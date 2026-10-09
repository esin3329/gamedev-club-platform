/**
 * S-22 내 활동
 * 내가 한 지원의 결과와 내가 제보한 버그의 처리 상태를 확인하는 화면
 */

export const dynamic = 'force-dynamic';

export default function MyActivityPage() {
  const applications = [
    { id: '1', project: '별빛 탐험대', position: '아트', date: '10/09', status: 'pending' as const },
    { id: '2', project: '픽셀 레이서', position: '사운드', date: '10/01', status: 'approved' as const },
    { id: '3', project: '타임 루프', position: '기획', date: '09/20', status: 'rejected' as const },
  ];
  
  type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
  type BugStatus = 'new' | 'confirmed' | 'in_progress' | 'fixed' | 'cannot_reproduce' | 'deferred';
  
  const bugReports: Array<{
    id: string;
    project: string;
    build: string;
    title: string;
    severity: BugSeverity;
    status: BugStatus;
    date: string;
  }> = [
    { id: '1', project: '던전 셰프', build: 'v0.1', title: '인벤토리 겹침', severity: 'high', status: 'fixed', date: '10/08' },
  ];
  
  const statusLabels = {
    pending: '검토 중',
    approved: '승인',
    rejected: '거절',
    cancelled: '취소',
  };
  
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  
  const bugStatusLabels = {
    new: '신규',
    confirmed: '확인됨',
    in_progress: '수정 중',
    fixed: '수정 완료',
    cannot_reproduce: '재현 불가',
    deferred: '보류',
  };
  
  const severityLabels = {
    critical: '치명',
    high: '높음',
    medium: '보통',
    low: '낮음',
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">내 활동</h1>
        
        <div className="mb-6">
          <div className="flex border-b">
            <button className="px-4 py-3 border-b-2 border-blue-600 font-medium text-blue-600">
              내 지원
            </button>
            <button className="px-4 py-3 text-gray-600 hover:text-gray-900">
              내 버그 리포트
            </button>
            <button className="px-4 py-3 text-gray-400 cursor-not-allowed">
              내 프로필 (P1)
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow divide-y">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>아직 지원한 프로젝트가 없어요</p>
              <a href="/projects?filter=recruiting" className="text-blue-600 hover:underline mt-2 inline-block">
                모집 중인 프로젝트 보기
              </a>
            </div>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-medium">{app.project}</span>
                    <span className="text-gray-500 ml-2">{app.position}</span>
                    <span className="text-sm text-gray-400 ml-2">{app.date} 지원</span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded ${statusColors[app.status]}`}>
                    {statusLabels[app.status]}
                  </span>
                  {app.status === 'approved' && (
                    <span className="text-sm text-green-600">→ 팀원 합류</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-gray-600 hover:underline">
                    지원서 보기
                  </button>
                  {app.status === 'pending' && (
                    <button className="text-sm text-red-600 hover:underline">
                      취소
                    </button>
                  )}
                  {app.status === 'approved' && (
                    <a 
                      href={`/projects/${app.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      프로젝트로
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <h2 className="text-lg font-semibold mt-8 mb-4">내 버그 리포트</h2>
        
        <div className="bg-white rounded-lg shadow divide-y">
          {bugReports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              제보한 버그가 없어요
            </div>
          ) : (
            bugReports.map((bug) => (
              <a 
                key={bug.id}
                href={`/bugs/${bug.id}`}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 block"
              >
                <div className="flex items-center gap-4">
                  <span>{bug.project}</span>
                  <span className="text-sm text-gray-500">{bug.build}</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    bug.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    bug.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    bug.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {severityLabels[bug.severity]}
                  </span>
                  <span className="font-medium">{bug.title}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    bug.status === 'fixed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {bugStatusLabels[bug.status]}
                  </span>
                  <span className="text-sm text-gray-500">{bug.date}</span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
