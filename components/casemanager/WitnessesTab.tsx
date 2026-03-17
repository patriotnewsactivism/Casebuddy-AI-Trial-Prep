import React, { useState } from 'react';
import { Case, ExpertWitness, Witness } from '../../types';
import { Plus, Trash2, Users } from 'lucide-react';
import { handleSuccess, handleError } from '../../utils/errorHandler';

interface WitnessesTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

export const WitnessesTab: React.FC<WitnessesTabProps> = ({ activeCase, updateCase }) => {
  const [tab, setTab] = useState<'fact' | 'expert'>('fact');
  const [showAddFact, setShowAddFact] = useState(false);
  const [showAddExpert, setShowAddExpert] = useState(false);
  const [newFact, setNewFact] = useState<Partial<Witness>>({});
  const [newExpert, setNewExpert] = useState<Partial<ExpertWitness>>({ side: 'ours' });

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const handleAddFact = async () => {
    if (!newFact.name) {
      handleError('Name is required');
      return;
    }
    const witness: Witness = {
      id: crypto.randomUUID(),
      name: newFact.name,
      role: newFact.role || '',
      personality: newFact.personality || 'Neutral',
      credibilityScore: newFact.credibilityScore || 50,
      avatarUrl: '',
    };
    const updated = [...(activeCase.witnesses || []), witness];
    await updateCase(activeCase.id, { witnesses: updated });
    setNewFact({});
    setShowAddFact(false);
    handleSuccess('Witness added');
  };

  const handleAddExpert = async () => {
    if (!newExpert.name) {
      handleError('Name is required');
      return;
    }
    const expert: ExpertWitness = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      name: newExpert.name,
      title: newExpert.title || '',
      specialty: newExpert.specialty || '',
      side: (newExpert.side || 'ours') as 'ours' | 'opposing',
      firm: newExpert.firm,
      email: newExpert.email,
      phone: newExpert.phone,
      fee: newExpert.fee,
    };
    const updated = [...(activeCase.expertWitnesses || []), expert];
    await updateCase(activeCase.id, { expertWitnesses: updated });
    setNewExpert({ side: 'ours' });
    setShowAddExpert(false);
    handleSuccess('Expert witness added');
  };

  const handleDeleteFact = async (id: string) => {
    const updated = (activeCase.witnesses || []).filter(w => w.id !== id);
    await updateCase(activeCase.id, { witnesses: updated });
    handleSuccess('Witness deleted');
  };

  const handleDeleteExpert = async (id: string) => {
    const updated = (activeCase.expertWitnesses || []).filter(e => e.id !== id);
    await updateCase(activeCase.id, { expertWitnesses: updated });
    handleSuccess('Expert deleted');
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-0">
        <button
          onClick={() => setTab('fact')}
          className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            tab === 'fact'
              ? 'bg-gold-500 text-slate-900'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Fact Witnesses ({activeCase.witnesses?.length || 0})
        </button>
        <button
          onClick={() => setTab('expert')}
          className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            tab === 'expert'
              ? 'bg-gold-500 text-slate-900'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Experts ({activeCase.expertWitnesses?.length || 0})
        </button>
      </div>

      {/* Fact Witnesses */}
      {tab === 'fact' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowAddFact(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={18} /> Add Witness
          </button>

          <div className="grid gap-4">
            {(activeCase.witnesses || []).map(w => (
              <div key={w.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-white">{w.name}</h4>
                    <p className="text-slate-400 text-sm">{w.role}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFact(w.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Personality:</span>
                  <span className="px-2 py-1 bg-slate-700 rounded text-white">{w.personality}</span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 text-sm">Credibility:</span>
                  <div className="h-2 bg-slate-700 rounded mt-1">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{ width: `${w.credibilityScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showAddFact && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={newFact.name || ''}
                onChange={e => setNewFact({ ...newFact, name: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Role"
                value={newFact.role || ''}
                onChange={e => setNewFact({ ...newFact, role: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
              <select
                value={newFact.personality || 'Neutral'}
                onChange={e => setNewFact({ ...newFact, personality: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              >
                <option value="Neutral">Neutral</option>
                <option value="Cooperative">Cooperative</option>
                <option value="Hostile">Hostile</option>
                <option value="Nervous">Nervous</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAddFact}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddFact(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expert Witnesses */}
      {tab === 'expert' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowAddExpert(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={18} /> Add Expert
          </button>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-300">Name</th>
                  <th className="px-4 py-2 text-left text-slate-300">Specialty</th>
                  <th className="px-4 py-2 text-left text-slate-300">Side</th>
                  <th className="px-4 py-2 text-left text-slate-300">Report</th>
                  <th className="px-4 py-2 text-right text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {(activeCase.expertWitnesses || []).map(e => (
                  <tr key={e.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-white font-semibold">{e.name}</td>
                    <td className="px-4 py-2 text-slate-300">{e.specialty}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-1 rounded ${e.side === 'ours' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {e.side === 'ours' ? 'Ours' : 'Opposing'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {e.reportReceived ? <span className="text-green-400">✓ Received</span> : <span className="text-slate-400">Pending</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => handleDeleteExpert(e.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddExpert && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={newExpert.name || ''}
                onChange={e => setNewExpert({ ...newExpert, name: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Title"
                value={newExpert.title || ''}
                onChange={e => setNewExpert({ ...newExpert, title: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
              <input
                type="text"
                placeholder="Specialty"
                value={newExpert.specialty || ''}
                onChange={e => setNewExpert({ ...newExpert, specialty: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
              <select
                value={newExpert.side || 'ours'}
                onChange={e => setNewExpert({ ...newExpert, side: e.target.value as 'ours' | 'opposing' })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              >
                <option value="ours">Our Expert</option>
                <option value="opposing">Opposing Expert</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAddExpert}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddExpert(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
