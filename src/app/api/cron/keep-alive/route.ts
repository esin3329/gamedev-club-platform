/**
 * Supabase keep-alive ping cron 엔드포인트
 * 
 * Cloudflare Workers cron 트리거에 의해 매일 호출됩니다.
 * Supabase 무료 프로젝트의 비활성 일시정지를 방지합니다.
 * 
 * Supabase Free tier는 7일 동안 API 호출이 없으면 프로젝트가 일시정지됩니다.
 * 이 엔드포인트는 간단한 쿼리를 실행하여 프로젝트를 활성 상태로 유지합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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

  try {
    const supabase = await createServiceClient();
    
    // 간단한 쿼리로 Supabase에 ping
    // cohorts 테이블에서 최신 1개 조회 (가벼운 쿼리)
    const { data, error } = await supabase
      .from('cohorts')
      .select('id')
      .limit(1);

    if (error) {
      // 테이블이 없을 수 있으므로 다른 테이블 시도
      const { error: fallbackError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (fallbackError) {
        throw fallbackError;
      }
    }

    // 추가로 auth 서비스도 확인 (선택적)
    const { error: authError } = await supabase.auth.getSession();
    
    return NextResponse.json({
      success: true,
      message: 'Supabase is alive',
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        auth: !authError,
      },
    });

  } catch (error) {
    console.error('Keep-alive ping error:', error);
    return NextResponse.json(
      { 
        error: 'Keep-alive failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
