/**
 * Cloudflare Worker Entry Point
 * 
 * This worker wraps OpenNext's generated worker and adds scheduled (cron) handlers.
 * 
 * wrangler.jsonc cron triggers:
 * - "0 */6 * * *": Every 6 hours - retention policy cleanup
 * - "0 0 * * *": Daily at midnight - Supabase keep-alive
 * 
 * Features:
 * - Job run tracking in job_runs table (NFR-O5b, TC-JOB-09)
 * - Discord webhook alerts on failure (TC-JOB-10)
 * - Staleness warnings if job hasn't succeeded in 24h (TC-JOB-11)
 */

/// <reference types="@cloudflare/workers-types" />

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Env {
  R2_BUILDS: R2Bucket;
  KV_CACHE: KVNamespace;
  CRON_SECRET: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DISCORD_ALERT_WEBHOOK_URL?: string;
  BUILD_RETENTION_ENABLED?: string;
  BUILD_RETENTION_WEBGL_KEEP?: string;
  BUILD_RETENTION_PC_KEEP?: string;
}

interface BuildInfo {
  id: string;
  version: string;
  buildType: 'webgl' | 'pc';
  storageKey: string;
  createdAt: Date;
  isFeatured: boolean;
}

interface RetentionConfig {
  enabled: boolean;
  webglKeepCount: number;
  pcKeepCount: number;
}

interface JobRunResult {
  success: boolean;
  summary?: Record<string, unknown>;
  error?: string;
}

const STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function getRetentionConfig(env: Env): RetentionConfig {
  return {
    enabled: env.BUILD_RETENTION_ENABLED !== 'false',
    webglKeepCount: parseInt(env.BUILD_RETENTION_WEBGL_KEEP || '2', 10),
    pcKeepCount: parseInt(env.BUILD_RETENTION_PC_KEEP || '1', 10),
  };
}

async function deleteR2Prefix(bucket: R2Bucket, prefix: string): Promise<number> {
  let deletedCount = 0;
  let cursor: string | undefined;
  
  do {
    const result = await bucket.list({ prefix, cursor });
    if (result.objects.length > 0) {
      await Promise.all(result.objects.map(obj => bucket.delete(obj.key)));
      deletedCount += result.objects.length;
    }
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  
  return deletedCount;
}

async function sendDiscordAlert(
  webhookUrl: string,
  jobName: string,
  status: 'failed' | 'stale',
  details: string
): Promise<void> {
  const color = status === 'failed' ? 0xff0000 : 0xffaa00; // Red for failed, orange for stale
  const title = status === 'failed' 
    ? `🚨 Job Failed: ${jobName}`
    : `⚠️ Job Stale: ${jobName}`;
  
  const payload = {
    embeds: [{
      title,
      description: details,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Gamedev Club Platform - Cron Monitor'
      }
    }]
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status}`);
    }
  } catch (err) {
    console.error('Failed to send Discord alert:', err);
  }
}

async function checkAndAlertStaleness(
  supabase: SupabaseClient,
  jobName: string,
  webhookUrl?: string
): Promise<{ isStale: boolean; lastSuccess?: Date }> {
  const { data: lastSuccess } = await supabase
    .from('job_runs')
    .select('finished_at')
    .eq('job_name', jobName)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!lastSuccess?.finished_at) {
    return { isStale: false };
  }
  
  const lastSuccessTime = new Date(lastSuccess.finished_at);
  const timeSinceSuccess = Date.now() - lastSuccessTime.getTime();
  const isStale = timeSinceSuccess > STALENESS_THRESHOLD_MS;
  
  if (isStale && webhookUrl) {
    const hoursAgo = Math.round(timeSinceSuccess / (60 * 60 * 1000));
    await sendDiscordAlert(
      webhookUrl,
      jobName,
      'stale',
      `Job hasn't succeeded in ${hoursAgo} hours. Last success: ${lastSuccessTime.toISOString()}`
    );
  }
  
  return { isStale, lastSuccess: lastSuccessTime };
}

async function startJobRun(
  supabase: SupabaseClient,
  jobName: string
): Promise<string> {
  const { data, error } = await supabase
    .from('job_runs')
    .insert({
      job_name: jobName,
      status: 'running',
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create job run record:', error);
    throw error;
  }
  
  return data.id;
}

async function finishJobRun(
  supabase: SupabaseClient,
  runId: string,
  result: JobRunResult
): Promise<void> {
  const { error } = await supabase
    .from('job_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: result.success ? 'success' : 'failed',
      summary: result.summary || null,
      error: result.error || null,
    })
    .eq('id', runId);
  
  if (error) {
    console.error('Failed to update job run record:', error);
  }
}

