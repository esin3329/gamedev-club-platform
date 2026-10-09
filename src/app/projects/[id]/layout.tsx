/**
 * 프로젝트 상세 공통 레이아웃
 * S-07 ~ S-14 화면에서 공유되는 프로젝트 헤더와 탭 네비게이션
 */

import Link from 'next/link';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex gap-6">
            <div className="w-32 h-32 bg-gray-200 rounded-lg flex-shrink-0">
              {/* 대표 이미지 플레이스홀더 */}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">
                    프로젝트명
                    <span className="ml-2 px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                      개발 중
                    </span>
                  </h1>
                  <p className="text-gray-600 mt-1">한 줄 소개가 여기에 표시됩니다</p>
                  <p className="text-sm text-gray-500 mt-2">
                    장르 · Unity · PC
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    지원하기
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700">
                    ⋯
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <nav className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            <TabLink href={`/projects/${id}`} exact>개요</TabLink>
            <TabLink href={`/projects/${id}/recruit`}>모집</TabLink>
            <TabLink href={`/projects/${id}/board`}>작업 보드</TabLink>
            <TabLink href={`/projects/${id}/builds`}>빌드</TabLink>
          </div>
        </nav>
      </div>
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function TabLink({ 
  href, 
  children, 
  exact = false 
}: { 
  href: string; 
  children: React.ReactNode; 
  exact?: boolean 
}) {
  return (
    <Link 
      href={href}
      className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-300"
    >
      {children}
    </Link>
  );
}
