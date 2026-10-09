/**
 * WebGL 빌드 zip 검증 유틸리티 (R2 Ranged Reads 최적화)
 * 
 * Cloudflare Workers의 10ms CPU 제한을 준수하기 위해:
 * - 전체 zip을 로드/압축 해제하지 않음
 * - R2 ranged reads로 End of Central Directory + Central Directory만 읽음
 * - Central Directory에서 파일 목록과 uncompressed size 추출
 * 
 * Unity와 Godot가 출력하는 WebGL 빌드 구조를 검증합니다.
 * - Unity: Build/ 폴더 안에 index.html 또는 루트에 index.html
 * - Godot: 루트에 index.html
 */

import { getBuildStorageConfig, formatBytes, MiB } from './config';

/**
 * R2 Bucket의 최소 인터페이스 (ranged reads만 필요)
 * Cloudflare의 전체 R2Bucket 타입과 호환되지만 필요한 메서드만 정의
 */
export interface R2BucketLike {
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
}

export interface WebGLValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'NO_INDEX_HTML' | 'INVALID_ZIP' | 'EMPTY_ZIP' | 'TOO_LARGE' | 'TOO_MANY_FILES' | 'READ_ERROR' | 'UNSAFE_PATH';
  indexHtmlPath?: string;
  basePath?: string;
  files: WebGLFileEntry[];
  totalUncompressedSize: number;
  fileCount: number;
}

export interface WebGLFileEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
}

/**
 * Check if a file path is safe (no path traversal or absolute paths)
 * TC-F4-33: Reject paths with ../ or absolute paths
 */
function isPathSafe(path: string): boolean {
  if (path.startsWith('/')) return false;
  if (path.includes('../')) return false;
  if (path.includes('..\\')) return false;
  const normalized = path.split(/[/\\]/).filter(Boolean);
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] === '..') return false;
  }
  return true;
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

export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export function getContentEncoding(filename: string): string | undefined {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.br')) return 'br';
  if (lowerName.endsWith('.gz')) return 'gzip';
  return undefined;
}

export function isCompressedFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return COMPRESSED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

// ============================================================================
// ZIP Central Directory 파싱 (Ranged Reads용)
// ============================================================================

const EOCD_SIGNATURE = 0x06054b50;  // End of Central Directory
const EOCD_MIN_SIZE = 22;
const EOCD_MAX_COMMENT_SIZE = 65535;
const CD_SIGNATURE = 0x02014b50;    // Central Directory File Header
const CD_HEADER_SIZE = 46;

interface EndOfCentralDirectory {
  diskNumber: number;
  cdDiskNumber: number;
  cdEntriesOnDisk: number;
  cdEntriesTotal: number;
  cdSize: number;
  cdOffset: number;
  commentLength: number;
}

interface CentralDirectoryEntry {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
  localHeaderOffset: number;
}

/**
 * End of Central Directory를 찾고 파싱합니다.
 * EOCD는 파일 끝에서 최대 65557 bytes 이내에 위치합니다.
 */
function parseEOCD(buffer: ArrayBuffer): EndOfCentralDirectory | null {
  const view = new DataView(buffer);
  const len = buffer.byteLength;
  
  // EOCD signature를 뒤에서부터 탐색
  for (let i = len - EOCD_MIN_SIZE; i >= Math.max(0, len - EOCD_MIN_SIZE - EOCD_MAX_COMMENT_SIZE); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      return {
        diskNumber: view.getUint16(i + 4, true),
        cdDiskNumber: view.getUint16(i + 6, true),
        cdEntriesOnDisk: view.getUint16(i + 8, true),
        cdEntriesTotal: view.getUint16(i + 10, true),
        cdSize: view.getUint32(i + 12, true),
        cdOffset: view.getUint32(i + 16, true),
        commentLength: view.getUint16(i + 20, true),
      };
    }
  }
  return null;
}

/**
 * Central Directory를 파싱하여 파일 목록을 추출합니다.
 */
