/**
 * Cloudflare R2 스토리지 클라이언트
 * 
 * PRD v1.1 D-04, D-05, F4-2 기반:
 * - WebGL 빌드: 별도 R2 서브도메인에서 서빙 (샌드박스 iframe 격리)
 * - PC 빌드: 비공개 버킷, presigned URL로 다운로드
 * - 업로드: 브라우저 → R2 직접 업로드 (presigned PUT URL)
 * 
 * AWS SDK v3 (@aws-sdk/client-s3)를 사용합니다.
 * R2는 S3 호환 API를 제공합니다.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getBuildStorageConfig, formatBytes } from './config';

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  webglSandboxDomain: string;
}

export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresAt: Date;
}

export interface UploadResult {
  key: string;
  size: number;
  url: string;
}

interface BuildInfo {
  id: string;
  version: string;
  buildType: 'webgl' | 'pc';
  storageKey: string;
  createdAt: Date;
  isFeatured: boolean;
}

class R2StorageClient {
  private client: S3Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * 빌드 업로드용 presigned PUT URL 생성
   * 브라우저에서 이 URL로 직접 업로드합니다.
   */
  async getUploadPresignedUrl(
    projectId: string,
    buildId: string,
    buildType: 'webgl' | 'pc',
    filename: string,
    contentType: string,
    fileSizeBytes: number
  ): Promise<PresignedUrlResult> {
    const storageConfig = getBuildStorageConfig();
    
    const maxSize = buildType === 'webgl' 
      ? storageConfig.upload.webglMaxSizeBytes 
      : storageConfig.upload.pcMaxSizeBytes;
    
    if (fileSizeBytes > maxSize) {
      throw new Error(
        `파일 크기가 제한을 초과합니다. ` +
        `최대: ${formatBytes(maxSize)}, 실제: ${formatBytes(fileSizeBytes)}`
      );
    }

    const key = this.buildStorageKey(projectId, buildId, buildType, filename);
    
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSizeBytes,
      Metadata: {
        'project-id': projectId,
        'build-id': buildId,
        'build-type': buildType,
        'original-filename': filename,
      },
    });

    const expiresIn = storageConfig.presignedUrl.uploadExpirySeconds;
    const url = await getSignedUrl(this.client, command, { expiresIn });
    
    return {
      url,
      key,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * WebGL 빌드 파일 업로드용 presigned URL (개별 파일)
   * zip 해제 후 각 파일마다 호출
   */
  async getWebGLFileUploadUrl(
    projectId: string,
    buildId: string,
    relativePath: string,
    contentType: string,
    contentEncoding?: string
  ): Promise<PresignedUrlResult> {
    const key = `webgl/${projectId}/${buildId}/${relativePath}`;
    
    const commandInput: PutObjectCommandInput = {
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: contentType,
    };
    
    if (contentEncoding) {
      commandInput.ContentEncoding = contentEncoding;
    }
    
    const command = new PutObjectCommand(commandInput);
    const storageConfig = getBuildStorageConfig();
    const expiresIn = storageConfig.presignedUrl.uploadExpirySeconds;
    const url = await getSignedUrl(this.client, command, { expiresIn });
    
    return {
      url,
      key,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * WebGL 빌드 플레이 URL 생성
   * 샌드박스 도메인에서 index.html을 가리킵니다.
   */
  getWebGLPlayUrl(projectId: string, buildId: string): string {
    return `https://${this.config.webglSandboxDomain}/webgl/${projectId}/${buildId}/index.html`;
  }

  /**
   * PC 빌드 다운로드용 presigned GET URL 생성
   * 인증된 사용자에게만 짧은 만료 시간의 URL 발급
   */
  async getDownloadPresignedUrl(
    key: string,
    expiresInSeconds?: number
  ): Promise<PresignedUrlResult> {
    const storageConfig = getBuildStorageConfig();
    const expiresIn = expiresInSeconds ?? storageConfig.presignedUrl.downloadExpirySeconds;
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { 
      expiresIn 
    });
    
    return {
      url,
      key,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * 빌드 파일 삭제
   */
  async deleteBuild(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });
    await this.client.send(command);
  }

  /**
   * WebGL 빌드 전체 삭제 (디렉토리 내 모든 파일)
   */
  async deleteWebGLBuild(projectId: string, buildId: string): Promise<void> {
    const prefix = `webgl/${projectId}/${buildId}/`;
    
    const listCommand = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: prefix,
    });
    
    const listResult = await this.client.send(listCommand);
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      return;
    }
    
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: this.config.bucketName,
      Delete: {
        Objects: listResult.Contents.map((obj) => ({ Key: obj.Key })),
      },
    });
    
    await this.client.send(deleteCommand);
  }

  /**
   * 파일 존재 여부 확인
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 프리픽스로 오브젝트 목록 조회
   */
  async listObjects(prefix: string): Promise<Array<{ key: string; size: number }>> {
    const objects: Array<{ key: string; size: number }> = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const result = await this.client.send(command);

      if (result.Contents) {
        for (const obj of result.Contents) {
          if (obj.Key && obj.Size !== undefined) {
            objects.push({ key: obj.Key, size: obj.Size });
          }
        }
      }

      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }

  /**
   * 스토리지 키 생성
   */
  private buildStorageKey(
    projectId: string,
    buildId: string,
    buildType: 'webgl' | 'pc',
    filename: string
  ): string {
    if (buildType === 'webgl') {
      return `webgl/${projectId}/${buildId}/${filename}`;
    }
    return `pc/${projectId}/${buildId}/${filename}`;
  }
}

