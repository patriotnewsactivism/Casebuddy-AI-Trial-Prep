import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Mail, Trash2, Crown, Shield, Eye, Edit3, UserPlus, Building2, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Team, TeamMember, TeamInvitation,
  createTeam, fetchTeams, fetchTeamMembers, removeTeamMember,
  inviteToTeam, fetchMyInvitations, respondToInvitation,
} from '../services/collaborationService';
import { toast } from 'react-toastify';

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  attorney: Users,
  paralegal: Edit3,
  viewer: Eye,
};

const roleColors: Record<string, string> = {
  owner: 'text-gold-500 bg-gold-500/10',
  admin: 'text-blue-400 bg-blue-500/10',
  attorney: 'text-emerald-400 bg-emerald-500/10',
  paralegal: 'text-purple-400 bg-purple-500/10',
  viewer: 'text-slate-400 bg-slate-700',
};

const TeamManager = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Create team form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamFirm, setNewTeamFirm] = useState('');

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('attorney');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamList, myInvites] = await Promise.all([
        fetchTeams(),
        fetchMyInvitations(),
      ]);
      setTeams(teamList);
      setInvitations(myInvites);
      if (teamList.length > 0 && !selectedTeam) {
        setSelectedTeam(teamList[0]);
      }
    } catch (err) {
      console.error('[TeamManager] loadData failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTeam]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedTeam) { setMembers([]); return; }
    fetchTeamMembers(selectedTeam.id).then(setMembers).catch(console.error);
  }, [selectedTeam]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const team = await createTeam(newTeamName.trim(), newTeamFirm.trim() || undefined);
      if (team) {
        setTeams(prev => [team, ...prev]);
        setSelectedTeam(team);
        toast.success('Team created successfully!');
      }
      setShowCreateForm(false);
      setNewTeamName('');
      setNewTeamFirm('');
    } catch (err) {
      toast.error('Failed to create team');
    }
  };

  const handleInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    try {
      await inviteToTeam(selectedTeam.id, inviteEmail.trim(), inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteForm(false);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (member.role === 'owner') { toast.error('Cannot remove team owner'); return; }
    if (!window.confirm(`Remove ${member.full_name || member.email || 'this member'} from the team?`)) return;
    try {
      await removeTeamMember(member.id);
      setMembers(prev => prev.filter(m => m.id !== member.id));
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleRespondInvite = async (invitation: TeamInvitation, accept: boolean) => {
    try {
      await respondToInvitation(invitation.id, accept);
      setInvitations(prev => prev.filter(i => i.id !== invitation.id));
      toast.success(accept ? 'Joined team!' : 'Invitation declined');
      if (accept) loadData();
    } catch {
      toast.error('Failed to respond to invitation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">Team Management</h1>
          <p className="text-slate-400 mt-1 text-sm">Collaborate with colleagues on cases</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold rounded-lg transition-colors"
        >
          <Plus size={18} />
          Create Team
        </button>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
          <h3 className="text-sm font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
            <Mail size={16} />
            Pending Invitations ({invitations.length})
          </h3>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                <div>
                  <p className="text-white font-medium">{inv.team_name || 'Unknown Team'}</p>
                  <p className="text-xs text-slate-400">Role: {inv.role} &middot; Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRespondInvite(inv, true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg"
                  >
                    <Check size={14} /> Accept
                  </button>
                  <button
                    onClick={() => handleRespondInvite(inv, false)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg"
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create a New Team</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Team Name *</label>
                <input
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="e.g., Smith & Associates"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Firm Name (optional)</label>
                <input
                  value={newTeamFirm}
                  onChange={e => setNewTeamFirm(e.target.value)}
                  placeholder="e.g., Smith & Associates LLP"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                <button onClick={handleCreateTeam} className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold rounded-lg">
                  Create Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Teams sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Your Teams</h3>
          {teams.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 bg-slate-800 rounded-lg">No teams yet. Create one to start collaborating.</p>
          ) : (
            teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedTeam?.id === team.id
                    ? 'bg-gold-500/10 border-gold-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{team.name}</p>
                    {team.firm_name && <p className="text-xs text-slate-500 truncate">{team.firm_name}</p>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Team Details */}
        <div className="lg:col-span-3">
          {selectedTeam ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedTeam.name}</h2>
                  {selectedTeam.firm_name && <p className="text-sm text-slate-400">{selectedTeam.firm_name}</p>}
                </div>
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold rounded-lg text-sm"
                >
                  <UserPlus size={16} />
                  Invite Member
                </button>
              </div>

              {/* Invite Form */}
              {showInviteForm && (
                <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@firm.com"
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    >
                      <option value="attorney">Attorney</option>
                      <option value="paralegal">Paralegal</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleInvite} className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold rounded-lg text-sm">
                        Send Invite
                      </button>
                      <button onClick={() => setShowInviteForm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="p-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Members ({members.length})</h3>
                {members.length === 0 ? (
                  <p className="text-slate-500 text-sm">No members yet. Invite colleagues to collaborate.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map(member => {
                      const RoleIcon = roleIcons[member.role] || Users;
                      return (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
                              <span className="text-sm font-bold text-white">
                                {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">{member.full_name || 'Unknown'}</p>
                              <p className="text-xs text-slate-400">{member.email || 'No email'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold capitalize ${roleColors[member.role] || 'text-slate-400'}`}>
                              <RoleIcon size={12} />
                              {member.role}
                            </span>
                            {member.role !== 'owner' && member.user_id !== user?.id && (
                              <button
                                onClick={() => handleRemoveMember(member)}
                                className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <Users className="mx-auto text-slate-600 mb-4" size={48} />
              <h3 className="text-xl font-semibold text-white mb-2">No Team Selected</h3>
              <p className="text-slate-400 mb-4">Create or select a team to manage members and collaborate on cases.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamManager;
