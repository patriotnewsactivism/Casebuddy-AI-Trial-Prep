import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, FileText, Users, BookOpen, ArrowRight, Trash2 } from 'lucide-react';
import {
  useCases, useActiveCase, setActiveCaseId, setCaseStage, setTaskStatus,
  deleteCase, CASE_STAGES, CaseStage, caseMinutesSaved, formatHoursSaved,
} from '../lib/caseStore';
import { AGENTS } from '../agents/personas';

const urgencyColor: Record<string, string> = {
  low: 'text-green-400', medium: 'text-yellow-400',
  high: 'text-orange-400', critical: 'text-red-400',
};

// The case war room — one screen showing how the client is flowing through
// every department of the firm: handoffs, deadlines, documents, witnesses,
// research, and the full activity trail.
export default function CaseDetail() {
  const { id } = useParams();
  const cases = useCases();
  const active = useActiveCase();
  const navigate = useNavigate();
  const c = cases.find(x => x.id === id);

  if (!c) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <div className="text-slate-400 mb-4">Case not found.</div>
        <Link to="/cases" className="text-violet-400 hover:text-violet-300 text-sm font-semibold">← Back to Case Manager</Link>
      </div>
    );
  }

  const doneTasks = c.tasks.filter(t => t.status === 'done').length;
  const progress = c.tasks.length ? Math.round((doneTasks / c.tasks.length) * 100) : 0;

  const workOn = (route: string) => {
    setActiveCaseId(c.id);
    navigate(route);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/cases" className="text-slate-400 hover:text-white mt-1"><ArrowLeft size={20} /></Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{c.clientName}</h1>
              {c.urgency && <span className={`text-sm font-semibold capitalize ${urgencyColor[c.urgency] || 'text-slate-400'}`}>● {c.urgency}</span>}
              {c.source === 'client-link' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 font-semibold">Client intake link</span>
              )}
              {caseMinutesSaved(c) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 border border-green-500/40 text-green-300 font-semibold">
                  {formatHoursSaved(caseMinutesSaved(c))}h billable saved
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">{c.caseType}{c.jurisdiction ? ` · ${c.jurisdiction}` : ''}{c.incidentDate ? ` · Incident: ${c.incidentDate}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active?.id !== c.id && (
            <button onClick={() => setActiveCaseId(c.id)}
              className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Set as Active Case
            </button>
          )}
          <button
            onClick={() => { if (window.confirm(`Delete the case file for ${c.clientName}? This cannot be undone.`)) { deleteCase(c.id); navigate('/cases'); } }}
            className="text-slate-500 hover:text-red-400 p-2" title="Delete case">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {CASE_STAGES.map((s, i) => {
            const currentIdx = CASE_STAGES.findIndex(x => x.id === c.stage);
            const isPast = i < currentIdx;
            const isCurrent = s.id === c.stage;
            return (
              <React.Fragment key={s.id}>
                {i > 0 && <div className={`h-0.5 flex-1 min-w-3 ${isPast || isCurrent ? 'bg-violet-500' : 'bg-slate-700'}`} />}
                <button onClick={() => setCaseStage(c.id, s.id as CaseStage)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    isCurrent ? 'bg-violet-600 text-white' : isPast ? 'bg-violet-600/20 text-violet-300' : 'bg-slate-700 text-slate-400 hover:text-white'
                  }`}>
                  {s.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: department handoffs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-sm">🏛️ Department Handoffs</h2>
              <div className="flex items-center gap-2">
                <div className="w-28 bg-slate-700 rounded-full h-2">
                  <div className="bg-violet-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-violet-400 text-xs font-bold">{doneTasks}/{c.tasks.length}</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {c.tasks.map(t => {
                const agent = AGENTS[t.agentId];
                if (!agent) return null;
                const done = t.status === 'done';
                return (
                  <div key={t.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${done ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-700/30 border-slate-700'}`}>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-sm shrink-0 ${done ? 'opacity-50' : ''}`}>
                      {agent.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${agent.textColor}`}>{agent.name}</span>
                        <span className={`text-sm font-medium ${done ? 'text-slate-500 line-through' : 'text-white'}`}>{t.title}</span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">{t.detail}</p>
                      {done && t.completedAt && (
                        <p className="text-green-500/70 text-xs mt-1">✓ Completed {new Date(t.completedAt).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!done && (
                        <>
                          <button onClick={() => workOn(t.route)}
                            className={`flex items-center gap-1 bg-gradient-to-r ${agent.color} text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity`}>
                            Work it <ArrowRight size={11} />
                          </button>
                          <button onClick={() => setTaskStatus(c.id, t.id, 'done')}
                            className="text-slate-500 hover:text-green-400 p-1.5" title="Mark done">
                            <CheckCircle2 size={15} />
                          </button>
                        </>
                      )}
                      {done && (
                        <button onClick={() => setTaskStatus(c.id, t.id, 'pending')}
                          className="text-slate-600 hover:text-slate-400 text-xs" title="Reopen">
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deadlines */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-sm flex items-center gap-2"><Clock size={14} className="text-yellow-400" /> Deadlines (Sol)</h2>
              <button onClick={() => workOn('/deadlines')} className="text-yellow-400 hover:text-yellow-300 text-xs font-semibold">Open tracker →</button>
            </div>
            {c.deadlines.length === 0 ? (
              <p className="text-slate-500 text-xs">No deadlines calendared yet. Sol is standing by.</p>
            ) : (
              <div className="space-y-1.5">
                {[...c.deadlines].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(d => {
                  const days = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={d.id} className="flex items-center gap-2 text-xs">
                      {d.isCritical && !d.isCompleted && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                      <span className={d.isCompleted ? 'text-slate-600 line-through' : 'text-slate-300'}>{d.title}</span>
                      <span className={`ml-auto font-bold shrink-0 ${d.isCompleted ? 'text-slate-600' : days < 7 ? 'text-red-400' : days < 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {d.isCompleted ? 'Done' : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Documents & Witnesses & Research */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold text-sm flex items-center gap-2"><FileText size={14} className="text-blue-400" /> Documents (Doc)</h2>
                <button onClick={() => workOn('/documents')} className="text-blue-400 hover:text-blue-300 text-xs font-semibold">Analyze →</button>
              </div>
              {c.documents.length === 0 ? (
                <p className="text-slate-500 text-xs">Nothing analyzed yet.</p>
              ) : c.documents.slice(0, 6).map(d => (
                <div key={d.id} className="text-xs py-1.5 border-b border-slate-700/50 last:border-0">
                  <div className="text-slate-300 font-medium">{d.fileName}</div>
                  <div className="text-slate-500 line-clamp-2">{d.summary}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold text-sm flex items-center gap-2"><Users size={14} className="text-orange-400" /> Witnesses (Rex)</h2>
                <button onClick={() => workOn('/witnesses')} className="text-orange-400 hover:text-orange-300 text-xs font-semibold">Prepare →</button>
              </div>
              {c.witnesses.length === 0 ? (
                <p className="text-slate-500 text-xs">No witnesses prepared yet.</p>
              ) : c.witnesses.map(w => (
                <div key={w.id} className="text-xs py-1.5 border-b border-slate-700/50 last:border-0">
                  <span className="text-slate-300 font-medium">{w.name}</span>
                  <span className="text-slate-500 ml-1.5 capitalize">({w.side})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-sm flex items-center gap-2"><BookOpen size={14} className="text-indigo-400" /> Research (Lex)</h2>
              <button onClick={() => workOn('/research')} className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">Research →</button>
            </div>
            {c.research.length === 0 ? (
              <p className="text-slate-500 text-xs">No research saved yet.</p>
            ) : c.research.slice(0, 5).map(r => (
              <div key={r.id} className="text-xs py-2 border-b border-slate-700/50 last:border-0">
                <div className="text-indigo-300 font-medium">{r.question}</div>
                <div className="text-slate-400 line-clamp-3 mt-0.5">{r.findings}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: case facts + activity feed */}
        <div className="space-y-4">
          <div className="bg-slate-800 border border-violet-500/30 rounded-xl p-5 space-y-3 text-sm">
            <h2 className="text-white font-bold text-sm">📋 Case Facts</h2>
            {c.viabilityScore != null && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Viability</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${c.viabilityScore}%` }} />
                  </div>
                  <span className="text-violet-400 font-bold text-xs">{c.viabilityScore}/100</span>
                </div>
              </div>
            )}
            {c.parties.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Parties</p>
                {c.parties.map((p, i) => <p key={i} className="text-slate-300 text-xs">• {p}</p>)}
              </div>
            )}
            {c.claims.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Claims</p>
                {c.claims.map((cl, i) => <p key={i} className="text-slate-300 text-xs">• {cl}</p>)}
              </div>
            )}
            {c.solConcern && (
              <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={13} className="text-red-400" />
                  <p className="text-red-400 text-xs font-semibold">SOL Warning</p>
                </div>
                <p className="text-slate-300 text-xs">{c.solConcern}</p>
              </div>
            )}
            {c.summary && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Summary</p>
                <p className="text-slate-300 text-xs leading-relaxed">{c.summary}</p>
              </div>
            )}
            {c.nextSteps.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Next Steps</p>
                {c.nextSteps.map((s, i) => (
                  <p key={i} className="text-slate-300 text-xs flex items-start gap-1.5"><span className="text-violet-400 font-bold shrink-0">→</span>{s}</p>
                ))}
              </div>
            )}
          </div>

          {/* Case brain — facts learned across every conversation */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-white font-bold text-sm mb-1">🧠 Case Brain</h2>
            <p className="text-slate-500 text-xs mb-3">Facts the team has learned — from any agent, any conversation, any time.</p>
            {c.factLog.length === 0 ? (
              <p className="text-slate-500 text-xs">Nothing yet. Talk to any agent (or the floating assistant) and new facts land here automatically.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {c.factLog.map(f => {
                  const agent = AGENTS[f.agentId];
                  return (
                    <div key={f.id} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${agent?.color || 'from-slate-600 to-slate-700'} flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5`}>
                        {agent?.avatar || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-300 text-xs leading-relaxed">{f.fact}</p>
                        <p className="text-slate-600 text-[10px]">{new Date(f.at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity trail */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-white font-bold text-sm mb-3">🕐 Firm Activity</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {c.activity.length === 0 && <p className="text-slate-500 text-xs">No activity yet.</p>}
              {c.activity.map(a => {
                const agent = AGENTS[a.agentId];
                return (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${agent?.color || 'from-slate-600 to-slate-700'} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                      {agent?.avatar || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-300 text-xs">
                        <span className={`font-bold ${agent?.textColor || 'text-slate-400'}`}>{agent?.name || 'System'}</span> {a.action}
                      </p>
                      {a.detail && <p className="text-slate-500 text-xs line-clamp-2">{a.detail}</p>}
                      <p className="text-slate-600 text-[10px]">{new Date(a.at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
