import React, { useState } from 'react';
import { Case, ClientProfile } from '../../types';
import { Save, X } from 'lucide-react';
import { handleSuccess, handleError } from '../../utils/errorHandler';

interface OverviewTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ activeCase, updateCase }) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftProfile, setDraftProfile] = useState<ClientProfile>(activeCase?.clientProfile || { fullName: '' });

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const handleSaveProfile = async () => {
    if (!draftProfile.fullName) {
      handleError('Client full name is required');
      return;
    }
    await updateCase(activeCase.id, { clientProfile: draftProfile });
    setEditingProfile(false);
    handleSuccess('Client profile updated');
  };

  return (
    <div className="space-y-6">
      {/* Case Vitals - 3 columns */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Column 1: Case Status & Court Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Case Status</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Status:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                activeCase.status === 'Pre-Trial' ? 'bg-blue-600' :
                activeCase.status === 'Discovery' ? 'bg-yellow-600' :
                activeCase.status === 'Trial' ? 'bg-orange-600' :
                activeCase.status === 'Appeal' ? 'bg-purple-600' :
                'bg-green-600'
              } text-white`}>{activeCase.status}</span>
            </div>
            {activeCase.docketNumber && (
              <div>
                <span className="text-slate-400">Docket:</span>
                <span className="ml-2 text-white">{activeCase.docketNumber}</span>
              </div>
            )}
            {activeCase.courtLocation && (
              <div>
                <span className="text-slate-400">Court:</span>
                <span className="ml-2 text-white">{activeCase.courtLocation}</span>
              </div>
            )}
            {activeCase.jurisdiction && (
              <div>
                <span className="text-slate-400">Jurisdiction:</span>
                <span className="ml-2 text-white capitalize">{activeCase.jurisdiction}</span>
              </div>
            )}
            {activeCase.clientType && (
              <div>
                <span className="text-slate-400">Party:</span>
                <span className="ml-2 text-white capitalize">{activeCase.clientType}</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Client Profile */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Client Profile</h3>
            {!editingProfile && (
              <button
                onClick={() => {
                  setDraftProfile(activeCase.clientProfile || { fullName: '' });
                  setEditingProfile(true);
                }}
                className="text-xs text-gold-500 hover:text-gold-400"
              >
                Edit
              </button>
            )}
          </div>

          {editingProfile ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Full Name"
                value={draftProfile.fullName}
                onChange={e => setDraftProfile({ ...draftProfile, fullName: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1 rounded"
              />
              <input
                type="email"
                placeholder="Email"
                value={draftProfile.email || ''}
                onChange={e => setDraftProfile({ ...draftProfile, email: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1 rounded"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={draftProfile.phone || ''}
                onChange={e => setDraftProfile({ ...draftProfile, phone: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1 rounded"
              />
              <input
                type="number"
                placeholder="Retainer Amount"
                value={draftProfile.retainerAmount || ''}
                onChange={e => setDraftProfile({ ...draftProfile, retainerAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1 rounded"
              />
              <input
                type="number"
                placeholder="Billing Rate"
                value={draftProfile.billingRate || ''}
                onChange={e => setDraftProfile({ ...draftProfile, billingRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1 rounded"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 flex items-center justify-center gap-1 bg-gold-500 hover:bg-gold-600 text-slate-900 text-sm font-semibold px-2 py-1 rounded"
                >
                  <Save size={14} /> Save
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-2 py-1 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : activeCase.clientProfile ? (
            <div className="space-y-1 text-sm">
              <div><span className="text-slate-400">Name:</span> <span className="text-white">{activeCase.clientProfile.fullName}</span></div>
              {activeCase.clientProfile.email && <div><span className="text-slate-400">Email:</span> <span className="text-white">{activeCase.clientProfile.email}</span></div>}
              {activeCase.clientProfile.phone && <div><span className="text-slate-400">Phone:</span> <span className="text-white">{activeCase.clientProfile.phone}</span></div>}
              {activeCase.clientProfile.retainerAmount && <div><span className="text-slate-400">Retainer:</span> <span className="text-gold-500">${activeCase.clientProfile.retainerAmount.toLocaleString()}</span></div>}
              {activeCase.clientProfile.billingRate && <div><span className="text-slate-400">Rate:</span> <span className="text-gold-500">${activeCase.clientProfile.billingRate}/hr</span></div>}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No profile added yet</p>
          )}
        </div>

        {/* Column 3: Parties & Judge */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Parties</h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-400">Client:</span>
              <p className="text-white font-semibold">{activeCase.client}</p>
            </div>
            {activeCase.opposingParty && (
              <div>
                <span className="text-slate-400">Opposing:</span>
                <p className="text-white font-semibold">{activeCase.opposingParty}</p>
              </div>
            )}
            {activeCase.opposingCounsel && (
              <div>
                <span className="text-slate-400">Opposing Counsel:</span>
                <p className="text-white font-semibold">{activeCase.opposingCounsel}</p>
              </div>
            )}
            {activeCase.judge && (
              <div>
                <span className="text-slate-400">Judge:</span>
                <p className="text-white font-semibold">{activeCase.judge}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legal Theory & Key Issues */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Legal Theory</h3>
          <p className="text-white text-sm">{activeCase.legalTheory || 'Not specified'}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Key Issues</h3>
          {activeCase.keyIssues && activeCase.keyIssues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeCase.keyIssues.map((issue, idx) => (
                <span key={idx} className="px-2 py-1 bg-slate-700 text-slate-200 text-xs rounded">{issue}</span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No issues specified</p>
          )}
        </div>
      </div>

      {/* Win Probability */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Win Probability</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-green-500"
                style={{ width: `${activeCase.winProbability}%` }}
              />
            </div>
          </div>
          <span className="text-gold-500 font-bold text-xl min-w-[50px] text-right">{activeCase.winProbability}%</span>
        </div>
      </div>
    </div>
  );
};
