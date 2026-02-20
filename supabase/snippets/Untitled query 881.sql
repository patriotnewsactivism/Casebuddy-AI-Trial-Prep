-- ============================================
-- CASEBUDDY CLOUD SYNC SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jpzkumgndqsdwimbvjku/sql/new
--
-- This script syncs the full schema to cloud Supabase
-- ============================================
-- ============================================
-- SECTION 1: TRANSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id TEXT PRIMARY KEY,
  "caseId" TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT,
  text TEXT NOT NULL DEFAULT '',
  duration INTEGER DEFAULT 0,
  speakers JSONB DEFAULT '[]'::jsonb,
  timestamp BIGINT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.transcriptions IS 'Stores audio/video transcriptions for cases';
-- ============================================
-- SECTION 2: TRIAL SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.trial_sessions (
  id TEXT PRIMARY KEY,
  "caseId" TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  "caseTitle" TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL DEFAULT 'pre-trial-motions',
  mode TEXT NOT NULL DEFAULT 'learn',
  date TEXT NOT NULL DEFAULT '',
  duration INTEGER DEFAULT 0,
  transcript JSONB DEFAULT '[]'::jsonb,
  "audioUrl" TEXT,
  score NUMERIC(5,2) DEFAULT 0.00,
  feedback TEXT DEFAULT '',
  metrics JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.trial_sessions IS 'Stores trial simulation and practice session data';
-- ============================================
-- SECTION 3: SETTLEMENT ANALYSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.settlement_analyses (
  id TEXT PRIMARY KEY,
  "caseId" TEXT NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  "economicDamages" JSONB DEFAULT '{}'::jsonb,
  "nonEconomicDamages" JSONB DEFAULT '{}'::jsonb,
  "punitiveDamages" JSONB DEFAULT '{}'::jsonb,
  "comparativeNegligence" NUMERIC(5,2) DEFAULT 0.00,
  "settlementRange" JSONB DEFAULT '[0, 0]'::jsonb,
  "recommendedDemand" NUMERIC(12,2) DEFAULT 0.00,
  "confidenceScore" NUMERIC(5,2) DEFAULT 0.00,
  factors JSONB DEFAULT '[]'::jsonb,
  "juryVerdictResearch" JSONB DEFAULT '[]'::jsonb,
  "negotiationStrategy" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.settlement_analyses IS 'Stores settlement analysis calculations and negotiation strategies';
-- ============================================
-- SECTION 4: INDEXES FOR PERFORMANCE
-- ============================================
-- Transcriptions table indexes
CREATE INDEX IF NOT EXISTS idx_transcriptions_case_id ON public.transcriptions ("caseId");
CREATE INDEX IF NOT EXISTS idx_transcriptions_timestamp ON public.transcriptions (timestamp DESC);
-- Trial sessions table indexes
CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON public.trial_sessions ("caseId");
CREATE INDEX IF NOT EXISTS idx_trial_sessions_date ON public.trial_sessions (date DESC);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_phase ON public.trial_sessions (phase);
-- Settlement analyses table indexes
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_case_id ON public.settlement_analyses ("caseId");
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_date ON public.settlement_analyses (date DESC);
-- Cases table indexes (using lowercase column names as they exist in cloud)
CREATE INDEX IF NOT EXISTS idx_cases_title_lower ON public.cases (LOWER(title));
CREATE INDEX IF NOT EXISTS idx_cases_client_lower ON public.cases (LOWER(client));
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases (status);
-- JSONB indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_cases_tags_gin ON public.cases USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_cases_evidence_gin ON public.cases USING GIN (evidence);
-- ============================================
-- SECTION 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on new tables
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;
-- Transcriptions policies
DROP POLICY IF EXISTS "anon_select_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_insert_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_update_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_delete_transcriptions" ON public.transcriptions;
CREATE POLICY "anon_select_transcriptions" ON public.transcriptions FOR SELECT USING (true);
CREATE POLICY "anon_insert_transcriptions" ON public.transcriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_transcriptions" ON public.transcriptions FOR UPDATE USING (true);
CREATE POLICY "anon_delete_transcriptions" ON public.transcriptions FOR DELETE USING (true);
-- Trial sessions policies
DROP POLICY IF EXISTS "anon_select_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_insert_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_update_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_delete_trial_sessions" ON public.trial_sessions;
CREATE POLICY "anon_select_trial_sessions" ON public.trial_sessions FOR SELECT USING (true);
CREATE POLICY "anon_insert_trial_sessions" ON public.trial_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_trial_sessions" ON public.trial_sessions FOR UPDATE USING (true);
CREATE POLICY "anon_delete_trial_sessions" ON public.trial_sessions FOR DELETE USING (true);
-- Settlement analyses policies
DROP POLICY IF EXISTS "anon_select_settlement_analyses" ON public.settlement_analyses;
DROP POLICY IF EXISTS "anon_insert_settlement_analyses" ON public.settlement_analyses;
DROP POLICY IF EXISTS "anon_update_settlement_analyses" ON public.settlement_analyses;
DROP POLICY IF EXISTS "anon_delete_settlement_analyses" ON public.settlement_analyses;
CREATE POLICY "anon_select_settlement_analyses" ON public.settlement_analyses FOR SELECT USING (true);
CREATE POLICY "anon_insert_settlement_analyses" ON public.settlement_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_settlement_analyses" ON public.settlement_analyses FOR UPDATE USING (true);
CREATE POLICY "anon_delete_settlement_analyses" ON public.settlement_analyses FOR DELETE USING (true);
-- ============================================
-- SECTION 6: HELPER FUNCTIONS
-- ============================================
-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Apply updated_at triggers (drop and recreate to avoid errors)
DROP TRIGGER IF EXISTS update_transcriptions_updated_at ON public.transcriptions;
DROP TRIGGER IF EXISTS update_trial_sessions_updated_at ON public.trial_sessions;
DROP TRIGGER IF EXISTS update_settlement_analyses_updated_at ON public.settlement_analyses;
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
-- SECTION 7: GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
-- ============================================
-- SYNC COMPLETE
-- ============================================
SELECT 'Schema sync complete!' as status;