/**
 * S-18 버그 리포트 상세
 * 개별 버그 리포트 상세 화면 (내 활동에서 접근)
 */

export const dynamic = 'force-dynamic';

interface BugDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BugDetailPage({ params }: BugDetailPageProps) {
  const { id } = await params;
  
  const bug = {
    id,
    projectId: 'project-1',
    projectName: '별빛 탐험대',
    buildVersion: 'v0.3',
    title: '보스전 후 멈춤',
    severity: 'critical' as const,
    status: 'new' as const,
    reporter: '도윤',
    date: '10/09',
    environment: 'Windows / Chrome',
    stepsToReproduce: '1. 1스테이지 보스 처치\n2. 보상 상자 열기 → 화면 멈춤',
    expectedResult: '다음 스테이지로 이동',
    actualResult: '화면 멈춤',
  };
  
  const severityColors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-700',
  };
  
  const severityLabels = {
    critical: '치명',
    high: '높음',
    medium: '보통',
    low: '낮음',
  };
  
  const statusLabels = {
    new: '신규',
    confirmed: '확인됨',
    in_progress: '수정 중',
    fixed: '수정 완료',
    cannot_reproduce: '재현 불가',
    deferred: '보류',
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <a 
            href={`/projects/${bug.projectId}/bugs`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← {bug.projectName} 버그 리포트
          </a>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-3">
                {bug.title}
                <span className={`px-2 py-0.5 text-sm rounded ${severityColors[bug.severity]}`}>
                  {severityLabels[bug.severity]}
                </span>
              </h1>
              <p className="text-gray-500 mt-1">
                제보: {bug.reporter} · {bug.date} · {bug.environment}
              </p>
              <p className="text-gray-500">
                빌드: {bug.buildVersion}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">상태:</span>
              <select className="border rounded-lg px-3 py-2">
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value} selected={value === bug.status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold mb-2">재현 단계</h2>
              <pre className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {bug.stepsToReproduce}
              </pre>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h2 className="font-semibold mb-2">기대 결과</h2>
                <p className="bg-gray-50 rounded-lg p-4 text-sm">{bug.expectedResult}</p>
              </div>
              <div>
                <h2 className="font-semibold mb-2">실제 결과</h2>
                <p className="bg-gray-50 rounded-lg p-4 text-sm">{bug.actualResult}</p>
              </div>
            </div>
            
            <div>
              <h2 className="font-semibold mb-2">스크린샷</h2>
              <div className="flex gap-4">
                <div className="w-48 h-36 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                  스크린샷 없음
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t flex justify-between">
            <a 
              href={`/builds/${bug.projectId}`}
              className="text-blue-600 hover:underline"
            >
              해당 빌드로 이동
            </a>
            <button className="text-blue-600 hover:underline">
              작업 카드로 전환 (P1)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
