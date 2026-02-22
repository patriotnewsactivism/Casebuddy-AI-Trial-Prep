-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'updated_at'
    AND table_type = 'BASE TABLE'
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

-- ============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, preferences)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'attorney'),
    COALESCE(NEW.raw_user_meta_data->'preferences', '{}'::jsonb)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SOFT DELETE FUNCTION FOR CASES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_case()
RETURNS TRIGGER AS $$
BEGIN
  -- Cascade soft delete to related records
  UPDATE public.evidence 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  UPDATE public.tasks 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  UPDATE public.trial_sessions 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  UPDATE public.witnesses 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  UPDATE public.documents 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  UPDATE public.settlement_analyses 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  UPDATE public.transcriptions 
  SET updated_at = NOW()
  WHERE case_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create soft delete trigger (runs BEFORE delete to handle cascade updates)
DROP TRIGGER IF EXISTS on_case_soft_delete ON public.cases;
CREATE TRIGGER on_case_soft_delete
  BEFORE UPDATE OF deleted_at ON public.cases
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION public.soft_delete_case();

-- ============================================================================
-- HELPER FUNCTION TO CHECK CASE OWNERSHIP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_case_owner(case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cases
    WHERE id = case_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- HELPER FUNCTION TO GET USER STATISTICS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_cases', COUNT(DISTINCT c.id),
    'active_cases', COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active' AND c.deleted_at IS NULL),
    'total_evidence', COUNT(DISTINCT e.id),
    'pending_tasks', COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('pending', 'in_progress')),
    'upcoming_sessions', COUNT(DISTINCT ts.id) FILTER (WHERE ts.session_date >= CURRENT_DATE AND ts.status = 'scheduled'),
    'total_witnesses', COUNT(DISTINCT w.id),
    'total_documents', COUNT(DISTINCT d.id)
  ) INTO result
  FROM public.cases c
  LEFT JOIN public.evidence e ON e.case_id = c.id
  LEFT JOIN public.tasks t ON t.case_id = c.id
  LEFT JOIN public.trial_sessions ts ON ts.case_id = c.id
  LEFT JOIN public.witnesses w ON w.case_id = c.id
  LEFT JOIN public.documents d ON d.case_id = c.id
  WHERE c.user_id = auth.uid()
  AND c.deleted_at IS NULL;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- FUNCTION TO CLEAN UP OLD SOFT-DELETED CASES (run periodically)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_cases(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Hard delete cases that were soft-deleted more than days_old days ago
  DELETE FROM public.cases
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - (days_old || ' days')::INTERVAL
  AND user_id = auth.uid();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION TO DUPLICATE A CASE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.duplicate_case(original_case_id UUID)
RETURNS UUID AS $$
DECLARE
  new_case_id UUID;
  original_case RECORD;
BEGIN
  -- Get original case
  SELECT * INTO original_case
  FROM public.cases
  WHERE id = original_case_id
  AND user_id = auth.uid()
  AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found or access denied';
  END IF;
  
  -- Create new case
  INSERT INTO public.cases (
    user_id, name, case_number, court_name, case_type, status,
    description, plaintiffs, defendants, key_dates, metadata
  )
  VALUES (
    auth.uid(),
    original_case.name || ' (Copy)',
    NULL, -- Don't copy case_number
    original_case.court_name,
    original_case.case_type,
    'active',
    original_case.description,
    original_case.plaintiffs,
    original_case.defendants,
    original_case.key_dates,
    original_case.metadata
  )
  RETURNING id INTO new_case_id;
  
  RETURN new_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER TO SYNC PROFILE EMAIL WITH AUTH USERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

-- ============================================================================
-- INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Composite indexes for frequently joined queries
CREATE INDEX IF NOT EXISTS idx_cases_user_status ON public.cases(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_case_status ON public.tasks(case_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_status ON public.tasks(due_date, status) WHERE status != 'completed';

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_cases_name_search ON public.cases USING GIN(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_documents_name_search ON public.documents USING GIN(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_evidence_name_search ON public.evidence USING GIN(to_tsvector('english', name));

-- ============================================================================
-- FUNCTION COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Automatically updates the updated_at timestamp on record modification';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile record when a new user signs up';
COMMENT ON FUNCTION public.soft_delete_case() IS 'Handles cascade updates when a case is soft deleted';
COMMENT ON FUNCTION public.is_case_owner(UUID) IS 'Checks if the current user owns the specified case';
COMMENT ON FUNCTION public.get_user_stats() IS 'Returns statistics for the current user';
COMMENT ON FUNCTION public.cleanup_soft_deleted_cases(INTEGER) IS 'Permanently deletes cases soft-deleted more than specified days ago';
COMMENT ON FUNCTION public.duplicate_case(UUID) IS 'Creates a copy of an existing case';
COMMENT ON FUNCTION public.sync_profile_email() IS 'Keeps profile email in sync with auth.users email';
