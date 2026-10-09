import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Profile {
  status: string;
}

interface Project {
  id: string;
  name: string;
  tagline: string;
  engine: string;
  status: string;
  genres: string[] | null;
  thumbnail_url: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  planning: '기획 중',
  recruiting: '팀원 모집 중',
  developing: '개발 중',
  completed: '완료',
  paused: '보류',
  archived: '보관',
};

const ENGINE_LABELS: Record<string, string> = {
  unity: 'Unity',
  unreal: 'Unreal',
  godot: 'Godot',
  other: '기타',
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single() as { data: Profile | null };

  if (!profile || profile.status !== 'active') {
    redirect('/pending');
  }

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      tagline,
      engine,
      status,
      genres,
      thumbnail_url,
      created_at
    `)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false }) as { data: Project[] | null };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ← 홈
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                프로젝트
              </h1>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled
            >
              프로젝트 만들기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 필터 (플레이스홀더) */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled
          >
            <option>모든 상태</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled
          >
            <option>모든 엔진</option>
          </select>
          <input
            type="text"
            placeholder="프로젝트 검색..."
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled
          />
        </div>

        {/* 프로젝트 목록 */}
        {projects && projects.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
              >
                <div className="h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  {project.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.thumbnail_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">
                      이미지 없음
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {project.name}
                    </h3>
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {ENGINE_LABELS[project.engine] || project.engine}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {project.tagline}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        project.status === 'recruiting'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                    {project.genres && project.genres.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {project.genres.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              등록된 프로젝트가 없습니다.
            </p>
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
              첫 번째 프로젝트를 만들어보세요!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
