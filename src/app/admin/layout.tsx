/**
 * 관리자 공통 레이아웃
 * S-23 ~ S-25 운영진 관리 화면의 공통 사이드바
 */

import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r">
        <div className="p-4 border-b">
          <h2 className="font-semibold">관리</h2>
        </div>
        <nav className="p-2">
          <AdminNavLink href="/admin/approvals">회원 관리</AdminNavLink>
          <AdminNavLink href="/admin/cohorts">기수 관리</AdminNavLink>
          <AdminNavLink href="/admin/content">콘텐츠 관리</AdminNavLink>
        </nav>
      </aside>
      
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href}
      className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
    >
      {children}
    </Link>
  );
}
