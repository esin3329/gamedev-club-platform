/**
 * S-19 공지 상세
 * 개별 공지 상세 화면
 */

export const dynamic = 'force-dynamic';

interface NoticeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { id } = await params;
  
  const notice = {
    id,
    title: '가을 게임잼 참가 안내',
    category: '게임잼',
    author: '운영진A',
    date: '10/08',
    isPinned: true,
    content: `
# 2026 가을 게임잼 안내

동아리 가을 게임잼이 개최됩니다!

## 일정
- **기간**: 10/17(금) 18:00 ~ 10/19(일) 18:00
- **장소**: 동아리방 + 온라인

## 참가 방법
1. 플랫폼에서 프로젝트를 생성하세요
2. 게임잼 기간 동안 개발을 진행합니다
3. 마감 전 빌드를 업로드해주세요

## 규칙
- 팀 구성: 1~4인
- 주제는 시작일에 공개됩니다
- 외부 에셋 사용 가능 (출처 명시)

문의사항은 Discord #운영진 채널로!
    `.trim(),
    relatedEventId: 'event-1',
    relatedEventTitle: '가을 게임잼',
    attachments: [
      { name: '게임잼_규칙.pdf', size: '1.2MB' },
    ],
  };
  
  const isAdmin = false; // TODO: 실제 권한 체크
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <a 
            href="/notices"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← 공지 목록
          </a>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3 mb-2">
              {notice.isPinned && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                  고정
                </span>
              )}
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                {notice.category}
              </span>
            </div>
            <h1 className="text-xl font-bold">{notice.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {notice.author} · {notice.date}
            </p>
          </div>
          
          <div className="px-6 py-6">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700">
                {notice.content}
              </pre>
            </div>
          </div>
          
          {notice.attachments.length > 0 && (
            <div className="px-6 py-4 border-t bg-gray-50">
              <h3 className="text-sm font-medium text-gray-500 mb-2">첨부파일</h3>
              <div className="space-y-2">
                {notice.attachments.map((file, i) => (
                  <a 
                    key={i}
                    href="#"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <span>📎</span>
                    <span>{file.name}</span>
                    <span className="text-gray-400 text-sm">({file.size})</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {notice.relatedEventId && (
            <div className="px-6 py-4 border-t">
              <span className="text-sm text-gray-500">관련 일정: </span>
              <a 
                href={`/calendar?event=${notice.relatedEventId}`}
                className="text-blue-600 hover:underline"
              >
                10/17 {notice.relatedEventTitle}
              </a>
              <a href="/calendar" className="ml-4 text-sm text-gray-500 hover:underline">
                캘린더에서 보기
              </a>
            </div>
          )}
          
          {isAdmin && (
            <div className="px-6 py-4 border-t flex gap-4">
              <button className="text-sm text-blue-600 hover:underline">수정</button>
              <button className="text-sm text-red-600 hover:underline">삭제</button>
              <button className="text-sm text-gray-600 hover:underline">
                {notice.isPinned ? '고정 해제' : '상단 고정'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
