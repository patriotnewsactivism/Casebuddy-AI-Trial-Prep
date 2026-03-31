-- ============================================
-- 008: Team Collaboration & Case Sharing
-- ============================================

-- Teams / Firms table
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_teams_owner ON public.teams(owner_id);

-- Team Members junction table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'attorney', 'paralegal', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

-- Case Sharing / Collaborators junction table
CREATE TABLE IF NOT EXISTS public.case_collaborators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  shared_by uuid REFERENCES auth.users(id),
  shared_at timestamptz DEFAULT now(),
  UNIQUE(case_id, user_id)
);

CREATE INDEX idx_case_collab_case ON public.case_collaborators(case_id);
CREATE INDEX idx_case_collab_user ON public.case_collaborators(user_id);

-- Team Invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'attorney', 'paralegal', 'viewer')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  UNIQUE(team_id, email, status)
);

CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);

-- RLS Policies

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Teams: members can view, owners can modify
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Team owners can update teams" ON public.teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create teams" ON public.teams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team owners can delete teams" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());

-- Team Members: members can see co-members, admins+ can manage
CREATE POLICY "Team members can view co-members" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Team admins can manage members" ON public.team_members
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Case Collaborators: case owner or collaborators can view
CREATE POLICY "Case collaborators can view shared cases" ON public.case_collaborators
  FOR SELECT USING (
    user_id = auth.uid()
    OR case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
  );

CREATE POLICY "Case owners can manage collaborators" ON public.case_collaborators
  FOR ALL USING (
    case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
  );

-- Invitations: invitees can view their own, team admins can manage
CREATE POLICY "Users can view their invitations" ON public.team_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invited_by = auth.uid()
  );

CREATE POLICY "Team admins can manage invitations" ON public.team_invitations
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Update existing cases RLS to include collaborators
-- Users can view cases shared with them
CREATE POLICY "Collaborators can view shared cases" ON public.cases
  FOR SELECT USING (
    id IN (SELECT case_id FROM public.case_collaborators WHERE user_id = auth.uid())
  );

-- Collaborators with edit permission can update shared cases
CREATE POLICY "Collaborators can edit shared cases" ON public.cases
  FOR UPDATE USING (
    id IN (
      SELECT case_id FROM public.case_collaborators
      WHERE user_id = auth.uid() AND permission IN ('edit', 'admin')
    )
  );
