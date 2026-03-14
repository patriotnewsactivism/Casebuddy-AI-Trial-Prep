-- ============================================================================
-- PRODUCTION READINESS MIGRATION
-- Adds: courtroom simulation tracking, AI caching, user tiers,
--        document processing queue, performance metrics
-- ============================================================================

-- ============================================================================
-- USER TIERS & USAGE TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON public.user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier ON public.user_tiers(tier);

COMMENT ON TABLE public.user_tiers IS 'User subscription tiers for rate limiting and feature gating';

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_action ON public.usage_tracking(user_id, action);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON public.usage_tracking(period_start, period_end);

COMMENT ON TABLE public.usage_tracking IS 'Tracks per-user usage for rate limiting and billing';

-- Function to increment usage atomically
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_action TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
  period_s TIMESTAMPTZ;
  period_e TIMESTAMPTZ;
BEGIN
  -- Monthly period
  period_s := date_trunc('month', NOW());
  period_e := date_trunc('month', NOW()) + INTERVAL '1 month';

  INSERT INTO public.usage_tracking (user_id, action, count, period_start, period_end)
  VALUES (p_user_id, p_action, p_increment, period_s, period_e)
  ON CONFLICT (user_id, action, period_start)
  DO UPDATE SET count = usage_tracking.count + p_increment, updated_at = NOW()
  RETURNING count INTO current_count;

  RETURN current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current usage
CREATE OR REPLACE FUNCTION public.get_usage(
  p_user_id UUID,
  p_action TEXT
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT count INTO current_count
  FROM public.usage_tracking
  WHERE user_id = p_user_id
    AND action = p_action
    AND period_start = date_trunc('month', NOW());

  RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- AI ANALYSIS CACHE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id TEXT,
  analysis_type TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  model_used TEXT,
  token_count INTEGER,
  hit_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prompt_hash, analysis_type)
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_hash ON public.analysis_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_type ON public.analysis_cache(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_document ON public.analysis_cache(document_id);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires ON public.analysis_cache(expires_at);

COMMENT ON TABLE public.analysis_cache IS 'Cached AI analysis results to reduce API costs';

-- Function to record cache hit
CREATE OR REPLACE FUNCTION public.record_cache_hit(p_cache_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.analysis_cache
  SET hit_count = hit_count + 1, updated_at = NOW()
  WHERE id = p_cache_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.analysis_cache
  WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DOCUMENT PROCESSING QUEUE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.document_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  processing_method TEXT CHECK (processing_method IN ('native_text', 'ocr_tesseract', 'ocr_google', 'ocr_aws', 'ocr_azure', 'transcription')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_queue_user ON public.document_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_document_queue_status ON public.document_queue(status);
CREATE INDEX IF NOT EXISTS idx_document_queue_priority ON public.document_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_document_queue_case ON public.document_queue(case_id);

COMMENT ON TABLE public.document_queue IS 'Queue for batch document processing (OCR, transcription, analysis)';

-- Function to claim next document from queue
CREATE OR REPLACE FUNCTION public.claim_next_document()
RETURNS UUID AS $$
DECLARE
  doc_id UUID;
BEGIN
  UPDATE public.document_queue
  SET status = 'processing', started_at = NOW(), updated_at = NOW()
  WHERE id = (
    SELECT id FROM public.document_queue
    WHERE status = 'pending'
    AND retry_count < max_retries
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO doc_id;

  RETURN doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COURTROOM SIMULATION SESSIONS (Extended)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.courtroom_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('mock_trial', 'deposition', 'cross_examination', 'direct_examination', 'opening_statement', 'closing_argument', 'voir_dire', 'sentencing')),
  difficulty TEXT DEFAULT 'practice' CHECK (difficulty IN ('learn', 'practice', 'trial')),
  ai_judge_model TEXT DEFAULT 'gemini-2.5-flash',
  ai_opposing_counsel_model TEXT DEFAULT 'gemini-2.5-flash',
  ai_witness_model TEXT DEFAULT 'gemini-2.5-flash',
  case_context TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  duration_seconds INTEGER DEFAULT 0,
  overall_score DECIMAL(5,2),
  feedback TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courtroom_sessions_user ON public.courtroom_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_courtroom_sessions_case ON public.courtroom_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_courtroom_sessions_type ON public.courtroom_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_courtroom_sessions_status ON public.courtroom_sessions(status);

COMMENT ON TABLE public.courtroom_sessions IS 'Extended courtroom simulation sessions with AI agent tracking';

-- ============================================================================
-- SIMULATION TRANSCRIPTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.simulation_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.courtroom_sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  analysis JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_transcripts_session ON public.simulation_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_sim_transcripts_speaker ON public.simulation_transcripts(speaker);
CREATE INDEX IF NOT EXISTS idx_sim_transcripts_time ON public.simulation_transcripts(timestamp);

COMMENT ON TABLE public.simulation_transcripts IS 'Turn-by-turn transcript of courtroom simulation sessions';

-- ============================================================================
-- OBJECTION TRACKER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.objection_tracker (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.courtroom_sessions(id) ON DELETE CASCADE,
  objection_type TEXT NOT NULL,
  raised_by TEXT NOT NULL CHECK (raised_by IN ('user', 'ai_opposing')),
  ruling TEXT CHECK (ruling IN ('sustained', 'overruled', 'pending')),
  reasoning TEXT,
  legal_basis TEXT,
  was_cured BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objection_tracker_session ON public.objection_tracker(session_id);
CREATE INDEX IF NOT EXISTS idx_objection_tracker_ruling ON public.objection_tracker(ruling);

COMMENT ON TABLE public.objection_tracker IS 'Tracks objections raised during courtroom simulations';

-- ============================================================================
-- PERFORMANCE METRICS (Per Session)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.simulation_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.courtroom_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  score DECIMAL(5,2) CHECK (score >= 0 AND score <= 100),
  feedback TEXT,
  details JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_metrics_session ON public.simulation_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_sim_metrics_user ON public.simulation_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_sim_metrics_type ON public.simulation_metrics(metric_type);

COMMENT ON TABLE public.simulation_metrics IS 'Granular performance metrics from courtroom simulations';

-- Function to calculate aggregate performance
CREATE OR REPLACE FUNCTION public.get_performance_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sessions', COUNT(DISTINCT cs.id),
    'total_duration_seconds', COALESCE(SUM(cs.duration_seconds), 0),
    'average_score', ROUND(COALESCE(AVG(cs.overall_score), 0), 2),
    'sessions_by_type', (
      SELECT jsonb_object_agg(session_type, cnt)
      FROM (
        SELECT session_type, COUNT(*) as cnt
        FROM public.courtroom_sessions
        WHERE user_id = p_user_id AND status = 'completed'
        GROUP BY session_type
      ) sub
    ),
    'objection_stats', jsonb_build_object(
      'total_raised', (SELECT COUNT(*) FROM public.objection_tracker ot
        JOIN public.courtroom_sessions cs2 ON ot.session_id = cs2.id
        WHERE cs2.user_id = p_user_id),
      'sustained', (SELECT COUNT(*) FROM public.objection_tracker ot
        JOIN public.courtroom_sessions cs2 ON ot.session_id = cs2.id
        WHERE cs2.user_id = p_user_id AND ot.ruling = 'sustained'),
      'overruled', (SELECT COUNT(*) FROM public.objection_tracker ot
        JOIN public.courtroom_sessions cs2 ON ot.session_id = cs2.id
        WHERE cs2.user_id = p_user_id AND ot.ruling = 'overruled')
    ),
    'recent_scores', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'date', cs3.created_at,
        'score', cs3.overall_score,
        'type', cs3.session_type
      ) ORDER BY cs3.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT created_at, overall_score, session_type
        FROM public.courtroom_sessions
        WHERE user_id = p_user_id AND status = 'completed' AND overall_score IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 20
      ) cs3
    )
  ) INTO result
  FROM public.courtroom_sessions cs
  WHERE cs.user_id = p_user_id AND cs.status = 'completed';

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courtroom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objection_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_metrics ENABLE ROW LEVEL SECURITY;

