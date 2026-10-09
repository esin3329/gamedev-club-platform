/**
 * WebGL 빌드 zip 검증 유틸리티
 * 
 * Unity와 Godot가 출력하는 WebGL 빌드 구조를 검증합니다.
 * - Unity: Build/ 폴더 안에 index.html 또는 루트에 index.html
 * - Godot: 루트에 index.html
 * 
 * 검증 후 R2에 추출하여 서빙 준비를 합니다.
 */

import JSZip from 'jszip';

export interface WebGLValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'NO_INDEX_HTML' | 'INVALID_ZIP' | 'EMPTY_ZIP' | 'TOO_LARGE';
  indexHtmlPath?: string;
  basePath?: string;
  files: WebGLFileInfo[];
  totalSize: number;
}

export interface WebGLFileInfo {
  path: string;
  size: number;
  isCompressed: boolean;
  contentType: string;
  contentEncoding?: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.mem': 'application/octet-stream',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.br': 'application/octet-stream',
  '.gz': 'application/octet-stream',
};

const COMPRESSED_EXTENSIONS = ['.br', '.gz'];

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function getContentEncoding(filename: string): string | undefined {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.br')) return 'br';
  if (lowerName.endsWith('.gz')) return 'gzip';
  return undefined;
}

function isCompressedFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return COMPRESSED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * WebGL zip 파일을 검증합니다.
 * 
 * Unity와 Godot 출력 구조를 모두 지원:
 * - 루트에 index.html이 있는 경우
 * - 단일 최상위 폴더 안에 index.html이 있는 경우 (예: Build/index.html)
 */
export async function validateWebGLZip(
  zipBuffer: ArrayBuffer,
  maxSizeBytes?: number
): Promise<WebGLValidationResult> {
  const files: WebGLFileInfo[] = [];
  let totalSize = 0;

  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const entries = Object.entries(zip.files);
    
    if (entries.length === 0) {
      return {
        valid: false,
        error: '빌드 파일이 비어 있습니다.',
        errorCode: 'EMPTY_ZIP',
        files: [],
        totalSize: 0,
      };
    }

    let indexHtmlPath: string | undefined;
    let basePath = '';
    const topLevelItems = new Set<string>();

    for (const [path, file] of entries) {
      if (file.dir) continue;

      // JSZip에서 압축 해제 전 크기를 직접 접근할 수 없으므로
      // 파일 내용을 읽어서 크기 확인 (작은 파일에만 적용)
      // 큰 파일은 나중에 extractWebGLFiles에서 처리
      const content = await file.async('uint8array');
      const uncompressedSize = content.length;
      totalSize += uncompressedSize;

      const normalizedPath = path.replace(/\\/g, '/');
      files.push({
        path: normalizedPath,
        size: uncompressedSize,
        isCompressed: isCompressedFile(normalizedPath),
        contentType: getContentType(normalizedPath),
        contentEncoding: getContentEncoding(normalizedPath),
      });

      const firstSegment = normalizedPath.split('/')[0];
      topLevelItems.add(firstSegment);

      if (normalizedPath.toLowerCase() === 'index.html') {
        indexHtmlPath = normalizedPath;
        basePath = '';
      }
    }

    if (!indexHtmlPath && topLevelItems.size === 1) {
      const topFolder = Array.from(topLevelItems)[0];
      const possibleIndexPath = `${topFolder}/index.html`;
      
      for (const [path] of entries) {
        const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
        if (normalizedPath === possibleIndexPath.toLowerCase()) {
          indexHtmlPath = path.replace(/\\/g, '/');
          basePath = topFolder + '/';
          break;
        }
      }
    }

    if (!indexHtmlPath) {
      for (const [path] of entries) {
        const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
        if (normalizedPath.endsWith('/index.html') || normalizedPath === 'index.html') {
          const parts = normalizedPath.split('/');
          if (parts.length <= 2) {
            indexHtmlPath = path.replace(/\\/g, '/');
            basePath = parts.length === 2 ? parts[0] + '/' : '';
            break;
          }
        }
      }
    }

    if (!indexHtmlPath) {
      return {
        valid: false,
        error: '빌드에 index.html이 필요합니다. Unity/Godot WebGL 빌드 출력을 확인해주세요.',
        errorCode: 'NO_INDEX_HTML',
        files,
        totalSize,
      };
    }

    if (maxSizeBytes && totalSize > maxSizeBytes) {
      return {
        valid: false,
        error: `압축 해제 후 크기가 제한을 초과합니다. (${formatSize(totalSize)} / ${formatSize(maxSizeBytes)})`,
        errorCode: 'TOO_LARGE',
        files,
        totalSize,
      };
    }

    return {
      valid: true,
      indexHtmlPath,
      basePath,
      files,
      totalSize,
    };

  } catch (error) {
    return {
      valid: false,
      error: '유효하지 않은 zip 파일입니다.',
      errorCode: 'INVALID_ZIP',
      files: [],
      totalSize: 0,
    };
  }
}

/**
 * zip에서 파일을 추출하여 콜백으로 전달합니다.
 * 메모리 효율을 위해 스트리밍 방식으로 처리합니다.
 */
export async function extractWebGLFiles(
  zipBuffer: ArrayBuffer,
  basePath: string,
  onFile: (path: string, content: Uint8Array, info: WebGLFileInfo) => Promise<void>
): Promise<void> {
  const zip = await JSZip.loadAsync(zipBuffer);
  
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    const normalizedPath = path.replace(/\\/g, '/');
    
    let targetPath = normalizedPath;
    if (basePath && normalizedPath.startsWith(basePath)) {
      targetPath = normalizedPath.slice(basePath.length);
    }

    const content = await file.async('uint8array');
    const info: WebGLFileInfo = {
      path: targetPath,
      size: content.length,
      isCompressed: isCompressedFile(targetPath),
      contentType: getContentType(targetPath),
      contentEncoding: getContentEncoding(targetPath),
    };

    await onFile(targetPath, content, info);
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export { MIME_TYPES, getContentType, getContentEncoding };
