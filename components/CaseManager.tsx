import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import { Case, CaseStatus } from '../types';
import { Plus, Trash2, LayoutDashboard, FileText, Search, Users, CheckSquare, DollarSign, Gavel, GitBranch, Share2 } from 'lucide-react';
import CaseShareDialog from './CaseShareDialog';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { generateRealisticCase } from '../services/caseGenerationService';

import { OverviewTab } from './casemanager/OverviewTab';
import { DocumentsTab } from './casemanager/DocumentsTab';
import { DiscoveryTab } from './casemanager/DiscoveryTab';
import { WitnessesTab } from './casemanager/WitnessesTab';
import { TasksTab } from './casemanager/TasksTab';
import { BudgetTab } from './casemanager/BudgetTab';
import { MotionsTab } from './casemanager/MotionsTab';
import { CaseTimeline } from './CaseTimeline';

type CaseTab = 'overview' | 'documents' | 'discovery' | 'witnesses' | 'tasks' | 'budget' | 'motions' | 'timeline';

interface TabDef {
  id: CaseTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={18} /> },
  { id: 'discovery', label: 'Discovery', icon: <Search size={18} /> },
  { id: 'witnesses', label: 'Witnesses', icon: <Users size={18} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={18} /> },
  { id: 'budget', label: 'Budget', icon: <DollarSign size={18} /> },
  { id: 'motions', label: 'Motions', icon: <Gavel size={18} /> },
  { id: 'timeline', label: 'Timeline', icon: <GitBranch size={18} /> },
];

