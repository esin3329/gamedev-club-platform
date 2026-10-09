# Test Coverage Report

This document maps P0 test scenario IDs from `test-scenarios-v1.1.md` to their automation status.

## Summary

| Category | Automated | Needs External Accounts | Manual |
|----------|-----------|------------------------|--------|
| Upload/Storage Config | 41 | 0 | 0 |
| WebGL Validation | 51 | 0 | 0 |
| WebGL Two-Phase Security | 26 | 0 | 0 |
| Retention Logic | 19 | 0 | 0 |
| RLS Policies | 13 | 0 | 0 |
| Environment Security | 8 | 0 | 0 |
| **Total** | **158** | See below | See below |

## Running Tests

```bash
# Run unit tests (config, WebGL validation, retention logic)
npm test

# Run database RLS tests (requires PostgreSQL)
npm run test:db

# Run all tests
npm run test:all
```

## Automated Tests

### Configuration Tests (`config.test.ts`)

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-F4-08 | MiB constant = 1,048,576 bytes | ✅ Automated |
| TC-F4-08 | WebGL size limit = 150 MiB (157,286,400 bytes) | ✅ Automated |
| TC-F4-08 | PC size limit = 500 MiB (524,288,000 bytes) | ✅ Automated |
| TC-F4-09 | FILE_SIZE_LIMITS.webgl = 157,286,400 | ✅ Automated |
| TC-F4-09 | FILE_SIZE_LIMITS.pc_windows = 524,288,000 | ✅ Automated |
| TC-F4-09 | FILE_SIZE_LIMITS.pc_mac = 524,288,000 | ✅ Automated |
| TC-F4-35 | Upload presigned URL expiry = 3600s | ✅ Automated |
| TC-F4-35 | Download presigned URL expiry = 300s | ✅ Automated |
| TC-F4-35 | Environment variable override for expiry times | ✅ Automated |
| TC-F4-42 | BUILD_TEMP_MAX_AGE_HOURS default 24h | ✅ Automated |
| TC-F4-42 | BUILD_TEMP_MAX_AGE_HOURS env var override | ✅ Automated |
| TC-F4-42 | BUILD_TEMP_MAX_AGE_HOURS=12 sets 12h | ✅ Automated |

### WebGL Two-Phase Upload Security Tests (`route.test.ts`)

Per test-scenarios-v1.1.md TC ID mapping:

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-F4-39a | Invalid zip temp file deleted on validation failure | ✅ Automated |
| TC-F4-39b | Temp zip deleted after successful registration | ✅ Automated |
| TC-F4-39c | Abandoned upload cleaned after BUILD_TEMP_MAX_AGE_HOURS | ✅ Automated |
| TC-F4-39c-2 | Partial uploads also cleaned on abandonment | ✅ Automated |
| TC-F4-42a | expectedFiles stored server-side in pending_validations | ✅ Automated |
| TC-F4-42b | complete() fetches from DB, ignores client input | ✅ Automated |
| TC-F4-42c | Missing files detected against server-stored list | ✅ Automated |
| TC-F4-42d | Unexpected files detected against server-stored list | ✅ Automated |
| TC-F4-43a | Storage key derived server-side from projectId/buildId | ✅ Automated |
| TC-F4-43b | Malicious storage key pointing to other project rejected | ✅ Automated |
| TC-F4-43c | Valid storage key for own project accepted | ✅ Automated |
| TC-F4-43d | PC build storage key validated against project prefix | ✅ Automated |
| TC-F4-44a | Uploaded file sizes compared against validated sizes | ✅ Automated |
| TC-F4-44b | File size mismatch beyond 5% tolerance rejected | ✅ Automated |
| TC-F4-44c | Total size cap enforced on actual uploaded bytes | ✅ Automated |
| TC-F4-44d | R2 list() sizes used, not client-reported sizes | ✅ Automated |
| TC-F4-45a | complete() requires pending_validations record | ✅ Automated |
| TC-F4-45b | complete() requires matching projectId | ✅ Automated |
| TC-F4-45c | complete() requires matching userId | ✅ Automated |
| TC-F4-45d | Expired validation returns specific error | ✅ Automated |
| TC-F4-46a | Atomic claim transitions status pending -> processing | ✅ Automated |
| TC-F4-46b | Second complete rejected (VALIDATION_ALREADY_USED, 409) | ✅ Automated |
| TC-F4-46c | Concurrent complete rejected (VALIDATION_IN_PROGRESS, 409) | ✅ Automated |
| TC-F4-46d | Replaying expired validation rejected | ✅ Automated |
| TC-F4-46e | Replaying failed validation rejected | ✅ Automated |
| TC-F4-46f | Valid status transitions enforce single-use pattern | ✅ Automated |

