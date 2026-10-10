/**
 * S-19 공지 목록
 * 동아리 공지를 확인하는 화면
 */

export const dynamic = 'force-dynamic';

export default function NoticesPage() {
  const notices = [
    { id: '1', title: '가을 게임잼 참가 안내', category: '게임잼', author: '운영진A', date: '10/08', isPinned: true },
    { id: '2', title: '플랫폼 사용 가이드', category: '일반', author: '운영진B', date: '10/01', isPinned: true },
    { id: '3', title: '학기말 쇼케이스 신청 안내', category: '쇼케이스', author: '운영진A', date: '10/05', isPinned: false },
    { id: '4', title: '신입 기수 OT 안내', category: '모집', author: '운영진B', date: '09/20', isPinned: false },
  ];
  
  const categoryColors: Record<string, string> = {
    '일반': 'bg-gray-100 text-gray-700',
    '게임잼': 'bg-purple-100 text-purple-700',
    '쇼케이스': 'bg-blue-100 text-blue-700',
    '모집': 'bg-green-100 text-green-700',
    '기타': 'bg-gray-100 text-gray-700',
  };
  
  const isAdmin = false; // TODO: 실제 권한 체크
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">공지사항</h1>
          <div className="flex items-center gap-4">
            <select className="border rounded-lg px-3 py-2 text-sm">
              <option>카테고리 전체</option>
              <option>일반</option>
              <option>게임잼</option>
              <option>쇼케이스</option>
              <option>모집</option>
              <option>기타</option>
            </select>
            <input 
              type="text"
              placeholder="검색"
              className="border rounded-lg px-3 py-2 text-sm"
            />
            {isAdmin && (
              <a 
                href="/admin/notices/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + 공지 작성
              </a>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow divide-y">
          {notices.map((notice) => (
            <a 
              key={notice.id}
              href={`/notices/${notice.id}`}
              className="block px-6 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {notice.isPinned && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                    고정
                  </span>
                )}
                <span className={`px-2 py-0.5 text-xs rounded ${categoryColors[notice.category]}`}>
                  {notice.category}
                </span>
                <span className="font-medium">{notice.title}</span>
                <span className="ml-auto text-sm text-gray-500">
                  {notice.author} · {notice.date}
                </span>
              </div>
            </a>
          ))}
        </div>
        
        <div className="flex justify-center mt-6">
          <nav className="flex gap-2">
            <button className="px-3 py-1 border rounded hover:bg-gray-50">&lt;</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded">1</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-50">2</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-50">3</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-50">&gt;</button>
          </nav>
        </div>
      </div>
    </div>
  );
}
