/**
 * S-11 프로젝트 상세 - 작업 보드 탭 (칸반)
 * 팀이 작업 카드를 만들고 상태 컬럼 간에 이동하는 칸반 보드
 */

export const dynamic = 'force-dynamic';

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;
  
  const columns = [
    {
      id: 'todo',
      name: '할 일',
      cards: [
        { id: '1', title: '보스 패턴 구현', position: '프로그래밍', assignee: '민수', dueDate: 'D-2' },
      ],
    },
    {
      id: 'in-progress',
      name: '진행 중',
      cards: [
        { id: '2', title: '타이틀 BGM', position: '사운드', assignee: '서연', dueDate: '기한 지남' },
      ],
    },
    {
      id: 'review',
      name: '검토',
      cards: [
        { id: '3', title: '맵 타일 정리', position: '아트', assignee: '지영', dueDate: 'D-5' },
      ],
    },
    {
      id: 'done',
      name: '완료',
      cards: [
        { id: '4', title: '점프 구현', position: '프로그래밍', assignee: '민수', dueDate: null },
      ],
    },
  ];
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-medium">마일스톤:</span>
            <span className="ml-2">프로토타입 (10/31)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="w-3/5 h-full bg-blue-600" />
            </div>
            <span className="text-sm text-gray-600">60% (6/10)</span>
          </div>
          <a 
            href={`/projects/${id}/milestones`}
            className="text-sm text-blue-600 hover:underline"
          >
            마일스톤 관리
          </a>
        </div>
        
        <div className="flex items-center gap-2">
          <select className="border rounded-lg px-3 py-1 text-sm">
            <option>담당자 전체</option>
          </select>
          <select className="border rounded-lg px-3 py-1 text-sm">
            <option>포지션 전체</option>
          </select>
          <select className="border rounded-lg px-3 py-1 text-sm">
            <option>마일스톤 전체</option>
          </select>
        </div>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div 
            key={column.id}
            className="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{column.name} ({column.cards.length})</h3>
            </div>
            
            <div className="space-y-3">
              {column.cards.map((card) => (
                <div 
                  key={card.id}
                  className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow"
                >
                  <h4 className="font-medium text-sm">{card.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-xs rounded">
                      {card.position}
                    </span>
                    <span className="text-xs text-gray-500">{card.assignee}</span>
                    {card.dueDate && (
                      <span className={`text-xs ml-auto ${
                        card.dueDate === '기한 지남' ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {card.dueDate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
              + 카드 추가
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
