-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  firm_name TEXT,
  role TEXT DEFAULT 'attorney' CHECK (role IN ('attorney', 'paralegal', 'admin', 'client')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_firm_name ON public.profiles(firm_name);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================================
-- CASES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  case_number TEXT,
  court_name TEXT,
  case_type TEXT CHECK (case_type IN ('civil', 'criminal', 'family', 'corporate', 'intellectual_property', 'real_estate', 'immigration', 'other')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'settled', 'dismissed', 'closed', 'archived')),
  description TEXT,
  plaintiffs TEXT[] DEFAULT '{}',
  defendants TEXT[] DEFAULT '{}',
  key_dates JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON public.cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON public.cases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);

-- ============================================================================
-- EVIDENCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('document', 'image', 'video', 'audio', 'physical', 'digital', 'testimony', 'other')),
  category TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  ai_analysis JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON public.evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON public.evidence(type);
CREATE INDEX IF NOT EXISTS idx_evidence_category ON public.evidence(category);
CREATE INDEX IF NOT EXISTS idx_evidence_tags ON public.evidence USING GIN(tags);

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users with application-specific data';
COMMENT ON TABLE public.cases IS 'Legal cases with soft delete support';
COMMENT ON TABLE public.evidence IS 'Evidence items linked to cases with AI analysis support';
COMMENT ON TABLE public.tasks IS 'Tasks associated with legal cases';

COMMENT ON COLUMN public.cases.key_dates IS 'JSON object containing important dates: filing_date, hearing_dates, trial_date, statute_of_limitations, etc.';
COMMENT ON COLUMN public.cases.metadata IS 'Flexible JSON storage for additional case metadata';
COMMENT ON COLUMN public.evidence.ai_analysis IS 'AI-generated analysis including summary, key_points, relevance_score, etc.';