function parseCentralDirectory(buffer: ArrayBuffer, entryCount: number): CentralDirectoryEntry[] {
  const view = new DataView(buffer);
  const entries: CentralDirectoryEntry[] = [];
  let offset = 0;
  
  for (let i = 0; i < entryCount && offset < buffer.byteLength; i++) {
    if (view.getUint32(offset, true) !== CD_SIGNATURE) {
      break;  // Invalid signature
    }
    
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    
    const fileNameBytes = new Uint8Array(buffer, offset + CD_HEADER_SIZE, fileNameLength);
    const fileName = new TextDecoder().decode(fileNameBytes);
    
    entries.push({
      fileName: fileName.replace(/\\/g, '/'),  // Windows 경로 정규화
      compressedSize,
      uncompressedSize,
      isDirectory: fileName.endsWith('/') || fileName.endsWith('\\'),
      localHeaderOffset,
    });
    
    offset += CD_HEADER_SIZE + fileNameLength + extraFieldLength + commentLength;
  }
  
  return entries;
}

/**
 * R2 Bucket의 ranged read를 사용하여 zip central directory를 검증합니다.
 * 전체 zip을 로드하지 않고 필요한 부분만 읽습니다.
 * 
 * @param bucket R2 Bucket 바인딩
 * @param key R2 object key
 * @param fileSize 파일 전체 크기 (R2 head에서 얻음)
 */
