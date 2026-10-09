/**
 * 빌드 등록 API
 * 
 * POST /api/builds/register
 * 
 * 브라우저에서 R2로 zip 업로드 완료 후 호출됩니다.
 * WebGL 빌드: zip 검증 → 추출 → R2 업로드 → DB 등록
 * PC 빌드: 메타데이터만 DB 등록
 * 
 * WebGL zip 검증 실패 시 업로드된 파일을 삭제하고 에러를 반환합니다.
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
  extractWebGLFiles,
  type WebGLFileInfo,
} from '@/lib/storage/webgl-validator';

interface RegisterRequest {
  projectId: string;
  buildId: string;
  buildType: 'webgl' | 'pc';
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  storageKey: string;
  fileSize: number;
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
      fileSize 
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
      return await handleWebGLRegistration({
        supabase,
        storage,
        config,
        userId: user.id,
        projectId,
        buildId,
        version,
        releaseNotes,
        testRequest,
        storageKey,
        fileSize,
      });
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

async function handleWebGLRegistration({
  supabase,
  storage,
  config,
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
  storage: ReturnType<typeof getStorageClient>;
  config: ReturnType<typeof getBuildStorageConfig>;
  userId: string;
  projectId: string;
  buildId: string;
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  storageKey: string;
  fileSize: number;
}) {
  try {
    const zipUrl = await storage.getDownloadPresignedUrl(storageKey, 600);
    const zipResponse = await fetch(zipUrl.url);
    
    if (!zipResponse.ok) {
      return NextResponse.json(
        { error: '업로드된 파일을 찾을 수 없습니다. 다시 업로드해주세요.' },
        { status: 404 }
      );
    }

    const zipBuffer = await zipResponse.arrayBuffer();
    
    const validation = await validateWebGLZip(
      zipBuffer,
      config.upload.webglMaxSizeBytes * 2
    );

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

    const uploadedFiles: string[] = [];
    let totalUploadedSize = 0;

    try {
      await extractWebGLFiles(
        zipBuffer,
        validation.basePath || '',
        async (path: string, content: Uint8Array, info: WebGLFileInfo) => {
          const presigned = await storage.getWebGLFileUploadUrl(
            projectId,
            buildId,
            path,
            info.contentType,
            info.contentEncoding
          );

          const uploadResponse = await fetch(presigned.url, {
            method: 'PUT',
            body: content.buffer as ArrayBuffer,
            headers: {
              'Content-Type': info.contentType,
              ...(info.contentEncoding && { 'Content-Encoding': info.contentEncoding }),
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${path}: ${uploadResponse.status}`);
          }

          uploadedFiles.push(presigned.key);
          totalUploadedSize += content.length;
        }
      );

    } catch (uploadError) {
      for (const key of uploadedFiles) {
        try {
          await storage.deleteBuild(key);
        } catch {
          console.error(`Failed to cleanup ${key}`);
        }
      }
      
      await storage.deleteBuild(storageKey);
      
      throw uploadError;
    }

    await storage.deleteBuild(storageKey);

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
        file_size: totalUploadedSize,
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
        fileCount: uploadedFiles.length,
        totalSize: formatBytes(totalUploadedSize),
      },
    });

  } catch (error) {
    console.error('WebGL registration error:', error);
    
    try {
      await storage.deleteBuild(storageKey);
    } catch {
      console.error('Failed to cleanup original zip');
    }
    
    throw error;
  }
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
