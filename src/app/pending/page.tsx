'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface Application {
  status: ApplicationStatus;
  rejection_reason: string | null;
  created_at: string;
}

export default function PendingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplication = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data } = await supabase
        .from('membership_applications')
        .select('status, rejection_reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as { data: Application | null };

      setApplication(data);
      setLoading(false);
    };

    fetchApplication();

    const channel = supabase
      .channel('application_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'membership_applications',
        },
        async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('status')
              .eq('id', user.id)
              .single() as { data: { status: string } | null };
            
            if (profile?.status === 'active') {
              router.push('/');
            }
          }
          fetchApplication();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        {application?.status === 'rejected' ? (
          <>
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              가입이 거절되었습니다
            </h1>
            {application.rejection_reason && (
              <p className="text-gray-600 dark:text-gray-400">
                사유: {application.rejection_reason}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-500">
              문의 사항이 있으시면 동아리 Discord로 연락해주세요.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              승인 대기 중
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              가입 신청이 접수되었습니다.
              <br />
              운영진의 승인 후 플랫폼을 이용하실 수 있습니다.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              승인이 완료되면 자동으로 홈 화면으로 이동합니다.
              <br />
              문의: 동아리 Discord
            </p>
          </>
        )}

        <button
          onClick={handleSignOut}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