const CaseManager = () => {
  const { cases, activeCase, setActiveCase, addCase, updateCase, deleteCase } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<CaseTab>('overview');
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showAiGenModal, setShowAiGenModal] = useState(false);
  const [aiGenPrompt, setAiGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [shareCaseId, setShareCaseId] = useState<string | null>(null);
  const [newCaseData, setNewCaseData] = useState<Partial<Case>>({
    title: '',
    client: '',
    opposingCounsel: '',
    judge: '',
    summary: '',
    status: CaseStatus.PRE_TRIAL,
  });

  // Reset tab on case switch
  useEffect(() => {
    setActiveTab('overview');
  }, [activeCase?.id]);

  const handleCreateCase = async () => {
    if (!newCaseData.title || !newCaseData.client) {
      handleError('Title and client are required');
      return;
    }

    const caseObj: Case = {
      id: crypto.randomUUID(),
      title: newCaseData.title,
      client: newCaseData.client,
      opposingCounsel: newCaseData.opposingCounsel || '',
      judge: newCaseData.judge || '',
      summary: newCaseData.summary || '',
      status: newCaseData.status || CaseStatus.PRE_TRIAL,
      winProbability: 50,
      nextCourtDate: 'TBD',
      evidence: [],
      tasks: [],
      budgetEntries: [],
      motions: [],
      courtDates: [],
      expertWitnesses: [],
      timelineEvents: [],
    };

    addCase(caseObj);
    setNewCaseData({ title: '', client: '', opposingCounsel: '', judge: '', summary: '', status: CaseStatus.PRE_TRIAL });
    setShowNewCaseModal(false);
    handleSuccess('Case created');
  };

  const handleAiGenerate = async () => {
    if (!aiGenPrompt.trim()) {
      handleError('Please enter a case description');
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateRealisticCase(aiGenPrompt);
      const caseObj: Case = {
        id: crypto.randomUUID(),
        title: generated.title || 'Untitled Case',
        client: generated.client || 'Unknown Client',
        opposingCounsel: generated.opposingCounsel || '',
        judge: generated.judge || '',
        summary: generated.summary || '',
        status: CaseStatus.PRE_TRIAL,
        winProbability: 50,
        nextCourtDate: 'TBD',
        evidence: [],
        tasks: [],
        ...generated,
      };
      addCase(caseObj);
      setAiGenPrompt('');
      setShowAiGenModal(false);
      handleSuccess('Case generated from AI');
    } catch (error) {
      handleError('Failed to generate case');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteCase = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this case?')) return;
    deleteCase(id);
    handleSuccess('Case deleted');
  };

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar: Case List */}
      <div className="w-64 border-r border-slate-700 pr-4 overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 py-4 mb-4 flex gap-2">
          <button
            onClick={() => setShowNewCaseModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-2 rounded-lg text-sm"
          >
            <Plus size={16} /> New
          </button>
          <button
            onClick={() => setShowAiGenModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg text-sm"
          >
            AI
          </button>
        </div>

        <div className="space-y-2">
          {cases.map(c => (
            <div
              key={c.id}
              onClick={() => setActiveCase(c)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                activeCase?.id === c.id
                  ? 'bg-gold-500/20 border-gold-500/50 border'
                  : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
              }`}
            >
              <h4 className="font-semibold text-white text-sm truncate">{c.title}</h4>
              <p className="text-slate-400 text-xs mt-1">{c.client}</p>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  c.status === 'Pre-Trial' ? 'bg-blue-600' :
                  c.status === 'Discovery' ? 'bg-yellow-600' :
                  c.status === 'Trial' ? 'bg-orange-600' :
                  c.status === 'Appeal' ? 'bg-purple-600' :
                  'bg-green-600'
                } text-white`}>
                  {c.status}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setShareCaseId(c.id);
                    }}
                    className="text-slate-400 hover:text-blue-400 text-xs"
                    title="Share case"
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteCase(c.id);
                    }}
                    className="text-slate-400 hover:text-red-500 text-xs"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {cases.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">No cases yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {!activeCase ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Select a case or create a new one</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-white">{activeCase.title}</h1>
              <p className="text-slate-400">{activeCase.client} vs {activeCase.opposingParty || 'Unknown'}</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-slate-700 pb-0 overflow-x-auto scrollbar-none">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gold-500 text-slate-900'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="pb-6">
              {activeTab === 'overview' && <OverviewTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'documents' && <DocumentsTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'discovery' && <DiscoveryTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'witnesses' && <WitnessesTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'tasks' && <TasksTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'budget' && <BudgetTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'motions' && <MotionsTab activeCase={activeCase} updateCase={updateCase} />}
              {activeTab === 'timeline' && <CaseTimeline activeCase={activeCase} updateCase={updateCase} />}
            </div>
          </div>
        )}
      </div>

      {/* New Case Modal */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Create New Case</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Case Title"
                value={newCaseData.title || ''}
                onChange={e => setNewCaseData({ ...newCaseData, title: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />
              <input
                type="text"
                placeholder="Client"
                value={newCaseData.client || ''}
                onChange={e => setNewCaseData({ ...newCaseData, client: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />
              <input
                type="text"
                placeholder="Opposing Counsel"
                value={newCaseData.opposingCounsel || ''}
                onChange={e => setNewCaseData({ ...newCaseData, opposingCounsel: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />
              <input
                type="text"
                placeholder="Judge"
                value={newCaseData.judge || ''}
                onChange={e => setNewCaseData({ ...newCaseData, judge: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />
              <textarea
                placeholder="Summary"
                value={newCaseData.summary || ''}
                onChange={e => setNewCaseData({ ...newCaseData, summary: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg resize-none h-20"
              />
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateCase}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAiGenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Generate Case with AI</h3>
            <textarea
              placeholder="Describe the case in detail (e.g., 'Contract dispute between tech startup and vendor over software license terms')"
              value={aiGenPrompt}
              onChange={e => setAiGenPrompt(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg resize-none h-24 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAiGenerate}
                disabled={generating || !aiGenPrompt.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={() => setShowAiGenModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Share Dialog */}
      {shareCaseId && (
        <CaseShareDialog
          caseId={shareCaseId}
          caseTitle={cases.find(c => c.id === shareCaseId)?.title || 'Untitled'}
          isOpen={!!shareCaseId}
          onClose={() => setShareCaseId(null)}
        />
      )}
    </div>
  );
};

export default CaseManager;
