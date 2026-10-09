/**
 * S-14 프로젝트 상세 - 빌드 탭 (빌드 목록)
 * 프로젝트의 빌드 목록을 버전별로 보고 플레이하거나 업로드하는 화면
 */

export const dynamic = 'force-dynamic';

interface BuildsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuildsPage({ params }: BuildsPageProps) {
  const { id } = await params;
  
  const isTeamMember = true; // TODO: 실제 권한 체크
  
  const builds = [
    { 
      id: '1', 
      version: 'v0.3', 
      type: 'webgl' as const, 
      date: '10/09', 
      uploader: '민수',
      rating: 4.2,
      ratingCount: 12,
      bugCount: 3,
      note: '보스 1종 추가, 점프 개선',
      isFeatured: true,
    },
    { 
      id: '2', 
      version: 'v0.3', 
      type: 'pc' as const, 
      date: '10/09', 
      uploader: '민수',
      size: '312MB',
      rating: 4.0,
      ratingCount: 5,
      isFeatured: false,
    },
    { 
      id: '3', 
      version: 'v0.2', 
      type: 'webgl' as const, 
      date: '09/28', 
      uploader: '희준',
      rating: 3.6,
      ratingCount: 9,
      bugCount: 7,
      isFeatured: false,
    },
    { 
      id: '4', 
      version: 'v0.1', 
      type: 'pc' as const, 
      date: '09/15', 
      uploader: '희준',
      isDeleted: true,
      isFeatured: false,
    },
  ];
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">빌드 ({builds.length})</h2>
          <select className="border rounded-lg px-3 py-1 text-sm">
            <option>유형 전체</option>
            <option>WebGL</option>
            <option>PC</option>
          </select>
        </div>
        
        {isTeamMember && (
          <a 
            href={`/projects/${id}/builds/upload`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            + 빌드 업로드
          </a>
        )}
      </div>
      
      <div className="space-y-4">
        {builds.map((build) => (
          <div 
            key={build.id}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {build.isFeatured && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                    대표
                  </span>
                )}
                <span className="font-semibold">{build.version}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  build.type === 'webgl' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {build.type === 'webgl' ? 'WebGL' : 'PC-Win'}
                </span>
                <span className="text-sm text-gray-500">{build.date} {build.uploader}</span>
                {build.size && (
                  <span className="text-sm text-gray-500">{build.size}</span>
                )}
                {build.rating && (
                  <span className="text-sm text-gray-500">
                    평점 {build.rating} ({build.ratingCount})
                  </span>
                )}
                {build.bugCount !== undefined && (
                  <span className="text-sm text-gray-500">버그 {build.bugCount}</span>
                )}
              </div>
              
              <div>
                {build.isDeleted ? (
                  <span className="text-sm text-gray-400">
                    파일 정리됨 (피드백 기록 유지)
                  </span>
                ) : build.type === 'webgl' ? (
                  <a 
                    href={`/builds/${build.id}`}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    플레이
                  </a>
                ) : (
                  <a 
                    href={`/builds/${build.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    받기
                  </a>
                )}
              </div>
            </div>
            
            {build.note && (
              <p className="text-sm text-gray-600 mt-2 pl-4">&ldquo;{build.note}&rdquo;</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