let storageClient: R2StorageClient | null = null;

export function getStorageClient(): R2StorageClient {
  if (!storageClient) {
    storageClient = new R2StorageClient({
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.R2_BUCKET_NAME || 'gamedev-builds',
      publicUrl: process.env.R2_PUBLIC_URL || '',
      webglSandboxDomain: process.env.WEBGL_SANDBOX_DOMAIN || 'builds.example.com',
    });
  }
  return storageClient;
}

// Re-export config utilities
export { getBuildStorageConfig, formatBytes } from './config';
export { FILE_SIZE_LIMITS } from './config';

// ============================================================================
// 빌드 보관 정책 (Retention Policy)
// ============================================================================

export interface RetentionResult {
  deletedBuilds: string[];
  preservedBuilds: string[];
  errors: string[];
}

/**
 * 프로젝트의 오래된 빌드 파일을 정리합니다.
 * 
 * 보관 정책:
 * - WebGL: 최신 N개 유지 (기본 2개)
 * - PC: 최신 N개 유지 (기본 1개)
 * - 대표 빌드(featured)는 항상 유지
 * 
 * 주의: 빌드 메타데이터와 피드백 기록은 삭제하지 않습니다.
 * R2 스토리지의 파일만 삭제합니다.
 * 
 * @param projectId 프로젝트 ID
 * @param builds 프로젝트의 모든 빌드 목록 (DB에서 조회)
 * @param featuredBuildId 대표 빌드 ID (프로젝트에서 조회)
 */
export async function cleanupOldBuilds(
  projectId: string,
  builds: BuildInfo[],
  featuredBuildId: string | null
): Promise<RetentionResult> {
  const config = getBuildStorageConfig();
  
  if (!config.retention.enabled) {
    return {
      deletedBuilds: [],
      preservedBuilds: builds.map(b => b.id),
      errors: [],
    };
  }

  const result: RetentionResult = {
    deletedBuilds: [],
    preservedBuilds: [],
    errors: [],
  };

  const client = getStorageClient();

  const webglBuilds = builds
    .filter(b => b.buildType === 'webgl')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  const pcBuilds = builds
    .filter(b => b.buildType === 'pc')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const processBuilds = async (
    buildList: BuildInfo[],
    keepCount: number,
    buildType: 'webgl' | 'pc'
  ) => {
    for (let i = 0; i < buildList.length; i++) {
      const build = buildList[i];
      const isWithinKeepLimit = i < keepCount;
      const isFeatured = config.retention.keepFeaturedBuild && 
                         build.id === featuredBuildId;

      if (isWithinKeepLimit || isFeatured) {
        result.preservedBuilds.push(build.id);
        continue;
      }

      try {
        if (buildType === 'webgl') {
          await client.deleteWebGLBuild(projectId, build.id);
        } else {
          await client.deleteBuild(build.storageKey);
        }
        result.deletedBuilds.push(build.id);
      } catch (error) {
        result.errors.push(
          `Failed to delete build ${build.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  };

  await processBuilds(webglBuilds, config.retention.webglKeepLatest, 'webgl');
  await processBuilds(pcBuilds, config.retention.pcKeepLatest, 'pc');

  return result;
}

/**
 * 보관 정책 설정 확인 (관리자 UI용)
 */
export function getRetentionPolicyInfo(): {
  enabled: boolean;
  webglKeep: number;
  pcKeep: number;
  keepFeatured: boolean;
  maxWebglSize: string;
  maxPcSize: string;
} {
  const config = getBuildStorageConfig();
  return {
    enabled: config.retention.enabled,
    webglKeep: config.retention.webglKeepLatest,
    pcKeep: config.retention.pcKeepLatest,
    keepFeatured: config.retention.keepFeaturedBuild,
    maxWebglSize: formatBytes(config.upload.webglMaxSizeBytes),
    maxPcSize: formatBytes(config.upload.pcMaxSizeBytes),
  };
}
