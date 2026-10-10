/**
 * S-21 공지 작성 (운영진)
 * 운영진이 공지를 작성하는 화면
 */

export const dynamic = 'force-dynamic';

export default function NewNoticePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            공지 작성
          </button>
          <a 
            href="/admin/events/new"
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
          >
            일정 등록
          </a>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="font-semibold">공지</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="공지 제목"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <select className="w-full border rounded-lg px-3 py-2">
                <option>일반</option>
                <option>게임잼</option>
                <option>쇼케이스</option>
                <option>모집</option>
                <option>기타</option>
              </select>
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" />
                <span className="text-sm">상단 고정</span>
              </label>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">
                  본문 <span className="text-red-500">*</span> (마크다운)
                </label>
                <button className="text-sm text-blue-600">미리보기</button>
              </div>
              <textarea 
                className="w-full border rounded-lg px-3 py-2 h-64 font-mono text-sm"
                placeholder="마크다운 문법을 지원합니다..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">첨부 파일</label>
              <button className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                + 파일 추가
              </button>
              <p className="text-xs text-gray-500 mt-1">20MB 이하</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="font-semibold">일정 연결 (선택)</h2>
            
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              <span className="text-sm">이 공지에 일정 연결</span>
            </label>
            
            <div className="opacity-50 pointer-events-none">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    유형
                  </label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option>게임잼</option>
                    <option>쇼케이스</option>
                    <option>마감일</option>
                    <option>정기 모임</option>
                    <option>기타</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    제목
                  </label>
                  <input 
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="일정 제목"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">시작</label>
                    <input 
                      type="datetime-local"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">종료</label>
                    <input 
                      type="datetime-local"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">장소/링크</label>
                  <input 
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="장소 또는 온라인 링크"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">설명</label>
                  <textarea 
                    className="w-full border rounded-lg px-3 py-2 h-20"
                    placeholder="일정 설명"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t flex justify-end gap-4">
          <button className="px-4 py-2 text-gray-600 hover:text-gray-900">
            취소
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            게시하기
          </button>
        </div>
      </div>
    </div>
  );
}
