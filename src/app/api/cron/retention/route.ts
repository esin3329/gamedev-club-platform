/**
 * 빌드 보관 정책 cleanup cron 엔드포인트
 * 
 * Cloudflare Workers cron 트리거에 의해 6시간마다 호출됩니다.
 * 또는 수동으로 호출할 수 있습니다 (CRON_SECRET 필요).
 * 
 * 각 프로젝트에 대해 보관 정책을 적용하여 오래된 빌드 파일을 삭제합니다.
 * 빌드 메타데이터는 유지되고 is_deleted 플래그만 true로 설정됩니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { 
  getR2BindingClient, 
  cleanupOldBuildsWithBinding,
} from '@/lib/storage/r2-binding';
import { 
  getStorageClient, 
  cleanupOldBuilds,
  getBuildStorageConfig,
} from '@/lib/storage/r2';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Cloudflare cron 트리거는 CF-Connecting-IP가 없음 (내부 호출)
  const isCronTrigger = !request.headers.get('cf-connecting-ip');
  
  if (!isCronTrigger) {
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  const config = getBuildStorageConfig();
  
  if (!config.retention.enabled) {
    return NextResponse.json({
      success: true,
      message: 'Retention policy is disabled',
      processed: 0,
    });
  }

  try {
    const supabase = await createServiceClient();
    
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, featured_build_id')
      .eq('is_deleted', false);

    if (projectsError) {
      throw projectsError;
    }

    const r2Binding = getR2BindingClient();
    
    let totalDeleted = 0;
    let totalPreserved = 0;
    const errors: string[] = [];

    for (const project of projects || []) {
      const { data: builds } = await supabase
        .from('builds')
        .select('id, version, build_type, storage_key, created_at')
        .eq('project_id', project.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (!builds || builds.length === 0) continue;

      const buildInfos = builds.map((b) => ({
        id: b.id,
        version: b.version,
        buildType: b.build_type as 'webgl' | 'pc',
        storageKey: b.storage_key,
        createdAt: new Date(b.created_at),
        isFeatured: b.id === project.featured_build_id,
      }));

      let result;
      
      if (r2Binding) {
        result = await cleanupOldBuildsWithBinding(
          r2Binding,
          project.id,
          buildInfos,
          project.featured_build_id
        );
      } else {
        result = await cleanupOldBuilds(
          project.id,
          buildInfos,
          project.featured_build_id
        );
      }

      totalDeleted += result.deletedBuilds.length;
      totalPreserved += result.preservedBuilds.length;
      errors.push(...result.errors);

      if (result.deletedBuilds.length > 0) {
        await supabase
          .from('builds')
          .update({ is_deleted: true })
          .in('id', result.deletedBuilds);
      }
    }

    return NextResponse.json({
      success: true,
      processed: projects?.length || 0,
      deleted: totalDeleted,
      preserved: totalPreserved,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Retention cleanup error:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
