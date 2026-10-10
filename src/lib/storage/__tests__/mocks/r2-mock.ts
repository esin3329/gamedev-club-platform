/**
 * In-memory R2 bucket mock for testing
 * 
 * Provides a fake R2Bucket interface that stores objects in memory.
 * Used to test R2-dependent code without actual Cloudflare infrastructure.
 */

import type { R2BucketLike } from '../../webgl-validator';

interface StoredObject {
  data: ArrayBuffer;
  metadata?: Record<string, string>;
  contentType?: string;
}

export class MockR2Bucket implements R2BucketLike {
  private objects: Map<string, StoredObject> = new Map();

  async put(
    key: string, 
    value: ArrayBuffer | Uint8Array | string,
    options?: { contentType?: string; metadata?: Record<string, string> }
  ): Promise<{ key: string; size: number }> {
    let data: ArrayBuffer;
    if (typeof value === 'string') {
      data = new TextEncoder().encode(value).buffer as ArrayBuffer;
    } else if (value instanceof Uint8Array) {
      data = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
    } else {
      data = value;
    }
    
    this.objects.set(key, {
      data,
      metadata: options?.metadata,
      contentType: options?.contentType,
    });
    
    return { key, size: data.byteLength };
  }

  async get(
    key: string, 
    options?: { range?: { offset: number; length: number } }
  ): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;

    let data = obj.data;
    
    if (options?.range) {
      const { offset, length } = options.range;
      data = obj.data.slice(offset, offset + length);
    }

    return {
      arrayBuffer: async () => data,
    };
  }

  async head(key: string): Promise<{ size: number } | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { size: obj.data.byteLength };
  }

  async delete(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      this.objects.delete(k);
    }
  }

  async list(options?: { prefix?: string }): Promise<{ objects: { key: string; size: number }[] }> {
    const results: { key: string; size: number }[] = [];
    
    for (const [key, obj] of this.objects) {
      if (!options?.prefix || key.startsWith(options.prefix)) {
        results.push({ key, size: obj.data.byteLength });
      }
    }
    
    return { objects: results };
  }

  // Test utilities
  clear(): void {
    this.objects.clear();
  }

  getObject(key: string): StoredObject | undefined {
    return this.objects.get(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.objects.keys());
  }

  getObjectCount(): number {
    return this.objects.size;
  }
}
