-- ============================================================
-- CASEBUDDY AI TRIAL PREP — SUPABASE SCHEMA FIX
-- ============================================================
-- Run this in: https://supabase.com/dashboard/project/czrqlvvjrwizwdyefldo/sql/new
--
-- This script:
--   1. Adds missing columns to the cases table (metadata, key_dates, etc.)
--   2. Creates 4 missing tables (transcriptions, trial_sessions, settlement_analyses, witnesses)
--   3. Adds performance indexes
--   4. Sets up RLS policies (permissive for prototype)
--   5. Creates helper functions & triggers
-- ============================================================

-- ============================================================
-- STEP 1: Fix the cases table — add missing columns
-- ============================================================
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_number TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS court_name TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS plaintiffs TEXT[] DEFAULT '{}';
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS defendants TEXT[] DEFAULT '{}';
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS key_dates JSONB DEFAULT '{}';
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON public.cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON public.cases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_user_status ON public.cases(user_id, status) WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 2: Create transcriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audio_file_path TEXT,
  audio_file_size BIGINT,
  audio_duration_seconds INTEGER,
  transcription_text TEXT,
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ai_summary TEXT,
  speaker_identification JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcriptions_case_id ON public.transcriptions(case_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON public.transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_status ON public.transcriptions(status);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON public.transcriptions(created_at DESC);

-- ============================================================
-- STEP 3: Create trial_sessions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_name TEXT NOT NULL,
  session_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  judge_name TEXT,
  courtroom_number TEXT,
  session_type TEXT CHECK (session_type IN ('hearing', 'trial', 'deposition', 'mediation', 'arbitration', 'conference', 'other')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  notes TEXT,
  ai_preparation JSONB DEFAULT '{}',
  key_events JSONB DEFAULT '[]',
  outcomes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON public.trial_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_user_id ON public.trial_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_session_date ON public.trial_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_status ON public.trial_sessions(status);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_type ON public.trial_sessions(session_type);

-- ============================================================
-- STEP 4: Create settlement_analyses table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settlement_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  analysis_type TEXT DEFAULT 'comprehensive' CHECK (analysis_type IN ('comprehensive', 'quick', 'counter_offer', 'mediation_prep')),
  plaintiff_strengths TEXT[] DEFAULT '{}',
  plaintiff_weaknesses TEXT[] DEFAULT '{}',
  defendant_strengths TEXT[] DEFAULT '{}',
  defendant_weaknesses TEXT[] DEFAULT '{}',
  key_legal_issues TEXT[] DEFAULT '{}',
  recommended_settlement_range JSONB DEFAULT '{"min": 0, "max": 0, "currency": "USD"}',
  probability_of_success JSONB DEFAULT '{"plaintiff": 0, "defendant": 0}',
  ai_recommendations JSONB DEFAULT '{}',
  risk_assessment JSONB DEFAULT '{}',
  similar_cases JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_analyses_case_id ON public.settlement_analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_user_id ON public.settlement_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_type ON public.settlement_analyses(analysis_type);

-- ============================================================
-- STEP 5: Create witnesses table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.witnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('plaintiff', 'defendant', 'expert', 'eyewitness', 'character', 'other')),
  contact_info JSONB DEFAULT '{}',
  background_info TEXT,
  testimony_summary TEXT,
  credibility_assessment JSONB DEFAULT '{}',
  expected_testimony TEXT,
  preparation_notes TEXT,
  ai_questions TEXT[] DEFAULT '{}',
  cross_examination_notes TEXT,
  is_friendly BOOLEAN DEFAULT true,
  reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_witnesses_case_id ON public.witnesses(case_id);
CREATE INDEX IF NOT EXISTS idx_witnesses_user_id ON public.witnesses(user_id);
CREATE INDEX IF NOT EXISTS idx_witnesses_role ON public.witnesses(role);

-- ============================================================
-- STEP 6: RLS Policies (permissive prototype mode)
-- ============================================================
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witnesses ENABLE ROW LEVEL SECURITY;

-- Transcriptions
CREATE POLICY "anon_select_transcriptions" ON public.transcriptions FOR SELECT USING (true);
CREATE POLICY "anon_insert_transcriptions" ON public.transcriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_transcriptions" ON public.transcriptions FOR UPDATE USING (true);
CREATE POLICY "anon_delete_transcriptions" ON public.transcriptions FOR DELETE USING (true);

-- Trial sessions
CREATE POLICY "anon_select_trial_sessions" ON public.trial_sessions FOR SELECT USING (true);
CREATE POLICY "anon_insert_trial_sessions" ON public.trial_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_trial_sessions" ON public.trial_sessions FOR UPDATE USING (true);
CREATE POLICY "anon_delete_trial_sessions" ON public.trial_sessions FOR DELETE USING (true);

-- Settlement analyses
CREATE POLICY "anon_select_settlement_analyses" ON public.settlement_analyses FOR SELECT USING (true);
CREATE POLICY "anon_insert_settlement_analyses" ON public.settlement_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_settlement_analyses" ON public.settlement_analyses FOR UPDATE USING (true);
CREATE POLICY "anon_delete_settlement_analyses" ON public.settlement_analyses FOR DELETE USING (true);

-- Witnesses
CREATE POLICY "anon_select_witnesses" ON public.witnesses FOR SELECT USING (true);
CREATE POLICY "anon_insert_witnesses" ON public.witnesses FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_witnesses" ON public.witnesses FOR UPDATE USING (true);
CREATE POLICY "anon_delete_witnesses" ON public.witnesses FOR DELETE USING (true);

-- ============================================================
-- STEP 7: Functions & Triggers
-- ============================================================
-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to new tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public'
    AND c.column_name = 'updated_at'
    AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW
       EXECUTE FUNCTION public.update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Soft delete cascade
CREATE OR REPLACE FUNCTION public.soft_delete_case()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.evidence SET updated_at = NOW() WHERE case_id = OLD.id;
  UPDATE public.tasks SET updated_at = NOW() WHERE case_id = OLD.id;
  UPDATE public.trial_sessions SET updated_at = NOW() WHERE case_id = OLD.id;
  UPDATE public.witnesses SET updated_at = NOW() WHERE case_id = OLD.id;
  UPDATE public.documents SET updated_at = NOW() WHERE case_id = OLD.id;
  UPDATE public.settlement_analyses SET updated_at = NOW() WHERE case_id = OLD.id;
  UPDATE public.transcriptions SET updated_at = NOW() WHERE case_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_case_soft_delete ON public.cases;
CREATE TRIGGER on_case_soft_delete
  BEFORE UPDATE OF deleted_at ON public.cases
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION public.soft_delete_case();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================
-- DONE! Verify with: SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- ============================================================
SELECT 'Schema migration complete!' as status;
