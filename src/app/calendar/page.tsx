/**
 * S-20 일정 캘린더
 * 게임잼, 쇼케이스, 마감일, 정기 모임을 월간 캘린더와 목록으로 확인하는 화면
 */

export const dynamic = 'force-dynamic';

export default function CalendarPage() {
  const isAdmin = false; // TODO: 실제 권한 체크
  
  const events = [
    { id: '1', title: '가을 게임잼', type: '게임잼', startDate: '10/17', endDate: '10/19' },
    { id: '2', title: '쇼케이스 신청 마감', type: '마감일', startDate: '10/24', endDate: null },
    { id: '3', title: '정기 모임', type: '정기 모임', startDate: '10/27', endDate: null },
  ];
  
  const typeColors: Record<string, string> = {
    '게임잼': 'bg-purple-500',
    '쇼케이스': 'bg-blue-500',
    '마감일': 'bg-red-500',
    '정기 모임': 'bg-green-500',
    '기타': 'bg-gray-500',
  };
  
  const typeBadgeColors: Record<string, string> = {
    '게임잼': 'bg-purple-100 text-purple-700',
    '쇼케이스': 'bg-blue-100 text-blue-700',
    '마감일': 'bg-red-100 text-red-700',
    '정기 모임': 'bg-green-100 text-green-700',
    '기타': 'bg-gray-100 text-gray-700',
  };
  
  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-200 rounded">&lt;</button>
            <h1 className="text-xl font-bold">2026년 10월</h1>
            <button className="p-2 hover:bg-gray-200 rounded">&gt;</button>
            <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
              오늘
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex border rounded-lg overflow-hidden">
              <button className="px-4 py-2 bg-blue-600 text-white text-sm">월간</button>
              <button className="px-4 py-2 text-sm hover:bg-gray-50">목록</button>
            </div>
            
            {isAdmin && (
              <a 
                href="/admin/events/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + 일정 등록
              </a>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span>유형:</span>
          <label className="flex items-center gap-1">
            <input type="checkbox" defaultChecked />
            <span className="w-3 h-3 bg-purple-500 rounded" />
            게임잼
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" defaultChecked />
            <span className="w-3 h-3 bg-blue-500 rounded" />
            쇼케이스
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" defaultChecked />
            <span className="w-3 h-3 bg-red-500 rounded" />
            마감일
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" defaultChecked />
            <span className="w-3 h-3 bg-green-500 rounded" />
            정기 모임
          </label>
          <label className="flex items-center gap-1 text-gray-400">
            <input type="checkbox" disabled />
            프로젝트 (P1)
          </label>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 border-b">
            {daysOfWeek.map((day) => (
              <div key={day} className="px-2 py-3 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {/* 10월 1일은 화요일이라고 가정 (offset 2) */}
            {[null, null, ...days].map((day, i) => (
              <div 
                key={i}
                className={`min-h-24 p-1 border-b border-r ${
                  day === null ? 'bg-gray-50' : ''
                }`}
              >
                {day && (
                  <>
                    <span className={`text-sm ${
                      day === 9 ? 'w-6 h-6 bg-blue-600 text-white rounded-full inline-flex items-center justify-center' : ''
                    }`}>
                      {day}
                    </span>
                    
                    {day === 17 && (
                      <div className="mt-1">
                        <div className={`text-xs px-1 py-0.5 ${typeColors['게임잼']} text-white rounded truncate`}>
                          게임잼 시작
                        </div>
                      </div>
                    )}
                    {day === 24 && (
                      <div className="mt-1">
                        <div className={`text-xs px-1 py-0.5 ${typeColors['마감일']} text-white rounded truncate`}>
                          쇼케이스 신청
                        </div>
                      </div>
                    )}
                    {day === 27 && (
                      <div className="mt-1">
                        <div className={`text-xs px-1 py-0.5 ${typeColors['정기 모임']} text-white rounded truncate`}>
                          정기 모임
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">다가오는 일정</h2>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-4">
                <span className="text-sm text-gray-500 w-20">{event.startDate}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${typeBadgeColors[event.type]}`}>
                  {event.type}
                </span>
                <span>{event.title}</span>
                {event.endDate && (
                  <span className="text-sm text-gray-500">~ {event.endDate}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
