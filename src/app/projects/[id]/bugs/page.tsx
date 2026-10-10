/**
 * S-18 버그 리포트 목록 (프로젝트별)
 * 프로젝트의 빌드별 버그 리포트를 모아 보는 화면
 */

export const dynamic = 'force-dynamic';

interface BugsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BugsPage({ params }: BugsPageProps) {
  const { id } = await params;
  
  const bugs = [
    { id: '1', severity: 'critical', title: '보스전 후 멈춤', status: 'new', build: 'v0.3' },
    { id: '2', severity: 'medium', title: 'BGM 끊김', status: 'confirmed', build: 'v0.3' },
    { id: '3', severity: 'low', title: '오타', status: 'new', build: 'v0.3' },
  ];
  
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
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">버그 리포트</h2>
          <select className="border rounded-lg px-3 py-1 text-sm">
            <option>빌드 v0.3</option>
            <option>빌드 v0.2</option>
            <option>빌드 v0.1</option>
          </select>
        </div>
        
        <div className="flex gap-2 text-sm">
          <span>신규 2</span>
          <span className="text-gray-400">/</span>
          <span>확인됨 1</span>
          <span className="text-gray-400">/</span>
          <span>수정 중 0</span>
          <span className="text-gray-400">/</span>
          <span>종결 4</span>
        </div>
      </div>
      
      <div className="flex gap-4 mb-4">
        <select className="border rounded-lg px-3 py-2 text-sm">
          <option>상태: 미해결</option>
          <option>상태: 전체</option>
          <option>상태: 신규</option>
          <option>상태: 확인됨</option>
          <option>상태: 수정 중</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm">
          <option>심각도: 전체</option>
          <option>심각도: 치명</option>
          <option>심각도: 높음</option>
          <option>심각도: 보통</option>
          <option>심각도: 낮음</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {bugs.map((bug) => (
            <a 
              key={bug.id}
              href={`/bugs/${bug.id}`}
              className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded ${severityColors[bug.severity as keyof typeof severityColors]}`}>
                  {severityLabels[bug.severity as keyof typeof severityLabels]}
                </span>
                <span className="font-medium text-sm truncate">{bug.title}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{bug.status}</div>
            </a>
          ))}
        </div>
        
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                보스전 후 멈춤
                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">치명</span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                제보: 도윤 · 10/09 · Windows/Chrome
              </p>
            </div>
            <select className="border rounded-lg px-3 py-2 text-sm">
              <option>신규</option>
              <option>확인됨</option>
              <option>수정 중</option>
              <option>수정 완료</option>
              <option>재현 불가</option>
              <option>보류</option>
            </select>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">재현 단계</h4>
              <ol className="list-decimal list-inside text-sm">
                <li>1스테이지 보스 처치</li>
                <li>보상 상자 열기 → 화면 멈춤</li>
              </ol>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">기대 결과</h4>
                <p className="text-sm">다음 스테이지로 이동</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">실제 결과</h4>
                <p className="text-sm">화면 멈춤</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">스크린샷</h4>
              <div className="w-32 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-sm">
                스크린샷
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <button className="text-sm text-blue-600 hover:underline">
              작업 카드로 전환 (P1)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
