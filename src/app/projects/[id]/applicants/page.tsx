/**
 * S-10 지원자 관리
 * 프로젝트 리더가 지원서를 검토하고 승인/거절하는 화면
 */

export const dynamic = 'force-dynamic';

interface ApplicantsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicantsPage({ params }: ApplicantsPageProps) {
  const { id } = await params;
  
  const applicants = [
    { id: '1', name: '하늘', position: '아트', date: '10/09', status: 'pending' },
    { id: '2', name: '도윤', position: '아트', date: '10/08', status: 'pending' },
    { id: '3', name: '유나', position: '사운드', date: '10/07', status: 'pending' },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <a 
          href={`/projects/${id}/recruit`} 
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← 모집 탭
        </a>
      </div>
      
      <h2 className="text-xl font-bold mb-6">지원자 관리</h2>
      
      <div className="flex gap-4 mb-6">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          검토 중 3
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
          승인 2
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
          거절 1
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
          취소 0
        </button>
        <select className="ml-auto border rounded-lg px-3 py-2 text-sm">
          <option>포지션 전체</option>
          <option>아트</option>
          <option>사운드</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {applicants.map((applicant) => (
            <div 
              key={applicant.id}
              className="p-4 bg-white rounded-lg shadow cursor-pointer hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div>
                  <div className="font-medium">{applicant.name}</div>
                  <div className="text-sm text-gray-500">
                    {applicant.position} · {applicant.date}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gray-200 rounded-full" />
            <div>
              <h3 className="font-semibold">하늘 (11기)</h3>
              <p className="text-sm text-gray-500">지원: 아트 · 10/09 지원</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-1">자기소개</h4>
              <p className="text-gray-800">
                &ldquo;도트 그래픽을 2년 정도 그려왔고, 캐릭터 애니메이션에 관심이 많습니다. 
                이번 프로젝트의 아트 스타일이 마음에 들어 지원합니다.&rdquo;
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-1">포트폴리오</h4>
              <a href="#" className="text-blue-600 hover:underline">
                https://portfolio.example.com
              </a>
            </div>
          </div>
          
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
            <button className="px-6 py-2 border rounded-lg hover:bg-gray-50">
              거절
            </button>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              승인하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
