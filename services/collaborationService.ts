/**
 * Collaboration Service — stub
 * Real-time collaboration requires additional infrastructure setup.
 * This stub satisfies imports and provides safe no-op fallbacks.
 */

export interface SharedCase {
  id: string;
  caseId: string;
  sharedBy: string;
  sharedWith: string;
  permissions: 'view' | 'edit';
  createdAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  role: 'owner' | 'attorney' | 'paralegal' | 'viewer';
  name: string;
  joinedAt: string;
}

export const shareCase = async (
  _caseId: string,
  _email: string,
  _permissions: 'view' | 'edit' = 'view',
): Promise<SharedCase | null> => {
  console.warn('[collaborationService] Case sharing requires team subscription.');
  return null;
};

export const getSharedCases = async (): Promise<SharedCase[]> => {
  return [];
};

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  return [];
};

export const inviteTeamMember = async (
  _email: string,
  _role: TeamMember['role'] = 'viewer',
): Promise<TeamMember | null> => {
  console.warn('[collaborationService] Team invites require team subscription.');
  return null;
};

export const removeTeamMember = async (_memberId: string): Promise<void> => {
  console.warn('[collaborationService] removeTeamMember: stub.');
};

export const updatePermissions = async (
  _shareId: string,
  _permissions: 'view' | 'edit',
): Promise<void> => {
  console.warn('[collaborationService] updatePermissions: stub.');
};

export const revokeAccess = async (_shareId: string): Promise<void> => {
  console.warn('[collaborationService] revokeAccess: stub.');
};

export const isCollaborationEnabled = (): boolean => false;
