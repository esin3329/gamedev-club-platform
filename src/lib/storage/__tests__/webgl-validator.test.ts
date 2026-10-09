/**
 * WebGL zip 검증 테스트
 * 
 * Central Directory 기반 검증 테스트
 * (전체 zip 압축 해제 없이 메타데이터만 읽음)
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { validateWebGLZip, getContentType, getContentEncoding, isCompressedFile } from '../webgl-validator';
import { MiB } from '../config';

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
    expect(result.fileCount).toBe(3);
    expect(result.totalUncompressedSize).toBeGreaterThan(0);
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

    // 500KB 제한으로 검증
    const result = await validateWebGLZip(zipBuffer, 500 * 1024);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('TOO_LARGE');
    expect(result.error).toContain('압축 해제 후 크기');
  });

  it('파일 수 제한 초과 시 invalid', async () => {
    const files: Record<string, string> = {
      'index.html': '<html></html>',
    };
    // 10개 파일 생성
    for (let i = 0; i < 10; i++) {
      files[`file${i}.txt`] = 'content';
    }
    const zipBuffer = await createTestZip(files);

    // 5개 제한으로 검증
    const result = await validateWebGLZip(zipBuffer, undefined, 5);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('TOO_MANY_FILES');
    expect(result.error).toContain('파일 수');
  });

  it('파일 정보를 올바르게 추출', async () => {
    const zipBuffer = await createTestZip({
      'index.html': '<html></html>',
      'game.wasm': 'wasm',
      'styles.css': 'body {}',
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(true);
    expect(result.files.length).toBe(3);
    
    const htmlFile = result.files.find(f => f.path === 'index.html');
    expect(htmlFile).toBeDefined();
    expect(htmlFile?.uncompressedSize).toBeGreaterThan(0);
  });

  it('totalUncompressedSize가 정확히 계산됨', async () => {
    const content1 = 'a'.repeat(100);
    const content2 = 'b'.repeat(200);
    const zipBuffer = await createTestZip({
      'index.html': content1,
      'data.txt': content2,
    });

    const result = await validateWebGLZip(zipBuffer);

    expect(result.valid).toBe(true);
    expect(result.totalUncompressedSize).toBe(300);
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

describe('isCompressedFile', () => {
  it('Brotli 압축 파일', () => {
    expect(isCompressedFile('game.wasm.br')).toBe(true);
    expect(isCompressedFile('data.br')).toBe(true);
  });

  it('Gzip 압축 파일', () => {
    expect(isCompressedFile('game.wasm.gz')).toBe(true);
    expect(isCompressedFile('data.gz')).toBe(true);
  });

  it('일반 파일', () => {
    expect(isCompressedFile('game.wasm')).toBe(false);
    expect(isCompressedFile('index.html')).toBe(false);
  });
});

describe('MiB constant', () => {
  it('MiB = 1,048,576 bytes', () => {
    expect(MiB).toBe(1024 * 1024);
    expect(MiB).toBe(1048576);
  });
});
