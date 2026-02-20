-- ============================================
-- CASEBUDDY MINIMAL SUPABASE SETUP
-- ============================================
-- Run this in Supabase SQL Editor to set up the
-- essential cases table with RLS policies.
--
-- Usage:
-- 1. Open: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- 2. Paste this entire file
-- 3. Click Run (Ctrl+Enter)
-- ============================================

-- Cases table (primary table for case management)
CREATE TABLE IF NOT EXISTS public.cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pre-Trial',
  opposingCounsel TEXT DEFAULT '',
  judge TEXT DEFAULT '',
  nextCourtDate TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  winProbability NUMERIC(5,2) DEFAULT 0.00,
  tags JSONB DEFAULT '[]'::jsonb,
  evidence JSONB DEFAULT '[]'::jsonb,
  tasks JSONB DEFAULT '[]'::jsonb,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cases IS 'Main cases table storing case information with nested evidence and tasks';

-- Enable Row Level Security
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Permissive policies for prototype mode (allows full anon access)
-- WARNING: Tighten these policies before production!
CREATE POLICY "anon_select_cases" ON public.cases FOR SELECT USING (true);
CREATE POLICY "anon_insert_cases" ON public.cases FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_cases" ON public.cases FOR UPDATE USING (true);
CREATE POLICY "anon_delete_cases" ON public.cases FOR DELETE USING (true);

-- Grant permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedAt = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger
DROP TRIGGER IF EXISTS update_cases_updated_at ON public.cases;
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- OPTIONAL: Additional tables for full setup
-- ============================================
-- See SUPABASE_SETUP.md for complete setup with:
-- - transcriptions table
-- - trial_sessions table
-- - settlement_analyses table
-- - indexes for performance
-- ============================================

-- Verification query (should return empty array)
-- SELECT * FROM cases LIMIT 1;
