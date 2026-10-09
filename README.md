# 게임 개발 동아리 플랫폼

대학교 게임 개발 동아리를 위한 통합 지원 플랫폼입니다.

## 주요 기능 (MVP)

- **회원 관리**: Discord OAuth 로그인, 가입 승인제, 기수 관리
- **프로젝트 페이지**: 게임 프로젝트 소개, 상태 관리, 팀원 목록
- **팀원 모집**: 포지션별 모집 공고, 지원/승인 프로세스
- **작업 보드**: 칸반 보드, 마일스톤 관리
- **빌드 공유**: WebGL 브라우저 플레이, PC 빌드 다운로드
- **플레이테스트 피드백**: 평점, 코멘트, 버그 리포트

## 기술 스택

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Storage**: Cloudflare R2 (빌드 파일)
- **Authentication**: Discord OAuth (via Supabase Auth)
- **Deployment**: Vercel (예정)

## 로컬 개발 환경 설정

### 사전 요구사항

- Node.js 20+
- Docker (Supabase 로컬 실행용)
- npm 또는 yarn

### 1. 저장소 클론 및 의존성 설치

```bash
git clone <repository-url>
cd gamedev-club-platform
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 편집하여 필요한 값을 설정하세요.

### 3. Supabase 로컬 실행

```bash
# Supabase CLI 설치 (처음 한 번)
npm install -g supabase

# Supabase 프로젝트 초기화 (처음 한 번)
supabase init

# 로컬 Supabase 시작
supabase start

# 마이그레이션 적용
supabase db reset
```

로컬 Supabase가 시작되면 콘솔에 URL과 키가 출력됩니다:
```
API URL: http://localhost:54321
anon key: eyJ...
service_role key: eyJ...
```

이 값들을 `.env.local`에 설정하세요.

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## 필요한 외부 계정/키

아래 계정들은 팀에서 생성해야 합니다:

### 필수 (MVP)

| 서비스 | 용도 | 설정 위치 |
|--------|------|----------|
| **Discord Developer** | OAuth 로그인 | [Discord Developer Portal](https://discord.com/developers/applications) |
| **Supabase** | 데이터베이스, 인증 | [Supabase Dashboard](https://supabase.com/dashboard) |

### 배포 시 필요

| 서비스 | 용도 | 설정 위치 |
|--------|------|----------|
| **Vercel** | 웹 호스팅 | [Vercel Dashboard](https://vercel.com/dashboard) |
| **Cloudflare R2** | 빌드 파일 저장소 | [Cloudflare Dashboard](https://dash.cloudflare.com/) |

### Discord OAuth 설정 방법

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 새 애플리케이션 생성
2. OAuth2 > General에서 Client ID와 Client Secret 복사
3. OAuth2 > Redirects에 콜백 URL 추가:
   - 로컬: `http://localhost:54321/auth/v1/callback`
   - 프로덕션: `https://<your-supabase-url>/auth/v1/callback`
4. Supabase Dashboard > Authentication > Providers > Discord에서 Client ID/Secret 설정

### Cloudflare R2 설정 방법

1. Cloudflare Dashboard에서 R2 버킷 생성 (`gamedev-builds`)
2. API 토큰 생성 (R2 Object Read & Write 권한)
3. WebGL 빌드용 커스텀 도메인 설정 (보안을 위해 메인 도메인과 분리)

## 프로젝트 구조

```
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── auth/               # 인증 관련 (login, callback)
│   │   ├── apply/              # 가입 신청
│   │   ├── pending/            # 승인 대기
│   │   ├── projects/           # 프로젝트 목록
│   │   └── admin/              # 관리자 페이지
│   ├── components/             # React 컴포넌트
│   ├── lib/
│   │   ├── supabase/           # Supabase 클라이언트 헬퍼
│   │   └── storage/            # R2 스토리지 추상화
│   └── types/                  # TypeScript 타입 정의
├── supabase/
│   ├── migrations/             # SQL 마이그레이션 파일
│   └── config.toml             # Supabase CLI 설정
├── docs/
│   └── schema.md               # 데이터베이스 스키마 문서
└── public/                     # 정적 파일
```

## 데이터베이스

스키마 문서: [docs/schema.md](docs/schema.md)

마이그레이션 파일:
- `00001_initial_schema.sql`: 테이블, 인덱스, 트리거
- `00002_rls_policies.sql`: Row Level Security 정책

### 마이그레이션 적용

```bash
# 로컬 DB 초기화 (데이터 삭제됨)
supabase db reset

# 새 마이그레이션 생성
supabase migration new <migration_name>

# 마이그레이션 상태 확인
supabase db diff
```

## 스크립트

```bash
npm run dev       # 개발 서버 실행
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버 실행
npm run lint      # ESLint 실행
```

## 환경 변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `NEXT_PUBLIC_SITE_URL` | 사이트 URL (OAuth 콜백용) | ✅ |
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID | 빌드 업로드 시 |
| `R2_ACCESS_KEY_ID` | R2 접근 키 ID | 빌드 업로드 시 |
| `R2_SECRET_ACCESS_KEY` | R2 비밀 키 | 빌드 업로드 시 |
| `R2_BUCKET_NAME` | R2 버킷 이름 | 빌드 업로드 시 |
| `R2_PUBLIC_URL` | R2 퍼블릭 URL | 빌드 업로드 시 |
| `WEBGL_SANDBOX_DOMAIN` | WebGL 샌드박스 도메인 | 보안 권장 |

## 개발 가이드

### 새 페이지 추가

1. `src/app/` 아래에 폴더와 `page.tsx` 생성
2. 서버 컴포넌트에서 `createClient`로 Supabase 클라이언트 생성
3. 필요시 클라이언트 컴포넌트는 `'use client'` 지시문 사용

### Supabase 쿼리

```typescript
// 서버 컴포넌트
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from('projects').select('*');
}

// 클라이언트 컴포넌트
'use client';
import { createClient } from '@/lib/supabase/client';

export default function Component() {
  const supabase = createClient();
  // ...
}
```

## 보안 고려사항

1. **WebGL 빌드 샌드박싱**: WebGL 빌드는 별도 도메인에서 iframe sandbox로 실행하여 메인 사이트 세션 접근 방지
2. **PC 빌드 다운로드**: 만료 시간이 있는 서명된 URL로만 다운로드 허용
3. **RLS 정책**: 모든 데이터 접근은 서버 측 RLS로 검증
4. **파일 검증**: 업로드 시 확장자/MIME 타입/크기 검증

## TODO

- [ ] 프로젝트 상세 페이지 구현
- [ ] 빌드 업로드/다운로드 구현
- [ ] 평점/코멘트 UI 구현
- [ ] 칸반 보드 드래그앤드롭
- [ ] 공지사항/일정 기능 (F6)
- [ ] 알림 기능 (P1)
- [ ] Google OAuth 추가 (P1)

## 라이선스

동아리 내부 사용 전용
