import React, { useState } from 'react';
import { Case, FiledMotion } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import { handleSuccess } from '../../utils/errorHandler';

interface MotionsTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

export const MotionsTab: React.FC<MotionsTabProps> = ({ activeCase, updateCase }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newMotion, setNewMotion] = useState<Partial<FiledMotion>>({ type: 'motion', status: 'drafting' });

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const motions = activeCase.motions || [];

  const handleAdd = async () => {
    if (!newMotion.title) {
      handleSuccess('Title is required');
      return;
    }
    const motion: FiledMotion = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      title: newMotion.title,
      type: (newMotion.type || 'motion') as any,
      status: (newMotion.status || 'drafting') as any,
      filedDate: newMotion.filedDate,
      dueDate: newMotion.dueDate,
      hearingDate: newMotion.hearingDate,
      notes: newMotion.notes,
    };
    const updated = [...motions, motion];
    await updateCase(activeCase.id, { motions: updated });
    setNewMotion({ type: 'motion', status: 'drafting' });
    setShowAdd(false);
    handleSuccess('Motion added');
  };

  const handleDelete = async (id: string) => {
    const updated = motions.filter(m => m.id !== id);
    await updateCase(activeCase.id, { motions: updated });
    handleSuccess('Motion deleted');
  };

  const handleStatusChange = async (id: string, status: string) => {
    const updated = motions.map(m =>
      m.id === id ? { ...m, status: status as any } : m
    );
    await updateCase(activeCase.id, { motions: updated });
    handleSuccess('Status updated');
  };

  const statusColors: Record<string, string> = {
    drafting: 'bg-slate-600',
    filed: 'bg-blue-600',
    pending: 'bg-yellow-600',
    granted: 'bg-green-600',
    denied: 'bg-red-600',
    moot: 'bg-gray-600',
    withdrawn: 'bg-orange-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Motions & Pleadings ({motions.length})</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
        >
          <Plus size={18} /> Add Motion
        </button>
      </div>

      {/* Motions Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-slate-300">Title</th>
              <th className="px-4 py-2 text-left text-slate-300">Type</th>
              <th className="px-4 py-2 text-left text-slate-300">Filed</th>
              <th className="px-4 py-2 text-left text-slate-300">Status</th>
              <th className="px-4 py-2 text-left text-slate-300">Hearing</th>
              <th className="px-4 py-2 text-left text-slate-300">Outcome</th>
              <th className="px-4 py-2 text-right text-slate-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {motions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No motions yet
                </td>
              </tr>
            ) : (
              motions.map(m => (
                <tr key={m.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                  <td className="px-4 py-2 text-white font-semibold">{m.title}</td>
                  <td className="px-4 py-2 text-slate-300 text-xs capitalize">{m.type}</td>
                  <td className="px-4 py-2 text-slate-300">
                    {m.filedDate ? new Date(m.filedDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={m.status}
                      onChange={e => handleStatusChange(m.id, e.target.value)}
                      className={`${statusColors[m.status]} text-white text-xs px-2 py-1 rounded font-semibold border-0 cursor-pointer`}
                    >
                      <option value="drafting">Drafting</option>
                      <option value="filed">Filed</option>
                      <option value="pending">Pending</option>
                      <option value="granted">Granted</option>
                      <option value="denied">Denied</option>
                      <option value="moot">Moot</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-slate-300">
                    {m.hearingDate ? new Date(m.hearingDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-300 text-sm">{m.outcome || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Add Motion</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Motion title"
                value={newMotion.title || ''}
                onChange={e => setNewMotion({ ...newMotion, title: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />

              <select
                value={newMotion.type || 'motion'}
                onChange={e => setNewMotion({ ...newMotion, type: e.target.value as any })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              >
                <option value="motion">Motion</option>
                <option value="pleading">Pleading</option>
                <option value="brief">Brief</option>
                <option value="order">Order</option>
                <option value="stipulation">Stipulation</option>
              </select>

              <input
                type="date"
                placeholder="Filed date"
                value={newMotion.filedDate || ''}
                onChange={e => setNewMotion({ ...newMotion, filedDate: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />

              <input
                type="date"
                placeholder="Due date"
                value={newMotion.dueDate || ''}
                onChange={e => setNewMotion({ ...newMotion, dueDate: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />

              <input
                type="date"
                placeholder="Hearing date"
                value={newMotion.hearingDate || ''}
                onChange={e => setNewMotion({ ...newMotion, hearingDate: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />

              <select
                value={newMotion.status || 'drafting'}
                onChange={e => setNewMotion({ ...newMotion, status: e.target.value as any })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              >
                <option value="drafting">Drafting</option>
                <option value="filed">Filed</option>
                <option value="pending">Pending</option>
                <option value="granted">Granted</option>
                <option value="denied">Denied</option>
              </select>

              <textarea
                placeholder="Notes (optional)"
                value={newMotion.notes || ''}
                onChange={e => setNewMotion({ ...newMotion, notes: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg resize-none h-20"
              />
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAdd}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
              >
                Add Motion
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewMotion({ type: 'motion', status: 'drafting' });
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
