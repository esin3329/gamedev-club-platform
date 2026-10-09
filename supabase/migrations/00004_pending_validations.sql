-- ============================================================================
-- Pending Validations Table
-- 
-- Stores server-validated file listings for WebGL two-phase uploads.
-- This prevents clients from tampering with expectedFiles in the complete step.
-- 
-- TC-F4-39: Temp zip deletion and abandoned upload cleanup
-- TC-F4-46: Single-use validation (replay prevention)
-- ============================================================================

CREATE TABLE pending_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Server-derived storage key for the temp zip (not client-supplied)
  temp_storage_key VARCHAR(500) NOT NULL,
  
  -- Validated file listing (stored as JSONB for efficiency)
  expected_files JSONB NOT NULL,
  
  -- Validation metadata
  base_path VARCHAR(500),
  file_count INT NOT NULL,
  total_uncompressed_size BIGINT NOT NULL,
  
  -- Timestamps for expiry/cleanup (BUILD_TEMP_MAX_AGE_HOURS, default 24h)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Status tracking (single-use: pending -> processing -> completed/failed/expired)
  -- 'processing' prevents concurrent complete calls (TC-F4-46)
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'expired', 'failed'))
);

CREATE INDEX idx_pending_validations_project ON pending_validations(project_id);
CREATE INDEX idx_pending_validations_user ON pending_validations(user_id);
CREATE INDEX idx_pending_validations_expires ON pending_validations(expires_at) WHERE status = 'pending';
CREATE INDEX idx_pending_validations_status ON pending_validations(status);

-- RLS policies
ALTER TABLE pending_validations ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own pending validations
CREATE POLICY "pending_validations_select_own" ON pending_validations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pending_validations_insert_own" ON pending_validations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pending_validations_update_own" ON pending_validations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pending_validations_delete_own" ON pending_validations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can see all for cleanup purposes
CREATE POLICY "pending_validations_select_admin" ON pending_validations
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "pending_validations_delete_admin" ON pending_validations
  FOR DELETE TO authenticated
  USING (is_admin());

COMMENT ON TABLE pending_validations IS 'Server-side storage for validated WebGL file listings during two-phase upload';
COMMENT ON COLUMN pending_validations.temp_storage_key IS 'Server-derived R2 key for temp zip (uploads/{projectId}/{buildId}.zip)';
COMMENT ON COLUMN pending_validations.expected_files IS 'JSONB array of {path, uncompressedSize} validated at server';
COMMENT ON COLUMN pending_validations.expires_at IS 'Auto-cleanup deadline for abandoned uploads (BUILD_TEMP_MAX_AGE_HOURS, default 24h)';
COMMENT ON COLUMN pending_validations.status IS 'Single-use status: pending -> processing -> completed/failed/expired (TC-F4-46)';
