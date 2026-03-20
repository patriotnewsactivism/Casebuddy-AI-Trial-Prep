import React, { useState } from 'react';
import { Case, DiscoveryRequest } from '../../types';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { handleSuccess, handleError } from '../../utils/errorHandler';

interface DiscoveryTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

export const DiscoveryTab: React.FC<DiscoveryTabProps> = ({ activeCase, updateCase }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newRequest, setNewRequest] = useState<Partial<DiscoveryRequest>>({
    type: 'interrogatory',
    status: 'pending',
  });

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const requests = activeCase.discoveryRequests || [];

  const filtered = requests.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const handleAddRequest = async () => {
    if (!newRequest.number || !newRequest.question) {
      handleError('Number and question are required');
      return;
    }

    const request: DiscoveryRequest = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      type: (newRequest.type || 'interrogatory') as any,
      number: newRequest.number,
      question: newRequest.question,
      status: (newRequest.status || 'pending') as any,
      servedDate: newRequest.servedDate,
      responseDueDate: newRequest.responseDueDate,
    };

    const updated = [...requests, request];
    await updateCase(activeCase.id, { discoveryRequests: updated });
    setNewRequest({ type: 'interrogatory', status: 'pending' });
    setShowAddModal(false);
    handleSuccess('Discovery request added');
  };

  const handleDeleteRequest = async (id: string) => {
    const updated = requests.filter(r => r.id !== id);
    await updateCase(activeCase.id, { discoveryRequests: updated });
    handleSuccess('Request deleted');
  };

  const getUrgencyColor = (dueDate: string | undefined): string => {
    if (!dueDate) return 'text-slate-400';
    const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-500 font-semibold';
    if (days < 7) return 'text-yellow-500 font-semibold';
    if (days < 30) return 'text-blue-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Discovery Requests ({filtered.length})</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
        >
          <Plus size={18} /> Add Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          <option value="interrogatory">Interrogatory</option>
          <option value="request-for-production">RFP</option>
          <option value="request-for-admission">RFA</option>
          <option value="deposition">Deposition</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="responded">Responded</option>
          <option value="objected">Objected</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-slate-300">Number</th>
              <th className="px-4 py-2 text-left text-slate-300">Type</th>
              <th className="px-4 py-2 text-left text-slate-300">Question</th>
              <th className="px-4 py-2 text-left text-slate-300">Status</th>
              <th className="px-4 py-2 text-left text-slate-300">Due Date</th>
              <th className="px-4 py-2 text-right text-slate-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No discovery requests
                </td>
              </tr>
            ) : (
              filtered.map(req => (
                <tr key={req.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                  <td className="px-4 py-2 text-white font-semibold">{req.number}</td>
                  <td className="px-4 py-2 text-slate-300 text-xs capitalize">{req.type.replace('-', ' ')}</td>
                  <td className="px-4 py-2 text-slate-300 truncate max-w-xs">{req.question}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      req.status === 'pending' ? 'bg-yellow-600' :
                      req.status === 'responded' ? 'bg-green-600' :
                      req.status === 'objected' ? 'bg-orange-600' :
                      'bg-red-600'
                    } text-white`}>
                      {req.status}
                    </span>
                  </td>
                  <td className={`px-4 py-2 ${getUrgencyColor(req.responseDueDate)}`}>
                    {req.responseDueDate ? new Date(req.responseDueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDeleteRequest(req.id)}
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
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Add Discovery Request</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Request number (e.g., 'Int-1')"
                value={newRequest.number || ''}
                onChange={e => setNewRequest({ ...newRequest, number: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
              />
              <select
                value={newRequest.type || ''}
                onChange={e => setNewRequest({ ...newRequest, type: e.target.value as any })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <option value="interrogatory">Interrogatory</option>
                <option value="request-for-production">RFP</option>
                <option value="request-for-admission">RFA</option>
                <option value="deposition">Deposition</option>
              </select>
              <textarea
                placeholder="Question/request text"
                value={newRequest.question || ''}
                onChange={e => setNewRequest({ ...newRequest, question: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm resize-none h-20"
              />
              <input
                type="date"
                placeholder="Served date"
                value={newRequest.servedDate || ''}
                onChange={e => setNewRequest({ ...newRequest, servedDate: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
              />
              <input
                type="date"
                placeholder="Response due date"
                value={newRequest.responseDueDate || ''}
                onChange={e => setNewRequest({ ...newRequest, responseDueDate: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
              />
              <select
                value={newRequest.status || ''}
                onChange={e => setNewRequest({ ...newRequest, status: e.target.value as any })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <option value="pending">Pending</option>
                <option value="responded">Responded</option>
                <option value="objected">Objected</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddRequest}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
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
