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
  role: 'owner' | 'attorney' | 'paralegal' | 'viewer';
  joined_at: string;
}

// ── Case Sharing ─────────────────────────────────────────────────────────────

export const shareCase = async (
  _caseId: string,
  _email: string,
  _permission: 'view' | 'edit' | 'admin' = 'view',
): Promise<CaseCollaborator | null> => {
  console.warn('[collaborationService] Case sharing not yet configured.');
  return null;
};

export const fetchCaseCollaborators = async (
  _caseId: string,
): Promise<CaseCollaborator[]> => {
  return [];
};

export const removeCaseCollaborator = async (_collaboratorId: string): Promise<void> => {
  console.warn('[collaborationService] removeCaseCollaborator: stub.');
};

export const updateCasePermission = async (
  _collaboratorId: string,
  _permission: 'view' | 'edit' | 'admin',
): Promise<void> => {
  console.warn('[collaborationService] updateCasePermission: stub.');
};

// ── Teams ────────────────────────────────────────────────────────────────────

export const createTeam = async (_name: string): Promise<Team | null> => {
  console.warn('[collaborationService] createTeam: stub.');
  return null;
};

export const getTeams = async (): Promise<Team[]> => {
  return [];
};

export const deleteTeam = async (_teamId: string): Promise<void> => {
  console.warn('[collaborationService] deleteTeam: stub.');
};

export const inviteTeamMember = async (
  _teamId: string,
  _email: string,
  _role: TeamMember['role'] = 'viewer',
): Promise<TeamMember | null> => {
  console.warn('[collaborationService] inviteTeamMember: stub.');
  return null;
};

export const getTeamMembers = async (_teamId: string): Promise<TeamMember[]> => {
  return [];
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

export const isCollaborationEnabled = (): boolean => false;
