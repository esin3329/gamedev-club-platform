/**
 * 빌드 등록 API
 * 
 * POST /api/builds/register
 * 
 * 브라우저에서 R2로 업로드 완료 후 호출됩니다.
 * 
 * WebGL 빌드 처리 방식 (Cloudflare Workers 10ms CPU 제한 준수):
 * 1. 검증: R2 ranged reads로 zip central directory만 읽어서 검증
 *    - index.html 존재 여부
 *    - 압축 해제 후 총 크기 (zip-bomb 방지)
 *    - 파일 수 제한
 * 2. 추출: 클라이언트에서 수행 (Worker에서 150MB zip 압축 해제 불가)
 *    - 클라이언트가 zip 해제 후 개별 파일을 presigned URL로 업로드
 *    - 또는 zip을 그대로 저장하고 Cloudflare Worker로 on-demand 서빙
 * 
 * PC 빌드: 메타데이터만 DB 등록 (zip 그대로 저장)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  getStorageClient, 
  getBuildStorageConfig, 
  formatBytes,
  cleanupOldBuilds,
} from '@/lib/storage/r2';
import { 
  validateWebGLZip,
} from '@/lib/storage/webgl-validator';
import {
  getR2BindingClient,
} from '@/lib/storage/r2-binding';

interface RegisterRequest {
  projectId: string;
  buildId: string;
  buildType: 'webgl' | 'pc';
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  storageKey: string;
  fileSize: number;
  /** WebGL: 클라이언트가 zip을 해제하고 개별 파일 업로드 완료 여부 */
  extractedByClient?: boolean;
  /** WebGL: 클라이언트가 업로드한 파일 수 */
  fileCount?: number;
  /** WebGL: 클라이언트가 계산한 총 크기 */
  totalSize?: number;
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
        { error: '활성 회원만 빌드를 등록할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body: RegisterRequest = await request.json();
    const { 
      projectId, 
      buildId, 
      buildType, 
      version, 
      releaseNotes, 
      testRequest,
      storageKey, 
      fileSize,
      extractedByClient,
      fileCount,
      totalSize,
    } = body;

    if (!projectId || !buildId || !buildType || !version || !storageKey) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: '프로젝트 팀원만 빌드를 등록할 수 있습니다.' },
        { status: 403 }
      );
    }

    const storage = getStorageClient();
    const config = getBuildStorageConfig();

    if (buildType === 'webgl') {
      if (extractedByClient) {
        // 클라이언트가 이미 zip을 해제하고 개별 파일을 업로드한 경우
        return await handleWebGLClientExtracted({
          supabase,
          storage,
          userId: user.id,
          projectId,
          buildId,
          version,
          releaseNotes,
          testRequest,
          fileCount: fileCount || 0,
          totalSize: totalSize || 0,
        });
      } else {
        // zip 검증만 수행 (클라이언트가 추출해야 함)
        return await handleWebGLValidation({
          supabase,
          storage,
          config,
          projectId,
          buildId,
          storageKey,
          fileSize,
        });
      }
    } else {
      return await handlePCRegistration({
        supabase,
        userId: user.id,
        projectId,
        buildId,
        version,
        releaseNotes,
        testRequest,
        storageKey,
        fileSize,
      });
    }

  } catch (error) {
    console.error('Build registration error:', error);
    return NextResponse.json(
      { error: '빌드 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * WebGL zip 검증 (R2 ranged reads 사용)
 * Worker의 10ms CPU 제한을 준수하기 위해 central directory만 읽음
 */
async function handleWebGLValidation({
  supabase,
  storage,
  config,
  projectId,
  buildId,
  storageKey,
  fileSize,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  storage: ReturnType<typeof getStorageClient>;
  config: ReturnType<typeof getBuildStorageConfig>;
  projectId: string;
  buildId: string;
  storageKey: string;
  fileSize: number;
}) {
  const r2Binding = getR2BindingClient();
  
  let validation;
  
  if (r2Binding) {
    // R2 바인딩 사용 시 ranged reads로 검증 (권장)
    // 현재는 작은 파일만 지원, 큰 파일은 클라이언트 사이드 검증 필요
    const zipUrl = await storage.getDownloadPresignedUrl(
      storageKey, 
      config.presignedUrl.downloadExpirySeconds
    );
    const response = await fetch(zipUrl.url, {
      headers: { 'Range': `bytes=${Math.max(0, fileSize - 66000)}-${fileSize - 1}` },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: '업로드된 파일을 찾을 수 없습니다. 다시 업로드해주세요.' },
        { status: 404 }
      );
    }
    
    // 작은 zip (< 5MB)만 서버에서 검증
    if (fileSize < 5 * 1024 * 1024) {
      const fullResponse = await fetch(zipUrl.url);
      const zipBuffer = await fullResponse.arrayBuffer();
      validation = await validateWebGLZip(
        zipBuffer,
        config.validation.webglMaxUncompressedBytes,
        config.validation.webglMaxFileCount
      );
    } else {
      // 큰 파일은 클라이언트가 검증해야 함
      return NextResponse.json({
        requireClientValidation: true,
        message: '파일이 너무 커서 클라이언트에서 검증해야 합니다.',
        limits: {
          maxUncompressedSize: config.validation.webglMaxUncompressedBytes,
          maxUncompressedSizeFormatted: formatBytes(config.validation.webglMaxUncompressedBytes),
          maxFileCount: config.validation.webglMaxFileCount,
        },
      });
    }
  } else {
    // 폴백: presigned URL로 전체 파일 다운로드 (작은 파일만)
    if (fileSize > 5 * 1024 * 1024) {
      return NextResponse.json({
        requireClientValidation: true,
        message: '파일이 너무 커서 클라이언트에서 검증해야 합니다.',
        limits: {
          maxUncompressedSize: config.validation.webglMaxUncompressedBytes,
          maxUncompressedSizeFormatted: formatBytes(config.validation.webglMaxUncompressedBytes),
          maxFileCount: config.validation.webglMaxFileCount,
        },
      });
    }
    
    const zipUrl = await storage.getDownloadPresignedUrl(
      storageKey,
      config.presignedUrl.downloadExpirySeconds
    );
    const response = await fetch(zipUrl.url);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: '업로드된 파일을 찾을 수 없습니다. 다시 업로드해주세요.' },
        { status: 404 }
      );
    }
    
    const zipBuffer = await response.arrayBuffer();
    validation = await validateWebGLZip(
      zipBuffer,
      config.validation.webglMaxUncompressedBytes,
      config.validation.webglMaxFileCount
    );
  }

  if (!validation.valid) {
    await storage.deleteBuild(storageKey);
    
    return NextResponse.json(
      { 
        error: validation.error,
        errorCode: validation.errorCode,
      },
      { status: 400 }
    );
  }

  // 검증 성공: 클라이언트가 추출 후 다시 등록해야 함
  return NextResponse.json({
    validated: true,
    requireExtraction: true,
    message: '검증 성공. 클라이언트에서 zip을 추출하여 개별 파일을 업로드해주세요.',
    validation: {
      indexHtmlPath: validation.indexHtmlPath,
      basePath: validation.basePath,
      fileCount: validation.fileCount,
      totalUncompressedSize: validation.totalUncompressedSize,
      totalUncompressedSizeFormatted: formatBytes(validation.totalUncompressedSize),
    },
  });
}

