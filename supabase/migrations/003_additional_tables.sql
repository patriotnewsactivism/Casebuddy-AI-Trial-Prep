-- ============================================================================
-- TRANSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

COMMENT ON TABLE public.transcriptions IS 'Audio transcriptions with AI-generated summaries';
COMMENT ON COLUMN public.transcriptions.speaker_identification IS 'JSON mapping speaker labels to identified names';

-- ============================================================================
-- TRIAL SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trial_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON public.trial_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_user_id ON public.trial_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_session_date ON public.trial_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_status ON public.trial_sessions(status);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_type ON public.trial_sessions(session_type);

COMMENT ON TABLE public.trial_sessions IS 'Trial sessions and court appearances';
COMMENT ON COLUMN public.trial_sessions.ai_preparation IS 'AI-generated preparation notes, arguments, and strategies';
COMMENT ON COLUMN public.trial_sessions.key_events IS 'Array of key events that occurred during the session';

-- ============================================================================
-- SETTLEMENT ANALYSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settlement_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_created_at ON public.settlement_analyses(created_at DESC);

COMMENT ON TABLE public.settlement_analyses IS 'AI-powered settlement analysis and recommendations';
COMMENT ON COLUMN public.settlement_analyses.ai_recommendations IS 'AI-generated settlement strategy and tactics';
COMMENT ON COLUMN public.settlement_analyses.risk_assessment IS 'Risk factors and mitigation strategies';

-- ============================================================================
-- WITNESSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.witnesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_witnesses_is_friendly ON public.witnesses(is_friendly);
CREATE INDEX IF NOT EXISTS idx_witnesses_name ON public.witnesses(name);

COMMENT ON TABLE public.witnesses IS 'Witness information with AI-generated preparation materials';
COMMENT ON COLUMN public.witnesses.contact_info IS 'JSON with email, phone, address fields';
COMMENT ON COLUMN public.witnesses.credibility_assessment IS 'AI-generated credibility analysis';
COMMENT ON COLUMN public.witnesses.ai_questions IS 'AI-generated direct and cross-examination questions';

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT CHECK (document_type IN ('pleading', 'motion', 'brief', 'contract', 'correspondence', 'discovery', 'exhibit', 'affidavit', 'judgment', 'other')),
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  version INTEGER DEFAULT 1,
  parent_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'final', 'filed', 'archived')),
  ai_draft_suggestions JSONB DEFAULT '{}',
  ai_review_notes TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON public.documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

COMMENT ON TABLE public.documents IS 'Legal documents with versioning and AI assistance';
COMMENT ON COLUMN public.documents.ai_draft_suggestions IS 'AI-generated drafting suggestions and improvements';
COMMENT ON COLUMN public.documents.parent_document_id IS 'Reference to parent document for version history';

-- ============================================================================
-- RLS POLICIES FOR ADDITIONAL TABLES
-- ============================================================================
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Transcriptions policies
CREATE POLICY "transcriptions_select_own" ON public.transcriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transcriptions_insert_own" ON public.transcriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transcriptions_update_own" ON public.transcriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transcriptions_delete_own" ON public.transcriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Trial sessions policies
CREATE POLICY "trial_sessions_select_own" ON public.trial_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trial_sessions_insert_own" ON public.trial_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trial_sessions_update_own" ON public.trial_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trial_sessions_delete_own" ON public.trial_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Settlement analyses policies
CREATE POLICY "settlement_analyses_select_own" ON public.settlement_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "settlement_analyses_insert_own" ON public.settlement_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settlement_analyses_update_own" ON public.settlement_analyses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settlement_analyses_delete_own" ON public.settlement_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- Witnesses policies
CREATE POLICY "witnesses_select_own" ON public.witnesses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "witnesses_insert_own" ON public.witnesses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "witnesses_update_own" ON public.witnesses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "witnesses_delete_own" ON public.witnesses
  FOR DELETE USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_own" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);
