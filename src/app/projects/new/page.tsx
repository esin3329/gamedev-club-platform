/**
 * S-06 프로젝트 생성
 * 동아리원이 새 프로젝트를 생성하는 화면
 */

export const dynamic = 'force-dynamic';

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <a href="/projects" className="text-sm text-gray-600 hover:text-gray-900">
            ← 돌아가기
          </a>
        </div>
        <h1 className="text-2xl font-bold mb-8">새 프로젝트 만들기</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">기본 정보</h2>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    프로젝트명 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="프로젝트 이름을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    한 줄 소개 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="프로젝트를 한 줄로 소개해주세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    장르 <span className="text-red-500">*</span>
                  </label>
                  <div className="text-sm text-gray-500">
                    [플레이스홀더] 장르 선택 칩
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    엔진 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="engine" value="unity" />
                      Unity
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="engine" value="unreal" />
                      Unreal
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="engine" value="godot" />
                      Godot
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="engine" value="other" />
                      기타
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    상태 <span className="text-red-500">*</span>
                  </label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option value="planning">기획 중</option>
                    <option value="recruiting">팀원 모집 중</option>
                    <option value="developing">개발 중</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    상세 소개 (마크다운)
                  </label>
                  <textarea 
                    className="w-full border rounded-lg px-3 py-2 h-32"
                    placeholder="프로젝트에 대해 자세히 설명해주세요"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">이미지 및 링크</h2>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    대표 이미지 (5MB 이하)
                  </label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                    끌어놓기 또는 [선택]
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    목표 플랫폼
                  </label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option value="pc">PC</option>
                    <option value="web">Web</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    외부 링크
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="GitHub"
                        className="flex-1 border rounded-lg px-3 py-2"
                      />
                      <input 
                        type="url" 
                        placeholder="URL"
                        className="flex-1 border rounded-lg px-3 py-2"
                      />
                    </div>
                    <button className="text-sm text-blue-600">+ 링크 추가</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 pt-6 border-t">
              <button className="px-4 py-2 text-gray-600 hover:text-gray-900">
                취소
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                저장하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
