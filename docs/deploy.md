# 배포 가이드

이 문서는 게임 개발 동아리 플랫폼을 프로덕션 환경에 배포하는 단계별 가이드입니다.

GitHub 저장소: https://github.com/esin3329/gamedev-club-platform

## 아키텍처 개요

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│                 │     │                   │     │                 │
│  GitHub Repo    │────▶│ Cloudflare Workers│────▶│  Supabase       │
│  esin3329/      │     │ (OpenNext)        │     │  (PostgreSQL)   │
│  gamedev-club-  │     │                   │     │                 │
│  platform       │     │                   │     │                 │
└─────────────────┘     └─────────┬─────────┘     └─────────────────┘
                                  │
                         ┌────────▼─────────┐
                         │                  │
                         │  Cloudflare R2   │
                         │  (빌드 파일)     │
                         │                  │
                         └──────────────────┘
```

모든 서비스는 **무료 티어**로 운영 가능합니다.

| 서비스 | 무료 한도 | 용도 |
|--------|----------|------|
| Cloudflare Workers | 100,000 요청/일, 10ms CPU/요청 | 웹 호스팅 (OpenNext) |
| Cloudflare R2 | 10GB 저장, 10M 요청/월 | 빌드 파일 |
| Supabase Free | 500MB DB, 1GB 대역폭 | 데이터베이스 |
| GitHub | 무제한 비공개 저장소 | 소스 코드 |

---

## 1단계: Supabase 프로젝트 설정

### 1.1 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인
2. **New Project** 클릭
3. 프로젝트 정보 입력:
   - **Name**: `gamedev-club` (또는 원하는 이름)
   - **Database Password**: 안전한 비밀번호 설정 (나중에 필요)
   - **Region**: Northeast Asia (Seoul) 또는 가까운 리전
4. **Create new project** 클릭

### 1.2 API 키 확인

프로젝트 생성 후 **Settings > API**에서 확인:

- **Project URL**: `https://<project-id>.supabase.co`
- **anon public**: 클라이언트용 공개 키
- **service_role**: 서버용 비밀 키 (절대 노출 금지!)

이 값들을 안전한 곳에 메모해두세요.

### 1.3 마이그레이션 적용

로컬에서 Supabase CLI로 마이그레이션을 적용합니다:

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 연결
supabase login
supabase link --project-ref <project-id>

# 마이그레이션 적용
supabase db push
```

또는 Supabase Dashboard의 **SQL Editor**에서 직접 실행:

1. `supabase/migrations/00001_initial_schema.sql` 내용 실행
2. `supabase/migrations/00002_rls_policies.sql` 내용 실행
3. `supabase/migrations/00003_notices_and_events.sql` 내용 실행

---

## 2단계: Discord OAuth 설정

### 2.1 Discord 애플리케이션 생성

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. **New Application** 클릭
3. 이름 입력 (예: "게임 개발 동아리") → **Create**

### 2.2 OAuth2 설정

1. 좌측 메뉴에서 **OAuth2 > General** 선택
2. **Client ID** 복사 (나중에 필요)
3. **Reset Secret** 클릭하여 **Client Secret** 생성 및 복사

### 2.3 Redirect URLs 추가

**OAuth2 > General**에서 **Redirects** 섹션에 추가:

```
https://<your-supabase-project>.supabase.co/auth/v1/callback
```

### 2.4 Supabase에 Discord 연결

1. Supabase Dashboard > **Authentication > Providers**
2. **Discord** 활성화
3. **Client ID**와 **Client Secret** 입력
4. **Save**

---

## 3단계: Cloudflare R2 설정

### 3.1 Cloudflare 계정 생성

1. [Cloudflare](https://dash.cloudflare.com/sign-up) 회원가입
2. 대시보드에서 **Account ID** 확인 (우측 사이드바)

### 3.2 R2 버킷 생성

1. Cloudflare Dashboard > **R2 Object Storage**
2. **Create bucket** 클릭
3. 버킷 이름: `gamedev-builds`
4. 위치: 자동 또는 아시아 태평양 선택
5. **Create bucket**

### 3.3 공개 액세스 설정 (WebGL 빌드용)

R2 버킷에 공개 도메인을 연결해야 WebGL 빌드를 서빙할 수 있습니다:

1. 생성된 버킷 클릭 > **Settings**
2. **Public access** > **Connect domain**
3. 서브도메인 입력 (예: `webgl-builds.yourdomain.com`)
4. Cloudflare에 등록된 도메인이 필요합니다

**대안: R2.dev 서브도메인 사용**

1. **Settings > R2.dev subdomain**
2. **Allow access** 활성화
3. 생성된 URL 사용 (예: `pub-xxxx.r2.dev`)

> ⚠️ **보안 주의**: WebGL 빌드는 별도 도메인에서 서빙하여 메인 사이트와 격리해야 합니다.

### 3.4 R2 API 토큰 생성 (로컬 개발용)

로컬 개발 시에만 필요합니다. Workers 배포 시에는 바인딩을 사용합니다.

1. **R2 > Overview > Manage R2 API Tokens**
2. **Create API token**
3. 권한: **Object Read & Write**, 버킷: `gamedev-builds`
4. **Create API Token**
5. **Access Key ID**와 **Secret Access Key** 복사

---

## 4단계: Cloudflare Workers 배포 (GitHub 연동)

### 4.1 Workers & Pages 프로젝트 생성

1. Cloudflare Dashboard > **Workers & Pages**
2. **Create** > **Pages** (Workers Builds 사용)
3. **Connect to Git** > GitHub 계정 연결
4. 저장소 선택: `esin3329/gamedev-club-platform`
5. **Begin setup**

### 4.2 빌드 설정

| 설정 | 값 |
|------|-----|
| **Framework preset** | None (커스텀) |
| **Build command** | `npm run build:cloudflare` |
| **Build output directory** | `.open-next` |
| **Root directory** | `/` |
| **Node.js version** | 20.x |

### 4.3 환경변수 설정

**Settings > Environment variables**에서 추가:

| 변수명 | 값 | 암호화 |
|--------|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | Workers 도메인 | No |
| `WEBGL_SANDBOX_DOMAIN` | WebGL 빌드 도메인 | No |
| `CRON_SECRET` | 랜덤 문자열 (32자 이상 권장) | **Yes** |

### 4.4 R2 바인딩 설정

1. **Settings > Functions > R2 bucket bindings**
2. **Add binding**:
   - Variable name: `R2_BUILDS`
   - R2 bucket: `gamedev-builds`
3. **Save**

### 4.5 배포

GitHub에 푸시하면 자동으로 빌드 및 배포됩니다:

```bash
git push origin main
```

배포 완료 후 Workers URL 확인 (예: `https://gamedev-club.workers.dev`)

