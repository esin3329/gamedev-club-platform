import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Profile {
  nickname: string | null;
  global_role: string;
  status: string;
}

export default async function HomePage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, global_role, status')
    .eq('id', user.id)
    .single() as { data: Profile | null };

  if (!profile || profile.status !== 'active') {
    redirect('/pending');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              게임 개발 동아리
            </h1>
            <nav className="flex items-center gap-4">
              <Link
                href="/projects"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                프로젝트
              </Link>
              {profile.global_role === 'admin' && (
                <Link
                  href="/admin/approvals"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  관리
                </Link>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {profile.nickname || user.email}
              </span>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* 내 프로젝트 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              내 프로젝트
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              참여 중인 프로젝트가 없습니다.
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-block text-blue-600 dark:text-blue-400 text-sm hover:underline"
            >
              프로젝트 둘러보기 →
            </Link>
          </div>

          {/* 내 할 일 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              내 할 일
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              할당된 작업이 없습니다.
            </p>
          </div>

          {/* 다가오는 일정 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              다가오는 일정
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              예정된 일정이 없습니다.
            </p>
          </div>

          {/* 새 빌드 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              새로 올라온 빌드
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              새로운 빌드가 없습니다.
            </p>
          </div>

          {/* 모집 중인 프로젝트 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              모집 중인 프로젝트
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              현재 모집 중인 프로젝트가 없습니다.
            </p>
            <Link
              href="/projects?status=recruiting"
              className="mt-4 inline-block text-blue-600 dark:text-blue-400 text-sm hover:underline"
            >
              모집 공고 보기 →
            </Link>
          </div>

          {/* 최근 공지 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              최근 공지
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              새로운 공지가 없습니다.
            </p>
          </div>
        </div>

        {/* 관리자 퀵 액션 */}
        {profile.global_role === 'admin' && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              관리자 메뉴
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/admin/approvals"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                가입 승인 대기
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
