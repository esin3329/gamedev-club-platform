# Test Coverage Report

This document maps P0 test scenario IDs from `test-scenarios-v1.1.md` to their automation status.

## Summary

| Category | Automated | Needs External Accounts | Manual |
|----------|-----------|------------------------|--------|
| Upload/Storage Config | 41 | 0 | 0 |
| WebGL Validation | 50 | 0 | 0 |
| WebGL Two-Phase Security | 15 | 0 | 0 |
| Retention Logic | 19 | 0 | 0 |
| RLS Policies | 10 | 0 | 0 |
| **Total** | **135** | See below | See below |

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
| TC-F4-42 | Cleanup orphaned upload max age default 24h | ✅ Automated |
| TC-F4-42 | Validation expiry default 24h | ✅ Automated |
| TC-F4-42 | Cleanup config environment variable override | ✅ Automated |

### WebGL Two-Phase Upload Security Tests (`route.test.ts`)

| TC-ID | Description | Status |
|-------|-------------|--------|
| TC-F4-39 | ExpectedFiles stored server-side (not from client) | ✅ Automated |
| TC-F4-39 | Complete requires pending validation record | ✅ Automated |
| TC-F4-39 | Expired validation rejected | ✅ Automated |
| TC-F4-40 | Storage key derived server-side from projectId/buildId | ✅ Automated |
| TC-F4-40 | Malicious storage key prefix rejected | ✅ Automated |
| TC-F4-40 | Valid storage key prefix accepted | ✅ Automated |
| TC-F4-41 | Uploaded file sizes compared against validated sizes | ✅ Automated |
| TC-F4-41 | File size mismatch beyond tolerance detected | ✅ Automated |
| TC-F4-41 | Total size cap enforced on actual uploaded bytes | ✅ Automated |
| TC-F4-41 | R2 sizes used (not client-reported) | ✅ Automated |
| TC-F4-42 | Expired pending validations identified | ✅ Automated |
| TC-F4-42 | Temp zip cleaned up on abandoned flow | ✅ Automated |
| TC-F4-42 | Orphaned temp zips older than 24h identified | ✅ Automated |
| TC-F4-40 | PC build wrong storage key prefix rejected | ✅ Automated |
| TC-F4-40 | PC build correct storage key prefix accepted | ✅ Automated |

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
| TC-F4-20 | Directory-only entries excluded from file count | ✅ Automated |

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
| TC-RLS-04 | Member cannot escalate own role to admin | ✅ Automated |
| TC-RLS-05 | Non-member cannot create cards in other project | ✅ Automated |
| TC-RLS-06 | Non-leader cannot approve recruitment applications | ✅ Automated |
| TC-RLS-07 | Admin can update projects (documented behavior) | ✅ Automated |
| TC-F5-02 | Same user same build has only one rating (unique constraint) | ✅ Automated |
| TC-F5-03 | Team member cannot rate own project build | ✅ Automated |

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
