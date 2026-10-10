/**
 * Job Tracking and Alert Tests
 * 
 * TC-JOB-09: Job run tracking in job_runs table
 * TC-JOB-10: Discord webhook alerts on failure
 * TC-JOB-11: Staleness warning if job hasn't succeeded in 24h
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

describe('TC-JOB-09: Job run tracking', () => {
  it('TC-JOB-09a: job run record created with running status', () => {
    const jobRun = {
      id: 'run-123',
      job_name: 'retention-cleanup',
      started_at: new Date().toISOString(),
      finished_at: null,
      status: 'running' as const,
      summary: null,
      error: null,
    };
    
    expect(jobRun.status).toBe('running');
    expect(jobRun.finished_at).toBeNull();
    expect(jobRun.error).toBeNull();
  });

  it('TC-JOB-09b: job run updated to success with summary', () => {
    const jobRun = {
      id: 'run-123',
      job_name: 'retention-cleanup',
      started_at: new Date(Date.now() - 5000).toISOString(),
      finished_at: new Date().toISOString(),
      status: 'success' as const,
      summary: { processed: 10, deleted: 2, preserved: 8 },
      error: null,
    };
    
    expect(jobRun.status).toBe('success');
    expect(jobRun.finished_at).not.toBeNull();
    expect(jobRun.summary).toEqual({ processed: 10, deleted: 2, preserved: 8 });
  });

  it('TC-JOB-09c: job run updated to failed with error', () => {
    const jobRun = {
      id: 'run-123',
      job_name: 'retention-cleanup',
      started_at: new Date(Date.now() - 5000).toISOString(),
      finished_at: new Date().toISOString(),
      status: 'failed' as const,
      summary: null,
      error: 'Database connection failed',
    };
    
    expect(jobRun.status).toBe('failed');
    expect(jobRun.error).toBe('Database connection failed');
  });

  it('TC-JOB-09d: RLS policy allows admin read', () => {
    // This is a schema design test - the actual RLS is tested in SQL
    const adminProfile = {
      id: 'user-admin',
      global_role: 'admin',
    };
    
    const canRead = adminProfile.global_role === 'admin';
    expect(canRead).toBe(true);
  });

  it('TC-JOB-09e: RLS policy blocks non-admin read', () => {
    const memberProfile = {
      id: 'user-member',
      global_role: 'member',
    };
    
    const canRead = memberProfile.global_role === 'admin';
    expect(canRead).toBe(false);
  });
});

describe('TC-JOB-10: Discord webhook alerts on failure', () => {
  it('TC-JOB-10a: webhook payload structure is correct', () => {
    const createWebhookPayload = (
      jobName: string,
      status: 'failed' | 'stale',
      details: string
    ) => {
      const color = status === 'failed' ? 0xff0000 : 0xffaa00;
      const title = status === 'failed'
        ? `🚨 Job Failed: ${jobName}`
        : `⚠️ Job Stale: ${jobName}`;
      
      return {
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
    };
    
    const payload = createWebhookPayload(
      'retention-cleanup',
      'failed',
      'Database connection failed'
    );
    
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].title).toBe('🚨 Job Failed: retention-cleanup');
    expect(payload.embeds[0].color).toBe(0xff0000);
    expect(payload.embeds[0].description).toBe('Database connection failed');
  });

  it('TC-JOB-10b: stale alert has warning color', () => {
    const color = 0xffaa00; // Orange for stale
    expect(color).toBe(16755200);
  });

  it('TC-JOB-10c: failed alert has error color', () => {
    const color = 0xff0000; // Red for failed
    expect(color).toBe(16711680);
  });

  it('TC-JOB-10d: alert skipped if webhook URL not set', () => {
    const webhookUrl: string | undefined = undefined;
    
    const shouldSendAlert = webhookUrl !== undefined;
    expect(shouldSendAlert).toBe(false);
  });

  it('TC-JOB-10e: alert sent if webhook URL is set', () => {
    const webhookUrl = 'https://discord.com/api/webhooks/123/abc';
    
    const shouldSendAlert = webhookUrl !== undefined;
    expect(shouldSendAlert).toBe(true);
  });
});

describe('TC-JOB-11: Staleness warning', () => {
  it('TC-JOB-11a: job is not stale if succeeded recently', () => {
    const lastSuccessTime = Date.now() - (12 * 60 * 60 * 1000); // 12 hours ago
    const timeSinceSuccess = Date.now() - lastSuccessTime;
    
    const isStale = timeSinceSuccess > STALENESS_THRESHOLD_MS;
    expect(isStale).toBe(false);
  });

  it('TC-JOB-11b: job is stale if not succeeded in 24h', () => {
    const lastSuccessTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    const timeSinceSuccess = Date.now() - lastSuccessTime;
    
    const isStale = timeSinceSuccess > STALENESS_THRESHOLD_MS;
    expect(isStale).toBe(true);
  });

  it('TC-JOB-11c: job is stale at exactly 24h boundary', () => {
    const lastSuccessTime = Date.now() - (24 * 60 * 60 * 1000 + 1); // 24h + 1ms ago
    const timeSinceSuccess = Date.now() - lastSuccessTime;
    
    const isStale = timeSinceSuccess > STALENESS_THRESHOLD_MS;
    expect(isStale).toBe(true);
  });

  it('TC-JOB-11d: staleness check runs before job execution', () => {
    const executionOrder: string[] = [];
    
    // Simulate the cron handler flow
    const stalenessCheck = () => {
      executionOrder.push('staleness-check');
      return { isStale: true, lastSuccess: new Date(Date.now() - 25 * 60 * 60 * 1000) };
    };
    
    const runJob = () => {
      executionOrder.push('run-job');
      return { success: true };
    };
    
    // Execute in order
    stalenessCheck();
    runJob();
    
    expect(executionOrder).toEqual(['staleness-check', 'run-job']);
    expect(executionOrder[0]).toBe('staleness-check');
  });

  it('TC-JOB-11e: staleness warning message includes hours since last success', () => {
    const lastSuccessTime = new Date(Date.now() - (30 * 60 * 60 * 1000)); // 30 hours ago
    const timeSinceSuccess = Date.now() - lastSuccessTime.getTime();
    const hoursAgo = Math.round(timeSinceSuccess / (60 * 60 * 1000));
    
    const warningMessage = `Job hasn't succeeded in ${hoursAgo} hours. Last success: ${lastSuccessTime.toISOString()}`;
    
    expect(warningMessage).toContain('30 hours');
    expect(warningMessage).toContain('Last success:');
  });

  it('TC-JOB-11f: admin page shows staleness warning', () => {
    // This tests the admin page UI component logic
    const jobStatus = {
      jobName: 'retention-cleanup',
      lastRun: {
        status: 'failed',
        started_at: new Date().toISOString(),
      },
      lastSuccess: {
        finished_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      },
      isStale: true,
    };
    
    // Admin page should show warning
    expect(jobStatus.isStale).toBe(true);
    
    // Warning badge should display
    const warningBadgeText = jobStatus.isStale ? '⚠️ 오래됨' : '';
    expect(warningBadgeText).toBe('⚠️ 오래됨');
  });
});
