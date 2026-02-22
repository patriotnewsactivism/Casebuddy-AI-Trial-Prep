-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES RLS POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- CASES RLS POLICIES
-- ============================================================================

-- Users can view their own cases (excluding soft-deleted by default via app logic)
CREATE POLICY "cases_select_own" ON public.cases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert cases for themselves
CREATE POLICY "cases_insert_own" ON public.cases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cases
CREATE POLICY "cases_update_own" ON public.cases
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cases (soft delete handled by app)
CREATE POLICY "cases_delete_own" ON public.cases
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- EVIDENCE RLS POLICIES
-- ============================================================================

-- Users can view evidence for their own cases
CREATE POLICY "evidence_select_own" ON public.evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = evidence.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );

-- Users can insert evidence for their own cases
CREATE POLICY "evidence_insert_own" ON public.evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = evidence.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );

-- Users can update evidence for their own cases
CREATE POLICY "evidence_update_own" ON public.evidence
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = evidence.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = evidence.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );

-- Users can delete evidence for their own cases
CREATE POLICY "evidence_delete_own" ON public.evidence
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = evidence.case_id
      AND cases.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TASKS RLS POLICIES
-- ============================================================================

-- Users can view tasks for their own cases
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = tasks.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );

-- Users can insert tasks for their own cases
CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = tasks.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );

-- Users can update tasks for their own cases
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = tasks.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = tasks.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );

-- Users can delete tasks for their own cases
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = tasks.case_id
      AND cases.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICY COMMENTS
-- ============================================================================
COMMENT ON POLICY "profiles_select_own" ON public.profiles IS 'Users can only view their own profile';
COMMENT ON POLICY "profiles_insert_own" ON public.profiles IS 'Users can only insert their own profile';
COMMENT ON POLICY "profiles_update_own" ON public.profiles IS 'Users can only update their own profile';
COMMENT ON POLICY "profiles_delete_own" ON public.profiles IS 'Users can only delete their own profile';

COMMENT ON POLICY "cases_select_own" ON public.cases IS 'Users can only view their own cases';
COMMENT ON POLICY "cases_insert_own" ON public.cases IS 'Users can only insert cases for themselves';
COMMENT ON POLICY "cases_update_own" ON public.cases IS 'Users can only update their own cases';
COMMENT ON POLICY "cases_delete_own" ON public.cases IS 'Users can only delete their own cases';

COMMENT ON POLICY "evidence_select_own" ON public.evidence IS 'Users can only view evidence for their own cases';
COMMENT ON POLICY "evidence_insert_own" ON public.evidence IS 'Users can only insert evidence for their own cases';
COMMENT ON POLICY "evidence_update_own" ON public.evidence IS 'Users can only update evidence for their own cases';
COMMENT ON POLICY "evidence_delete_own" ON public.evidence IS 'Users can only delete evidence for their own cases';

COMMENT ON POLICY "tasks_select_own" ON public.tasks IS 'Users can only view tasks for their own cases';
COMMENT ON POLICY "tasks_insert_own" ON public.tasks IS 'Users can only insert tasks for their own cases';
COMMENT ON POLICY "tasks_update_own" ON public.tasks IS 'Users can only update tasks for their own cases';
COMMENT ON POLICY "tasks_delete_own" ON public.tasks IS 'Users can only delete tasks for their own cases';
