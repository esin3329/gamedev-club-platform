/**
 * S-07 프로젝트 상세 - 개요 탭
 * 프로젝트 소개, 팀원, 대표 빌드를 보여주는 허브 화면
 */

export const dynamic = 'force-dynamic';

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const { id } = await params;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">소개</h2>
          <div className="prose max-w-none">
            <p className="text-gray-600">
              프로젝트 상세 소개 (마크다운)가 여기에 렌더링됩니다.
            </p>
            <p className="text-gray-400 text-sm mt-4">
              [플레이스홀더] 실제 구현 시 프로젝트 데이터를 Supabase에서 가져와 표시합니다.
            </p>
          </div>
        </section>
        
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">스크린샷</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-48 h-32 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                <span className="text-gray-400">스크린샷 {i}</span>
              </div>
            ))}
          </div>
        </section>
        
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">외부 링크</h2>
          <div className="flex gap-4">
            <a href="#" className="text-blue-600 hover:underline">GitHub</a>
            <a href="#" className="text-blue-600 hover:underline">기획서</a>
          </div>
        </section>
      </div>
      
      <div className="space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">대표 빌드</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">WebGL</span>
              <span className="font-medium">v0.3</span>
              <span className="text-sm text-gray-500">평점 4.2 (12)</span>
            </div>
            <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              바로 플레이
            </button>
          </div>
        </section>
        
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">팀원 (4)</h2>
          <ul className="space-y-3">
            {[
              { name: '희준', role: '리더', position: '기획' },
              { name: '민수', role: '팀원', position: '프로그래밍' },
              { name: '지영', role: '팀원', position: '아트' },
              { name: '서연', role: '팀원', position: '사운드' },
            ].map((member, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div>
                  <span className="font-medium">{member.name}</span>
                  {member.role === '리더' && (
                    <span className="ml-1 text-xs text-blue-600">리더</span>
                  )}
                  <span className="text-sm text-gray-500 block">{member.position}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