/**
 * WebGL: 클라이언트가 zip 추출 후 개별 파일 업로드 완료
 */
async function handleWebGLClientExtracted({
  supabase,
  storage,
  userId,
  projectId,
  buildId,
  version,
  releaseNotes,
  testRequest,
  fileCount,
  totalSize,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  storage: ReturnType<typeof getStorageClient>;
  userId: string;
  projectId: string;
  buildId: string;
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  fileCount: number;
  totalSize: number;
}) {
  // index.html 존재 확인
  const indexExists = await storage.fileExists(`webgl/${projectId}/${buildId}/index.html`);
  
  if (!indexExists) {
    return NextResponse.json(
      { 
        error: '빌드에 index.html이 필요합니다. 업로드된 파일을 확인해주세요.',
        errorCode: 'NO_INDEX_HTML',
      },
      { status: 400 }
    );
  }

  const { data: build, error: insertError } = await supabase
    .from('builds')
    .insert({
      id: buildId,
      project_id: projectId,
      version,
      build_type: 'webgl',
      release_notes: releaseNotes || null,
      test_request: testRequest || null,
      storage_key: `webgl/${projectId}/${buildId}/`,
      file_size: totalSize,
      uploader_id: userId,
    })
    .select()
    .single();

  if (insertError) {
    await storage.deleteWebGLBuild(projectId, buildId);
    throw insertError;
  }

  await runRetentionCleanup(supabase, projectId);

  const playUrl = storage.getWebGLPlayUrl(projectId, buildId);

  return NextResponse.json({
    success: true,
    build: {
      id: build.id,
      version: build.version,
      buildType: 'webgl',
      playUrl,
      fileCount,
      totalSize: formatBytes(totalSize),
    },
  });
}

async function handlePCRegistration({
  supabase,
  userId,
  projectId,
  buildId,
  version,
  releaseNotes,
  testRequest,
  storageKey,
  fileSize,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  projectId: string;
  buildId: string;
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  storageKey: string;
  fileSize: number;
}) {
  const { data: build, error: insertError } = await supabase
    .from('builds')
    .insert({
      id: buildId,
      project_id: projectId,
      version,
      build_type: 'pc',
      release_notes: releaseNotes || null,
      test_request: testRequest || null,
      storage_key: storageKey,
      file_size: fileSize,
      uploader_id: userId,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await runRetentionCleanup(supabase, projectId);

  return NextResponse.json({
    success: true,
    build: {
      id: build.id,
      version: build.version,
      buildType: 'pc',
      totalSize: formatBytes(fileSize),
    },
  });
}

async function runRetentionCleanup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('featured_build_id')
      .eq('id', projectId)
      .single();

    const { data: builds } = await supabase
      .from('builds')
      .select('id, version, build_type, storage_key, created_at')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (builds && builds.length > 0) {
      const buildInfos = builds.map(b => ({
        id: b.id,
        version: b.version,
        buildType: b.build_type as 'webgl' | 'pc',
        storageKey: b.storage_key,
        createdAt: new Date(b.created_at),
        isFeatured: b.id === project?.featured_build_id,
      }));

      const result = await cleanupOldBuilds(
        projectId,
        buildInfos,
        project?.featured_build_id || null
      );

      if (result.deletedBuilds.length > 0) {
        await supabase
          .from('builds')
          .update({ is_deleted: true })
          .in('id', result.deletedBuilds);
      }
    }
  } catch (error) {
    console.error('Retention cleanup error:', error);
  }
}
