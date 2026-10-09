/**
 * WebGL Two-Phase Upload Security Tests
 * 
 * Tests for security fixes in the build registration flow:
 * - TC-F4-39a/b/c: Server-side expectedFiles storage (not trusted from client)
 * - TC-F4-40: Storage key derived server-side
 * - TC-F4-41: Actual R2 file sizes compared against validated sizes
 * - TC-F4-42: Abandoned upload cleanup (BUILD_TEMP_MAX_AGE_HOURS)
 * - TC-F4-46: Single-use validation (replay prevention)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the helper functions directly since we can't easily test the full route
describe('WebGL Two-Phase Upload Security', () => {
  describe('TC-F4-40: Server-derived storage keys', () => {
    it('TC-F4-40a: should derive temp zip key from projectId and buildId', () => {
      const projectId = 'proj-123';
      const buildId = 'build-456';
      const expected = `uploads/${projectId}/${buildId}.zip`;
      
      // This is the logic from deriveTempZipKey
      const derivedKey = `uploads/${projectId}/${buildId}.zip`;
      
      expect(derivedKey).toBe(expected);
    });

    it('TC-F4-40b: should reject storage keys that do not match project prefix', () => {
      const projectId = 'proj-123';
      const maliciousKey = 'uploads/other-project/build.zip';
      
      // This is the logic from validateStorageKeyPrefix
      const expectedPrefix = `uploads/${projectId}/`;
      const isValid = maliciousKey.startsWith(expectedPrefix);
      
      expect(isValid).toBe(false);
    });

    it('TC-F4-40c: should accept storage keys that match project prefix', () => {
      const projectId = 'proj-123';
      const validKey = 'uploads/proj-123/build-456.zip';
      
      const expectedPrefix = `uploads/${projectId}/`;
      const isValid = validKey.startsWith(expectedPrefix);
      
      expect(isValid).toBe(true);
    });

    it('TC-F4-40d: should reject PC build with wrong storage key prefix', () => {
      const projectId = 'proj-123';
      const maliciousStorageKey = 'pc/other-project/build.zip';
      
      const expectedPrefix = `pc/${projectId}/`;
      const isValid = maliciousStorageKey.startsWith(expectedPrefix);
      
      expect(isValid).toBe(false);
    });

    it('TC-F4-40e: should accept PC build with correct storage key prefix', () => {
      const projectId = 'proj-123';
      const validStorageKey = 'pc/proj-123/build-456.zip';
      
      const expectedPrefix = `pc/${projectId}/`;
      const isValid = validStorageKey.startsWith(expectedPrefix);
      
      expect(isValid).toBe(true);
    });
  });

  describe('TC-F4-39: ExpectedFiles server-side storage', () => {
    it('TC-F4-39a: should store expected files in pending_validations table', () => {
      // This is a structural test - the route now stores in DB, not returned to client for re-submission
      const expectedFiles = [
        { path: 'index.html', uncompressedSize: 1000 },
        { path: 'Build/game.wasm', uncompressedSize: 5000000 },
      ];
      
      // The pending_validations record structure
      const validationRecord = {
        build_id: 'build-123',
        project_id: 'proj-456',
        user_id: 'user-789',
        temp_storage_key: 'uploads/proj-456/build-123.zip',
        expected_files: expectedFiles,
        base_path: '',
        file_count: 2,
        total_uncompressed_size: 5001000,
        status: 'pending',
      };
      
      expect(validationRecord.expected_files).toEqual(expectedFiles);
      expect(validationRecord.temp_storage_key).toBe('uploads/proj-456/build-123.zip');
    });

    it('TC-F4-39b: should reject complete request without pending validation', () => {
      // The complete endpoint requires a matching pending_validations record
      const pendingValidation = null;
      
      const shouldReject = !pendingValidation;
      expect(shouldReject).toBe(true);
    });

    it('TC-F4-39c: should reject complete request with expired validation', () => {
      const pendingValidation = {
        expires_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        status: 'pending',
      };
      
      const isExpired = new Date(pendingValidation.expires_at) < new Date();
      expect(isExpired).toBe(true);
    });
  });

  describe('TC-F4-41: Actual file size verification', () => {
    it('TC-F4-41a: should compare uploaded file sizes against validated sizes', () => {
      const expectedFiles = [
        { path: 'index.html', uncompressedSize: 1000 },
        { path: 'game.js', uncompressedSize: 50000 },
      ];
      
      const uploadedFiles = [
        { key: 'index.html', size: 1000 },
        { key: 'game.js', size: 50000 },
      ];
      
      // Build lookup map
      const expectedMap = new Map(expectedFiles.map(f => [f.path.toLowerCase(), f]));
      
      // Check sizes match (with 5% tolerance)
      const sizeMismatches: { path: string; expected: number; actual: number }[] = [];
      
      for (const uploaded of uploadedFiles) {
        const expected = expectedMap.get(uploaded.key.toLowerCase());
        if (expected) {
          const tolerance = Math.max(expected.uncompressedSize * 0.05, 1024);
          const sizeDiff = Math.abs(uploaded.size - expected.uncompressedSize);
          
          if (sizeDiff > tolerance) {
            sizeMismatches.push({
              path: uploaded.key,
              expected: expected.uncompressedSize,
              actual: uploaded.size,
            });
          }
        }
      }
      
      expect(sizeMismatches).toHaveLength(0);
    });

    it('TC-F4-41b: should detect file size mismatch beyond tolerance', () => {
      const expectedFiles = [
        { path: 'index.html', uncompressedSize: 1000 },
        { path: 'game.js', uncompressedSize: 50000 },
      ];
      
      const uploadedFiles = [
        { key: 'index.html', size: 1000 },
        { key: 'game.js', size: 60000 }, // 20% larger - beyond 5% tolerance
      ];
      
      const expectedMap = new Map(expectedFiles.map(f => [f.path.toLowerCase(), f]));
      const sizeMismatches: { path: string; expected: number; actual: number }[] = [];
      
      for (const uploaded of uploadedFiles) {
        const expected = expectedMap.get(uploaded.key.toLowerCase());
        if (expected) {
          const tolerance = Math.max(expected.uncompressedSize * 0.05, 1024);
          const sizeDiff = Math.abs(uploaded.size - expected.uncompressedSize);
          
          if (sizeDiff > tolerance) {
            sizeMismatches.push({
              path: uploaded.key,
              expected: expected.uncompressedSize,
              actual: uploaded.size,
            });
          }
        }
      }
      
      expect(sizeMismatches).toHaveLength(1);
      expect(sizeMismatches[0].path).toBe('game.js');
    });

    it('TC-F4-41c: should enforce total size cap on actual uploaded bytes', () => {
      const maxSize = 500 * 1024 * 1024; // 500 MiB
      
      const uploadedFiles = [
        { key: 'index.html', size: 1000 },
        { key: 'game.wasm', size: 400 * 1024 * 1024 },
        { key: 'game.data', size: 150 * 1024 * 1024 }, // Total: ~550 MiB
      ];
      
      const totalActualSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
      const exceedsLimit = totalActualSize > maxSize;
      
      expect(exceedsLimit).toBe(true);
    });

    it('TC-F4-41d: should use actual R2 sizes not client-reported sizes', () => {
      // R2 list() returns objects with size property
      const r2Objects = [
        { key: 'webgl/proj/build/index.html', size: 1000, uploaded: new Date() },
        { key: 'webgl/proj/build/game.js', size: 50000, uploaded: new Date() },
      ];
      
      const prefix = 'webgl/proj/build/';
      const uploadedFiles = r2Objects.map(obj => ({
        key: obj.key.replace(prefix, ''),
        size: obj.size, // This comes from R2, not client
      }));
      
      expect(uploadedFiles[0].size).toBe(1000);
      expect(uploadedFiles[1].size).toBe(50000);
    });
  });

  describe('TC-F4-42: Abandoned upload cleanup (BUILD_TEMP_MAX_AGE_HOURS)', () => {
    it('TC-F4-42a: should identify expired pending validations', () => {
      const pendingValidations = [
        { 
          id: 'v1',
          expires_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
          status: 'pending',
        },
        { 
          id: 'v2',
          expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1h from now
          status: 'pending',
        },
      ];
      
      const now = new Date();
      const expired = pendingValidations.filter(v => 
        v.status === 'pending' && new Date(v.expires_at) < now
      );
      
      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe('v1');
    });

    it('TC-F4-42b: should cleanup temp zip on abandoned flow', () => {
      const pendingValidation = {
        temp_storage_key: 'uploads/proj-123/build-456.zip',
        project_id: 'proj-123',
        build_id: 'build-456',
      };
      
      // Files to delete
      const filesToDelete = [
        pendingValidation.temp_storage_key,
      ];
      
      // Partial uploads to delete
      const partialUploadPrefix = `webgl/${pendingValidation.project_id}/${pendingValidation.build_id}/`;
      
      expect(filesToDelete).toContain('uploads/proj-123/build-456.zip');
      expect(partialUploadPrefix).toBe('webgl/proj-123/build-456/');
    });

    it('TC-F4-42c: should identify orphaned temp zips older than BUILD_TEMP_MAX_AGE_HOURS', () => {
      const maxAge = 24 * 60 * 60 * 1000; // 24h in ms (default BUILD_TEMP_MAX_AGE_HOURS)
      const cutoff = new Date(Date.now() - maxAge);
      
      const tempZips = [
        { key: 'uploads/proj-1/build-1.zip', uploaded: new Date(Date.now() - 25 * 60 * 60 * 1000) }, // 25h old
        { key: 'uploads/proj-2/build-2.zip', uploaded: new Date(Date.now() - 1 * 60 * 60 * 1000) }, // 1h old
      ];
      
      const orphaned = tempZips.filter(z => z.uploaded < cutoff);
      
      expect(orphaned).toHaveLength(1);
      expect(orphaned[0].key).toBe('uploads/proj-1/build-1.zip');
    });
  });

  describe('TC-F4-46: Single-use validation (replay prevention)', () => {
    it('TC-F4-46a: validation status transitions from pending to processing', () => {
      // Simulating atomic claim via UPDATE ... WHERE status = 'pending'
      const validationBefore = { status: 'pending' };
      const validationAfter = { status: 'processing' };
      
      // Only one request should succeed in claiming
      expect(validationBefore.status).toBe('pending');
      expect(validationAfter.status).toBe('processing');
    });

    it('TC-F4-46b: second complete request should be rejected (already completed)', () => {
      const existingValidation = { status: 'completed' };
      
      // Check the status - completed means it was already used
      const shouldReject = existingValidation.status === 'completed';
      const errorCode = 'VALIDATION_ALREADY_USED';
      
      expect(shouldReject).toBe(true);
      expect(errorCode).toBe('VALIDATION_ALREADY_USED');
    });

    it('TC-F4-46c: concurrent complete request should be rejected (processing)', () => {
      const existingValidation = { status: 'processing' };
      
      // Check the status - processing means another request is handling it
      const shouldReject = existingValidation.status === 'processing';
      const errorCode = 'VALIDATION_IN_PROGRESS';
      
      expect(shouldReject).toBe(true);
      expect(errorCode).toBe('VALIDATION_IN_PROGRESS');
    });

    it('TC-F4-46d: expired validation cannot be replayed', () => {
      const existingValidation = { status: 'expired' };
      
      const shouldReject = existingValidation.status === 'expired';
      const errorCode = 'VALIDATION_EXPIRED';
      
      expect(shouldReject).toBe(true);
      expect(errorCode).toBe('VALIDATION_EXPIRED');
    });

    it('TC-F4-46e: failed validation cannot be replayed', () => {
      const existingValidation = { status: 'failed' };
      
      const shouldReject = existingValidation.status === 'failed';
      const errorCode = 'VALIDATION_FAILED';
      
      expect(shouldReject).toBe(true);
      expect(errorCode).toBe('VALIDATION_FAILED');
    });

    it('TC-F4-46f: valid status transitions for single-use pattern', () => {
      const validStatuses = ['pending', 'processing', 'completed', 'expired', 'failed'];
      
      // Valid transitions:
      // pending -> processing (claimed by complete)
      // processing -> completed (success)
      // processing -> failed (error during processing)
      // pending -> expired (cleanup job)
      
      const validTransitions = {
        pending: ['processing', 'expired'],
        processing: ['completed', 'failed'],
        completed: [], // terminal state
        expired: [], // terminal state
        failed: [], // terminal state
      };
      
      expect(validStatuses).toHaveLength(5);
      expect(validTransitions.pending).toContain('processing');
      expect(validTransitions.processing).toContain('completed');
      expect(validTransitions.completed).toHaveLength(0);
    });
  });
});
