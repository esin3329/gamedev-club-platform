/**
 * 빌드 등록 API
 * 
 * POST /api/builds/register
 * 
 * WebGL 빌드 처리 플로우 (보안 우선):
 * 
 * 1. 초기 검증 (action: 'validate')
 *    - 클라이언트가 zip을 R2에 업로드 완료 후 호출
 *    - 서버가 R2 ranged reads로 central directory를 읽어 검증
 *    - index.html 존재, 파일 수/크기 제한 확인
 *    - 검증 통과 시 expectedFiles 목록 반환
 * 
 * 2. 파일 업로드 (클라이언트)
 *    - 클라이언트가 zip을 브라우저에서 추출
 *    - 개별 파일을 presigned URL로 R2에 업로드
 * 
 * 3. 등록 완료 (action: 'complete')
 *    - 클라이언트가 모든 파일 업로드 완료 후 호출
 *    - 서버가 R2에 업로드된 파일 세트를 검증
 *    - expectedFiles와 실제 업로드된 파일 비교 (이름, 크기)
 *    - 매칭되면 DB에 등록하고 playable로 표시
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
  validateWebGLZipFromR2,
  validateWebGLZip,
  type WebGLFileEntry,
} from '@/lib/storage/webgl-validator';
import {
  getR2BindingClient,
  getR2Binding,
} from '@/lib/storage/r2-binding';

interface ValidateRequest {
  action: 'validate';
  projectId: string;
  buildId: string;
  storageKey: string;
  fileSize: number;
}

interface CompleteRequest {
  action: 'complete';
  projectId: string;
  buildId: string;
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  /** 서버가 validate에서 반환한 expectedFiles */
  expectedFiles: ExpectedFile[];
}

interface PCRegisterRequest {
  action?: 'register';
  projectId: string;
  buildId: string;
  buildType: 'pc';
  version: string;
  releaseNotes?: string;
  testRequest?: string;
  storageKey: string;
  fileSize: number;
}

interface ExpectedFile {
  path: string;
  uncompressedSize: number;
}

