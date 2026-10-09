/**
 * S-25 운영진 - 콘텐츠 관리
 * 숨김 처리된 피드백을 확인하고 숨김 해제하거나, 규정 위반 빌드 삭제 이력을 보는 화면
 */

export const dynamic = 'force-dynamic';

export default function ContentManagementPage() {
  const hiddenContent = [
    { 
      id: '1', 
      type: '코멘트', 
      location: '별빛 탐험대 v0.3', 
      author: 'OO',
      reason: '비방 표현',
      hiddenBy: '운영진A',
      hiddenAt: '10/09',
    },
  ];
  
  const deletedBuilds = [
    {
      id: '1',
      project: '테스트 프로젝트',
      version: 'v0.1',
      reason: '규정 위반 콘텐츠',
      deletedBy: '운영진A',
      deletedAt: '10/05',
    },
  ];
  
  return (
    <div>
      <h1 className="text-xl font-bold mb-6">콘텐츠 관리</h1>
      
      <div className="mb-6">
        <div className="flex border-b">
          <button className="px-4 py-3 border-b-2 border-blue-600 font-medium text-blue-600">
            숨김 처리된 콘텐츠
          </button>
          <button className="px-4 py-3 text-gray-600 hover:text-gray-900">
            삭제된 빌드
          </button>
          <button className="px-4 py-3 text-gray-400 cursor-not-allowed">
            저장 공간 (P1)
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow divide-y">
        {hiddenContent.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            숨김 처리된 콘텐츠가 없어요
          </div>
        ) : (
          hiddenContent.map((item) => (
            <div key={item.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {item.type}
                    </span>
                    <span className="font-medium">{item.location}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    작성자: {item.author}
                  </p>
                  <p className="text-sm text-gray-500">
                    사유: {item.reason} · 숨김: {item.hiddenBy} {item.hiddenAt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-gray-600 hover:underline">
                    내용 보기
                  </button>
                  <button className="text-sm text-blue-600 hover:underline">
                    숨김 해제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <h2 className="text-lg font-semibold mt-8 mb-4">삭제된 빌드</h2>
      
      <div className="bg-white rounded-lg shadow divide-y">
        {deletedBuilds.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            삭제된 빌드가 없어요
          </div>
        ) : (
          deletedBuilds.map((item) => (
            <div key={item.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <span className="font-medium">{item.project}</span>
                <span className="text-gray-500 ml-2">{item.version}</span>
                <p className="text-sm text-gray-500 mt-1">
                  사유: {item.reason} · 삭제: {item.deletedBy} {item.deletedAt}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-8 bg-gray-100 rounded-lg p-6">
        <h3 className="font-semibold mb-2">R2 사용량 (P1)</h3>
        <p className="text-sm text-gray-500 mb-4">
          저장 공간 현황과 오래된 빌드 정리 기능은 P1 범위입니다.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="w-[45%] h-full bg-blue-600" />
          </div>
          <span className="text-sm text-gray-600">무료 한도 대비 45%</span>
        </div>
      </div>
    </div>
  );
}