---

## 5단계: Cron 작업 설정

Cloudflare Workers cron 트리거를 설정합니다.

### 5.1 wrangler.jsonc 설정

프로젝트의 `wrangler.jsonc`에 cron 설정이 포함되어 있습니다:

```jsonc
{
  "triggers": {
    "crons": [
      "0 */6 * * *",  // 6시간마다: 보관 정책 cleanup
      "0 0 * * *"     // 매일 자정: Supabase keep-alive
    ]
  }
}
```

### 5.2 Cron 트리거 활성화

Workers & Pages 프로젝트에서 Cron 트리거는 자동으로 설정됩니다.
수동 호출도 가능합니다:

```bash
# 보관 정책 cleanup
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-site.workers.dev/api/cron/retention

# Supabase keep-alive
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-site.workers.dev/api/cron/keep-alive
```

**대안: 외부 cron 서비스**

Workers cron 트리거가 작동하지 않는 경우:
- [cron-job.org](https://cron-job.org/) - 무료 cron 서비스
- [EasyCron](https://www.easycron.com/) - 무료 티어 제공

---

## 6단계: 커스텀 도메인 설정 (선택)

### 6.1 메인 사이트 도메인

1. Cloudflare Workers & Pages > 프로젝트 > **Custom domains**
2. **Set up a custom domain**
3. 도메인 입력 (예: `gamedev.yourdomain.com`)
4. DNS 레코드 자동 생성됨

### 6.2 WebGL 샌드박스 도메인

WebGL 빌드는 보안을 위해 별도 도메인에서 서빙해야 합니다:

1. R2 버킷 > **Settings > Custom domains**
2. 별도 서브도메인 연결 (예: `webgl.yourdomain.com`)
3. 환경변수 `WEBGL_SANDBOX_DOMAIN` 업데이트

---

## 7단계: 배포 확인

### 체크리스트

- [ ] 메인 사이트 접속 확인
- [ ] Discord 로그인 테스트
- [ ] 프로젝트 생성 테스트
- [ ] 빌드 업로드 테스트 (WebGL, PC)
- [ ] WebGL 빌드 플레이 테스트
- [ ] cron 작업 수동 실행 테스트

### 로그 확인

Cloudflare Dashboard > **Workers & Pages > 프로젝트 > Logs**에서 실시간 로그 확인

### 문제 해결

**빌드 실패 시:**
```bash
# 로컬에서 Cloudflare 빌드 테스트
npm run build:cloudflare
```

**R2 접근 오류 시:**
- 바인딩 이름이 `R2_BUILDS`인지 확인
- 버킷 이름이 `gamedev-builds`인지 확인

**Discord 로그인 오류 시:**
- Redirect URL이 정확한지 확인
- Supabase의 Site URL 설정 확인

**10ms CPU 제한 초과 시:**
- WebGL 업로드: 클라이언트에서 zip 추출 필요 (서버에서 150MB zip 처리 불가)
- 큰 요청은 분할 처리

---

## 무료 티어 한도 및 제약

### Cloudflare Workers Free

| 제약 | 값 | 영향 |
|------|-----|------|
| 일일 요청 | 100,000 | 대부분 충분 |
| CPU 시간/요청 | 10ms | zip 전체 압축 해제 불가 |
| 메모리 | 128MB | 큰 파일 메모리 로드 불가 |
| 스크립트 크기 (비압축) | 64 MiB | 현재 ~8.7 MiB (86% 여유) |

**CPU 제한 대응:**
- WebGL zip 검증: R2 ranged reads로 central directory만 읽음
- WebGL zip 추출: 클라이언트에서 수행 후 개별 파일 업로드

### Worker 번들 크기 측정

현재 프로젝트 번들 크기 (2026-10-09 기준):

```
Total Upload: 8,920 KiB (8.71 MiB) / gzip: 1,802 KiB (1.76 MiB)
Limit: 64 MiB (비압축 기준, 압축 크기 제한 없음)
사용률: 13.6% | 여유: 86.4% (55.3 MiB)
```

번들 크기 측정 명령:

```bash
# OpenNext 빌드 후 wrangler dry-run
npm run build:cloudflare
cd .open-next && npx wrangler deploy worker.js --dry-run --outdir ../wrangler-dry-run
```

**주요 번들 구성:**
- Next.js 서버 런타임 (handler.mjs): ~5.4 MiB
- Next.js/React 코어: 번들 대부분 차지
- AWS SDK (R2용): ~1 MiB - Workers 환경에서는 R2 바인딩 사용으로 최소화
- JSZip: 클라이언트 전용 (서버 번들에 포함 안 됨)

**번들 크기 최적화 팁:**
- 불필요한 서버 사이드 패키지 제거
- 대용량 정적 자산은 R2/KV에 저장
- 서비스 바인딩으로 기능 분리 가능

### Cloudflare R2 Free

| 제약 | 값 |
|------|-----|
| 저장 용량 | 10GB |
| Class A 작업 | 1M/월 (PUT, POST, LIST) |
| Class B 작업 | 10M/월 (GET) |

### Supabase Free

| 제약 | 값 |
|------|-----|
| 데이터베이스 | 500MB |
| 대역폭 | 5GB/월 |
| 비활성 일시정지 | 7일 |

> keep-alive cron으로 비활성 일시정지 방지

---

## 설정값 기본값

`src/lib/storage/config.ts`에서 환경변수로 오버라이드 가능:

| 설정 | 환경변수 | 기본값 | 설명 |
|------|---------|--------|------|
| WebGL 업로드 크기 | `BUILD_WEBGL_MAX_SIZE_MB` | 150 MiB | zip 파일 크기 |
| PC 빌드 크기 | `BUILD_PC_MAX_SIZE_MB` | 500 MiB | 빌드 파일 크기 |
| 압축 해제 후 크기 | `BUILD_WEBGL_MAX_UNCOMPRESSED_MB` | 500 MiB | zip-bomb 방지 |
| 최대 파일 수 | `BUILD_WEBGL_MAX_FILE_COUNT` | 1000 | zip-bomb 방지 |
| WebGL 보관 개수 | `BUILD_RETENTION_WEBGL_KEEP` | 2 | 최신 N개 유지 |
| PC 보관 개수 | `BUILD_RETENTION_PC_KEEP` | 1 | 최신 N개 유지 |
| 업로드 URL 만료 | `PRESIGNED_URL_UPLOAD_EXPIRY_SECONDS` | 3600 (1시간) | |
| 다운로드 URL 만료 | `PRESIGNED_URL_DOWNLOAD_EXPIRY_SECONDS` | 300 (5분) | |

> **크기 단위**: MB는 MiB (1,048,576 bytes = 1024 × 1024)를 의미합니다.

---

## 업데이트 배포

GitHub에 푸시하면 자동으로 배포됩니다:

```bash
git add .
git commit -m "feat: 새 기능 추가"
git push origin main
```

Cloudflare Workers가 자동으로 빌드 및 배포합니다.

---

## 롤백

Cloudflare Workers & Pages > **Deployments**에서 이전 배포 선택 > **Rollback to this deployment**
