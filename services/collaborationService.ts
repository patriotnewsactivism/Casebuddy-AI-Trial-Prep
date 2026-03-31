import { getSupabaseClient } from './supabaseClient';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  firm_name?: string;
  created_at: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'attorney' | 'paralegal' | 'viewer';
  joined_at: string;
  email?: string;
  full_name?: string;
}

export interface CaseCollaborator {
  id: string;
  case_id: string;
  user_id: string;
  permission: 'view' | 'edit' | 'admin';
  shared_by: string;
  shared_at: string;
  email?: string;
  full_name?: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  team_name?: string;
}

// ── Teams ─────────────────────────────────────────────────

export const createTeam = async (name: string, firmName?: string): Promise<Team | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('teams')
    .insert({ name, firm_name: firmName, owner_id: user.id })
    .select()
    .single();

  if (error) { console.error('[Collab] createTeam failed:', error); throw error; }

  // Auto-add creator as owner member
  await client.from('team_members').insert({
    team_id: data.id,
    user_id: user.id,
    role: 'owner',
    invited_by: user.id,
  });

  return data;
};

export const fetchTeams = async (): Promise<Team[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('team_members')
    .select('team_id, role, teams:team_id(id, name, firm_name, owner_id, created_at)')
    .order('joined_at', { ascending: false });

  if (error) { console.error('[Collab] fetchTeams failed:', error); return []; }

  return (data || [])
    .filter((row: any) => row.teams)
    .map((row: any) => row.teams as Team);
};

export const fetchTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('team_members')
    .select('id, team_id, user_id, role, joined_at, profiles:user_id(email, full_name)')
    .eq('team_id', teamId)
    .order('joined_at');

  if (error) { console.error('[Collab] fetchTeamMembers failed:', error); return []; }

  return (data || []).map((row: any) => ({
    ...row,
    email: row.profiles?.email,
    full_name: row.profiles?.full_name,
  }));
};

export const removeTeamMember = async (memberId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from('team_members').delete().eq('id', memberId);
  if (error) throw error;
};

// ── Case Sharing ──────────────────────────────────────────

export const shareCase = async (
  caseId: string,
  targetEmail: string,
  permission: 'view' | 'edit' | 'admin' = 'view'
): Promise<CaseCollaborator | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  // Lookup the target user by email
  const { data: profiles } = await client
    .from('profiles')
    .select('id')
    .eq('email', targetEmail)
    .single();

  if (!profiles) {
    throw new Error(`No user found with email: ${targetEmail}`);
  }

  const { data, error } = await client
    .from('case_collaborators')
    .upsert({
      case_id: caseId,
      user_id: profiles.id,
      permission,
      shared_by: user.id,
    }, { onConflict: 'case_id,user_id' })
    .select()
    .single();

  if (error) { console.error('[Collab] shareCase failed:', error); throw error; }
  return data;
};

export const fetchCaseCollaborators = async (caseId: string): Promise<CaseCollaborator[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('case_collaborators')
    .select('*, profiles:user_id(email, full_name)')
    .eq('case_id', caseId);

  if (error) { console.error('[Collab] fetchCaseCollaborators failed:', error); return []; }

  return (data || []).map((row: any) => ({
    ...row,
    email: row.profiles?.email,
    full_name: row.profiles?.full_name,
  }));
};

export const removeCaseCollaborator = async (collaboratorId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from('case_collaborators').delete().eq('id', collaboratorId);
  if (error) throw error;
};

export const updateCasePermission = async (
  collaboratorId: string,
  permission: 'view' | 'edit' | 'admin'
): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from('case_collaborators')
    .update({ permission })
    .eq('id', collaboratorId);
  if (error) throw error;
};

// ── Invitations ───────────────────────────────────────────

export const inviteToTeam = async (
  teamId: string,
  email: string,
  role: string = 'attorney'
): Promise<TeamInvitation | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('team_invitations')
    .insert({ team_id: teamId, email, role, invited_by: user.id })
    .select()
    .single();

  if (error) { console.error('[Collab] inviteToTeam failed:', error); throw error; }
  return data;
};

export const fetchMyInvitations = async (): Promise<TeamInvitation[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from('team_invitations')
    .select('*, teams:team_id(name)')
    .eq('email', user.email)
    .eq('status', 'pending');

  if (error) { console.error('[Collab] fetchMyInvitations failed:', error); return []; }

  return (data || []).map((row: any) => ({
    ...row,
    team_name: row.teams?.name,
  }));
};

export const respondToInvitation = async (
  invitationId: string,
  accept: boolean
): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;

  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  if (accept) {
    // Get invitation details
    const { data: invitation } = await client
      .from('team_invitations')
      .select('team_id, role')
      .eq('id', invitationId)
      .single();

    if (invitation) {
      // Add user to team
      await client.from('team_members').insert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: user.id,
      });
    }
  }

  // Update invitation status
  const { error } = await client
    .from('team_invitations')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', invitationId);

  if (error) throw error;
};
