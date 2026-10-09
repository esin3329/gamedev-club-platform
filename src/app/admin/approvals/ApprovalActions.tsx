'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Cohort {
  id: string;
  name: string;
}

interface ApprovalActionsProps {
  applicationId: string;
  userId: string;
  cohorts: Cohort[];
}

export default function ApprovalActions({
  applicationId,
  userId,
  cohorts,
}: ApprovalActionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async () => {
    if (!selectedCohort) {
      alert('기수를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: 'active' as const,
          cohort_id: selectedCohort,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: appError } = await supabase
        .from('membership_applications')
        .update({
          status: 'approved' as const,
          reviewer_id: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (appError) throw appError;

      router.refresh();
    } catch (error) {
      console.error('Approval error:', error);
      alert('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: 'rejected' as const,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: appError } = await supabase
        .from('membership_applications')
        .update({
          status: 'rejected' as const,
          reviewer_id: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectReason || null,
        })
        .eq('id', applicationId);

      if (appError) throw appError;

      setShowRejectModal(false);
      router.refresh();
    } catch (error) {
      console.error('Rejection error:', error);
      alert('거절 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          value={selectedCohort}
          onChange={(e) => setSelectedCohort(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          disabled={loading}
        >
          <option value="">기수 선택</option>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleApprove}
          disabled={loading || !selectedCohort}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          승인
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          거절
        </button>
      </div>

      {/* 거절 사유 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              가입 거절
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거절 사유 (선택)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                거절 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
