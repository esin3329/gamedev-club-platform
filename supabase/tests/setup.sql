-- ============================================================================
-- Test Database Setup
-- 
-- Creates a stubbed auth schema to simulate Supabase authentication
-- for RLS policy testing without actual Supabase infrastructure.
-- ============================================================================

-- Create Supabase-like roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

-- Grant usage on public schema to roles
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- Create auth schema (stub for Supabase auth)
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

-- Stub auth.users table
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session variable to simulate current user
-- Usage: SET LOCAL auth.uid = 'uuid-here';
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('auth.uid', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper to set current user for testing
CREATE OR REPLACE FUNCTION test_set_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('auth.uid', user_id::TEXT, true);
END;
$$ LANGUAGE plpgsql;

-- Helper to clear current user
CREATE OR REPLACE FUNCTION test_clear_user()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('auth.uid', '', true);
END;
$$ LANGUAGE plpgsql;

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;