export async function validateWebGLZipFromR2(
  bucket: R2BucketLike,
  key: string,
  fileSize: number
): Promise<WebGLValidationResult> {
  const config = getBuildStorageConfig();
  const files: WebGLFileEntry[] = [];
  
  try {
    // 1. EOCD 읽기 (파일 끝에서 최대 65KB)
    const eocdReadSize = Math.min(fileSize, EOCD_MIN_SIZE + EOCD_MAX_COMMENT_SIZE);
    const eocdStart = fileSize - eocdReadSize;
    
    const eocdObject = await bucket.get(key, {
      range: { offset: eocdStart, length: eocdReadSize },
    });
    
    if (!eocdObject) {
      return {
        valid: false,
        error: '업로드된 파일을 찾을 수 없습니다.',
        errorCode: 'READ_ERROR',
        files: [],
        totalUncompressedSize: 0,
        fileCount: 0,
      };
    }
    
    const eocdBuffer = await eocdObject.arrayBuffer();
    const eocd = parseEOCD(eocdBuffer);
    
    if (!eocd) {
      return {
        valid: false,
        error: '유효하지 않은 zip 파일입니다.',
        errorCode: 'INVALID_ZIP',
        files: [],
        totalUncompressedSize: 0,
        fileCount: 0,
      };
    }
    
    if (eocd.cdEntriesTotal === 0) {
      return {
        valid: false,
        error: '빌드 파일이 비어 있습니다.',
        errorCode: 'EMPTY_ZIP',
        files: [],
        totalUncompressedSize: 0,
        fileCount: 0,
      };
    }
    
    // 2. Central Directory 읽기
    const cdObject = await bucket.get(key, {
      range: { offset: eocd.cdOffset, length: eocd.cdSize },
    });
    
    if (!cdObject) {
      return {
        valid: false,
        error: 'zip Central Directory를 읽을 수 없습니다.',
        errorCode: 'INVALID_ZIP',
        files: [],
        totalUncompressedSize: 0,
        fileCount: 0,
      };
    }
    
    const cdBuffer = await cdObject.arrayBuffer();
    const entries = parseCentralDirectory(cdBuffer, eocd.cdEntriesTotal);
    
    // 3. 파일 수 제한 검사 (디렉터리 제외 - PRD 8.2)
    const fileOnlyCount = entries.filter(e => !e.isDirectory).length;
    if (fileOnlyCount > config.validation.webglMaxFileCount) {
      return {
        valid: false,
        error: `zip 내 파일 수가 제한을 초과합니다. (${fileOnlyCount}개 / 최대 ${config.validation.webglMaxFileCount}개)`,
        errorCode: 'TOO_MANY_FILES',
        files: [],
        totalUncompressedSize: 0,
        fileCount: fileOnlyCount,
      };
    }
    
    // 4. 파일 목록 및 크기 계산
    let totalUncompressedSize = 0;
    let indexHtmlPath: string | undefined;
    let basePath = '';
    const topLevelItems = new Set<string>();
    
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      // TC-F4-33: Path traversal check
      if (!isPathSafe(entry.fileName)) {
        return {
          valid: false,
          error: '안전하지 않은 파일 경로가 포함되어 있습니다. (경로 조작 시도 감지)',
          errorCode: 'UNSAFE_PATH',
          files: [],
          totalUncompressedSize: 0,
          fileCount: 0,
        };
      }
      
      totalUncompressedSize += entry.uncompressedSize;
      
      files.push({
        path: entry.fileName,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        isDirectory: false,
      });
      
      const firstSegment = entry.fileName.split('/')[0];
      topLevelItems.add(firstSegment);
      
      // 루트의 index.html 확인
      if (entry.fileName.toLowerCase() === 'index.html') {
        indexHtmlPath = entry.fileName;
        basePath = '';
      }
    }
    
    // 5. 압축 해제 후 크기 제한 검사
    if (totalUncompressedSize > config.validation.webglMaxUncompressedBytes) {
      return {
        valid: false,
        error: `압축 해제 후 크기가 제한을 초과합니다. (${formatBytes(totalUncompressedSize)} / 최대 ${formatBytes(config.validation.webglMaxUncompressedBytes)})`,
        errorCode: 'TOO_LARGE',
        files,
        totalUncompressedSize,
        fileCount: files.length,
      };
    }
    
    // 6. 단일 최상위 폴더 내 index.html 확인
    if (!indexHtmlPath && topLevelItems.size === 1) {
      const topFolder = Array.from(topLevelItems)[0];
      const possibleIndexPath = `${topFolder}/index.html`.toLowerCase();
      
      for (const entry of entries) {
        if (entry.fileName.toLowerCase() === possibleIndexPath) {
          indexHtmlPath = entry.fileName;
          basePath = topFolder + '/';
          break;
        }
      }
    }
    
    // 7. 깊은 경로의 index.html 확인 (2단계까지)
    if (!indexHtmlPath) {
      for (const entry of entries) {
        const lowerPath = entry.fileName.toLowerCase();
        if (lowerPath.endsWith('/index.html') || lowerPath === 'index.html') {
          const parts = entry.fileName.split('/');
          if (parts.length <= 2) {
            indexHtmlPath = entry.fileName;
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
        totalUncompressedSize,
        fileCount: files.length,
      };
    }
    
    return {
      valid: true,
      indexHtmlPath,
      basePath,
      files,
      totalUncompressedSize,
      fileCount: files.length,
    };
    
  } catch (error) {
    console.error('WebGL zip validation error:', error);
    return {
      valid: false,
      error: '파일 검증 중 오류가 발생했습니다.',
      errorCode: 'READ_ERROR',
      files: [],
      totalUncompressedSize: 0,
      fileCount: 0,
    };
  }
}

// ============================================================================
// ArrayBuffer 기반 검증 (테스트 및 폴백용)
// ============================================================================

/**
 * ArrayBuffer에서 직접 zip central directory를 검증합니다.
 * 테스트 및 작은 파일용. 실제 프로덕션에서는 validateWebGLZipFromR2 사용.
 */
export async function validateWebGLZip(
  zipBuffer: ArrayBuffer,
  maxUncompressedBytes?: number,
  maxFileCount?: number
): Promise<WebGLValidationResult> {
  const config = getBuildStorageConfig();
  const maxUncompressed = maxUncompressedBytes ?? config.validation.webglMaxUncompressedBytes;
  const maxFiles = maxFileCount ?? config.validation.webglMaxFileCount;
  const files: WebGLFileEntry[] = [];
  
  try {
    // EOCD 파싱
    const eocd = parseEOCD(zipBuffer);
    
    if (!eocd) {
      return {
        valid: false,
        error: '유효하지 않은 zip 파일입니다.',
        errorCode: 'INVALID_ZIP',
        files: [],
        totalUncompressedSize: 0,
        fileCount: 0,
      };
    }
    
    if (eocd.cdEntriesTotal === 0) {
      return {
        valid: false,
        error: '빌드 파일이 비어 있습니다.',
        errorCode: 'EMPTY_ZIP',
        files: [],
        totalUncompressedSize: 0,
        fileCount: 0,
      };
    }
    
    // Central Directory 파싱
    const cdBuffer = zipBuffer.slice(eocd.cdOffset, eocd.cdOffset + eocd.cdSize);
    const entries = parseCentralDirectory(cdBuffer, eocd.cdEntriesTotal);
    
    // 파일 수 제한 검사 (디렉터리 제외 - PRD 8.2)
    const fileOnlyCount = entries.filter(e => !e.isDirectory).length;
    if (fileOnlyCount > maxFiles) {
      return {
        valid: false,
        error: `zip 내 파일 수가 제한을 초과합니다. (${fileOnlyCount}개 / 최대 ${maxFiles}개)`,
        errorCode: 'TOO_MANY_FILES',
        files: [],
        totalUncompressedSize: 0,
        fileCount: fileOnlyCount,
      };
    }
    
    let totalUncompressedSize = 0;
    let indexHtmlPath: string | undefined;
    let basePath = '';
    const topLevelItems = new Set<string>();
    
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      // TC-F4-33: Path traversal check
      if (!isPathSafe(entry.fileName)) {
        return {
          valid: false,
          error: '안전하지 않은 파일 경로가 포함되어 있습니다. (경로 조작 시도 감지)',
          errorCode: 'UNSAFE_PATH',
          files: [],
          totalUncompressedSize: 0,
          fileCount: 0,
        };
      }
      
      totalUncompressedSize += entry.uncompressedSize;
      
      files.push({
        path: entry.fileName,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        isDirectory: false,
      });
      
      const firstSegment = entry.fileName.split('/')[0];
      topLevelItems.add(firstSegment);
      
      if (entry.fileName.toLowerCase() === 'index.html') {
        indexHtmlPath = entry.fileName;
        basePath = '';
      }
    }
    
    // 크기 제한
    if (totalUncompressedSize > maxUncompressed) {
      return {
        valid: false,
        error: `압축 해제 후 크기가 제한을 초과합니다. (${formatBytes(totalUncompressedSize)} / 최대 ${formatBytes(maxUncompressed)})`,
        errorCode: 'TOO_LARGE',
        files,
        totalUncompressedSize,
        fileCount: files.length,
      };
    }
    
    // 단일 폴더 내 index.html
    if (!indexHtmlPath && topLevelItems.size === 1) {
      const topFolder = Array.from(topLevelItems)[0];
      const possibleIndexPath = `${topFolder}/index.html`.toLowerCase();
      
      for (const entry of entries) {
        if (entry.fileName.toLowerCase() === possibleIndexPath) {
          indexHtmlPath = entry.fileName;
          basePath = topFolder + '/';
          break;
        }
      }
    }
    
    // 깊은 경로
    if (!indexHtmlPath) {
      for (const entry of entries) {
        const lowerPath = entry.fileName.toLowerCase();
        if (lowerPath.endsWith('/index.html') || lowerPath === 'index.html') {
          const parts = entry.fileName.split('/');
          if (parts.length <= 2) {
            indexHtmlPath = entry.fileName;
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
        totalUncompressedSize,
        fileCount: files.length,
      };
    }
    
    return {
      valid: true,
      indexHtmlPath,
      basePath,
      files,
      totalUncompressedSize,
      fileCount: files.length,
    };
    
  } catch (error) {
    console.error('WebGL zip validation error:', error);
    return {
      valid: false,
      error: '유효하지 않은 zip 파일입니다.',
      errorCode: 'INVALID_ZIP',
      files: [],
      totalUncompressedSize: 0,
      fileCount: 0,
    };
  }
}

export { MIME_TYPES };
