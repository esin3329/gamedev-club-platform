/**
 * S-24 운영진 - 기수 관리
 * 기수를 생성·수정하는 화면
 */

export const dynamic = 'force-dynamic';

export default function CohortsPage() {
  const cohorts = [
    { id: '1', name: '11기', period: '2026-03 ~', memberCount: 18 },
    { id: '2', name: '10기', period: '2025-03 ~', memberCount: 21 },
    { id: '3', name: '9기', period: '2024-03 ~ 2025-02', memberCount: 13 },
  ];
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">기수 관리</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          + 기수 추가
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow divide-y">
        {cohorts.map((cohort) => (
          <div key={cohort.id} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-semibold">{cohort.name}</span>
              <span className="text-gray-500">{cohort.period}</span>
              <a href={`/admin/approvals?cohort=${cohort.id}`} className="text-blue-600 hover:underline">
                회원 {cohort.memberCount}명
              </a>
            </div>
            <button className="text-sm text-gray-600 hover:underline">수정</button>
          </div>
        ))}
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-4">기수 추가</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="12기"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              시작일 <span className="text-red-500">*</span>
            </label>
            <input 
              type="month"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              종료일
            </label>
            <input 
              type="month"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              설명
            </label>
            <input 
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="선택 사항"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
