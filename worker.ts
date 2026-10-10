/**
 * Cloudflare Worker 진입점
 * 
 * OpenNext for Cloudflare가 생성하는 워커와 함께 사용됩니다.
 * scheduled 이벤트(cron 트리거)를 처리합니다.
 * 
 * wrangler.jsonc의 triggers.crons 설정과 연동됩니다:
 * - "0 *\/6 * * *": 6시간마다 보관 정책 cleanup
 * - "0 0 * * *": 매일 자정 Supabase keep-alive
 */

/// <reference types="@cloudflare/workers-types" />

export interface Env {
  R2_BUILDS: R2Bucket;
  KV_CACHE: KVNamespace;
  CRON_SECRET: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export default {
  /**
   * HTTP 요청 처리 - OpenNext가 이 부분을 오버라이드합니다
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // OpenNext가 이 핸들러를 대체합니다.
    // 직접 실행 시 에러 반환
    return new Response('This worker is managed by OpenNext', { status: 500 });
  },

  /**
   * 스케줄 트리거 (cron) 처리
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronExpression = event.cron;
    
    console.log(`Cron triggered: ${cronExpression} at ${new Date(event.scheduledTime).toISOString()}`);
    
    // 사이트 URL 결정 (환경변수 또는 기본값)
    const siteUrl = env.NEXT_PUBLIC_SUPABASE_URL 
      ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin.replace('supabase', 'gamedev')
      : 'https://gamedev.example.com';
    
    try {
      if (cronExpression === '0 */6 * * *') {
        // 6시간마다: 보관 정책 cleanup
        await callCronEndpoint(`${siteUrl}/api/cron/retention`, env.CRON_SECRET);
      } else if (cronExpression === '0 0 * * *') {
        // 매일 자정: Supabase keep-alive
        await callCronEndpoint(`${siteUrl}/api/cron/keep-alive`, env.CRON_SECRET);
      } else {
        console.log(`Unknown cron expression: ${cronExpression}`);
      }
    } catch (error) {
      console.error(`Cron job failed for ${cronExpression}:`, error);
    }
  },
};

async function callCronEndpoint(url: string, secret: string): Promise<void> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'User-Agent': 'Cloudflare-Cron/1.0',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cron endpoint returned ${response.status}: ${text}`);
  }

  const result = await response.json();
  console.log(`Cron result for ${url}:`, JSON.stringify(result));
}
