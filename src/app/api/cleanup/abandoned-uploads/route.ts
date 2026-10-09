/**
 * 방치된 업로드 정리 API
 * 
 * POST /api/cleanup/abandoned-uploads
 * 
 * 이 엔드포인트는 cron job으로 주기적으로 호출되어야 합니다.
 * Cloudflare Workers의 경우 Cron Triggers를 사용합니다.
 * 
 * 정리 대상:
 * 1. 만료된 pending_validations (24시간 이상 경과)
 * 2. 해당 검증에 연결된 임시 zip 파일
 * 3. 부분적으로 업로드된 WebGL 파일들
 * 
 * TC-F4-39: Temp zip deletion on abandoned flows
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageClient, getBuildStorageConfig } from '@/lib/storage/r2';
import { getR2BindingClient, getR2Binding } from '@/lib/storage/r2-binding';

interface CleanupResult {
  expiredValidations: number;
  deletedTempZips: number;
  deletedPartialUploads: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization (cron secret or admin)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require it
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Check if user is admin
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('global_role')
        .eq('id', user.id)
        .single();
      
      if (!profile || profile.global_role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const result = await cleanupAbandonedUploads();
    
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Clean up abandoned uploads and expired validations
 */
export async function cleanupAbandonedUploads(): Promise<CleanupResult> {
  const supabase = await createClient();
  const storage = getStorageClient();
  const r2Binding = getR2BindingClient();
  const r2Bucket = getR2Binding();
  const config = getBuildStorageConfig();
  
  const result: CleanupResult = {
    expiredValidations: 0,
    deletedTempZips: 0,
    deletedPartialUploads: 0,
    errors: [],
  };

  // 1. Find expired pending validations
  const { data: expiredValidations, error: fetchError } = await supabase
    .from('pending_validations')
    .select('*')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (fetchError) {
    result.errors.push(`Failed to fetch expired validations: ${fetchError.message}`);
    return result;
  }

  if (!expiredValidations || expiredValidations.length === 0) {
    return result;
  }

  // 2. Process each expired validation
  for (const validation of expiredValidations) {
    try {
      // Delete temp zip
      try {
        await storage.deleteBuild(validation.temp_storage_key);
        result.deletedTempZips++;
      } catch (err) {
        // Temp zip might already be deleted
        console.warn(`Temp zip not found: ${validation.temp_storage_key}`);
      }

      // Delete any partially uploaded files
      const prefix = `webgl/${validation.project_id}/${validation.build_id}/`;
      
      if (r2Binding) {
        const keys = await r2Binding.list(prefix);
        if (keys.length > 0) {
          await r2Binding.deleteMany(keys);
          result.deletedPartialUploads += keys.length;
        }
      } else if (r2Bucket) {
        let cursor: string | undefined;
        const keysToDelete: string[] = [];
        
        do {
          const listResult = await r2Bucket.list({ prefix, cursor });
          for (const obj of listResult.objects) {
            keysToDelete.push(obj.key);
          }
          cursor = listResult.truncated ? listResult.cursor : undefined;
        } while (cursor);
        
        if (keysToDelete.length > 0) {
          await r2Bucket.delete(keysToDelete);
          result.deletedPartialUploads += keysToDelete.length;
        }
      } else {
        // AWS SDK fallback
        const listed = await storage.listObjects(prefix);
        if (listed.length > 0) {
          for (const obj of listed) {
            await storage.deleteBuild(obj.key);
          }
          result.deletedPartialUploads += listed.length;
        }
      }

      // Mark validation as expired
      await supabase
        .from('pending_validations')
        .update({ status: 'expired' })
        .eq('id', validation.id);

      result.expiredValidations++;
    } catch (err) {
      result.errors.push(
        `Failed to cleanup validation ${validation.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  // 3. Also cleanup very old temp zips that might not have validation records
  // (e.g., from before the pending_validations table was added)
  try {
    await cleanupOrphanedTempZips(storage, r2Bucket, result);
  } catch (err) {
    result.errors.push(
      `Failed to cleanup orphaned temp zips: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Clean up temp zips older than 24 hours that don't have pending_validations records
 */
async function cleanupOrphanedTempZips(
  storage: ReturnType<typeof getStorageClient>,
  r2Bucket: ReturnType<typeof getR2Binding>,
  result: CleanupResult
): Promise<void> {
  const supabase = await createClient();
  const config = getBuildStorageConfig();
  const maxAge = config.cleanup?.orphanedUploadMaxAgeMs || 24 * 60 * 60 * 1000; // Default 24h
  const cutoff = new Date(Date.now() - maxAge);

  const prefix = 'uploads/';
  
  if (r2Bucket) {
    let cursor: string | undefined;
    
    do {
      const listResult = await r2Bucket.list({ prefix, cursor });
      
      for (const obj of listResult.objects) {
        // Check if older than cutoff
        if (obj.uploaded < cutoff) {
          // Check if there's a pending validation for this
          const match = obj.key.match(/^uploads\/([^/]+)\/([^/]+)\.zip$/);
          if (match) {
            const [, projectId, buildId] = match;
            
            const { data: validation } = await supabase
              .from('pending_validations')
              .select('id')
              .eq('build_id', buildId)
              .eq('status', 'pending')
              .single();
            
            // If no pending validation, it's orphaned
            if (!validation) {
              try {
                await r2Bucket.delete(obj.key);
                result.deletedTempZips++;
              } catch {
                result.errors.push(`Failed to delete orphaned zip: ${obj.key}`);
              }
            }
          }
        }
      }
      
      cursor = listResult.truncated ? listResult.cursor : undefined;
    } while (cursor);
  }
}

// Export for Cloudflare Workers scheduled handler
export { cleanupAbandonedUploads as scheduled };
