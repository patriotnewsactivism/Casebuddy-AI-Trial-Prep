import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Shield, Edit3, Eye, Loader2, Share2 } from 'lucide-react';
import {
  CaseCollaborator,
  shareCase,
  fetchCaseCollaborators,
  removeCaseCollaborator,
  updateCasePermission,
} from '../services/collaborationService';
import { toast } from 'react-toastify';

interface CaseShareDialogProps {
  caseId: string;
  caseTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const permissionLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  view: { label: 'View only', icon: Eye, color: 'text-slate-400' },
  edit: { label: 'Can edit', icon: Edit3, color: 'text-blue-400' },
  admin: { label: 'Full access', icon: Shield, color: 'text-gold-500' },
};

const CaseShareDialog: React.FC<CaseShareDialogProps> = ({ caseId, caseTitle, isOpen, onClose }) => {
  const [collaborators, setCollaborators] = useState<CaseCollaborator[]>([]);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit' | 'admin'>('view');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchCaseCollaborators(caseId)
      .then(setCollaborators)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, caseId]);

  const handleShare = async () => {
    if (!email.trim()) return;
    setSharing(true);
    try {
      const collab = await shareCase(caseId, email.trim(), permission);
      if (collab) {
        setCollaborators(prev => [...prev.filter(c => c.user_id !== collab.user_id), { ...collab, email: email.trim() }]);
      }
      toast.success(`Case shared with ${email}`);
      setEmail('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to share case');
    } finally {
      setSharing(false);
    }
  };

  const handleRemove = async (collab: CaseCollaborator) => {
    try {
      await removeCaseCollaborator(collab.id);
      setCollaborators(prev => prev.filter(c => c.id !== collab.id));
      toast.success('Collaborator removed');
    } catch {
      toast.error('Failed to remove collaborator');
    }
  };

  const handlePermissionChange = async (collab: CaseCollaborator, newPerm: 'view' | 'edit' | 'admin') => {
    try {
      await updateCasePermission(collab.id, newPerm);
      setCollaborators(prev => prev.map(c => c.id === collab.id ? { ...c, permission: newPerm } : c));
    } catch {
      toast.error('Failed to update permission');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-gold-500" />
            <h2 className="text-lg font-bold text-white">Share Case</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-400 mb-4">
            Share <span className="text-white font-medium">"{caseTitle}"</span> with colleagues
          </p>

          {/* Share form */}
          <div className="flex gap-2 mb-6">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@firm.com"
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
              onKeyDown={e => e.key === 'Enter' && handleShare()}
            />
            <select
              value={permission}
              onChange={e => setPermission(e.target.value as any)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleShare}
              disabled={sharing || !email.trim()}
              className="flex items-center gap-1 px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-slate-900 font-semibold rounded-lg text-sm"
            >
              {sharing ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Share
            </button>
          </div>

          {/* Collaborators list */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
              People with access ({collaborators.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-slate-400" size={20} />
              </div>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No collaborators yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {collaborators.map(collab => {
                  const perm = permissionLabels[collab.permission];
                  const PermIcon = perm?.icon || Eye;
                  return (
                    <div key={collab.id} className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">
                            {(collab.full_name || collab.email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{collab.full_name || collab.email}</p>
                          {collab.full_name && <p className="text-xs text-slate-500 truncate">{collab.email}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={collab.permission}
                          onChange={e => handlePermissionChange(collab, e.target.value as any)}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                        >
                          <option value="view">View</option>
                          <option value="edit">Edit</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleRemove(collab)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseShareDialog;
