/**
 * Test zip file builder utilities
 * 
 * Creates test zip files with specific characteristics for validation testing.
 * Based on the test file preparation scripts from test-scenarios-v1.1.md
 */

import JSZip from 'jszip';

export interface ZipBuilderOptions {
  files?: Record<string, string | Uint8Array>;
  compression?: 'STORE' | 'DEFLATE';
}

/**
 * Create a basic test zip with given files
 */
export async function createTestZip(
  files: Record<string, string | Uint8Array>,
  compression: 'STORE' | 'DEFLATE' = 'DEFLATE'
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content, { 
      compression: compression === 'STORE' ? 'STORE' : 'DEFLATE' 
    });
  }
  
  return await zip.generateAsync({ 
    type: 'arraybuffer',
    compression: compression === 'STORE' ? 'STORE' : 'DEFLATE',
  });
}

/**
 * Create a WebGL build zip with minimal valid structure
 * TC-F4-01, TC-F4-02, TC-F4-03: Valid Unity/Godot WebGL builds
 */
export async function createValidWebGLZip(options?: {
  subfolder?: string;
  additionalFiles?: Record<string, string | Uint8Array>;
  indexContent?: string;
}): Promise<ArrayBuffer> {
  const { subfolder = '', additionalFiles = {}, indexContent = '<html><body>WebGL Test</body></html>' } = options || {};
  
  const prefix = subfolder ? `${subfolder}/` : '';
  
  const files: Record<string, string | Uint8Array> = {
    [`${prefix}index.html`]: indexContent,
    [`${prefix}Build/game.wasm`]: 'wasm content placeholder',
    [`${prefix}Build/game.data`]: 'data content placeholder',
    [`${prefix}Build/game.js`]: '// Unity loader script',
    ...additionalFiles,
  };
  
  return createTestZip(files);
}

/**
 * Create a zip without index.html
 * TC-F4-05: WebGL build missing index.html should be rejected
 */
export async function createNoIndexHtmlZip(): Promise<ArrayBuffer> {
  return createTestZip({
    'Build/game.wasm': 'wasm content',
    'Build/game.data': 'data content',
    'Build/game.js': '// loader',
  });
}

/**
 * Create a zip with index.html in a single top-level folder
 * TC-F4-06: WebGL build with subfolder structure should pass
 */
export async function createSubfolderZip(folderName: string = 'Build'): Promise<ArrayBuffer> {
  return createValidWebGLZip({ subfolder: folderName });
}

/**
 * Create a zip with exactly N files
 * TC-F4-29, TC-F4-30: File count boundary tests
 * 
 * @param fileCount Total number of files (including index.html)
 */
export async function createFileCountZip(fileCount: number): Promise<ArrayBuffer> {
  const files: Record<string, string> = {
    'index.html': '<html><body>file count test</body></html>',
  };
  
  for (let i = 0; i < fileCount - 1; i++) {
    files[`Build/f${i.toString().padStart(5, '0')}.txt`] = 'x';
  }
  
  return createTestZip(files);
}

/**
 * Create a zip where uncompressed total size is exactly N bytes
 * TC-F4-27, TC-F4-28: Uncompressed size boundary tests
 * 
 * @param totalUncompressedSize Target total uncompressed size in bytes
 */
export async function createUncompressedSizeZip(totalUncompressedSize: number): Promise<ArrayBuffer> {
  const indexHtml = '<html><body>unzip cap test</body></html>';
  const indexSize = indexHtml.length;
  
  const fillerSize = totalUncompressedSize - indexSize;
  if (fillerSize < 0) {
    throw new Error(`Target size ${totalUncompressedSize} is smaller than index.html (${indexSize} bytes)`);
  }
  
  const filler = new Uint8Array(fillerSize).fill(0);
  
  return createTestZip({
    'index.html': indexHtml,
    'filler.bin': filler,
  }, 'DEFLATE');
}

/**
 * Create a zip file with exact compressed size
 * TC-F4-08, TC-F4-09: WebGL upload size boundary tests
 * 
 * Note: This creates a STORED zip (no compression) so the zip size
 * matches the content size plus overhead more predictably.
 * 
 * @param targetSize Target zip file size in bytes
 */
export async function createExactSizeZip(targetSize: number): Promise<ArrayBuffer> {
  const indexHtml = '<html><body>cap test</body></html>';
  
  const overhead = 120;
  const fillerSize = Math.max(0, targetSize - indexHtml.length - overhead);
  const filler = new Uint8Array(fillerSize).fill(0);
  
  let zip = await createTestZip({
    'index.html': indexHtml,
    'filler.bin': filler,
  }, 'STORE');
  
  let diff = targetSize - zip.byteLength;
  let iterations = 0;
  const maxIterations = 10;
  
  while (diff !== 0 && iterations < maxIterations) {
    const newFillerSize = fillerSize + diff;
    if (newFillerSize < 0) break;
    
    const newFiller = new Uint8Array(newFillerSize).fill(0);
    zip = await createTestZip({
      'index.html': indexHtml,
      'filler.bin': newFiller,
    }, 'STORE');
    
    diff = targetSize - zip.byteLength;
    iterations++;
  }
  
  return zip;
}

/**
 * Create a malformed/truncated zip
 * TC-F4-34: Corrupted zip should be rejected
 */
export async function createTruncatedZip(): Promise<ArrayBuffer> {
  const validZip = await createValidWebGLZip();
  const truncateAmount = Math.min(1024, Math.floor(validZip.byteLength / 4));
  return validZip.slice(0, validZip.byteLength - truncateAmount);
}

/**
 * Create an empty zip file
 */
export async function createEmptyZip(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  return await zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Create invalid (non-zip) data
 */
export function createInvalidZipData(): ArrayBuffer {
  const data = new Uint8Array(100);
  data.fill(0x00);
  return data.buffer as ArrayBuffer;
}

/**
 * Create a zip with path traversal attempt (zipslip)
 * TC-F4-33: Path traversal should be rejected
 */
export async function createZipSlipZip(): Promise<ArrayBuffer> {
  return createTestZip({
    'index.html': '<html></html>',
    '../evil.html': '<script>alert("zipslip")</script>',
  });
}

/**
 * Create a zip with absolute path
 * TC-F4-33: Absolute paths should be rejected
 */
export async function createAbsolutePathZip(): Promise<ArrayBuffer> {
  return createTestZip({
    'index.html': '<html></html>',
    '/etc/passwd': 'malicious',
  });
}

/**
 * Calculate the uncompressed size of a zip's contents
 */
export async function getZipUncompressedSize(zipBuffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(zipBuffer);
  let totalSize = 0;
  
  for (const fileName of Object.keys(zip.files)) {
    const file = zip.files[fileName];
    if (!file.dir) {
      const content = await file.async('uint8array');
      totalSize += content.length;
    }
  }
  
  return totalSize;
}

/**
 * Get file count in a zip (excluding directories)
 */
export async function getZipFileCount(zipBuffer: ArrayBuffer): Promise<number> {
  const zip = await JSZip.loadAsync(zipBuffer);
  return Object.values(zip.files).filter(f => !f.dir).length;
}
