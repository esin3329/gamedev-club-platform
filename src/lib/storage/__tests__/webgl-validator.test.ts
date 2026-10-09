/**
 * WebGL zip 검증 테스트
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { validateWebGLZip, extractWebGLFiles, getContentType, getContentEncoding } from '../webgl-validator';

async function createTestZip(files: Record<string, string | Uint8Array>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return await zip.generateAsync({ type: 'arraybuffer' });
}

describe('validateWebGLZip', () => {
  it('루트에 index.html이 있으면 valid', async () => {
    const zipBuffer = await createTestZip({
      'index.html': '<html></html>',
      'Build/game.wasm': 'wasm content',
      'Build/game.data': 'data content',
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(true);
    expect(result.indexHtmlPath).toBe('index.html');
    expect(result.basePath).toBe('');
    expect(result.files.length).toBe(3);
  });

  it('단일 최상위 폴더 안에 index.html이 있으면 valid (Unity 구조)', async () => {
    const zipBuffer = await createTestZip({
      'Build/index.html': '<html></html>',
      'Build/game.wasm': 'wasm content',
      'Build/game.data': 'data content',
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(true);
    expect(result.indexHtmlPath).toBe('Build/index.html');
    expect(result.basePath).toBe('Build/');
  });

  it('WebGL 폴더 안에 index.html이 있으면 valid (일반적인 구조)', async () => {
    const zipBuffer = await createTestZip({
      'WebGL/index.html': '<html></html>',
      'WebGL/Build/game.wasm': 'wasm',
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(true);
    expect(result.indexHtmlPath).toBe('WebGL/index.html');
  });

  it('index.html이 없으면 invalid', async () => {
    const zipBuffer = await createTestZip({
      'Build/game.wasm': 'wasm content',
      'Build/game.data': 'data content',
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('NO_INDEX_HTML');
    expect(result.error).toContain('index.html');
  });

  it('빈 zip은 invalid', async () => {
    const zip = new JSZip();
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('EMPTY_ZIP');
  });

  it('잘못된 zip 데이터는 invalid', async () => {
    const invalidBuffer = new ArrayBuffer(100);
    new Uint8Array(invalidBuffer).fill(0);

    const result = await validateWebGLZip(invalidBuffer);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_ZIP');
  });

  it('압축 해제 후 크기 제한 초과 시 invalid', async () => {
    const largeContent = 'x'.repeat(1024 * 1024); // 1MB
    const zipBuffer = await createTestZip({
      'index.html': '<html></html>',
      'large.data': largeContent,
    });

    const result = await validateWebGLZip(zipBuffer, 500 * 1024); // 500KB 제한

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('TOO_LARGE');
  });

  it('파일 정보를 올바르게 추출', async () => {
    const zipBuffer = await createTestZip({
      'index.html': '<html></html>',
      'game.wasm': 'wasm',
      'game.data.br': 'compressed',
      'styles.css': 'body {}',
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(true);
    
    const htmlFile = result.files.find(f => f.path === 'index.html');
    expect(htmlFile?.contentType).toBe('text/html');
    
    const wasmFile = result.files.find(f => f.path === 'game.wasm');
    expect(wasmFile?.contentType).toBe('application/wasm');
    
    const brFile = result.files.find(f => f.path === 'game.data.br');
    expect(brFile?.isCompressed).toBe(true);
    expect(brFile?.contentEncoding).toBe('br');
    
    const cssFile = result.files.find(f => f.path === 'styles.css');
    expect(cssFile?.contentType).toBe('text/css');
  });
});

describe('extractWebGLFiles', () => {
  it('basePath를 제거하고 파일 추출', async () => {
    const zipBuffer = await createTestZip({
      'Build/index.html': '<html></html>',
      'Build/game.js': 'code',
      'Build/sub/data.bin': 'data',
    });

    const extractedFiles: Array<{ path: string; size: number }> = [];

    await extractWebGLFiles(zipBuffer, 'Build/', async (path, content) => {
      extractedFiles.push({ path, size: content.length });
    });

    expect(extractedFiles).toHaveLength(3);
    expect(extractedFiles.find(f => f.path === 'index.html')).toBeDefined();
    expect(extractedFiles.find(f => f.path === 'game.js')).toBeDefined();
    expect(extractedFiles.find(f => f.path === 'sub/data.bin')).toBeDefined();
  });

  it('basePath가 없으면 원본 경로 유지', async () => {
    const zipBuffer = await createTestZip({
      'index.html': '<html></html>',
      'game.js': 'code',
    });

    const extractedFiles: string[] = [];

    await extractWebGLFiles(zipBuffer, '', async (path) => {
      extractedFiles.push(path);
    });

    expect(extractedFiles).toContain('index.html');
    expect(extractedFiles).toContain('game.js');
  });
});

describe('getContentType', () => {
  it('HTML 파일', () => {
    expect(getContentType('index.html')).toBe('text/html');
    expect(getContentType('page.htm')).toBe('text/html');
  });

  it('JavaScript 파일', () => {
    expect(getContentType('game.js')).toBe('application/javascript');
    expect(getContentType('module.mjs')).toBe('application/javascript');
  });

  it('WebAssembly 파일', () => {
    expect(getContentType('game.wasm')).toBe('application/wasm');
  });

  it('이미지 파일', () => {
    expect(getContentType('icon.png')).toBe('image/png');
    expect(getContentType('photo.jpg')).toBe('image/jpeg');
    expect(getContentType('logo.webp')).toBe('image/webp');
  });

  it('압축 파일', () => {
    expect(getContentType('data.br')).toBe('application/octet-stream');
    expect(getContentType('data.gz')).toBe('application/octet-stream');
  });

  it('알 수 없는 확장자는 octet-stream', () => {
    expect(getContentType('file.xyz')).toBe('application/octet-stream');
  });
});

describe('getContentEncoding', () => {
  it('Brotli 압축', () => {
    expect(getContentEncoding('game.wasm.br')).toBe('br');
    expect(getContentEncoding('data.br')).toBe('br');
  });

  it('Gzip 압축', () => {
    expect(getContentEncoding('game.wasm.gz')).toBe('gzip');
    expect(getContentEncoding('data.gz')).toBe('gzip');
  });

  it('압축되지 않은 파일', () => {
    expect(getContentEncoding('game.wasm')).toBeUndefined();
    expect(getContentEncoding('index.html')).toBeUndefined();
  });
});
