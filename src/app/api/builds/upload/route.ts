/**
 * 빌드 업로드 presigned URL 발급 API
 * 
 * POST /api/builds/upload
 * 
 * 브라우저에서 R2로 직접 업로드하기 위한 presigned URL을 발급합니다.
 * Vercel의 요청 크기 제한(4.5MB/50MB)을 우회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageClient, getBuildStorageConfig, formatBytes } from '@/lib/storage/r2';

interface UploadRequest {
  projectId: string;
  buildId: string;
  buildType: 'webgl' | 'pc';
  filename: string;
  contentType: string;
  fileSizeBytes: number;
}

interface WebGLFileRequest {
  projectId: string;
  buildId: string;
  relativePath: string;
  contentType: string;
  contentEncoding?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status !== 'active') {
      return NextResponse.json(
        { error: '활성 회원만 빌드를 업로드할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const isWebGLFile = 'relativePath' in body;

    if (isWebGLFile) {
      return handleWebGLFileUpload(body as WebGLFileRequest, user.id, supabase);
    } else {
      return handleBuildUpload(body as UploadRequest, user.id, supabase);
    }
  } catch (error) {
    console.error('Upload URL generation error:', error);
    return NextResponse.json(
      { error: '업로드 URL 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

async function handleBuildUpload(
  body: UploadRequest,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { projectId, buildId, buildType, filename, contentType, fileSizeBytes } = body;

  if (!projectId || !buildId || !buildType || !filename || !contentType || !fileSizeBytes) {
    return NextResponse.json(
      { error: '필수 파라미터가 누락되었습니다.' },
      { status: 400 }
    );
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .is('left_at', null)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: '프로젝트 팀원만 빌드를 업로드할 수 있습니다.' },
      { status: 403 }
    );
  }

  const config = getBuildStorageConfig();
  const maxSize = buildType === 'webgl' 
    ? config.upload.webglMaxSizeBytes 
    : config.upload.pcMaxSizeBytes;

  if (fileSizeBytes > maxSize) {
    return NextResponse.json(
      { 
        error: `파일 크기가 제한을 초과합니다.`,
        details: {
          maxSize: formatBytes(maxSize),
          actualSize: formatBytes(fileSizeBytes),
        }
      },
      { status: 413 }
    );
  }

  const allowedExtensions = config.allowedExtensions.buildArchive;
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (!allowedExtensions.includes(ext)) {
    return NextResponse.json(
      { 
        error: `허용되지 않는 파일 형식입니다.`,
        details: {
          allowed: allowedExtensions,
          actual: ext,
        }
      },
      { status: 400 }
    );
  }

  const storage = getStorageClient();
  const result = await storage.getUploadPresignedUrl(
    projectId,
    buildId,
    buildType,
    filename,
    contentType,
    fileSizeBytes
  );

  return NextResponse.json({
    uploadUrl: result.url,
    storageKey: result.key,
    expiresAt: result.expiresAt.toISOString(),
    limits: {
      maxWebglSize: formatBytes(config.upload.webglMaxSizeBytes),
      maxPcSize: formatBytes(config.upload.pcMaxSizeBytes),
    },
  });
}

async function handleWebGLFileUpload(
  body: WebGLFileRequest,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { projectId, buildId, relativePath, contentType, contentEncoding } = body;

  if (!projectId || !buildId || !relativePath || !contentType) {
    return NextResponse.json(
      { error: '필수 파라미터가 누락되었습니다.' },
      { status: 400 }
    );
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .is('left_at', null)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: '프로젝트 팀원만 빌드를 업로드할 수 있습니다.' },
      { status: 403 }
    );
  }

  const storage = getStorageClient();
  const result = await storage.getWebGLFileUploadUrl(
    projectId,
    buildId,
    relativePath,
    contentType,
    contentEncoding
  );

  return NextResponse.json({
    uploadUrl: result.url,
    storageKey: result.key,
    expiresAt: result.expiresAt.toISOString(),
  });
}

/**
 * GET: 현재 업로드 제한 정보 조회
 */
export async function GET() {
  const config = getBuildStorageConfig();
  
  return NextResponse.json({
    limits: {
      webgl: {
        maxSize: formatBytes(config.upload.webglMaxSizeBytes),
        maxSizeBytes: config.upload.webglMaxSizeBytes,
      },
      pc: {
        maxSize: formatBytes(config.upload.pcMaxSizeBytes),
        maxSizeBytes: config.upload.pcMaxSizeBytes,
      },
    },
    allowedExtensions: config.allowedExtensions.buildArchive,
    retention: {
      enabled: config.retention.enabled,
      webglKeepLatest: config.retention.webglKeepLatest,
      pcKeepLatest: config.retention.pcKeepLatest,
      keepFeaturedBuild: config.retention.keepFeaturedBuild,
    },
  });
}
