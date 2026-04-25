/**
 * Collaboration Service — stub
 * Full real-time collaboration requires team subscription.
 * All functions return safe empty/null values until configured.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CaseCollaborator {
  id: string;
  case_id: string;
  user_id: string;
  email?: string;
  full_name?: string;
  permission: 'view' | 'edit' | 'admin';
  invited_at: string;
  accepted: boolean;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: 'owner' | 'admin' | 'attorney' | 'paralegal' | 'viewer';
  joined_at: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  team_name: string;
  invited_by: string;
  invited_email: string;
  role: TeamMember['role'];
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

// ── Case Sharing ─────────────────────────────────────────────────────────────

export const shareCase = async (
  _caseId: string,
  _email: string,
  _permission: CaseCollaborator['permission'] = 'view',
): Promise<CaseCollaborator | null> => {
  console.warn('[collaborationService] Case sharing not yet configured.');
  return null;
};

export const fetchCaseCollaborators = async (
  _caseId: string,
): Promise<CaseCollaborator[]> => [];

export const removeCaseCollaborator = async (_id: string): Promise<void> => {
  console.warn('[collaborationService] removeCaseCollaborator: stub.');
};

export const updateCasePermission = async (
  _id: string,
  _permission: CaseCollaborator['permission'],
): Promise<void> => {
  console.warn('[collaborationService] updateCasePermission: stub.');
};

// ── Teams ────────────────────────────────────────────────────────────────────

export const createTeam = async (_name: string): Promise<Team | null> => {
  console.warn('[collaborationService] createTeam: stub.');
  return null;
};

export const fetchTeams = async (): Promise<Team[]> => [];

export const deleteTeam = async (_teamId: string): Promise<void> => {
  console.warn('[collaborationService] deleteTeam: stub.');
};

export const fetchTeamMembers = async (_teamId: string): Promise<TeamMember[]> => [];

export const inviteToTeam = async (
  _teamId: string,
  _email: string,
  _role: TeamMember['role'] = 'viewer',
): Promise<TeamInvitation | null> => {
  console.warn('[collaborationService] inviteToTeam: stub.');
  return null;
};

export const removeTeamMember = async (_memberId: string): Promise<void> => {
  console.warn('[collaborationService] removeTeamMember: stub.');
};

export const updateTeamMemberRole = async (
  _memberId: string,
  _role: TeamMember['role'],
): Promise<void> => {
  console.warn('[collaborationService] updateTeamMemberRole: stub.');
};

export const fetchMyInvitations = async (): Promise<TeamInvitation[]> => [];

export const respondToInvitation = async (
  _invitationId: string,
  _accept: boolean,
): Promise<void> => {
  console.warn('[collaborationService] respondToInvitation: stub.');
};

export const isCollaborationEnabled = (): boolean => false;
