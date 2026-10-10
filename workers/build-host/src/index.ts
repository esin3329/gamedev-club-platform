/**
 * WebGL Build Host Worker
 * 
 * Serves WebGL game builds from R2 storage on a separate origin.
 * This worker is deployed independently from the main application.
 * 
 * URL Pattern: https://<worker>.workers.dev/webgl/<projectId>/<buildId>/<path>
 * 
 * Security features:
 * - Only serves registered, playable builds (checks .playable marker)
 * - No cookies (separate origin)
 * - Restrictive CSP for untrusted game sandbox
 * - GET/HEAD only
 * 
 * Performance features:
 * - Streams files directly from R2 (no buffering)
 * - Workers Cache API for repeated requests
 * - Proper Range and conditional request support
 * - Correct MIME types and Content-Encoding for Unity/Godot
 */

/// <reference types="@cloudflare/workers-types" />

export interface Env {
  R2_BUILDS: R2Bucket;
  ENVIRONMENT?: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.unityweb': 'application/octet-stream',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.mem': 'application/octet-stream',
  '.symbols.json': 'application/json',
};

const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'application/javascript',
  'application/json',
  'application/xml',
  'image/svg+xml',
]);

function getMimeType(path: string): string {
  const lower = path.toLowerCase();
  
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (lower.endsWith(ext)) {
      return mime;
    }
  }
  
  return 'application/octet-stream';
}

function getContentEncoding(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.br')) return 'br';
  if (lower.endsWith('.gz')) return 'gzip';
  return null;
}

function getUncompressedMimeType(path: string): string {
  const lower = path.toLowerCase();
  let basePath = lower;
  
  if (lower.endsWith('.br')) {
    basePath = lower.slice(0, -3);
  } else if (lower.endsWith('.gz')) {
    basePath = lower.slice(0, -3);
  }
  
  return getMimeType(basePath);
}

function generateETag(object: R2Object): string {
  return `"${object.etag}"`;
}

function getSecurityHeaders(mimeType: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  
  if (mimeType.startsWith('text/html')) {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' blob: data:",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "base-uri 'self'",
    ].join('; ');
    
    headers['Permissions-Policy'] = [
      'accelerometer=()',
      'autoplay=(self)',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
    ].join(', ');
  }
  
  return headers;
}

function getCacheHeaders(mimeType: string, path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (path.endsWith('index.html')) {
    headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300';
  } else if (mimeType === 'application/wasm' || 
             mimeType === 'application/octet-stream' ||
             path.includes('.data') ||
             path.includes('.unityweb')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (mimeType.startsWith('text/') || 
             mimeType.startsWith('application/javascript')) {
    headers['Cache-Control'] = 'public, max-age=86400, stale-while-revalidate=3600';
  } else {
    headers['Cache-Control'] = 'public, max-age=604800';
  }
  
  return headers;
}

function parseRangeHeader(rangeHeader: string, totalSize: number): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;
  
  const [, startStr, endStr] = match;
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : totalSize - 1;
  
  if (start > end || start >= totalSize) return null;
  if (end >= totalSize) end = totalSize - 1;
  
  return { start, end };
}

async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: { 'Allow': 'GET, HEAD' }
    });
  }
  
  if (path === '/' || path === '') {
    return new Response('WebGL Build Host', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  if (path === '/health') {
    return new Response('OK', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  const pathMatch = path.match(/^\/webgl\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!pathMatch) {
    return new Response('Not Found', { status: 404 });
  }
  
  const [, projectId, buildId, filePath] = pathMatch;
  const r2Key = `webgl/${projectId}/${buildId}/${filePath}`;
  
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  
  let cachedResponse = await cache.match(cacheKey);
  if (cachedResponse && request.method === 'GET') {
    const cachedETag = cachedResponse.headers.get('ETag');
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && cachedETag && ifNoneMatch === cachedETag) {
      return new Response(null, { status: 304 });
    }
    return cachedResponse;
  }
  
  const playableMarker = `webgl/${projectId}/${buildId}/.playable`;
  const markerObject = await env.R2_BUILDS.head(playableMarker);
  if (!markerObject) {
    return new Response('Build not found or not playable', { status: 404 });
  }
  
  const r2Object = await env.R2_BUILDS.get(r2Key);
  if (!r2Object) {
    return new Response('File not found', { status: 404 });
  }
  
  const contentEncoding = getContentEncoding(filePath);
  const mimeType = contentEncoding ? getUncompressedMimeType(filePath) : getMimeType(filePath);
  const etag = generateETag(r2Object);
  
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }
  
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', mimeType);
  responseHeaders.set('ETag', etag);
  
  if (contentEncoding) {
    responseHeaders.set('Content-Encoding', contentEncoding);
    responseHeaders.set('Vary', 'Accept-Encoding');
  }
  
  const securityHeaders = getSecurityHeaders(mimeType);
  for (const [key, value] of Object.entries(securityHeaders)) {
    responseHeaders.set(key, value);
  }
  
  const cacheHeaders = getCacheHeaders(mimeType, filePath);
  for (const [key, value] of Object.entries(cacheHeaders)) {
    responseHeaders.set(key, value);
  }
  
  responseHeaders.set('Accept-Ranges', 'bytes');
  
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, r2Object.size);
    if (!range) {
      return new Response('Range Not Satisfiable', { 
        status: 416,
        headers: { 'Content-Range': `bytes */${r2Object.size}` }
      });
    }
    
    const { start, end } = range;
    const contentLength = end - start + 1;
    
    responseHeaders.set('Content-Range', `bytes ${start}-${end}/${r2Object.size}`);
    responseHeaders.set('Content-Length', contentLength.toString());
    
    const rangedObject = await env.R2_BUILDS.get(r2Key, {
      range: { offset: start, length: contentLength }
    });
    
    if (!rangedObject) {
      return new Response('Range request failed', { status: 500 });
    }
    
    return new Response(rangedObject.body, {
      status: 206,
      headers: responseHeaders,
    });
  }
  
  responseHeaders.set('Content-Length', r2Object.size.toString());
  
  const response = new Response(
    request.method === 'HEAD' ? null : r2Object.body,
    {
      status: 200,
      headers: responseHeaders,
    }
  );
  
  if (request.method === 'GET' && !rangeHeader) {
    const cacheTtl = mimeType === 'application/wasm' || 
                     mimeType === 'application/octet-stream' 
                       ? 86400 * 30 
                       : 86400;
    
    const responseToCache = response.clone();
    ctx.waitUntil(cache.put(cacheKey, responseToCache));
  }
  
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error('Build host error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
