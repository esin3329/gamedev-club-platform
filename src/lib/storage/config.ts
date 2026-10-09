/**
 * 빌드 스토리지 설정
 * 
 * 모든 값은 서버 사이드 설정으로 관리됩니다.
 * 환경 변수로 오버라이드 가능하며, 코드 수정 없이 변경할 수 있습니다.
 * 
 * 크기 단위: MB는 MiB (1,048,576 bytes = 1024 * 1024 bytes)를 의미합니다.
 * 이는 바이너리 기반 저장소에서 일반적으로 사용하는 단위입니다.
 * 
 * 향후 Supabase settings 테이블로 마이그레이션하여
 * 운영진이 UI에서 변경할 수 있도록 확장 가능합니다.
 */

/** 1 MiB in bytes (1024 * 1024 = 1,048,576) */
export const MiB = 1024 * 1024;

export interface BuildStorageConfig {
  upload: {
    /** WebGL zip 파일 최대 크기 (bytes). 기본값: 150 MiB */
    webglMaxSizeBytes: number;
    /** PC 빌드 파일 최대 크기 (bytes). 기본값: 500 MiB */
    pcMaxSizeBytes: number;
  };
  validation: {
    /** 
     * WebGL zip 압축 해제 후 총 크기 제한 (bytes). 기본값: 500 MiB
     * zip-bomb 방지용. Central directory의 uncompressed size 합계로 검증.
     */
    webglMaxUncompressedBytes: number;
    /** 
     * WebGL zip 내 최대 파일 수. 기본값: 1000
     * zip-bomb 방지 및 처리 시간 제한용.
     */
    webglMaxFileCount: number;
  };
  retention: {
    /** 보관 정책 활성화 여부. 기본값: true */
    enabled: boolean;
    /** WebGL 빌드 보관 개수. 기본값: 2 */
    webglKeepLatest: number;
    /** PC 빌드 보관 개수. 기본값: 1 */
    pcKeepLatest: number;
    /** 대표 빌드 보관 여부. 기본값: true */
    keepFeaturedBuild: boolean;
  };
  presignedUrl: {
    /** 업로드용 presigned URL 만료 시간 (초). 기본값: 3600 (1시간) */
    uploadExpirySeconds: number;
    /** 다운로드용 presigned URL 만료 시간 (초). 기본값: 300 (5분) */
    downloadExpirySeconds: number;
  };
  allowedExtensions: {
    buildArchive: string[];
    image: string[];
  };
}

function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function getBuildStorageConfig(): BuildStorageConfig {
  return {
    upload: {
      // BUILD_WEBGL_MAX_SIZE_MB: WebGL zip 최대 크기 (MiB 단위)
      webglMaxSizeBytes: parseEnvInt(
        process.env.BUILD_WEBGL_MAX_SIZE_MB, 
        150  // 기본값: 150 MiB
      ) * MiB,
      
      // BUILD_PC_MAX_SIZE_MB: PC 빌드 최대 크기 (MiB 단위)
      pcMaxSizeBytes: parseEnvInt(
        process.env.BUILD_PC_MAX_SIZE_MB, 
        500  // 기본값: 500 MiB
      ) * MiB,
    },
    
    validation: {
      // BUILD_WEBGL_MAX_UNCOMPRESSED_MB: 압축 해제 후 총 크기 제한 (MiB 단위)
      // zip-bomb 방지. 실제 압축 해제 없이 central directory에서 검증.
      webglMaxUncompressedBytes: parseEnvInt(
        process.env.BUILD_WEBGL_MAX_UNCOMPRESSED_MB,
        500  // 기본값: 500 MiB
      ) * MiB,
      
      // BUILD_WEBGL_MAX_FILE_COUNT: zip 내 최대 파일 수
      webglMaxFileCount: parseEnvInt(
        process.env.BUILD_WEBGL_MAX_FILE_COUNT,
        1000  // 기본값: 1000개
      ),
    },
    
    retention: {
      // BUILD_RETENTION_ENABLED: 보관 정책 활성화
      enabled: parseEnvBool(
        process.env.BUILD_RETENTION_ENABLED, 
        true  // 기본값: 활성화
      ),
      
      // BUILD_RETENTION_WEBGL_KEEP: WebGL 빌드 보관 개수
      webglKeepLatest: parseEnvInt(
        process.env.BUILD_RETENTION_WEBGL_KEEP, 
        2  // 기본값: 최신 2개
      ),
      
      // BUILD_RETENTION_PC_KEEP: PC 빌드 보관 개수
      pcKeepLatest: parseEnvInt(
        process.env.BUILD_RETENTION_PC_KEEP, 
        1  // 기본값: 최신 1개
      ),
      
      // BUILD_RETENTION_KEEP_FEATURED: 대표 빌드 보관
      keepFeaturedBuild: parseEnvBool(
        process.env.BUILD_RETENTION_KEEP_FEATURED, 
        true  // 기본값: 대표 빌드 유지
      ),
    },
    
    presignedUrl: {
      // PRESIGNED_URL_UPLOAD_EXPIRY_SECONDS: 업로드 URL 만료 시간
      uploadExpirySeconds: parseEnvInt(
        process.env.PRESIGNED_URL_UPLOAD_EXPIRY_SECONDS,
        3600  // 기본값: 1시간 (3600초)
      ),
      // PRESIGNED_URL_DOWNLOAD_EXPIRY_SECONDS: 다운로드 URL 만료 시간
      downloadExpirySeconds: parseEnvInt(
        process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY_SECONDS,
        300  // 기본값: 5분 (300초)
      ),
    },
    
    allowedExtensions: {
      buildArchive: ['.zip', '.7z'],
      image: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
  };
}

export const FILE_SIZE_LIMITS = {
  get WEBGL_BUILD() {
    return getBuildStorageConfig().upload.webglMaxSizeBytes;
  },
  get PC_BUILD() {
    return getBuildStorageConfig().upload.pcMaxSizeBytes;
  },
  PROJECT_IMAGE: 5 * MiB,       // 5 MiB
  BUG_SCREENSHOT: 5 * MiB,      // 5 MiB
  ATTACHMENT: 20 * MiB,         // 20 MiB
  AVATAR: 2 * MiB,              // 2 MiB
} as const;

/**
 * 바이트를 읽기 쉬운 형식으로 변환
 * KiB, MiB, GiB 등 이진 단위 사용
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
