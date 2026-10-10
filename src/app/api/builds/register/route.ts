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
 *    - 검증 결과를 DB에 저장 (pending_validations 테이블)
 *    - 검증 통과 시 expectedFiles 목록 반환
 * 
 * 2. 파일 업로드 (클라이언트)
 *    - 클라이언트가 zip을 브라우저에서 추출
 *    - 개별 파일을 presigned URL로 R2에 업로드
 * 
 * 3. 등록 완료 (action: 'complete')
 *    - 클라이언트가 모든 파일 업로드 완료 후 호출
 *    - 서버가 저장된 expectedFiles를 DB에서 조회 (클라이언트 입력 무시)
 *    - R2에 업로드된 파일의 실제 크기를 검증
 *    - 매칭되면 DB에 등록하고 playable로 표시
 * 
 * PC 빌드: 메타데이터만 DB 등록 (zip 그대로 저장)
 * 
 * Security Fixes (TC-F4-39+):
 * - expectedFiles stored server-side, not trusted from client
 * - Storage keys derived server-side, not from client
 * - Actual R2 file sizes compared against validated sizes
 * - Abandoned uploads cleaned up after 24h expiry
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
} from '@/lib/storage/webgl-validator';
import {
  getR2BindingClient,
  getR2Binding,
} from '@/lib/storage/r2-binding';

interface ValidateRequest {
  action: 'validate';
  projectId: string;
  buildId: string;
  fileSize: number;
}

