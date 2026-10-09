/**
 * S-21 일정 등록 (운영진)
 * 운영진이 일정을 등록하는 화면
 */

export const dynamic = 'force-dynamic';

export default function NewEventPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          <a 
            href="/admin/notices/new"
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
          >
            공지 작성
          </a>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            일정 등록
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h2 className="font-semibold mb-4">일정 등록</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              유형 <span className="text-red-500">*</span>
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
              제목 <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="일정 제목"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                시작 <span className="text-red-500">*</span>
              </label>
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
          
          <div>
            <label className="block text-sm font-medium mb-1">관련 공지 (선택)</label>
            <select className="w-full border rounded-lg px-3 py-2">
              <option value="">선택 안 함</option>
              <option value="1">가을 게임잼 참가 안내</option>
              <option value="2">학기말 쇼케이스 신청 안내</option>
            </select>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t flex justify-end gap-4">
          <button className="px-4 py-2 text-gray-600 hover:text-gray-900">
            취소
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
