# P0 화면-라우트 매핑 문서

이 문서는 PRD의 P0 화면(S-01 ~ S-25)과 Next.js App Router 라우트를 매핑합니다.

## 매핑 원칙

1. **탭 기반 화면**: 프로젝트 상세의 탭들은 동적 라우트 세그먼트로 구분
2. **모달 화면**: 별도 라우트 없이 부모 페이지에서 처리
3. **관리자 화면**: `/admin` prefix 사용
4. **인증 화면**: `/auth` prefix 사용

## 화면-라우트 매핑

| 화면 ID | 화면명 | 라우트 | 페이지 파일 | 상태 |
|---------|--------|--------|-------------|------|
| S-01 | 로그인 (Discord) | `/auth/login` | `src/app/auth/login/page.tsx` | ✅ 구현됨 |
| S-02 | 가입 신청 | `/apply` | `src/app/apply/page.tsx` | ✅ 구현됨 |
| S-03 | 승인 대기 / 거절 안내 | `/pending` | `src/app/pending/page.tsx` | ✅ 구현됨 |
| S-04 | 홈 대시보드 | `/` | `src/app/page.tsx` | ✅ 구현됨 |
| S-05 | 프로젝트 목록 | `/projects` | `src/app/projects/page.tsx` | ✅ 구현됨 |
| S-06 | 프로젝트 생성 / 수정 | `/projects/new`, `/projects/[id]/edit` | `src/app/projects/new/page.tsx`, `src/app/projects/[id]/edit/page.tsx` | 🔲 플레이스홀더 |
| S-07 | 프로젝트 상세 - 개요 탭 | `/projects/[id]` | `src/app/projects/[id]/page.tsx` | 🔲 플레이스홀더 |
| S-08 | 프로젝트 상세 - 모집 탭 | `/projects/[id]/recruit` | `src/app/projects/[id]/recruit/page.tsx` | 🔲 플레이스홀더 |
| S-09 | 팀원 지원 (모달) | - | S-08 페이지 내 모달 컴포넌트 | 🔲 플레이스홀더 |
| S-10 | 지원자 관리 | `/projects/[id]/applicants` | `src/app/projects/[id]/applicants/page.tsx` | 🔲 플레이스홀더 |
| S-11 | 프로젝트 상세 - 작업 보드 탭 | `/projects/[id]/board` | `src/app/projects/[id]/board/page.tsx` | 🔲 플레이스홀더 |
| S-12 | 작업 카드 상세 (모달) | - | S-11 페이지 내 모달 컴포넌트 | 🔲 플레이스홀더 |
| S-13 | 마일스톤 관리 | `/projects/[id]/milestones` | `src/app/projects/[id]/milestones/page.tsx` | 🔲 플레이스홀더 |
| S-14 | 프로젝트 상세 - 빌드 탭 | `/projects/[id]/builds` | `src/app/projects/[id]/builds/page.tsx` | 🔲 플레이스홀더 |
| S-15 | 빌드 업로드 | `/projects/[id]/builds/upload` | `src/app/projects/[id]/builds/upload/page.tsx` | 🔲 플레이스홀더 |
| S-16 | 빌드 상세 / 플레이 | `/builds/[id]` | `src/app/builds/[id]/page.tsx` | 🔲 플레이스홀더 |
| S-17 | 피드백 작성 (모달/패널) | - | S-16 페이지 내 컴포넌트 | 🔲 플레이스홀더 |
| S-18 | 버그 리포트 목록 / 상세 | `/projects/[id]/bugs`, `/bugs/[id]` | `src/app/projects/[id]/bugs/page.tsx`, `src/app/bugs/[id]/page.tsx` | 🔲 플레이스홀더 |
| S-19 | 공지 목록 / 상세 | `/notices`, `/notices/[id]` | `src/app/notices/page.tsx`, `src/app/notices/[id]/page.tsx` | 🔲 플레이스홀더 |
| S-20 | 일정 캘린더 | `/calendar` | `src/app/calendar/page.tsx` | 🔲 플레이스홀더 |
| S-21 | 공지 / 일정 작성 (운영진) | `/admin/notices/new`, `/admin/events/new` | `src/app/admin/notices/new/page.tsx`, `src/app/admin/events/new/page.tsx` | 🔲 플레이스홀더 |
| S-22 | 내 활동 | `/me` | `src/app/me/page.tsx` | 🔲 플레이스홀더 |
| S-23 | 운영진 - 회원 관리 | `/admin/approvals` | `src/app/admin/approvals/page.tsx` | ✅ 구현됨 |
| S-24 | 운영진 - 기수 관리 | `/admin/cohorts` | `src/app/admin/cohorts/page.tsx` | 🔲 플레이스홀더 |
| S-25 | 운영진 - 콘텐츠 관리 | `/admin/content` | `src/app/admin/content/page.tsx` | 🔲 플레이스홀더 |

## 라우트 그룹 구조