type RegisterRequest = ValidateRequest | CompleteRequest | PCRegisterRequest;

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

    // PC 빌드 등록
    if ('buildType' in body && body.buildType === 'pc') {
      return await handlePCRegistration(supabase, user.id, body);
    }

    // WebGL: validate 액션
    if ('action' in body && body.action === 'validate') {
      return await handleWebGLValidate(supabase, user.id, body);
    }

    // WebGL: complete 액션
    if ('action' in body && body.action === 'complete') {
      return await handleWebGLComplete(supabase, user.id, body);
    }

    return NextResponse.json(
      { error: '유효하지 않은 요청입니다. action을 지정해주세요.' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Build registration error:', error);
    return NextResponse.json(
      { error: '빌드 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * WebGL zip 검증 (모든 크기의 zip에 대해 서버 사이드 검증)
 * R2 ranged reads로 central directory만 읽어서 검증
 */
async function handleWebGLValidate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: ValidateRequest
) {
  const { projectId, buildId, storageKey, fileSize } = body;

  if (!projectId || !buildId || !storageKey || !fileSize) {
    return NextResponse.json(
      { error: '필수 파라미터가 누락되었습니다.' },
      { status: 400 }
    );
  }

  // 프로젝트 팀원 확인
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
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
  const r2Bucket = getR2Binding();

  let validation;

  if (r2Bucket) {
    // R2 바인딩으로 ranged reads 검증 (Cloudflare Workers 환경)
    validation = await validateWebGLZipFromR2(
      r2Bucket,
      storageKey,
      fileSize
    );
  } else {
    // 폴백: presigned URL로 EOCD + Central Directory만 다운로드
    // Central Directory 크기는 파일 수에 비례 (최대 1000개 × ~100bytes ≈ 100KB)
    const eocdReadSize = Math.min(fileSize, 66000); // EOCD + comment
    
    const zipUrl = await storage.getDownloadPresignedUrl(storageKey);
    
    // 먼저 EOCD를 읽어서 CD 위치 파악
    const eocdResponse = await fetch(zipUrl.url, {
      headers: { 'Range': `bytes=${fileSize - eocdReadSize}-${fileSize - 1}` },
    });
    
    if (!eocdResponse.ok) {
      return NextResponse.json(
        { error: '업로드된 파일을 찾을 수 없습니다. 다시 업로드해주세요.' },
        { status: 404 }
      );
    }
    
    const eocdBuffer = await eocdResponse.arrayBuffer();
    
    // EOCD에서 CD 위치 추출 후 CD만 추가로 읽기
    // 간단히 전체 EOCD + CD를 포함하는 범위를 읽음 (최대 ~170KB for 1000 files)
    const maxCdSize = config.validation.webglMaxFileCount * 100 + 66000;
    const rangeStart = Math.max(0, fileSize - maxCdSize);
    
    const cdResponse = await fetch(zipUrl.url, {
      headers: { 'Range': `bytes=${rangeStart}-${fileSize - 1}` },
    });
    
    if (!cdResponse.ok) {
      return NextResponse.json(
        { error: 'zip 파일을 읽을 수 없습니다.' },
        { status: 500 }
      );
    }
    
    const cdBuffer = await cdResponse.arrayBuffer();
    
    // 부분 버퍼로 검증 (validateWebGLZip은 EOCD + CD가 있으면 동작)
    validation = await validateWebGLZip(
      cdBuffer,
      config.validation.webglMaxUncompressedBytes,
      config.validation.webglMaxFileCount
    );
  }

  if (!validation.valid) {
    // 검증 실패 시 업로드된 zip 삭제
    try {
      await storage.deleteBuild(storageKey);
    } catch {
      console.error('Failed to cleanup invalid zip');
    }
    
    return NextResponse.json(
      { 
        error: validation.error,
        errorCode: validation.errorCode,
      },
      { status: 400 }
    );
  }

  // 검증 성공: 클라이언트에게 expectedFiles 반환
  // 클라이언트는 이 목록에 맞게 파일을 추출하여 업로드해야 함
  const expectedFiles: ExpectedFile[] = validation.files.map(f => ({
    path: validation.basePath ? f.path.replace(validation.basePath, '') : f.path,
    uncompressedSize: f.uncompressedSize,
  }));

  return NextResponse.json({
    validated: true,
    buildId,
    indexHtmlPath: validation.indexHtmlPath,
    basePath: validation.basePath || '',
    fileCount: validation.fileCount,
    totalUncompressedSize: validation.totalUncompressedSize,
    totalUncompressedSizeFormatted: formatBytes(validation.totalUncompressedSize),
    expectedFiles,
    message: '검증 성공. zip을 추출하여 개별 파일을 업로드한 후 complete를 호출해주세요.',
  });
}

/**
 * WebGL 업로드 완료 검증 및 등록
 * R2에 업로드된 파일 세트를 expectedFiles와 비교
 */
async function handleWebGLComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: CompleteRequest
) {
  const { projectId, buildId, version, releaseNotes, testRequest, expectedFiles } = body;

  if (!projectId || !buildId || !version || !expectedFiles || expectedFiles.length === 0) {
    return NextResponse.json(
      { error: '필수 파라미터가 누락되었습니다.' },
      { status: 400 }
    );
  }

  // 프로젝트 팀원 확인
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
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
  const r2Binding = getR2BindingClient();
  
  const prefix = `webgl/${projectId}/${buildId}/`;

  // R2에 업로드된 파일 목록 조회
  let uploadedFiles: { key: string; size: number }[] = [];
  
  if (r2Binding) {
    const keys = await r2Binding.list(prefix);
    // 각 파일의 크기를 가져오기 위해 head 호출 필요
    // R2 바인딩의 list는 size를 포함하지 않으므로 별도 처리
    for (const key of keys) {
      const relativePath = key.replace(prefix, '');
      if (relativePath) {
        uploadedFiles.push({ key: relativePath, size: 0 }); // 크기는 아래에서 검증
      }
    }
  } else {
    // AWS SDK로 목록 조회
    const listed = await storage.listObjects(prefix);
    uploadedFiles = listed.map(obj => ({
      key: obj.key.replace(prefix, ''),
      size: obj.size,
    }));
  }

  // 1. index.html 존재 확인
  const hasIndexHtml = uploadedFiles.some(f => f.key.toLowerCase() === 'index.html');
  if (!hasIndexHtml) {
    return NextResponse.json(
      { 
        error: '빌드에 index.html이 필요합니다. 모든 파일이 업로드되었는지 확인해주세요.',
        errorCode: 'NO_INDEX_HTML',
      },
      { status: 400 }
    );
  }

  // 2. expectedFiles와 비교
  const expectedSet = new Map(expectedFiles.map(f => [f.path.toLowerCase(), f]));
  const uploadedSet = new Set(uploadedFiles.map(f => f.key.toLowerCase()));
  
  // 누락된 파일 확인
  const missingFiles: string[] = [];
  for (const expected of expectedFiles) {
    if (!uploadedSet.has(expected.path.toLowerCase())) {
      missingFiles.push(expected.path);
    }
  }
  
  if (missingFiles.length > 0) {
    const maxShow = 10;
    const shown = missingFiles.slice(0, maxShow);
    const moreCount = missingFiles.length - maxShow;
    
    return NextResponse.json(
      { 
        error: `일부 파일이 업로드되지 않았습니다: ${shown.join(', ')}${moreCount > 0 ? ` 외 ${moreCount}개` : ''}`,
        errorCode: 'MISSING_FILES',
        missingFiles: missingFiles.slice(0, 50),
      },
      { status: 400 }
    );
  }

  // 3. 예상치 못한 파일 확인 (보안)
  const unexpectedFiles: string[] = [];
  for (const uploaded of uploadedFiles) {
    if (!expectedSet.has(uploaded.key.toLowerCase())) {
      unexpectedFiles.push(uploaded.key);
    }
  }
  
  if (unexpectedFiles.length > 0) {
    const maxShow = 10;
    const shown = unexpectedFiles.slice(0, maxShow);
    const moreCount = unexpectedFiles.length - maxShow;
    
    return NextResponse.json(
      { 
        error: `예상치 못한 파일이 업로드되었습니다: ${shown.join(', ')}${moreCount > 0 ? ` 외 ${moreCount}개` : ''}`,
        errorCode: 'UNEXPECTED_FILES',
        unexpectedFiles: unexpectedFiles.slice(0, 50),
      },
      { status: 400 }
    );
  }

  // 4. 파일 수 제한 재확인
  if (uploadedFiles.length > config.validation.webglMaxFileCount) {
    return NextResponse.json(
      { 
        error: `파일 수가 제한을 초과합니다. (${uploadedFiles.length}개 / 최대 ${config.validation.webglMaxFileCount}개)`,
        errorCode: 'TOO_MANY_FILES',
      },
      { status: 400 }
    );
  }

  // 5. 총 크기 계산 및 제한 확인
  const totalSize = expectedFiles.reduce((sum, f) => sum + f.uncompressedSize, 0);
  
  if (totalSize > config.validation.webglMaxUncompressedBytes) {
    return NextResponse.json(
      { 
        error: `총 크기가 제한을 초과합니다. (${formatBytes(totalSize)} / 최대 ${formatBytes(config.validation.webglMaxUncompressedBytes)})`,
        errorCode: 'TOO_LARGE',
      },
      { status: 400 }
    );
  }

  // 6. DB에 등록
  const { data: build, error: insertError } = await supabase
    .from('builds')
    .insert({
      id: buildId,
      project_id: projectId,
      version,
      build_type: 'webgl',
      release_notes: releaseNotes || null,
      test_request: testRequest || null,
      storage_key: prefix,
      file_size: totalSize,
      uploader_id: userId,
    })
    .select()
    .single();

  if (insertError) {
    console.error('DB insert error:', insertError);
    // 실패 시 업로드된 파일 정리
    try {
      await storage.deleteWebGLBuild(projectId, buildId);
    } catch {
      console.error('Failed to cleanup uploaded files');
    }
    throw insertError;
  }

  // 7. 보관 정책 적용
  await runRetentionCleanup(supabase, projectId);

  // 8. 원본 zip 삭제 (있는 경우)
  try {
    await storage.deleteBuild(`uploads/${projectId}/${buildId}.zip`);
  } catch {
    // 원본 zip이 없을 수 있음
  }

  const playUrl = storage.getWebGLPlayUrl(projectId, buildId);

  return NextResponse.json({
    success: true,
    build: {
      id: build.id,
      version: build.version,
      buildType: 'webgl',
      playUrl,
      fileCount: uploadedFiles.length,
      totalSize: formatBytes(totalSize),
    },
  });
}

async function handlePCRegistration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: PCRegisterRequest
) {
  const { projectId, buildId, version, releaseNotes, testRequest, storageKey, fileSize } = body;

  if (!projectId || !buildId || !version || !storageKey) {
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
      { error: '프로젝트 팀원만 빌드를 등록할 수 있습니다.' },
      { status: 403 }
    );
  }

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
