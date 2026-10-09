/**
 * 빌드 스토리지 설정
 * 
 * 모든 값은 서버 사이드 설정으로 관리됩니다.
 * 환경 변수로 오버라이드 가능하며, 코드 수정 없이 변경할 수 있습니다.
 * 
 * 향후 Supabase settings 테이블로 마이그레이션하여
 * 운영진이 UI에서 변경할 수 있도록 확장 가능합니다.
 */

export interface BuildStorageConfig {
  upload: {
    webglMaxSizeBytes: number;
    pcMaxSizeBytes: number;
  };
  retention: {
    enabled: boolean;
    webglKeepLatest: number;
    pcKeepLatest: number;
    keepFeaturedBuild: boolean;
  };
  presignedUrl: {
    uploadExpirySeconds: number;
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
      webglMaxSizeBytes: parseEnvInt(
        process.env.BUILD_WEBGL_MAX_SIZE_MB, 
        150  // 기본값: 150MB
      ) * 1024 * 1024,
      
      pcMaxSizeBytes: parseEnvInt(
        process.env.BUILD_PC_MAX_SIZE_MB, 
        500  // 기본값: 500MB
      ) * 1024 * 1024,
    },
    
    retention: {
      enabled: parseEnvBool(
        process.env.BUILD_RETENTION_ENABLED, 
        true  // 기본값: 활성화
      ),
      
      webglKeepLatest: parseEnvInt(
        process.env.BUILD_RETENTION_WEBGL_KEEP, 
        2  // 기본값: 최신 2개
      ),
      
      pcKeepLatest: parseEnvInt(
        process.env.BUILD_RETENTION_PC_KEEP, 
        1  // 기본값: 최신 1개
      ),
      
      keepFeaturedBuild: parseEnvBool(
        process.env.BUILD_RETENTION_KEEP_FEATURED, 
        true  // 기본값: 대표 빌드 유지
      ),
    },
    
    presignedUrl: {
      uploadExpirySeconds: parseEnvInt(
        process.env.PRESIGNED_URL_UPLOAD_EXPIRY_SECONDS,
        3600  // 기본값: 1시간
      ),
      downloadExpirySeconds: parseEnvInt(
        process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY_SECONDS,
        300  // 기본값: 5분
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
  PROJECT_IMAGE: 5 * 1024 * 1024,       // 5MB
  BUG_SCREENSHOT: 5 * 1024 * 1024,      // 5MB
  ATTACHMENT: 20 * 1024 * 1024,         // 20MB
  AVATAR: 2 * 1024 * 1024,              // 2MB
} as const;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
