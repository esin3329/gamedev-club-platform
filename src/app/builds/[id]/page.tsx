/**
 * S-16 빌드 상세 / 플레이 (WebGL) / 다운로드 (PC)
 * WebGL 빌드를 브라우저에서 바로 실행하거나 PC 빌드를 내려받고,
 * 같은 화면에서 피드백을 확인·작성하는 화면
 */

export const dynamic = 'force-dynamic';

interface BuildDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuildDetailPage({ params }: BuildDetailPageProps) {
  const { id } = await params;
  
  const build = {
    id,
    projectId: 'project-1',
    projectName: '별빛 탐험대',
    version: 'v0.3',
    type: 'webgl' as const,
    date: '10/09',
    uploader: '민수',
    releaseNotes: '- 보스 1종 추가\n- 점프 개선\n조작: 방향키, Z 점프',
    testRequest: '보스 난이도가 적절한지 확인해주세요.',
    rating: 4.2,
    ratingCount: 12,
  };
  
  const isWebGL = build.type === 'webgl';
  const sandboxDomain = process.env.WEBGL_SANDBOX_DOMAIN || 'builds.example.com';
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <a 
              href={`/projects/${build.projectId}/builds`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← 빌드 목록
            </a>
            <span className="text-gray-300">|</span>
            <span className="font-semibold">{build.projectName}</span>
            <span className="font-semibold">{build.version}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${
              isWebGL ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isWebGL ? 'WebGL' : 'PC-Win'}
            </span>
            <span className="text-sm text-gray-500">{build.date} {build.uploader}</span>
            <select className="ml-auto border rounded-lg px-3 py-1 text-sm">
              <option>다른 버전 ▼</option>
              <option>v0.2</option>
              <option>v0.1</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {isWebGL ? (
              <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <p className="text-lg mb-4">WebGL 게임</p>
                  <p className="text-sm text-gray-400 mb-4">
                    샌드박스 iframe으로 {sandboxDomain}에서 서빙
                  </p>
                  <button className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700">
                    클릭하여 시작
                  </button>
                </div>
                {/* 실제 구현: 
                <iframe 
                  src={`https://${sandboxDomain}/builds/${build.projectId}/${build.id}/index.html`}
                  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-fullscreen"
                  className="w-full h-full"
                />
                */}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-6xl mb-4">💾</div>
                <h3 className="text-xl font-semibold mb-2">PC 빌드 다운로드</h3>
                <p className="text-gray-600 mb-4">Windows 실행 파일 · 312MB</p>
                <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  다운로드
                </button>
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-left">
                  <p className="font-medium text-yellow-800">⚠️ 보안 안내</p>
                  <p className="text-yellow-700 mt-1">
                    동아리원이 업로드한 실행 파일입니다. 신뢰할 수 있는 경우에만 실행하세요.
                  </p>
                  <p className="text-yellow-600 mt-1">업로더: {build.uploader}</p>
                </div>
              </div>
            )}
            
            {isWebGL && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <button className="px-3 py-1 border rounded hover:bg-gray-50">
                    전체화면
                  </button>
                  <span className="text-gray-500">로딩 중... 45%</span>
                </div>
                <a href="#" className="text-blue-600 hover:underline">
                  문제가 있나요? 도움말
                </a>
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow">
              <div className="border-b">
                <div className="flex">
                  <button className="px-4 py-3 border-b-2 border-blue-600 font-medium text-blue-600">
                    코멘트 (8)
                  </button>
                  <button className="px-4 py-3 text-gray-600 hover:text-gray-900">
                    버그 리포트 (3)
                  </button>
                  <select className="ml-auto mr-4 my-2 border rounded px-2 text-sm">
                    <option>최신순</option>
                    <option>평점순</option>
                  </select>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <FeedbackItem
                  author="지영"
                  rating={5}
                  content="보스 패턴이 재밌어요! 2페이즈는 조금 어려움"
                  date="10/09"
                />
                <FeedbackItem
                  author="도윤"
                  rating={4}
                  content="점프 개선 좋아요"
                  date="10/08"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-3">평균 평점</h3>
              <div className="text-3xl font-bold">
                {build.rating} <span className="text-lg text-gray-500">/ 5</span>
              </div>
              <p className="text-sm text-gray-500">{build.ratingCount}명 참여</p>
              
              <div className="mt-4 space-y-2">
                <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  피드백 남기기
                </button>
                <button className="w-full py-2 border rounded-lg hover:bg-gray-50">
                  버그 제보하기
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-3">버전 노트</h3>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                {build.releaseNotes}
              </pre>
              
              {build.testRequest && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">테스트 요청</h4>
                  <p className="text-sm">{build.testRequest}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackItem({ 
  author, 
  rating, 
  content, 
  date 
}: { 
  author: string; 
  rating: number; 
  content: string; 
  date: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{author}</span>
          <span className="text-yellow-500">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
          <span className="text-sm text-gray-500">{date}</span>
        </div>
        <p className="text-gray-700 mt-1">&ldquo;{content}&rdquo;</p>
      </div>
    </div>
  );
}