interface CompleteRequest {
  action: 'complete';
  projectId: string;
  buildId: string;
  version: string;
  releaseNotes?: string;
  testRequest?: string;
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

/**
 * Derive the temp zip storage key server-side.
 * This prevents clients from pointing validation at another project's objects.
 */
function deriveTempZipKey(projectId: string, buildId: string): string {
  return `uploads/${projectId}/${buildId}.zip`;
}

/**
 * Validate that a storage key belongs to the expected project prefix.
 */
function validateStorageKeyPrefix(key: string, projectId: string): boolean {
  const expectedPrefix = `uploads/${projectId}/`;
  return key.startsWith(expectedPrefix);
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
 * 
 * Security: Storage key is derived server-side from projectId/buildId
 */
async function handleWebGLValidate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: ValidateRequest
) {
  const { projectId, buildId, fileSize } = body;

  if (!projectId || !buildId || !fileSize) {
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

  // Server-derived storage key (not from client)
  const tempStorageKey = deriveTempZipKey(projectId, buildId);

  const storage = getStorageClient();
  const config = getBuildStorageConfig();
  const r2Bucket = getR2Binding();

  let validation;

  if (r2Bucket) {
    // R2 바인딩으로 ranged reads 검증 (Cloudflare Workers 환경)
    validation = await validateWebGLZipFromR2(
      r2Bucket,
      tempStorageKey,
      fileSize
    );
  } else {
    // 폴백: presigned URL로 EOCD + Central Directory만 다운로드
    const eocdReadSize = Math.min(fileSize, 66000);
    
    const zipUrl = await storage.getDownloadPresignedUrl(tempStorageKey);
    
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
    
    validation = await validateWebGLZip(
      cdBuffer,
      config.validation.webglMaxUncompressedBytes,
      config.validation.webglMaxFileCount
    );
  }

  if (!validation.valid) {
    // 검증 실패 시 업로드된 zip 삭제 (server-derived key)
    try {
      await storage.deleteBuild(tempStorageKey);
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

  // Build expected files list with normalized paths
  const expectedFiles: ExpectedFile[] = validation.files.map(f => ({
    path: validation.basePath ? f.path.replace(validation.basePath, '') : f.path,
    uncompressedSize: f.uncompressedSize,
  }));

  // Store validation result server-side (not returned to client for re-submission)
  // Delete any existing pending validation for this buildId
  await supabase
    .from('pending_validations')
    .delete()
    .eq('build_id', buildId);

  const { error: insertError } = await supabase
    .from('pending_validations')
    .insert({
      build_id: buildId,
      project_id: projectId,
      user_id: userId,
      temp_storage_key: tempStorageKey,
      expected_files: expectedFiles,
      base_path: validation.basePath || null,
      file_count: validation.fileCount,
      total_uncompressed_size: validation.totalUncompressedSize,
      status: 'pending',
    });

  if (insertError) {
    console.error('Failed to store validation:', insertError);
    // Clean up the zip since we can't track it
    try {
      await storage.deleteBuild(tempStorageKey);
    } catch {
      console.error('Failed to cleanup zip after validation storage error');
    }
    return NextResponse.json(
      { error: '검증 결과를 저장하는데 실패했습니다.' },
      { status: 500 }
    );
  }

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
 * 
 * Security:
 * - Fetches expectedFiles from server-side storage (not from client)
 * - Compares actual R2 object sizes against validated sizes
 * - Uses server-derived storage key for cleanup
 */
async function handleWebGLComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: CompleteRequest
) {
  const { projectId, buildId, version, releaseNotes, testRequest } = body;

  if (!projectId || !buildId || !version) {
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

  // Atomically claim the validation record (single-use, TC-F4-46 replay prevention)
  // UPDATE with status='pending' filter ensures only one request can claim it
  const { data: claimedValidation, error: claimError } = await supabase
    .from('pending_validations')
    .update({ status: 'processing' })
    .eq('build_id', buildId)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (claimError || !claimedValidation) {
    // Check if validation exists but was already used
    const { data: existingValidation } = await supabase
      .from('pending_validations')
      .select('status')
      .eq('build_id', buildId)
      .eq('project_id', projectId)
      .single();

    if (existingValidation) {
      if (existingValidation.status === 'completed') {
        return NextResponse.json(
          { 
            error: '이 검증은 이미 완료되었습니다. 빌드가 이미 등록되었습니다.',
            errorCode: 'VALIDATION_ALREADY_USED',
          },
          { status: 409 }
        );
      }
      if (existingValidation.status === 'processing') {
        return NextResponse.json(
          { 
            error: '이 검증이 현재 처리 중입니다. 잠시 후 다시 시도해주세요.',
            errorCode: 'VALIDATION_IN_PROGRESS',
          },
          { status: 409 }
        );
      }
      if (existingValidation.status === 'expired') {
        return NextResponse.json(
          { 
            error: '검증이 만료되었습니다. 다시 업로드해주세요.',
            errorCode: 'VALIDATION_EXPIRED',
          },
          { status: 400 }
        );
      }
      if (existingValidation.status === 'failed') {
        return NextResponse.json(
          { 
            error: '이전 등록 시도가 실패했습니다. 다시 업로드해주세요.',
            errorCode: 'VALIDATION_FAILED',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: '유효한 검증 기록이 없습니다. validate를 먼저 호출해주세요.',
        errorCode: 'NO_PENDING_VALIDATION',
      },
      { status: 400 }
    );
  }

  // Alias for clarity in rest of function
  const pendingValidation = claimedValidation;

  // Check if validation has expired (even after claiming)
  if (new Date(pendingValidation.expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('pending_validations')
      .update({ status: 'expired' })
      .eq('id', pendingValidation.id);

    return NextResponse.json(
      { 
        error: '검증이 만료되었습니다. 다시 업로드해주세요.',
        errorCode: 'VALIDATION_EXPIRED',
      },
      { status: 400 }
    );
  }

  // Use server-stored expectedFiles (ignore any client-supplied ones)
  const expectedFiles: ExpectedFile[] = pendingValidation.expected_files as ExpectedFile[];
  const tempStorageKey = pendingValidation.temp_storage_key;

  const storage = getStorageClient();
  const config = getBuildStorageConfig();
  const r2Binding = getR2BindingClient();
  const r2Bucket = getR2Binding();
  
  const prefix = `webgl/${projectId}/${buildId}/`;

  // R2에 업로드된 파일 목록 조회 (with actual sizes)
  let uploadedFiles: { key: string; size: number }[] = [];
  
  if (r2Bucket) {
    // R2 binding list() returns objects with size
    let cursor: string | undefined;
    do {
      const result = await r2Bucket.list({ prefix, cursor });
      for (const obj of result.objects) {
        const relativePath = obj.key.replace(prefix, '');
        if (relativePath) {
          uploadedFiles.push({ key: relativePath, size: obj.size });
        }
      }
      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);
  } else {
    // AWS SDK로 목록 조회 (already returns size)
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

  // 2. Build lookup maps for comparison
  const expectedMap = new Map(expectedFiles.map(f => [f.path.toLowerCase(), f]));
  const uploadedMap = new Map(uploadedFiles.map(f => [f.key.toLowerCase(), f]));
  
  // 3. Check for missing files
  const missingFiles: string[] = [];
  for (const expected of expectedFiles) {
    if (!uploadedMap.has(expected.path.toLowerCase())) {
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

  // 4. Check for unexpected files (security)
  const unexpectedFiles: string[] = [];
  for (const uploaded of uploadedFiles) {
    if (!expectedMap.has(uploaded.key.toLowerCase())) {
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

  // 5. Verify actual file sizes match validated uncompressed sizes
  // Extracted file sizes are deterministic — require exact match
  const sizeMismatches: { path: string; expected: number; actual: number }[] = [];
  let totalActualSize = 0;

  for (const uploaded of uploadedFiles) {
    const expected = expectedMap.get(uploaded.key.toLowerCase());
    if (expected) {
      totalActualSize += uploaded.size;
      
      if (uploaded.size !== expected.uncompressedSize) {
        sizeMismatches.push({
          path: uploaded.key,
          expected: expected.uncompressedSize,
          actual: uploaded.size,
        });
      }
    }
  }

  if (sizeMismatches.length > 0) {
    const maxShow = 5;
    const shown = sizeMismatches.slice(0, maxShow).map(m => 
      `${m.path}: expected ${formatBytes(m.expected)}, got ${formatBytes(m.actual)}`
    );
    
    return NextResponse.json(
      { 
        error: `파일 크기가 검증된 값과 다릅니다: ${shown.join('; ')}${sizeMismatches.length > maxShow ? ` 외 ${sizeMismatches.length - maxShow}개` : ''}`,
        errorCode: 'SIZE_MISMATCH',
      },
      { status: 400 }
    );
  }

  // 6. Enforce total size cap on actual uploaded bytes
  if (totalActualSize > config.validation.webglMaxUncompressedBytes) {
    return NextResponse.json(
      { 
        error: `총 업로드 크기가 제한을 초과합니다. (${formatBytes(totalActualSize)} / 최대 ${formatBytes(config.validation.webglMaxUncompressedBytes)})`,
        errorCode: 'TOO_LARGE',
      },
      { status: 400 }
    );
  }

  // 7. File count re-check
  if (uploadedFiles.length > config.validation.webglMaxFileCount) {
    return NextResponse.json(
      { 
        error: `파일 수가 제한을 초과합니다. (${uploadedFiles.length}개 / 최대 ${config.validation.webglMaxFileCount}개)`,
        errorCode: 'TOO_MANY_FILES',
      },
      { status: 400 }
    );
  }

  // 8. DB에 등록
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
      file_size: totalActualSize,
      uploader_id: userId,
    })
    .select()
    .single();

  if (insertError) {
    console.error('DB insert error:', insertError);
    // Mark validation as failed
    await supabase
      .from('pending_validations')
      .update({ status: 'failed' })
      .eq('id', pendingValidation.id);
    
    // Clean up uploaded files
    try {
      if (r2Binding) {
        await r2Binding.deleteWebGLBuild(projectId, buildId);
      } else {
        await storage.deleteWebGLBuild(projectId, buildId);
      }
    } catch {
      console.error('Failed to cleanup uploaded files');
    }
    throw insertError;
  }

  // 9. Mark validation as completed
  await supabase
    .from('pending_validations')
    .update({ status: 'completed' })
    .eq('id', pendingValidation.id);

  // 10. 보관 정책 적용
  await runRetentionCleanup(supabase, projectId);

  // 11. 원본 zip 삭제 (server-derived key)
  try {
    await storage.deleteBuild(tempStorageKey);
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
      totalSize: formatBytes(totalActualSize),
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

  // Validate that storageKey belongs to this project
  const expectedPrefix = `pc/${projectId}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: '잘못된 스토리지 키입니다.' },
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