### WebGL Validation Tests (`webgl-validator.test.ts`)

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-F4-05 | Valid WebGL zip with index.html passes | ✅ Automated |
| TC-F4-06 | Missing index.html rejected | ✅ Automated |
| TC-F4-07 | index.html in subfolder rejected | ✅ Automated |
| TC-F4-10 | File count > 1000 rejected | ✅ Automated |
| TC-F4-11 | Uncompressed size > 500 MiB rejected | ✅ Automated |
| TC-F4-12 | Exact size at limit passes | ✅ Automated |
| TC-F4-13 | Size 1 byte over limit rejected | ✅ Automated |
| TC-F4-14 | Malformed/truncated zip rejected | ✅ Automated |
| TC-F4-15 | Empty zip rejected | ✅ Automated |
| TC-F4-16 | Path traversal attack (../) rejected | ✅ Automated |
| TC-F4-17 | Absolute path in zip rejected | ✅ Automated |
| TC-F4-18 | EOCD not found rejected | ✅ Automated |
| TC-F4-19 | CD entry parse error rejected | ✅ Automated |
| TC-F4-29b | Directory entries excluded from file count | ✅ Automated |

### Retention Logic Tests (`retention.test.ts`)

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-RET-01 | WebGL: Keep 2 latest builds | ✅ Automated |
| TC-RET-02 | PC: Keep 1 latest build | ✅ Automated |
| TC-RET-03 | Featured build protected from deletion | ✅ Automated |
| TC-RET-04 | Only oldest excess builds deleted | ✅ Automated |
| TC-RET-05 | Soft-deleted builds ignored | ✅ Automated |
| TC-RET-06 | WebGL and PC builds tracked separately | ✅ Automated |
| TC-RET-07 | Build at retention limit kept | ✅ Automated |
| TC-RET-08 | Single build always kept | ✅ Automated |
| TC-RET-09 | Featured build counted toward retention limit | ✅ Automated |
| TC-RET-10 | Multiple featured builds all protected | ✅ Automated |

### RLS Policy Tests (`rls.test.sql`)

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-RLS-01 | All public tables have RLS enabled | ✅ Automated |
| TC-RLS-02 | Anonymous cannot read profiles | ✅ Automated |
| TC-RLS-02 | Anonymous cannot read projects | ✅ Automated |
| TC-RLS-03 | Member cannot update other profile | ✅ Automated |
| TC-RLS-04 | Active member cannot escalate own role to admin | ✅ Automated |
| TC-RLS-04a | Pending user cannot escalate own role to admin | ✅ Automated |
| TC-RLS-04b | Mixed update (name + global_role) blocks role escalation | ✅ Automated |
| TC-RLS-04b | Pending user mixed update (name + status) blocks status change | ✅ Automated |
| TC-RLS-05 | Non-member cannot create cards in other project | ✅ Automated |
| TC-RLS-06 | Non-leader cannot approve recruitment applications | ✅ Automated |
| TC-RLS-07 | Admin can update projects (documented behavior) | ✅ Automated |
| TC-F5-02 | Same user same build has only one rating (unique constraint) | ✅ Automated |
| TC-F5-03 | Team member cannot rate own project build | ✅ Automated |

### Environment Security Tests (`scripts/__tests__/scan-secrets.test.ts`)

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-ENV-10a | AWS access key pattern detected | ✅ Automated |
| TC-ENV-10b | Supabase service role key (JWT) pattern detected | ✅ Automated |
| TC-ENV-10c | Discord webhook URL pattern detected | ✅ Automated |
| TC-ENV-10d | scan-secrets.sh script exists and executable | ✅ Automated |
| TC-ENV-10e | .gitignore blocks .env files | ✅ Automated |
| TC-ENV-10f | .gitignore blocks .dev.vars (wrangler secrets) | ✅ Automated |
| TC-ENV-10g | gitleaks full history scan passes | ✅ Automated |
| TC-ENV-10h | gitleaks blocks staged fake secret | ✅ Automated |

## Needs External Accounts

These tests require real external services (Supabase, R2, Discord, Cloudflare):

| TC-ID | Description | Dependency |
|-------|-------------|------------|
| TC-F4-01 | Full upload flow end-to-end | Real R2 bucket |
| TC-F4-02 | Download with presigned URL | Real R2 bucket |
| TC-F4-03 | Build deletion flow | Real R2 + Supabase |
| TC-AUTH-* | Authentication flows | Real Supabase Auth |
| TC-DISCORD-* | Discord OAuth integration | Real Discord app |
| TC-WEBHOOK-* | Discord webhook notifications | Real Discord webhook |
| TC-DEPLOY-* | Production deployment | Cloudflare account |

## Manual Testing Required

These scenarios require human interaction or visual verification:

