/**
 * 빌드 다운로드 presigned URL 발급 API
 * 
 * GET /api/builds/[id]/download
 * 
 * PC 빌드 다운로드를 위한 짧은 만료 시간의 presigned URL을 발급합니다.
 * 인증된 활성 회원만 다운로드할 수 있습니다.
 * 
 * PRD v1.1 D-05: PC 빌드는 비공개 버킷에 저장되며,
 * 로그인된 사용자에게만 presigned URL을 발급합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageClient, getBuildStorageConfig } from '@/lib/storage/r2';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const buildId = params.id;

    if (!buildId) {
      return NextResponse.json(
        { error: '빌드 ID가 필요합니다.' },
        { status: 400 }
      );
    }

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
        { error: '활성 회원만 빌드를 다운로드할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { data: build, error: buildError } = await supabase
      .from('builds')
      .select(`
        id,
        version,
        build_type,
        storage_key,
        file_size,
        project_id,
        is_deleted,
        projects!inner (
          id,
          name
        )
      `)
      .eq('id', buildId)
      .single();

    if (buildError || !build) {
      return NextResponse.json(
        { error: '빌드를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (build.is_deleted) {
      return NextResponse.json(
        { error: '삭제된 빌드입니다.' },
        { status: 410 }
      );
    }

    if (build.build_type === 'webgl') {
      const storage = getStorageClient();
      const playUrl = storage.getWebGLPlayUrl(build.project_id, build.id);
      
      return NextResponse.json({
        buildId: build.id,
        version: build.version,
        buildType: 'webgl',
        playUrl,
        message: 'WebGL 빌드는 브라우저에서 직접 플레이합니다.',
      });
    }

    if (!build.storage_key) {
      return NextResponse.json(
        { error: '빌드 파일이 존재하지 않습니다.' },
        { status: 404 }
      );
    }

    const config = getBuildStorageConfig();
    const storage = getStorageClient();
    
    const result = await storage.getDownloadPresignedUrl(
      build.storage_key,
      config.presignedUrl.downloadExpirySeconds
    );

    const { error: updateError } = await supabase
      .from('builds')
      .update({ 
        download_count: (build as unknown as { download_count?: number }).download_count 
          ? (build as unknown as { download_count: number }).download_count + 1 
          : 1 
      })
      .eq('id', buildId);

    if (updateError) {
      console.warn('다운로드 카운트 업데이트 실패:', updateError);
    }

    return NextResponse.json({
      buildId: build.id,
      version: build.version,
      buildType: build.build_type,
      downloadUrl: result.url,
      expiresAt: result.expiresAt.toISOString(),
      fileSize: build.file_size,
      projectName: (build.projects as unknown as { name: string }).name,
    });

  } catch (error) {
    console.error('Download URL generation error:', error);
    return NextResponse.json(
      { error: '다운로드 URL 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
