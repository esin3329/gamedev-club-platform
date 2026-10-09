/**
 * S-06 프로젝트 수정
 * 프로젝트 리더가 프로젝트 정보를 수정하는 화면
 */

export const dynamic = 'force-dynamic';

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <a href={`/projects/${id}`} className="text-sm text-gray-600 hover:text-gray-900">
          ← 돌아가기
        </a>
      </div>
      <h2 className="text-xl font-bold mb-6">프로젝트 수정</h2>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold">기본 정보</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                프로젝트명 <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className="w-full border rounded-lg px-3 py-2"
                defaultValue="프로젝트명"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                한 줄 소개 <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className="w-full border rounded-lg px-3 py-2"
                defaultValue="한 줄 소개"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                상태 <span className="text-red-500">*</span>
              </label>
              <select className="w-full border rounded-lg px-3 py-2">
                <option value="planning">기획 중</option>
                <option value="recruiting">팀원 모집 중</option>
                <option value="developing" selected>개발 중</option>
                <option value="completed">완료</option>
                <option value="paused">보류</option>
                <option value="archived">보관</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                상세 소개 (마크다운)
              </label>
              <textarea 
                className="w-full border rounded-lg px-3 py-2 h-32"
                defaultValue="기존 상세 소개 내용"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold">이미지 및 링크</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                대표 이미지
              </label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                [현재 이미지] 또는 새 이미지 선택
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between pt-6 border-t">
          <button className="px-4 py-2 text-red-600 hover:text-red-700">
            프로젝트 보관
          </button>
          <div className="flex gap-4">
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
  );
}
