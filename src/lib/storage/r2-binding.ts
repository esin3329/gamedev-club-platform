/**
 * Cloudflare R2 바인딩 클라이언트
 * 
 * Cloudflare Workers/Pages 환경에서 R2 바인딩을 통해 직접 접근합니다.
 * AWS SDK 대신 Cloudflare의 네이티브 R2 API를 사용하여 더 효율적입니다.
 * 
 * 로컬 개발 시에는 Wrangler가 R2 바인딩을 에뮬레이션합니다.
 */

import { getBuildStorageConfig, formatBytes } from './config';

export interface R2UploadResult {
  key: string;
  size: number;
  etag: string;
}

export interface R2PresignedUrlResult {
  url: string;
  key: string;
  expiresAt: Date;
}

interface BuildInfo {
  id: string;
  version: string;
  buildType: 'webgl' | 'pc';
  storageKey: string;
  createdAt: Date;
  isFeatured: boolean;
}

export interface RetentionResult {
  deletedBuilds: string[];
  preservedBuilds: string[];
  errors: string[];
}

/**
 * Cloudflare R2 바인딩 타입
 * Cloudflare Workers 런타임에서 제공됩니다.
 */
export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
  createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>;
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
  sha1?: ArrayBuffer | string;
  sha256?: ArrayBuffer | string;
  sha384?: ArrayBuffer | string;
  sha512?: ArrayBuffer | string;
  onlyIf?: R2Conditional;
  storageClass?: string;
}

interface R2GetOptions {
  onlyIf?: R2Conditional;
  range?: R2Range;
}

interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  include?: ('httpMetadata' | 'customMetadata')[];
}

interface R2MultipartOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  storageClass?: string;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2Conditional {
  etagMatches?: string;
  etagDoesNotMatch?: string;
  uploadedBefore?: Date;
  uploadedAfter?: Date;
}

interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: R2Checksums;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  range?: R2Range;
  storageClass: string;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}

interface R2MultipartUpload {
  key: string;
  uploadId: string;
  uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob): Promise<R2UploadedPart>;
  abort(): Promise<void>;
  complete(uploadedParts: R2UploadedPart[]): Promise<R2Object>;
}

interface R2UploadedPart {
  partNumber: number;
  etag: string;
}

/**
 * Cloudflare 환경에서 R2 바인딩을 가져옵니다.
 * Next.js의 경우 getRequestContext()를 통해 접근합니다.
 */
export function getR2Binding(): R2Bucket | null {
  try {
    // Cloudflare Pages/Workers 환경에서는 globalThis에 바인딩이 있음
    // OpenNext가 이를 처리해줌
    const env = (globalThis as unknown as { process?: { env?: { R2_BUILDS?: R2Bucket } } }).process?.env;
    if (env?.R2_BUILDS) {
      return env.R2_BUILDS as R2Bucket;
    }
    
    // Next.js App Router에서 Cloudflare 바인딩 접근
    // @ts-expect-error - Cloudflare specific
    if (typeof getRequestContext === 'function') {
      // @ts-expect-error - Cloudflare specific
      const ctx = getRequestContext();
      return ctx?.env?.R2_BUILDS || null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * R2 바인딩을 사용하는 스토리지 클라이언트
 */
export class R2BindingClient {
  private bucket: R2Bucket;
  private webglSandboxDomain: string;

  constructor(bucket: R2Bucket, webglSandboxDomain: string) {
    this.bucket = bucket;
    this.webglSandboxDomain = webglSandboxDomain;
  }

  /**
   * 파일 업로드
   */
  async upload(
    key: string,
    content: ArrayBuffer | Uint8Array | string,
    options?: {
      contentType?: string;
      contentEncoding?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<R2UploadResult> {
    const result = await this.bucket.put(key, content, {
      httpMetadata: {
        contentType: options?.contentType,
        contentEncoding: options?.contentEncoding,
      },
      customMetadata: options?.metadata,
    });

    return {
      key: result.key,
      size: result.size,
      etag: result.etag,
    };
  }

  /**
   * 파일 다운로드
   */
  async download(key: string): Promise<ArrayBuffer | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return await object.arrayBuffer();
  }

  /**
   * 파일 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    const object = await this.bucket.head(key);
    return object !== null;
  }

  /**
   * 파일 삭제
   */
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * 여러 파일 삭제
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.bucket.delete(keys);
  }

  /**
   * 프리픽스로 파일 목록 조회
   */
  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.bucket.list({
        prefix,
        cursor,
      });

      for (const obj of result.objects) {
        keys.push(obj.key);
      }

      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    return keys;
  }

  /**
   * WebGL 빌드 디렉토리 전체 삭제
   */
  async deleteWebGLBuild(projectId: string, buildId: string): Promise<void> {
    const prefix = `webgl/${projectId}/${buildId}/`;
    const keys = await this.list(prefix);
    await this.deleteMany(keys);
  }

  /**
   * WebGL 빌드 플레이 URL 생성
   */
  getWebGLPlayUrl(projectId: string, buildId: string): string {
    return `https://${this.webglSandboxDomain}/webgl/${projectId}/${buildId}/index.html`;
  }

  /**
   * 스토리지 키 생성
   */
  buildStorageKey(
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

/**
 * R2 바인딩 클라이언트 싱글톤
 */
let bindingClient: R2BindingClient | null = null;

export function getR2BindingClient(): R2BindingClient | null {
  if (bindingClient) return bindingClient;

  const bucket = getR2Binding();
  if (!bucket) return null;

  const webglSandboxDomain = process.env.WEBGL_SANDBOX_DOMAIN || 'builds.example.com';
  bindingClient = new R2BindingClient(bucket, webglSandboxDomain);
  return bindingClient;
}

/**
 * 프로젝트의 오래된 빌드 파일을 정리합니다 (R2 바인딩 버전)
 */
export async function cleanupOldBuildsWithBinding(
  client: R2BindingClient,
  projectId: string,
  builds: BuildInfo[],
  featuredBuildId: string | null
): Promise<RetentionResult> {
  const config = getBuildStorageConfig();

  if (!config.retention.enabled) {
    return {
      deletedBuilds: [],
      preservedBuilds: builds.map((b) => b.id),
      errors: [],
    };
  }

  const result: RetentionResult = {
    deletedBuilds: [],
    preservedBuilds: [],
    errors: [],
  };

  const webglBuilds = builds
    .filter((b) => b.buildType === 'webgl')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const pcBuilds = builds
    .filter((b) => b.buildType === 'pc')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const processBuilds = async (
    buildList: BuildInfo[],
    keepCount: number,
    buildType: 'webgl' | 'pc'
  ) => {
    for (let i = 0; i < buildList.length; i++) {
      const build = buildList[i];
      const isWithinKeepLimit = i < keepCount;
      const isFeatured =
        config.retention.keepFeaturedBuild && build.id === featuredBuildId;

      if (isWithinKeepLimit || isFeatured) {
        result.preservedBuilds.push(build.id);
        continue;
      }

      try {
        if (buildType === 'webgl') {
          await client.deleteWebGLBuild(projectId, build.id);
        } else {
          await client.delete(build.storageKey);
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

export { formatBytes };
