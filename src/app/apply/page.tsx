'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Position } from '@/types/database';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'planning', label: '기획' },
  { value: 'programming', label: '프로그래밍' },
  { value: 'art', label: '아트' },
  { value: 'sound', label: '사운드' },
];

export default function ApplyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    studentId: '',
    desiredPosition: '' as Position | '',
    introduction: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('로그인이 필요합니다.');
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          name: formData.name,
          nickname: user.user_metadata?.full_name || formData.name,
          avatar_url: user.user_metadata?.avatar_url || null,
          primary_position: formData.desiredPosition || null,
          engines: [] as string[],
          external_links: {} as Record<string, string>,
          cohort_id: null,
          global_role: 'member' as const,
          status: 'pending' as const,
        });

      if (profileError) throw profileError;

      const { error: applicationError } = await supabase
        .from('membership_applications')
        .insert({
          user_id: user.id,
          name: formData.name,
          student_id: formData.studentId || null,
          desired_position: formData.desiredPosition || null,
          introduction: formData.introduction || null,
          status: 'pending' as const,
        });

      if (applicationError) throw applicationError;

      router.push('/pending');
    } catch (err) {
      console.error('Application error:', err);
      setError('신청 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-lg w-full space-y-6 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            동아리 가입 신청
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            아래 정보를 입력하면 운영진의 승인 후 플랫폼을 이용할 수 있습니다.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="실명을 입력하세요"
            />
          </div>

          <div>
            <label
              htmlFor="studentId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              학번 (선택)
            </label>
            <input
              type="text"
              id="studentId"
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 20210001"
            />
          </div>

          <div>
            <label
              htmlFor="position"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              희망 포지션
            </label>
            <select
              id="position"
              value={formData.desiredPosition}
              onChange={(e) => setFormData({ ...formData, desiredPosition: e.target.value as Position })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">선택하세요</option>
              {POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="introduction"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              한 줄 소개
            </label>
            <textarea
              id="introduction"
              rows={3}
              value={formData.introduction}
              onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="간단한 자기소개를 작성해주세요"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              로그아웃
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '처리 중...' : '가입 신청'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
