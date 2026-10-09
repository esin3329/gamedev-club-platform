import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ApprovalActions from './ApprovalActions';

export const dynamic = 'force-dynamic';

interface Profile {
  global_role: string;
  status: string;
}

interface Application {
  id: string;
  user_id: string;
  name: string;
  student_id: string | null;
  desired_position: string | null;
  introduction: string | null;
  status: string;
  created_at: string;
}

interface Cohort {
  id: string;
  name: string;
}

const POSITION_LABELS: Record<string, string> = {
  planning: '기획',
  programming: '프로그래밍',
  art: '아트',
  sound: '사운드',
};

export default async function AdminApprovalsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role, status')
    .eq('id', user.id)
    .single() as { data: Profile | null };

  if (!profile || profile.status !== 'active' || profile.global_role !== 'admin') {
    redirect('/');
  }

  const { data: applications } = await supabase
    .from('membership_applications')
    .select(`
      id,
      user_id,
      name,
      student_id,
      desired_position,
      introduction,
      status,
      created_at
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) as { data: Application[] | null };

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, name')
    .order('created_at', { ascending: false }) as { data: Cohort[] | null };

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
              가입 승인 관리
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {applications && applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {app.name}
                      </h3>
                      {app.desired_position && (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                          {POSITION_LABELS[app.desired_position] || app.desired_position}
                        </span>
                      )}
                    </div>
                    {app.student_id && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        학번: {app.student_id}
                      </p>
                    )}
                    {app.introduction && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        {app.introduction}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                      신청일: {new Date(app.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  
                  <ApprovalActions 
                    applicationId={app.id}
                    userId={app.user_id}
                    cohorts={cohorts || []}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <p className="text-gray-500 dark:text-gray-400">
              대기 중인 가입 신청이 없습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