| TC-ID | Description | Reason |
|-------|-------------|--------|
| TC-UI-* | UI/UX validation | Visual inspection required |
| TC-A11Y-* | Accessibility testing | Screen reader testing |
| TC-PERF-* | Performance under load | Requires load testing tools |
| TC-MOBILE-* | Mobile responsiveness | Device testing |

## Bugs Found and Fixed

### Bug 1: Role Escalation Vulnerability (TC-RLS-04)

**Severity**: Critical (Security)

**Description**: Users could change their own `global_role` to `admin` via profile update, bypassing authorization checks.

**Root Cause**: The `profiles_update_own` RLS policy allowed users to modify any column of their own profile, including `global_role` and `status`.

**Fix**: Added a trigger `protect_profile_sensitive_columns` that prevents non-admin users from modifying `global_role` or `status` columns.

**File**: `supabase/migrations/00002_rls_policies.sql`

### Bug 2: File Count Including Directories (TC-F4-10)

**Severity**: Medium

**Description**: WebGL validation was counting directory entries toward the 1000-file limit, causing valid zips with many directories to be incorrectly rejected.

**Root Cause**: The EOCD's `cdEntriesTotal` includes directory entries, but PRD 8.2 specifies the limit should be "files only, excluding directories".

**Fix**: Modified validation to parse Central Directory entries and count only non-directory entries.

**File**: `src/lib/storage/webgl-validator.ts`

### Bug 3: Client-Trusted expectedFiles (TC-F4-39)

**Severity**: High (Security)

**Description**: The `complete` endpoint trusted `expectedFiles` from the client request body. A modified client could send any list, bypassing server-side validation.

**Root Cause**: The validation results were returned to the client and then re-submitted in the complete request, allowing tampering.

**Fix**: Added `pending_validations` table to store validated file listings server-side. The `complete` endpoint now fetches the stored record instead of trusting client input.

**Files**: 
- `supabase/migrations/00004_pending_validations.sql`
- `src/app/api/builds/register/route.ts`

### Bug 4: R2 Binding Sizes Recorded as 0 (TC-F4-41)

**Severity**: High (Security)

**Description**: With the R2 binding path, uploaded file sizes were recorded as 0 and never compared against expected sizes. This allowed uploading files of any size.

**Root Cause**: The R2 binding list code was hardcoding `size: 0` instead of using the actual size from `r2Bucket.list()`.

**Fix**: Updated to properly read `obj.size` from R2 list results and compare against validated uncompressed sizes with a 5% tolerance.

**File**: `src/app/api/builds/register/route.ts`

### Bug 5: Client-Supplied Storage Key (TC-F4-40)

**Severity**: High (Security)

**Description**: The `validate` endpoint accepted a client-supplied `storageKey`, allowing a malicious user to point validation at another project's zip file.

**Root Cause**: No server-side derivation or validation of the storage key prefix.

**Fix**: Storage key is now derived server-side from `projectId` and `buildId`. PC builds also validate that the storage key starts with the correct project prefix.

**File**: `src/app/api/builds/register/route.ts`

### Bug 6: Orphaned Uploads (TC-F4-42)

**Severity**: Medium (Resource Leak)

**Description**: If a client abandoned the upload flow after uploading the temp zip (never calling `complete`), the temp zip and any partially-extracted files were orphaned forever.

**Root Cause**: No cleanup mechanism for pending validations or orphaned uploads.

**Fix**: 
- Added `expires_at` column to `pending_validations` (default 24h)
- Created cleanup API endpoint `/api/cleanup/abandoned-uploads`
- Cleanup job deletes expired temp zips and partial uploads

**Files**:
- `supabase/migrations/00004_pending_validations.sql`
- `src/app/api/cleanup/abandoned-uploads/route.ts`
- `src/lib/storage/config.ts` (cleanup config)

## Test Architecture

### Unit Tests (Vitest)
- **Location**: `src/lib/storage/__tests__/`
- **Mock**: In-memory R2 mock (`mocks/r2-mock.ts`)
- **Utilities**: ZIP builders (`mocks/zip-builder.ts`)

### Database Tests (PostgreSQL + psql)
- **Location**: `supabase/tests/`
- **Setup**: `setup.sql` creates auth schema stub
- **Tests**: `rls.test.sql` validates RLS policies
- **Runner**: `scripts/test-db.sh`

### Integration Tests
- Requires real external services
- Not automated in this suite

## Coverage by PRD Section

| PRD Section | Coverage |
|-------------|----------|
| 4.2 Permission Matrix | 10 RLS tests |
| 8.2 File Size Limits | 38 config tests |
| 8.2 WebGL Validation | 50 validation tests |
| 8.3 Retention Policy | 19 retention tests |
| F4 Build Upload | Partial (needs R2) |
| F5 Rating System | 2 RLS tests |
