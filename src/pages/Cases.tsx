import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCases, useActiveCase, setActiveCaseId, CASE_STAGES } from '../lib/caseStore';
import { AGENTS } from '../agents/personas';

const urgencyColor: Record<string, string> = {
  low: 'text-green-400 bg-green-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

export default function Cases() {
  const cases = useCases();
  const active = useActiveCase();
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">Case Manager</h1>
            <p className="text-slate-400 text-sm">Every case file the firm is working — intake to verdict</p>
          </div>
        </div>
        <Link to="/intake" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Case via Intake
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <FolderOpen className="text-slate-600 mx-auto mb-4" size={48} />
          <div className="text-slate-400 text-lg font-medium">No cases yet</div>
          <div className="text-slate-500 text-sm mt-2 mb-6">
            Start an AI intake — Maya will interview the client, open the case file, and brief every department automatically
          </div>
          <Link to="/intake" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block">
            Start AI Intake
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map(c => {
            const doneTasks = c.tasks.filter(t => t.status === 'done').length;
            const openDeadlines = c.deadlines.filter(d => !d.isCompleted);
            const critical = openDeadlines.filter(d => d.isCritical).length;
            const stage = CASE_STAGES.find(s => s.id === c.stage)?.label || c.stage;
            return (
              <div key={c.id}
                onClick={() => navigate(`/cases/${c.id}`)}
                className={`bg-slate-800 border rounded-xl p-5 cursor-pointer transition-colors hover:border-violet-500/60 ${active?.id === c.id ? 'border-violet-500/50' : 'border-slate-700'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold">{c.clientName}</span>
                      <span className="text-slate-400 text-sm">{c.caseType}</span>
                      {c.urgency && (
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold capitalize ${urgencyColor[c.urgency] || 'text-slate-400 bg-slate-700'}`}>
                          {c.urgency}
                        </span>
                      )}
                      {active?.id === c.id && (
                        <span className="text-xs px-2 py-0.5 rounded font-semibold bg-violet-600/30 text-violet-300">Active</span>
                      )}
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      Stage: {stage} · Opened {new Date(c.createdAt).toLocaleDateString()}
                      {c.solConcern && (
                        <span className="text-red-400 ml-2 inline-flex items-center gap-1">
                          <AlertTriangle size={11} /> SOL concern
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-center">
                      <div className="text-white font-bold">{doneTasks}/{c.tasks.length}</div>
                      <div className="text-slate-500">handoffs</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold ${critical > 0 ? 'text-red-400' : 'text-white'}`}>{openDeadlines.length}</div>
                      <div className="text-slate-500">deadlines</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold">{c.documents.length}</div>
                      <div className="text-slate-500">docs</div>
                    </div>
                    {active?.id !== c.id ? (
                      <button
                        onClick={e => { e.stopPropagation(); setActiveCaseId(c.id); }}
                        className="bg-slate-700 hover:bg-violet-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        Set Active
                      </button>
                    ) : (
                      <CheckCircle2 size={18} className="text-violet-400" />
                    )}
                  </div>
                </div>
                {/* Department progress strip */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {c.tasks.map(t => {
                    const agent = AGENTS[t.agentId];
                    if (!agent) return null;
                    return (
                      <div key={t.id} title={`${agent.name}: ${t.title} (${t.status})`}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${agent.color} ${t.status === 'done' ? '' : 'opacity-30'}`}>
                        {agent.avatar}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
