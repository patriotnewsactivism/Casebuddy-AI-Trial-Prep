-- ============================================
-- CASEBUDDY COMPLETE SCHEMA SETUP
-- ============================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jpzkumgndqsdwimbvjku/sql/new
-- ============================================

-- ============================================
-- SECTION 1: CASES TABLE
-- ============================================

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

-- ============================================
-- SECTION 2: TRANSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.transcriptions (
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

-- ============================================
-- SECTION 3: TRIAL SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.trial_sessions (
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

-- ============================================
-- SECTION 4: SETTLEMENT ANALYSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.settlement_analyses (
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

-- ============================================
-- SECTION 5: INDEXES FOR PERFORMANCE
-- ============================================

-- Cases table indexes
CREATE INDEX IF NOT EXISTS idx_cases_title_lower ON public.cases (LOWER(title));
CREATE INDEX IF NOT EXISTS idx_cases_client_lower ON public.cases (LOWER(client));
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases (createdAt DESC);

-- Transcriptions table indexes
CREATE INDEX IF NOT EXISTS idx_transcriptions_case_id ON public.transcriptions (caseId);
CREATE INDEX IF NOT EXISTS idx_transcriptions_timestamp ON public.transcriptions (timestamp DESC);

-- Trial sessions table indexes
CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON public.trial_sessions (caseId);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_date ON public.trial_sessions (date DESC);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_phase ON public.trial_sessions (phase);

-- Settlement analyses table indexes
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_case_id ON public.settlement_analyses (caseId);
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_date ON public.settlement_analyses (date DESC);

-- JSONB indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_cases_tags_gin ON public.cases USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_cases_evidence_gin ON public.cases USING GIN (evidence);

-- ============================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "anon_select_cases" ON public.cases;
DROP POLICY IF EXISTS "anon_insert_cases" ON public.cases;
DROP POLICY IF EXISTS "anon_update_cases" ON public.cases;
DROP POLICY IF EXISTS "anon_delete_cases" ON public.cases;
DROP POLICY IF EXISTS "anon_select_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_insert_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_update_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_delete_transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "anon_select_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_insert_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_update_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_delete_trial_sessions" ON public.trial_sessions;
DROP POLICY IF EXISTS "anon_select_settlement_analyses" ON public.settlement_analyses;
DROP POLICY IF EXISTS "anon_insert_settlement_analyses" ON public.settlement_analyses;
DROP POLICY IF EXISTS "anon_update_settlement_analyses" ON public.settlement_analyses;
DROP POLICY IF EXISTS "anon_delete_settlement_analyses" ON public.settlement_analyses;

-- Cases policies
CREATE POLICY "anon_select_cases" ON public.cases FOR SELECT USING (true);
CREATE POLICY "anon_insert_cases" ON public.cases FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_cases" ON public.cases FOR UPDATE USING (true);
CREATE POLICY "anon_delete_cases" ON public.cases FOR DELETE USING (true);

-- Transcriptions policies
CREATE POLICY "anon_select_transcriptions" ON public.transcriptions FOR SELECT USING (true);
CREATE POLICY "anon_insert_transcriptions" ON public.transcriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_transcriptions" ON public.transcriptions FOR UPDATE USING (true);
CREATE POLICY "anon_delete_transcriptions" ON public.transcriptions FOR DELETE USING (true);

-- Trial sessions policies
CREATE POLICY "anon_select_trial_sessions" ON public.trial_sessions FOR SELECT USING (true);
CREATE POLICY "anon_insert_trial_sessions" ON public.trial_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_trial_sessions" ON public.trial_sessions FOR UPDATE USING (true);
CREATE POLICY "anon_delete_trial_sessions" ON public.trial_sessions FOR DELETE USING (true);

-- Settlement analyses policies
CREATE POLICY "anon_select_settlement_analyses" ON public.settlement_analyses FOR SELECT USING (true);
CREATE POLICY "anon_insert_settlement_analyses" ON public.settlement_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_settlement_analyses" ON public.settlement_analyses FOR UPDATE USING (true);
CREATE POLICY "anon_delete_settlement_analyses" ON public.settlement_analyses FOR DELETE USING (true);

-- ============================================
-- SECTION 7: HELPER FUNCTIONS & TRIGGERS
-- ============================================

-- Function to auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedAt = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_cases_updated_at ON public.cases;
DROP TRIGGER IF EXISTS update_transcriptions_updated_at ON public.transcriptions;
DROP TRIGGER IF EXISTS update_trial_sessions_updated_at ON public.trial_sessions;
DROP TRIGGER IF EXISTS update_settlement_analyses_updated_at ON public.settlement_analyses;

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transcriptions_updated_at
  BEFORE UPDATE ON public.transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trial_sessions_updated_at
  BEFORE UPDATE ON public.trial_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settlement_analyses_updated_at
  BEFORE UPDATE ON public.settlement_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SECTION 8: GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- SETUP COMPLETE
-- ============================================
SELECT 'Schema setup complete!' as status;