-- User tiers: users can read own tier
CREATE POLICY "user_tiers_select_own" ON public.user_tiers
  FOR SELECT USING (auth.uid() = user_id);

-- Usage tracking: users can read own usage
CREATE POLICY "usage_tracking_select_own" ON public.usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Analysis cache: public read (shared cache benefits all users)
CREATE POLICY "analysis_cache_select_all" ON public.analysis_cache
  FOR SELECT USING (true);

CREATE POLICY "analysis_cache_insert_all" ON public.analysis_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "analysis_cache_update_all" ON public.analysis_cache
  FOR UPDATE USING (true);

-- Document queue: users manage own documents
CREATE POLICY "document_queue_select_own" ON public.document_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "document_queue_insert_own" ON public.document_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "document_queue_update_own" ON public.document_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "document_queue_delete_own" ON public.document_queue
  FOR DELETE USING (auth.uid() = user_id);

-- Courtroom sessions: users manage own sessions
CREATE POLICY "courtroom_sessions_select_own" ON public.courtroom_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "courtroom_sessions_insert_own" ON public.courtroom_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "courtroom_sessions_update_own" ON public.courtroom_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "courtroom_sessions_delete_own" ON public.courtroom_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Simulation transcripts: accessible via session ownership
CREATE POLICY "sim_transcripts_select_own" ON public.simulation_transcripts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courtroom_sessions cs
      WHERE cs.id = simulation_transcripts.session_id AND cs.user_id = auth.uid())
  );

CREATE POLICY "sim_transcripts_insert_own" ON public.simulation_transcripts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.courtroom_sessions cs
      WHERE cs.id = simulation_transcripts.session_id AND cs.user_id = auth.uid())
  );

-- Objection tracker: accessible via session ownership
CREATE POLICY "objection_tracker_select_own" ON public.objection_tracker
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courtroom_sessions cs
      WHERE cs.id = objection_tracker.session_id AND cs.user_id = auth.uid())
  );

CREATE POLICY "objection_tracker_insert_own" ON public.objection_tracker
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.courtroom_sessions cs
      WHERE cs.id = objection_tracker.session_id AND cs.user_id = auth.uid())
  );

-- Simulation metrics: users read/write own
CREATE POLICY "sim_metrics_select_own" ON public.simulation_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sim_metrics_insert_own" ON public.simulation_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- AUTO-CREATE FREE TIER ON USER SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_tiers (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_tier ON auth.users;
CREATE TRIGGER on_auth_user_created_tier
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_tier();

-- ============================================================================
-- FUNCTION COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.increment_usage(UUID, TEXT, INTEGER) IS 'Atomically increments usage counter for a user action in the current month';
COMMENT ON FUNCTION public.get_usage(UUID, TEXT) IS 'Returns current month usage count for a user action';
COMMENT ON FUNCTION public.record_cache_hit(UUID) IS 'Records a cache hit and increments hit counter';
COMMENT ON FUNCTION public.cleanup_expired_cache() IS 'Removes expired cache entries';
COMMENT ON FUNCTION public.claim_next_document() IS 'Claims the next pending document from the processing queue';
COMMENT ON FUNCTION public.get_performance_summary(UUID) IS 'Returns aggregate performance metrics for a user';
COMMENT ON FUNCTION public.handle_new_user_tier() IS 'Auto-creates free tier for new users on signup';
