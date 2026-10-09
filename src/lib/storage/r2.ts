/**
 * Cloudflare R2 스토리지 추상화 레이어
 * 
 * 현재는 플레이스홀더 구현입니다.
 * 실제 R2 연동 시 AWS SDK v3 (@aws-sdk/client-s3)를 사용하세요.
 * R2는 S3 호환 API를 제공합니다.
 */

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface UploadResult {
  key: string;
  size: number;
  url: string;
}

export interface DownloadOptions {
  expiresIn?: number; // 초 단위, 기본 3600 (1시간)
}

class R2StorageClient {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * 빌드 파일 업로드
   * @param file 업로드할 파일
   * @param projectId 프로젝트 ID
   * @param buildType 'webgl' | 'pc'
   * @returns 업로드 결과
   */
  async uploadBuild(
    file: File | Buffer,
    projectId: string,
    buildType: 'webgl' | 'pc',
    filename: string
  ): Promise<UploadResult> {
    const key = `builds/${projectId}/${buildType}/${Date.now()}_${filename}`;
    const size = file instanceof File ? file.size : file.length;

    // TODO: 실제 R2 업로드 구현
    console.log(`[R2 Stub] Would upload to: ${key}`);

    return {
      key,
      size,
      url: `${this.config.publicUrl}/${key}`,
    };
  }

  /**
   * WebGL 빌드용 Presigned URL 생성 (샌드박스 도메인에서 서빙)
   */
  async getWebGLPlayUrl(key: string): Promise<string> {
    const sandboxDomain = process.env.WEBGL_SANDBOX_DOMAIN || this.config.publicUrl;
    
    // TODO: 실제 presigned URL 생성
    return `${sandboxDomain}/${key}`;
  }

  /**
   * PC 빌드 다운로드용 Presigned URL 생성
   * 만료 시간이 있어 외부 공유 방지
   */
  async getDownloadUrl(
    key: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    const expiresIn = options.expiresIn || 3600;
    
    // TODO: 실제 presigned URL 생성
    console.log(`[R2 Stub] Would generate presigned URL for: ${key}, expires in ${expiresIn}s`);
    
    return `${this.config.publicUrl}/${key}?expires=${Date.now() + expiresIn * 1000}`;
  }

  /**
   * 빌드 파일 삭제
   */
  async deleteBuild(key: string): Promise<void> {
    // TODO: 실제 R2 삭제 구현
    console.log(`[R2 Stub] Would delete: ${key}`);
  }

  /**
   * 이미지 업로드 (스크린샷, 썸네일 등)
   */
  async uploadImage(
    file: File | Buffer,
    category: 'screenshots' | 'thumbnails' | 'avatars',
    filename: string
  ): Promise<UploadResult> {
    const key = `images/${category}/${Date.now()}_${filename}`;
    const size = file instanceof File ? file.size : file.length;

    // TODO: 실제 R2 업로드 구현
    console.log(`[R2 Stub] Would upload image to: ${key}`);

    return {
      key,
      size,
      url: `${this.config.publicUrl}/${key}`,
    };
  }
}

// 싱글톤 인스턴스 (환경 변수에서 설정 로드)
let storageClient: R2StorageClient | null = null;

export function getStorageClient(): R2StorageClient {
  if (!storageClient) {
    storageClient = new R2StorageClient({
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.R2_BUCKET_NAME || 'gamedev-builds',
      publicUrl: process.env.R2_PUBLIC_URL || '',
    });
  }
  return storageClient;
}

// 파일 크기 제한 상수 (PRD 섹션 8.2 기반)
export const FILE_SIZE_LIMITS = {
  WEBGL_BUILD: 200 * 1024 * 1024,      // 200MB
  PC_BUILD: 1024 * 1024 * 1024,         // 1GB
  PROJECT_IMAGE: 5 * 1024 * 1024,       // 5MB
  BUG_SCREENSHOT: 5 * 1024 * 1024,      // 5MB
  ATTACHMENT: 20 * 1024 * 1024,         // 20MB
  AVATAR: 2 * 1024 * 1024,              // 2MB
} as const;

export const ALLOWED_EXTENSIONS = {
  BUILD_ARCHIVE: ['.zip', '.7z'],
  IMAGE: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
} as const;

/**
 * 파일 확장자 검증
 */
export function isAllowedExtension(
  filename: string,
  type: keyof typeof ALLOWED_EXTENSIONS
): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS[type].includes(ext as never);
}

/**
 * 파일 크기 검증
 */
export function isWithinSizeLimit(
  size: number,
  type: keyof typeof FILE_SIZE_LIMITS
): boolean {
  return size <= FILE_SIZE_LIMITS[type];
}
