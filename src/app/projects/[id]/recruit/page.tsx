/**
 * S-08 프로젝트 상세 - 모집 탭
 * 포지션별 모집 현황을 보고 지원하거나 모집 공고를 관리하는 화면
 */

export const dynamic = 'force-dynamic';

interface RecruitPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecruitPage({ params }: RecruitPageProps) {
  const { id } = await params;
  
  const isLeader = false; // TODO: 실제 권한 체크
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">포지션별 모집 현황</h2>
          {isLeader && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              + 공고 등록
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          <RecruitmentCard
            position="아트"
            current={1}
            total={2}
            deadline="10/20"
            status="recruiting"
            description="필요 역량: 도트 캐릭터, 애니메이션"
            hasApplied={false}
          />
          
          <RecruitmentCard
            position="사운드"
            current={0}
            total={1}
            deadline={null}
            status="recruiting"
            description="효과음 + BGM 2곡"
            hasApplied={true}
          />
          
          <RecruitmentCard
            position="프로그래밍"
            current={2}
            total={2}
            deadline={null}
            status="filled"
            description="Unity C# 개발"
            hasApplied={false}
          />
        </div>
      </div>
      
      {isLeader && (
        <div className="space-y-6">
          <section className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">지원자 현황</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>검토 중</span>
                <span className="font-medium">3건</span>
              </li>
              <li className="flex justify-between">
                <span>승인</span>
                <span className="font-medium">2건</span>
              </li>
              <li className="flex justify-between">
                <span>거절</span>
                <span className="font-medium">1건</span>
              </li>
            </ul>
            <a 
              href={`/projects/${id}/applicants`}
              className="block mt-4 text-center py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              지원자 관리
            </a>
          </section>
        </div>
      )}
    </div>
  );
}

interface RecruitmentCardProps {
  position: string;
  current: number;
  total: number;
  deadline: string | null;
  status: 'recruiting' | 'filled' | 'closed';
  description: string;
  hasApplied: boolean;
}

function RecruitmentCard({ 
  position, 
  current, 
  total, 
  deadline, 
  status, 
  description,
  hasApplied 
}: RecruitmentCardProps) {
  const statusLabels = {
    recruiting: '모집 중',
    filled: '충원 완료',
    closed: '마감',
  };
  
  const statusColors = {
    recruiting: 'bg-green-100 text-green-700',
    filled: 'bg-gray-100 text-gray-700',
    closed: 'bg-gray-100 text-gray-500',
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">{position}</h3>
            <span className="text-sm text-gray-500">{current} / {total}명</span>
            {deadline && (
              <span className="text-sm text-gray-500">마감 {deadline}</span>
            )}
            <span className={`px-2 py-0.5 text-xs rounded ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">{description}</p>
        </div>
        <div>
          {status === 'recruiting' && !hasApplied && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              지원하기
            </button>
          )}
          {hasApplied && (
            <button className="px-4 py-2 border text-gray-600 rounded-lg text-sm">
              지원 완료 (검토 중)
            </button>
          )}
          {status === 'filled' && (
            <span className="text-sm text-gray-400">충원 완료</span>
          )}
        </div>
      </div>
    </div>
  );
}
