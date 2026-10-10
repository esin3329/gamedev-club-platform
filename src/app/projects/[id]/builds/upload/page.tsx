/**
 * S-15 빌드 업로드
 * WebGL 또는 PC 빌드를 버전 노트와 함께 업로드하는 화면
 * 파일은 브라우저에서 Cloudflare R2로 presigned URL을 통해 직접 업로드
 */

export const dynamic = 'force-dynamic';

interface BuildUploadPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuildUploadPage({ params }: BuildUploadPageProps) {
  const { id } = await params;
  
  return (
    <div>
      <div className="mb-6">
        <a 
          href={`/projects/${id}/builds`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← 빌드 목록
        </a>
      </div>
      
      <h2 className="text-xl font-bold mb-6">새 빌드 업로드</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h3 className="font-semibold">1. 빌드 정보</h3>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              버전명 <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="v0.4"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              빌드 유형 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="buildType" value="webgl" defaultChecked />
                WebGL
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="buildType" value="pc" />
                PC
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              대상 OS (PC 선택 시 필수)
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="os" value="windows" />
                Windows
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="os" value="mac" />
                Mac
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="os" value="linux" />
                Linux
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              버전 노트 <span className="text-red-500">*</span>
            </label>
            <textarea 
              className="w-full border rounded-lg px-3 py-2 h-24"
              placeholder="변경 사항, 조작법, 알려진 이슈"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              테스트 요청 사항 (선택)
            </label>
            <textarea 
              className="w-full border rounded-lg px-3 py-2 h-16"
              placeholder="특별히 테스트해주셨으면 하는 부분"
            />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h3 className="font-semibold">2. 파일</h3>
          
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <div className="text-gray-500">
              <p className="mb-2">zip 파일을 끌어놓거나</p>
              <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                파일 선택
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-500 space-y-1">
            <p>• WebGL zip 최대 200MB</p>
            <p>• PC zip/7z 최대 1GB</p>
          </div>
          
          <a 
            href="#"
            className="text-sm text-blue-600 hover:underline"
          >
            엔진별 WebGL 빌드 가이드
          </a>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-yellow-800">Unreal 프로젝트 안내</p>
            <p className="text-yellow-700 mt-1">
              Unreal은 WebGL 지원이 제한적입니다. PC 빌드 업로드를 권장합니다.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4">
          <span className="text-sm">진행:</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">파일 검사</span>
            <span className="text-green-600">✓</span>
          </div>
          <span className="text-gray-400">›</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm">업로드</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="w-0 h-full bg-blue-600" />
            </div>
            <span className="text-sm text-gray-500">0%</span>
          </div>
          <span className="text-gray-400">›</span>
          <span className="text-sm text-gray-400">게시</span>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          업로드 중에는 페이지를 닫지 마세요.
        </p>
        
        <div className="flex justify-end gap-4 mt-6">
          <button className="px-4 py-2 text-gray-600 hover:text-gray-900">
            취소
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            업로드 시작
          </button>
        </div>
      </div>
    </div>
  );
}
