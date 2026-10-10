/**
 * Admin Job Monitoring Page (TC-JOB-09, TC-JOB-11)
 * 
 * Displays the status of scheduled jobs (cron tasks):
 * - Last run time and result for each job
 * - Staleness warnings if a job hasn't succeeded in 24h
 */

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface JobRun {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'failed';
  summary: Record<string, unknown> | null;
  error: string | null;
}

interface JobStatus {
  jobName: string;
  displayName: string;
  description: string;
  lastRun: JobRun | null;
  lastSuccess: JobRun | null;
  isStale: boolean;
  isRunning: boolean;
}

const JOB_DEFINITIONS: Record<string, { displayName: string; description: string }> = {
  'retention-cleanup': {
    displayName: '빌드 보관 정책',
    description: '6시간마다 오래된 빌드 파일을 정리합니다.',
  },
  'keep-alive': {
    displayName: 'Supabase Keep-Alive',
    description: '매일 Supabase 무료 프로젝트의 비활성화를 방지합니다.',
  },
};

const STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  
  if (diff < 60 * 1000) return '방금 전';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}분 전`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}시간 전`;
  return `${Math.floor(diff / (24 * 60 * 60 * 1000))}일 전`;
}

function StatusBadge({ status, isStale }: { status: string; isStale: boolean }) {
  if (isStale) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        ⚠️ 오래됨
      </span>
    );
  }
  
  switch (status) {
    case 'running':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          🔄 실행 중
        </span>
      );
    case 'success':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          ✅ 성공
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          ❌ 실패
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          — 기록 없음
        </span>
      );
  }
}

export default async function AdminJobsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'active' || profile.global_role !== 'admin') {
    redirect('/');
  }

  // Get latest runs for each job
  const jobNames = Object.keys(JOB_DEFINITIONS);
  const jobStatuses: JobStatus[] = [];
  
  for (const jobName of jobNames) {
    const def = JOB_DEFINITIONS[jobName];
    
    // Get last run (any status)
    const { data: lastRunData } = await supabase
      .from('job_runs')
      .select('*')
      .eq('job_name', jobName)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    // Get last successful run
    const { data: lastSuccessData } = await supabase
      .from('job_runs')
      .select('*')
      .eq('job_name', jobName)
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single();
    
    const lastRun = lastRunData as JobRun | null;
    const lastSuccess = lastSuccessData as JobRun | null;
    
    // Check staleness
    let isStale = false;
    if (lastSuccess?.finished_at) {
      const timeSinceSuccess = Date.now() - new Date(lastSuccess.finished_at).getTime();
      isStale = timeSinceSuccess > STALENESS_THRESHOLD_MS;
    } else if (lastRun) {
      // No successful run ever
      isStale = true;
    }
    
    jobStatuses.push({
      jobName,
      displayName: def.displayName,
      description: def.description,
      lastRun,
      lastSuccess,
      isStale,
      isRunning: lastRun?.status === 'running',
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              ← 홈
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              스케줄 작업 모니터링
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {jobStatuses.map((job) => (
            <div
              key={job.jobName}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                job.isStale ? 'border-l-4 border-yellow-400' : ''
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {job.displayName}
                    </h3>
                    <StatusBadge 
                      status={job.lastRun?.status || 'none'} 
                      isStale={job.isStale && !job.isRunning}
                    />
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {job.description}
                  </p>
                  
                  {job.isStale && !job.isRunning && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-700 dark:text-yellow-400">
                      ⚠️ 이 작업이 24시간 이상 성공하지 못했습니다.
                    </div>
                  )}
                  
                  {job.lastRun?.error && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                      오류: {job.lastRun.error}
                    </div>
                  )}
                </div>
                
                <div className="text-right text-sm space-y-1">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">마지막 실행: </span>
                    <span className="text-gray-900 dark:text-white">
                      {job.lastRun?.started_at 
                        ? formatRelativeTime(new Date(job.lastRun.started_at))
                        : '없음'}
                    </span>
                  </div>
                  {job.lastSuccess && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">마지막 성공: </span>
                      <span className="text-gray-900 dark:text-white">
                        {formatRelativeTime(new Date(job.lastSuccess.finished_at!))}
                      </span>
                    </div>
                  )}
                  {job.lastRun?.summary && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <details>
                        <summary className="cursor-pointer">상세 정보</summary>
                        <pre className="mt-1 text-left bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-w-xs">
                          {JSON.stringify(job.lastRun.summary, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {jobStatuses.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <p className="text-gray-500 dark:text-gray-400">
                등록된 스케줄 작업이 없습니다.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
