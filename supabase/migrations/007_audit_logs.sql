-- ============================================================================
-- AUDIT LOGS & MONITORING
-- Tracks all AI requests, user actions, and system events for:
-- - Usage analytics and billing
-- - Security auditing
-- - Performance monitoring
-- - Cost tracking per user/feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  details JSONB DEFAULT '{}',
  model_used TEXT,
  token_count INTEGER,
  estimated_cost DECIMAL(10,6),
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource);

COMMENT ON TABLE public.audit_logs IS 'Audit trail for all AI requests, user actions, and system events';

-- RLS: Users can read their own logs, system can write
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "audit_logs_insert_all" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- USAGE ANALYTICS VIEWS
-- ============================================================================

-- Monthly cost summary per user
CREATE OR REPLACE FUNCTION public.get_user_cost_summary(
  p_user_id UUID,
  p_month TIMESTAMPTZ DEFAULT date_trunc('month', NOW())
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_requests', COUNT(*) FILTER (WHERE action = 'ai_request'),
    'total_tokens', COALESCE(SUM(token_count) FILTER (WHERE action = 'ai_request'), 0),
    'total_estimated_cost', ROUND(COALESCE(SUM(estimated_cost) FILTER (WHERE action = 'ai_request'), 0)::numeric, 4),
    'cache_hits', COUNT(*) FILTER (WHERE action = 'cache_hit'),
    'cache_misses', COUNT(*) FILTER (WHERE action = 'cache_miss'),
    'cache_hit_rate', CASE
      WHEN COUNT(*) FILTER (WHERE action IN ('cache_hit', 'cache_miss')) > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE action = 'cache_hit')::numeric /
        COUNT(*) FILTER (WHERE action IN ('cache_hit', 'cache_miss'))::numeric, 4
      )
      ELSE 0
    END,
    'ocr_processed', COUNT(*) FILTER (WHERE action = 'ocr_process'),
    'transcriptions', COUNT(*) FILTER (WHERE action = 'transcription'),
    'courtroom_sessions', COUNT(*) FILTER (WHERE action = 'courtroom_session'),
    'avg_response_ms', ROUND(COALESCE(AVG(duration_ms) FILTER (WHERE action = 'ai_request'), 0)),
    'error_count', COUNT(*) FILTER (WHERE NOT success),
    'models_used', (
      SELECT COALESCE(jsonb_object_agg(model_used, cnt), '{}'::jsonb)
      FROM (
        SELECT model_used, COUNT(*) as cnt
        FROM public.audit_logs
        WHERE user_id = p_user_id
          AND created_at >= p_month
          AND created_at < p_month + INTERVAL '1 month'
          AND model_used IS NOT NULL
        GROUP BY model_used
      ) sub
    )
  ) INTO result
  FROM public.audit_logs
  WHERE user_id = p_user_id
    AND created_at >= p_month
    AND created_at < p_month + INTERVAL '1 month';

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_cost_summary(UUID, TIMESTAMPTZ) IS 'Returns monthly usage and cost analytics for a user';

-- Auto-cleanup old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_audit_logs() IS 'Removes audit log entries older than 90 days';