async function runRetentionCleanup(env: Env, supabase: SupabaseClient): Promise<JobRunResult> {
  const config = getRetentionConfig(env);
  
  if (!config.enabled) {
    return { 
      success: true, 
      summary: { message: 'Retention policy is disabled', processed: 0 } 
    };
  }
  
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, featured_build_id')
    .eq('is_deleted', false);
  
  if (projectsError) {
    return { 
      success: false, 
      error: `Projects query failed: ${projectsError.message}` 
    };
  }
  
  let totalDeleted = 0;
  let totalPreserved = 0;
  const errors: string[] = [];
  
  for (const project of projects || []) {
    try {
      const { data: builds } = await supabase
        .from('builds')
        .select('id, version, build_type, storage_key, created_at')
        .eq('project_id', project.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      
      if (!builds || builds.length === 0) continue;
      
      const buildInfos: BuildInfo[] = builds.map(b => ({
        id: b.id,
        version: b.version,
        buildType: b.build_type as 'webgl' | 'pc',
        storageKey: b.storage_key,
        createdAt: new Date(b.created_at),
        isFeatured: b.id === project.featured_build_id,
      }));
      
      const webglBuilds = buildInfos.filter(b => b.buildType === 'webgl');
      const pcBuilds = buildInfos.filter(b => b.buildType === 'pc');
      
      const toDelete: BuildInfo[] = [];
      
      let webglKept = 0;
      for (const build of webglBuilds) {
        if (build.isFeatured) {
          totalPreserved++;
          continue;
        }
        if (webglKept < config.webglKeepCount) {
          webglKept++;
          totalPreserved++;
        } else {
          toDelete.push(build);
        }
      }
      
      let pcKept = 0;
      for (const build of pcBuilds) {
        if (build.isFeatured) {
          totalPreserved++;
          continue;
        }
        if (pcKept < config.pcKeepCount) {
          pcKept++;
          totalPreserved++;
        } else {
          toDelete.push(build);
        }
      }
      
      for (const build of toDelete) {
        try {
          if (build.buildType === 'webgl') {
            await deleteR2Prefix(env.R2_BUILDS, `webgl/${project.id}/${build.id}/`);
          } else {
            await env.R2_BUILDS.delete(build.storageKey);
          }
          
          await supabase
            .from('builds')
            .update({ is_deleted: true })
            .eq('id', build.id);
          
          totalDeleted++;
        } catch (err) {
          errors.push(`Failed to delete build ${build.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to process project ${project.id}: ${err}`);
    }
  }
  
  return {
    success: errors.length === 0,
    summary: {
      processed: projects?.length || 0,
      deleted: totalDeleted,
      preserved: totalPreserved,
      errors: errors.length > 0 ? errors : undefined,
    },
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

async function runKeepAlive(supabase: SupabaseClient): Promise<JobRunResult> {
  let databaseOk = false;
  let authOk = false;
  
  try {
    const { error: dbError } = await supabase
      .from('cohorts')
      .select('id')
      .limit(1);
    
    if (dbError) {
      const { error: fallbackError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      databaseOk = !fallbackError;
    } else {
      databaseOk = true;
    }
  } catch {
    databaseOk = false;
  }
  
  try {
    const { error: authError } = await supabase.auth.getSession();
    authOk = !authError;
  } catch {
    authOk = false;
  }
  
  return {
    success: databaseOk,
    summary: {
      database: databaseOk,
      auth: authOk,
    },
    error: !databaseOk ? 'Database ping failed' : undefined,
  };
}

export default {
  /**
   * HTTP request handling - OpenNext overrides this
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response('This worker is managed by OpenNext. Run `npm run build:cloudflare` to build.', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  },

  /**
   * Scheduled (cron) trigger handling
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronExpression = event.cron;
    const startTime = Date.now();
    
    console.log(`Cron triggered: ${cronExpression} at ${new Date(event.scheduledTime).toISOString()}`);
    
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase credentials not configured');
      return;
    }
    
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    let jobName: string;
    let runJob: () => Promise<JobRunResult>;
    
    if (cronExpression === '0 */6 * * *') {
      jobName = 'retention-cleanup';
      runJob = () => runRetentionCleanup(env, supabase);
    } else if (cronExpression === '0 0 * * *') {
      jobName = 'keep-alive';
      runJob = () => runKeepAlive(supabase);
    } else {
      console.log(`Unknown cron expression: ${cronExpression}`);
      return;
    }
    
    // Check staleness before running (TC-JOB-11)
    const stalenessCheck = await checkAndAlertStaleness(
      supabase,
      jobName,
      env.DISCORD_ALERT_WEBHOOK_URL
    );
    
    if (stalenessCheck.isStale) {
      console.warn(`Job ${jobName} is stale. Last success: ${stalenessCheck.lastSuccess?.toISOString()}`);
    }
    
    // Start job run tracking (TC-JOB-09)
    let runId: string | null = null;
    try {
      runId = await startJobRun(supabase, jobName);
    } catch (err) {
      console.error('Failed to start job run tracking:', err);
    }
    
    // Execute the job
    let result: JobRunResult;
    try {
      result = await runJob();
      console.log(`Job ${jobName} completed in ${Date.now() - startTime}ms:`, JSON.stringify(result));
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      console.error(`Job ${jobName} threw exception:`, error);
    }
    
    // Finish job run tracking
    if (runId) {
      await finishJobRun(supabase, runId, result);
    }
    
    // Send Discord alert on failure (TC-JOB-10)
    if (!result.success && env.DISCORD_ALERT_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_ALERT_WEBHOOK_URL,
        jobName,
        'failed',
        result.error || 'Job failed without error message'
      );
    }
  },
};
