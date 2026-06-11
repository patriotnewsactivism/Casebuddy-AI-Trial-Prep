import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ChevronDown, CheckCircle2, X } from 'lucide-react';
import { useCases, useActiveCase, setActiveCaseId, setTaskStatus, CASE_STAGES } from '../lib/caseStore';
import { AGENTS } from '../agents/personas';

// Shown at the top of every module. Displays the active case the whole firm
// is working, lets the user switch cases, and surfaces this department's
// handoff briefing from Maya so the agent knows exactly what to do.
export default function ActiveCaseBar({ agentId }: { agentId?: string }) {
  const cases = useCases();
  const active = useActiveCase();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (cases.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 border-dashed rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <Briefcase size={14} />
          No case file open — work here won't be saved to a case.
        </div>
        <Link to="/intake" className="text-violet-400 hover:text-violet-300 text-xs font-semibold shrink-0">
          Start intake with Maya →
        </Link>
      </div>
    );
  }

  const task = active && agentId
    ? active.tasks.find(t => t.agentId === agentId && t.status !== 'done')
    : null;
  const agent = agentId ? AGENTS[agentId] : null;
  const stageLabel = active ? CASE_STAGES.find(s => s.id === active.stage)?.label : '';

  return (
    <div className="mb-5 space-y-2">
      <div className="bg-slate-800 border border-violet-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <Briefcase size={16} className="text-violet-400 shrink-0" />
        {active ? (
          <Link to={`/cases/${active.id}`} className="min-w-0 group">
            <span className="text-white text-sm font-semibold group-hover:text-violet-300 transition-colors">{active.clientName}</span>
            <span className="text-slate-400 text-xs ml-2">{active.caseType}{stageLabel ? ` · ${stageLabel}` : ''}</span>
          </Link>
        ) : (
          <span className="text-slate-400 text-sm">No active case selected</span>
        )}
        <div className="ml-auto flex items-center gap-2 relative">
          <button onClick={() => setPickerOpen(o => !o)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            Switch case <ChevronDown size={12} />
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-40 py-1 max-h-72 overflow-y-auto">
              {cases.map(c => (
                <button key={c.id}
                  onClick={() => { setActiveCaseId(c.id); setPickerOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors ${active?.id === c.id ? 'bg-violet-600/20' : ''}`}>
                  <div className="text-white text-xs font-semibold">{c.clientName}</div>
                  <div className="text-slate-500 text-xs">{c.caseType}</div>
                </button>
              ))}
              {active && (
                <button onClick={() => { setActiveCaseId(null); setPickerOpen(false); }}
                  className="w-full text-left px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5">
                  <X size={11} /> Work without a case
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Department briefing handed off from intake */}
      {task && agent && active && (
        <div className={`bg-slate-800/70 border ${agent.borderColor}/40 rounded-xl px-4 py-3 flex items-start gap-3`}>
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5`}>
            {agent.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-bold ${agent.textColor} uppercase tracking-wider mb-0.5`}>
              {agent.name}'s assignment from intake
            </div>
            <div className="text-white text-sm font-medium">{task.title}</div>
            <div className="text-slate-400 text-xs mt-0.5">{task.detail}</div>
          </div>
          <button
            onClick={() => setTaskStatus(active.id, task.id, 'done')}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-green-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0"
            title="Mark this assignment complete">
            <CheckCircle2 size={13} /> Done
          </button>
        </div>
      )}
    </div>
  );
}
