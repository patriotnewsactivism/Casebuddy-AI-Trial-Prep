-- ============================================
-- CASEBUDDY SUPABASE SETUP SCRIPT
-- ============================================
-- Run this script in the Supabase SQL Editor to set up
-- all required tables, indexes, and RLS policies.
-- 
-- Prerequisites:
-- 1. Create a Supabase project
-- 2. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local
-- 
-- After running this script, verify setup using:
--    testSupabaseConnection() in supabaseSetup.ts
-- ============================================

-- ============================================
-- SECTION 1: CASES TABLE
-- ============================================
-- Primary table for case management
-- Stores all case data including nested evidence and tasks as JSONB

DROP TABLE IF EXISTS public.cases CASCADE;

CREATE TABLE public.cases (
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
COMMENT ON COLUMN public.cases.id IS 'Unique case identifier (UUID format)';
COMMENT ON COLUMN public.cases.status IS 'Case status: Pre-Trial, Discovery, Trial, Appeal, Closed';
COMMENT ON COLUMN public.cases.evidence IS 'JSON array of EvidenceItem objects';
COMMENT ON COLUMN public.cases.tasks IS 'JSON array of CaseTask objects';

-- ============================================
-- SECTION 2: TRANSCRIPTIONS TABLE
-- ============================================
-- Stores audio/video transcriptions linked to cases

DROP TABLE IF EXISTS public.transcriptions CASCADE;

CREATE TABLE public.transcriptions (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  fileName TEXT NOT NULL,
  fileUrl TEXT,
  text TEXT NOT NULL DEFAULT '',
  duration INTEGER DEFAULT 0,
  speakers JSONB DEFAULT '[]'::jsonb,
  timestamp BIGINT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.transcriptions IS 'Stores audio/video transcriptions for cases';
COMMENT ON COLUMN public.transcriptions.duration IS 'Duration in seconds';
COMMENT ON COLUMN public.transcriptions.timestamp IS 'Unix timestamp of creation';

-- ============================================
-- SECTION 3: TRIAL SESSIONS TABLE
-- ============================================
-- Stores trial simulation/practice session data

DROP TABLE IF EXISTS public.trial_sessions CASCADE;

CREATE TABLE public.trial_sessions (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  caseTitle TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL DEFAULT 'pre-trial-motions',
  mode TEXT NOT NULL DEFAULT 'learn',
  date TEXT NOT NULL DEFAULT '',
  duration INTEGER DEFAULT 0,
  transcript JSONB DEFAULT '[]'::jsonb,
  audioUrl TEXT,
  score NUMERIC(5,2) DEFAULT 0.00,
  feedback TEXT DEFAULT '',
  metrics JSONB DEFAULT '{}'::jsonb,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.trial_sessions IS 'Stores trial simulation and practice session data';
COMMENT ON COLUMN public.trial_sessions.phase IS 'Trial phase: pre-trial-motions, voir-dire, opening-statement, etc.';
COMMENT ON COLUMN public.trial_sessions.mode IS 'Simulation mode: learn, practice, trial';
COMMENT ON COLUMN public.trial_sessions.transcript IS 'JSON array of TrialSessionTranscriptEntry objects';

-- ============================================
-- SECTION 4: SETTLEMENT ANALYSES TABLE
-- ============================================
-- Stores settlement analysis and negotiation data

DROP TABLE IF EXISTS public.settlement_analyses CASCADE;

CREATE TABLE public.settlement_analyses (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  economicDamages JSONB DEFAULT '{}'::jsonb,
  nonEconomicDamages JSONB DEFAULT '{}'::jsonb,
  punitiveDamages JSONB DEFAULT '{}'::jsonb,
  comparativeNegligence NUMERIC(5,2) DEFAULT 0.00,
  settlementRange JSONB DEFAULT '[0, 0]'::jsonb,
  recommendedDemand NUMERIC(12,2) DEFAULT 0.00,
  confidenceScore NUMERIC(5,2) DEFAULT 0.00,
  factors JSONB DEFAULT '[]'::jsonb,
  juryVerdictResearch JSONB DEFAULT '[]'::jsonb,
  negotiationStrategy TEXT DEFAULT '',
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.settlement_analyses IS 'Stores settlement analysis calculations and negotiation strategies';
COMMENT ON COLUMN public.settlement_analyses.settlementRange IS 'JSON array [min, max] settlement values';

-- ============================================
-- SECTION 5: INDEXES FOR PERFORMANCE
-- ============================================
-- Add indexes for commonly queried columns

-- Cases table indexes
CREATE INDEX idx_cases_title_lower ON public.cases (LOWER(title));
CREATE INDEX idx_cases_client_lower ON public.cases (LOWER(client));
CREATE INDEX idx_cases_status ON public.cases (status);
CREATE INDEX idx_cases_created_at ON public.cases (createdAt DESC);
CREATE INDEX idx_cases_next_court_date ON public.cases (nextCourtDate);

-- Transcriptions table indexes
CREATE INDEX idx_transcriptions_case_id ON public.transcriptions (caseId);
CREATE INDEX idx_transcriptions_timestamp ON public.transcriptions (timestamp DESC);

-- Trial sessions table indexes
CREATE INDEX idx_trial_sessions_case_id ON public.trial_sessions (caseId);
CREATE INDEX idx_trial_sessions_date ON public.trial_sessions (date DESC);
CREATE INDEX idx_trial_sessions_phase ON public.trial_sessions (phase);

-- Settlement analyses table indexes
CREATE INDEX idx_settlement_analyses_case_id ON public.settlement_analyses (caseId);
CREATE INDEX idx_settlement_analyses_date ON public.settlement_analyses (date DESC);

-- JSONB indexes for array containment queries
CREATE INDEX idx_cases_tags_gin ON public.cases USING GIN (tags);
CREATE INDEX idx_cases_evidence_gin ON public.cases USING GIN (evidence);

-- ============================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS and create permissive policies for prototype
-- WARNING: These policies allow full anon access. tighten for production!

-- Enable RLS on all tables
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;

-- Cases: Full CRUD for anon (prototype mode)
CREATE POLICY "anon_select_cases" ON public.cases
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_cases" ON public.cases
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_cases" ON public.cases
  FOR UPDATE USING (true);

CREATE POLICY "anon_delete_cases" ON public.cases
  FOR DELETE USING (true);

-- Transcriptions: Full CRUD for anon (prototype mode)
CREATE POLICY "anon_select_transcriptions" ON public.transcriptions
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_transcriptions" ON public.transcriptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_transcriptions" ON public.transcriptions
  FOR UPDATE USING (true);

CREATE POLICY "anon_delete_transcriptions" ON public.transcriptions
  FOR DELETE USING (true);

-- Trial Sessions: Full CRUD for anon (prototype mode)
CREATE POLICY "anon_select_trial_sessions" ON public.trial_sessions
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_trial_sessions" ON public.trial_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_trial_sessions" ON public.trial_sessions
  FOR UPDATE USING (true);

CREATE POLICY "anon_delete_trial_sessions" ON public.trial_sessions
  FOR DELETE USING (true);

-- Settlement Analyses: Full CRUD for anon (prototype mode)
CREATE POLICY "anon_select_settlement_analyses" ON public.settlement_analyses
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_settlement_analyses" ON public.settlement_analyses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_settlement_analyses" ON public.settlement_analyses
  FOR UPDATE USING (true);

CREATE POLICY "anon_delete_settlement_analyses" ON public.settlement_analyses
  FOR DELETE USING (true);

-- ============================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedAt = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transcriptions_updated_at
  BEFORE UPDATE ON public.transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trial_sessions_updated_at
  BEFORE UPDATE ON public.trial_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settlement_analyses_updated_at
  BEFORE UPDATE ON public.settlement_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SECTION 8: GRANT PERMISSIONS
-- ============================================
-- Ensure anon role has necessary permissions

GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- To verify setup:
-- 1. Run: SELECT * FROM cases LIMIT 1;
-- 2. Check RLS is enabled: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- 3. Use testSupabaseConnection() in the app
