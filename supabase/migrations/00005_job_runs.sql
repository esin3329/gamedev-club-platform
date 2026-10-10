-- Job Run Tracking (NFR-O5b, TC-JOB-09)
-- Tracks execution history of scheduled jobs (cron tasks)

-- Enum for job run status
CREATE TYPE job_status AS ENUM ('running', 'success', 'failed');

-- Job runs table
CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status job_status NOT NULL DEFAULT 'running',
  summary jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying latest runs by job name
CREATE INDEX idx_job_runs_job_name_started ON job_runs(job_name, started_at DESC);

-- Index for finding stale jobs (jobs that haven't succeeded recently)
CREATE INDEX idx_job_runs_status_finished ON job_runs(status, finished_at DESC) WHERE status = 'success';

-- Enable RLS
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read job runs
CREATE POLICY job_runs_select_admin ON job_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- RLS Policy: Service role can insert/update (for cron jobs)
-- Note: Cron jobs use service_role key which bypasses RLS,
-- but we define explicit policies for documentation
CREATE POLICY job_runs_insert_service ON job_runs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY job_runs_update_service ON job_runs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE job_runs IS 'Tracks execution history of scheduled jobs (NFR-O5b)';
COMMENT ON COLUMN job_runs.job_name IS 'Identifier for the job (e.g., retention-cleanup, keep-alive)';
COMMENT ON COLUMN job_runs.status IS 'Current status: running, success, or failed';
COMMENT ON COLUMN job_runs.summary IS 'JSON summary of job results (e.g., deleted count)';
COMMENT ON COLUMN job_runs.error IS 'Error message if job failed';