```
src/app/
├── (auth)/                     # 인증 관련 (미들웨어 제외 그룹)
│   └── auth/
│       ├── login/page.tsx      # S-01
│       └── callback/route.ts
├── apply/page.tsx              # S-02
├── pending/page.tsx            # S-03
├── page.tsx                    # S-04 홈 대시보드
├── projects/
│   ├── page.tsx               # S-05 프로젝트 목록
│   ├── new/page.tsx           # S-06 프로젝트 생성
│   └── [id]/
│       ├── page.tsx           # S-07 프로젝트 상세 (개요)
│       ├── edit/page.tsx      # S-06 프로젝트 수정
│       ├── recruit/page.tsx   # S-08 모집 탭
│       ├── applicants/page.tsx # S-10 지원자 관리
│       ├── board/page.tsx     # S-11 작업 보드
│       ├── milestones/page.tsx # S-13 마일스톤 관리
│       ├── builds/
│       │   ├── page.tsx       # S-14 빌드 목록
│       │   └── upload/page.tsx # S-15 빌드 업로드
│       ├── bugs/page.tsx      # S-18 버그 목록 (프로젝트별)
│       └── layout.tsx         # 프로젝트 상세 공통 레이아웃
├── builds/
│   └── [id]/page.tsx          # S-16 빌드 상세/플레이
├── bugs/
│   └── [id]/page.tsx          # S-18 버그 상세
├── notices/
│   ├── page.tsx               # S-19 공지 목록
│   └── [id]/page.tsx          # S-19 공지 상세
├── calendar/page.tsx          # S-20 일정 캘린더
├── me/page.tsx                # S-22 내 활동
└── admin/
    ├── layout.tsx             # 관리자 공통 레이아웃
    ├── approvals/page.tsx     # S-23 회원 관리
    ├── cohorts/page.tsx       # S-24 기수 관리
    ├── content/page.tsx       # S-25 콘텐츠 관리
    ├── notices/
    │   └── new/page.tsx       # S-21 공지 작성
    └── events/
        └── new/page.tsx       # S-21 일정 등록
```

## API 라우트

```
src/app/api/
├── auth/callback/route.ts     # OAuth 콜백 (기존)
├── builds/
│   ├── [id]/
│   │   ├── download/route.ts  # PC 빌드 다운로드 presigned URL
│   │   └── play/route.ts      # WebGL 빌드 플레이 URL
│   └── upload/route.ts        # 빌드 업로드 presigned URL 발급
├── projects/
│   └── [id]/
│       └── apply/route.ts     # 팀원 지원 처리
└── admin/
    └── approvals/route.ts     # 가입 승인 처리
```

## 판단 사항 (Judgment Calls)

### 1. 빌드 상세 라우트 분리 (S-16)
- **결정**: `/builds/[id]`를 프로젝트 하위가 아닌 최상위로 분리
- **이유**: 빌드는 홈 대시보드의 "새 빌드" 위젯에서 직접 접근하므로 짧은 URL이 유리
- **대안 고려**: `/projects/[projectId]/builds/[buildId]` - 컨텍스트 명확하나 URL 길이 증가

### 2. 버그 리포트 이중 라우트 (S-18)
- **결정**: 
  - `/projects/[id]/bugs` - 프로젝트별 버그 목록
  - `/bugs/[id]` - 개별 버그 상세
- **이유**: S-22(내 활동)에서 "내가 남긴 버그 리포트" 접근 시 프로젝트 컨텍스트 불필요

### 3. 모달 화면 처리 (S-09, S-12, S-17)
- **결정**: 별도 라우트 없이 부모 페이지 내 컴포넌트로 처리
- **이유**: 
  - 모달은 컨텍스트 유지가 필요 (현재 빌드 정보 등)
  - URL 공유 불필요한 일시적 UI
- **참고**: 필요 시 Parallel Routes + Intercepting Routes로 모달 URL 지원 가능

### 4. 관리자 공지/일정 작성 통합 (S-21)
- **결정**: 공지와 일정을 별도 라우트로 분리
- **이유**: 화면 흐름 문서에서 "모드 탭"으로 구분하나, 데이터 모델이 다르므로 라우트 분리가 명확

### 5. 프로젝트 상세 레이아웃
- **결정**: `/projects/[id]/layout.tsx` 공통 레이아웃 사용
- **이유**: S-07~S-14 공통 헤더(프로젝트명, 상태, 탭 네비게이션)를 한 번만 정의

## 미들웨어 보호 라우트

`src/middleware.ts`에서 처리:

| 라우트 패턴 | 조건 | 리다이렉트 |
|------------|------|-----------|
| `/admin/*` | 운영진 아님 | `/` |
| `/projects/[id]/applicants` | 프로젝트 리더 아님 | `/projects/[id]` |
| `/projects/[id]/builds/upload` | 프로젝트 팀원 아님 | `/projects/[id]/builds` |
| 보호된 페이지 전체 | 미로그인 | `/auth/login` |
| 보호된 페이지 전체 | pending 상태 | `/pending` |
