/**
 * Build Storage Configuration Tests
 * 
 * Test scenarios from test-scenarios-v1.1.md:
 * - TC-F4-35: Presigned URL lifetimes from config
 * - TC-RET-08, TC-RET-09: Config values affect retention and size limits
 * - MiB constant verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  getBuildStorageConfig, 
  MiB, 
  FILE_SIZE_LIMITS,
  formatBytes 
} from '../config';

describe('MiB constant', () => {
  it('MiB = 1,048,576 bytes (1024 × 1024)', () => {
    expect(MiB).toBe(1024 * 1024);
    expect(MiB).toBe(1048576);
  });

  it('150 MiB = 157,286,400 bytes (WebGL 업로드 상한)', () => {
    expect(150 * MiB).toBe(157286400);
  });

  it('500 MiB = 524,288,000 bytes (PC 빌드/압축 해제 상한)', () => {
    expect(500 * MiB).toBe(524288000);
  });

  it('5 MiB = 5,242,880 bytes (이미지 상한)', () => {
    expect(5 * MiB).toBe(5242880);
  });
});

describe('getBuildStorageConfig - Default values', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TC-F4-08/09: WebGL 업로드 상한 기본값 150 MiB', () => {
    const config = getBuildStorageConfig();
    expect(config.upload.webglMaxSizeBytes).toBe(150 * MiB);
    expect(config.upload.webglMaxSizeBytes).toBe(157286400);
  });

  it('TC-F4-11/12: PC 빌드 상한 기본값 500 MiB', () => {
    const config = getBuildStorageConfig();
    expect(config.upload.pcMaxSizeBytes).toBe(500 * MiB);
    expect(config.upload.pcMaxSizeBytes).toBe(524288000);
  });

  it('TC-F4-27/28: 압축 해제 후 크기 상한 기본값 500 MiB', () => {
    const config = getBuildStorageConfig();
    expect(config.validation.webglMaxUncompressedBytes).toBe(500 * MiB);
    expect(config.validation.webglMaxUncompressedBytes).toBe(524288000);
  });

  it('TC-F4-29/30: 파일 수 상한 기본값 1,000개', () => {
    const config = getBuildStorageConfig();
    expect(config.validation.webglMaxFileCount).toBe(1000);
  });

  it('TC-F4-35: presigned URL 업로드 만료 시간 기본값 3,600초 (1시간)', () => {
    const config = getBuildStorageConfig();
    expect(config.presignedUrl.uploadExpirySeconds).toBe(3600);
  });

  it('TC-F4-35: presigned URL 다운로드 만료 시간 기본값 300초 (5분)', () => {
    const config = getBuildStorageConfig();
    expect(config.presignedUrl.downloadExpirySeconds).toBe(300);
  });

  it('TC-RET-01: 보관 정책 기본 활성화', () => {
    const config = getBuildStorageConfig();
    expect(config.retention.enabled).toBe(true);
  });

  it('TC-RET-01: WebGL 빌드 보관 개수 기본값 2개', () => {
    const config = getBuildStorageConfig();
    expect(config.retention.webglKeepLatest).toBe(2);
  });

  it('TC-RET-06: PC 빌드 보관 개수 기본값 1개', () => {
    const config = getBuildStorageConfig();
    expect(config.retention.pcKeepLatest).toBe(1);
  });

  it('TC-RET-04: 대표 빌드 보관 기본 활성화', () => {
    const config = getBuildStorageConfig();
    expect(config.retention.keepFeaturedBuild).toBe(true);
  });

  it('허용 확장자 설정', () => {
    const config = getBuildStorageConfig();
    expect(config.allowedExtensions.buildArchive).toContain('.zip');
    expect(config.allowedExtensions.buildArchive).toContain('.7z');
    expect(config.allowedExtensions.image).toContain('.png');
    expect(config.allowedExtensions.image).toContain('.jpg');
  });
});

describe('getBuildStorageConfig - Environment variable overrides', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TC-RET-09: BUILD_WEBGL_MAX_SIZE_MB 환경변수 오버라이드', () => {
    vi.stubEnv('BUILD_WEBGL_MAX_SIZE_MB', '100');
    const config = getBuildStorageConfig();
    expect(config.upload.webglMaxSizeBytes).toBe(100 * MiB);
  });

  it('BUILD_PC_MAX_SIZE_MB 환경변수 오버라이드', () => {
    vi.stubEnv('BUILD_PC_MAX_SIZE_MB', '1000');
    const config = getBuildStorageConfig();
    expect(config.upload.pcMaxSizeBytes).toBe(1000 * MiB);
  });

  it('BUILD_WEBGL_MAX_UNCOMPRESSED_MB 환경변수 오버라이드', () => {
    vi.stubEnv('BUILD_WEBGL_MAX_UNCOMPRESSED_MB', '250');
    const config = getBuildStorageConfig();
    expect(config.validation.webglMaxUncompressedBytes).toBe(250 * MiB);
  });

  it('BUILD_WEBGL_MAX_FILE_COUNT 환경변수 오버라이드', () => {
    vi.stubEnv('BUILD_WEBGL_MAX_FILE_COUNT', '500');
    const config = getBuildStorageConfig();
    expect(config.validation.webglMaxFileCount).toBe(500);
  });

  it('TC-F4-35: PRESIGNED_URL_UPLOAD_EXPIRY_SECONDS 환경변수 오버라이드', () => {
    vi.stubEnv('PRESIGNED_URL_UPLOAD_EXPIRY_SECONDS', '7200');
    const config = getBuildStorageConfig();
    expect(config.presignedUrl.uploadExpirySeconds).toBe(7200);
  });

  it('TC-F4-35: PRESIGNED_URL_DOWNLOAD_EXPIRY_SECONDS 환경변수 오버라이드', () => {
    vi.stubEnv('PRESIGNED_URL_DOWNLOAD_EXPIRY_SECONDS', '600');
    const config = getBuildStorageConfig();
    expect(config.presignedUrl.downloadExpirySeconds).toBe(600);
  });

  it('TC-RET-08: BUILD_RETENTION_WEBGL_KEEP 환경변수 오버라이드', () => {
    vi.stubEnv('BUILD_RETENTION_WEBGL_KEEP', '3');
    const config = getBuildStorageConfig();
    expect(config.retention.webglKeepLatest).toBe(3);
  });

  it('BUILD_RETENTION_PC_KEEP 환경변수 오버라이드', () => {
    vi.stubEnv('BUILD_RETENTION_PC_KEEP', '2');
    const config = getBuildStorageConfig();
    expect(config.retention.pcKeepLatest).toBe(2);
  });

  it('BUILD_RETENTION_ENABLED=false 비활성화', () => {
    vi.stubEnv('BUILD_RETENTION_ENABLED', 'false');
    const config = getBuildStorageConfig();
    expect(config.retention.enabled).toBe(false);
  });

  it('BUILD_RETENTION_KEEP_FEATURED=false 대표 빌드 미보관', () => {
    vi.stubEnv('BUILD_RETENTION_KEEP_FEATURED', 'false');
    const config = getBuildStorageConfig();
    expect(config.retention.keepFeaturedBuild).toBe(false);
  });

  it('잘못된 숫자 값은 기본값 사용', () => {
    vi.stubEnv('BUILD_WEBGL_MAX_SIZE_MB', 'invalid');
    const config = getBuildStorageConfig();
    expect(config.upload.webglMaxSizeBytes).toBe(150 * MiB);
  });
});

describe('FILE_SIZE_LIMITS', () => {
  it('WEBGL_BUILD는 config에서 동적으로 가져옴', () => {
    expect(FILE_SIZE_LIMITS.WEBGL_BUILD).toBe(150 * MiB);
  });

  it('PC_BUILD는 config에서 동적으로 가져옴', () => {
    expect(FILE_SIZE_LIMITS.PC_BUILD).toBe(500 * MiB);
  });

  it('PROJECT_IMAGE는 5 MiB', () => {
    expect(FILE_SIZE_LIMITS.PROJECT_IMAGE).toBe(5 * MiB);
  });

  it('BUG_SCREENSHOT는 5 MiB', () => {
    expect(FILE_SIZE_LIMITS.BUG_SCREENSHOT).toBe(5 * MiB);
  });

  it('ATTACHMENT는 20 MiB', () => {
    expect(FILE_SIZE_LIMITS.ATTACHMENT).toBe(20 * MiB);
  });

  it('AVATAR는 2 MiB', () => {
    expect(FILE_SIZE_LIMITS.AVATAR).toBe(2 * MiB);
  });
});

describe('formatBytes', () => {
  it('0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('bytes (< 1 KiB)', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
  });

  it('KiB', () => {
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatBytes(1536)).toBe('1.5 KiB');
  });

  it('MiB', () => {
    expect(formatBytes(MiB)).toBe('1 MiB');
    expect(formatBytes(150 * MiB)).toBe('150 MiB');
    expect(formatBytes(500 * MiB)).toBe('500 MiB');
  });

  it('GiB', () => {
    expect(formatBytes(1024 * MiB)).toBe('1 GiB');
  });

  it('상한 경계값 포맷', () => {
    expect(formatBytes(157286400)).toBe('150 MiB');  // WebGL 상한
    expect(formatBytes(524288000)).toBe('500 MiB');  // PC/압축해제 상한
    expect(formatBytes(157286401)).toBe('150 MiB');  // cap+1 (반올림)
    expect(formatBytes(524288001)).toBe('500 MiB');  // cap+1 (반올림)
  });
});

describe('TC-F4-42: Cleanup configuration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('방치된 업로드 만료 시간 기본값 24시간', () => {
    const config = getBuildStorageConfig();
    expect(config.cleanup.orphanedUploadMaxAgeMs).toBe(24 * 60 * 60 * 1000);
  });

  it('검증 만료 시간 기본값 24시간', () => {
    const config = getBuildStorageConfig();
    expect(config.cleanup.validationExpiryMs).toBe(24 * 60 * 60 * 1000);
  });

  it('환경 변수로 오버라이드 가능', () => {
    vi.stubEnv('CLEANUP_ORPHANED_UPLOAD_MAX_AGE_HOURS', '48');
    vi.stubEnv('CLEANUP_VALIDATION_EXPIRY_HOURS', '12');
    
    const config = getBuildStorageConfig();
    expect(config.cleanup.orphanedUploadMaxAgeMs).toBe(48 * 60 * 60 * 1000);
    expect(config.cleanup.validationExpiryMs).toBe(12 * 60 * 60 * 1000);
  });
});
