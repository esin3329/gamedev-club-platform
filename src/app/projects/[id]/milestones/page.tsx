/**
 * S-13 마일스톤 관리
 * 리더가 마일스톤을 만들고 목표일과 진행률을 관리하는 화면
 */

export const dynamic = 'force-dynamic';

interface MilestonesPageProps {
  params: Promise<{ id: string }>;
}

export default async function MilestonesPage({ params }: MilestonesPageProps) {
  const { id } = await params;
  
  const milestones = [
    { id: '1', name: '프로토타입', targetDate: '10/31', progress: 60, total: 10, completed: 6, isCompleted: false },
    { id: '2', name: '가을 게임잼 제출', targetDate: '11/15', progress: 20, total: 5, completed: 1, isCompleted: false },
  ];
  
  const completedMilestones = [
    { id: '3', name: '기획 확정', targetDate: '10/01', progress: 100, total: 4, completed: 4, isCompleted: true },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <a 
          href={`/projects/${id}/board`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← 작업 보드
        </a>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">마일스톤</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          + 마일스톤
        </button>
      </div>
      
      <div className="space-y-4">
        {milestones.map((milestone) => (
          <div key={milestone.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold">{milestone.name}</h3>
                <span className="text-sm text-gray-500">목표 {milestone.targetDate}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600" 
                      style={{ width: `${milestone.progress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">
                    {milestone.progress}% ({milestone.completed}/{milestone.total})
                  </span>
                </div>
                <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
                  수정
                </button>
                <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
                  완료 처리
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8">
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <span>▼</span>
          <span>완료된 마일스톤 ({completedMilestones.length})</span>
        </button>
        
        <div className="mt-4 space-y-4">
          {completedMilestones.map((milestone) => (
            <div key={milestone.id} className="bg-gray-50 rounded-lg p-6 text-gray-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="font-medium">{milestone.name}</h3>
                  <span className="text-sm">완료 {milestone.targetDate}</span>
                </div>
                <span className="text-sm">100% ({milestone.total}/{milestone.total})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">마일스톤 추가</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="마일스톤 이름"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              목표일 <span className="text-red-500">*</span>
            </label>
            <input 
              type="date"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              설명
            </label>
            <input 
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="마일스톤 설명 (선택)"
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
