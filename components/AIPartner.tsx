import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import {
  Brain, Shield, Target, Scale, AlertTriangle, CheckCircle,
  Loader2, ChevronRight, ChevronDown, Swords, Eye,
  FileText, Users, Briefcase, BarChart2, Zap, XCircle,
  Clock, Sparkles
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  assessCaseHealth,
  predictOpposingCounsel,
  generatePreTrialChecklist,
  assessSettlement,
  runDevilsAdvocate,
  CaseHealthReport,
  OpposingCounselBrief,
  PreTrialChecklist,
  SettlementAssessment,
  DevilsAdvocateBrief,
} from '../services/partnerService';

type AnalysisTab = 'health' | 'opposing' | 'checklist' | 'settlement' | 'devil';

const TABS: { id: AnalysisTab; label: string; icon: React.ElementType; color: string; description: string }[] = [
  { id: 'health', label: 'Case Health', icon: BarChart2, color: 'text-blue-400', description: 'Strengths, weaknesses, win probability' },
  { id: 'opposing', label: 'Opposing Counsel', icon: Swords, color: 'text-red-400', description: 'Predict their arguments & strategy' },
  { id: 'checklist', label: 'Pre-Trial Checklist', icon: CheckCircle, color: 'text-green-400', description: 'Everything needed before trial' },
  { id: 'settlement', label: 'Settlement vs Trial', icon: Scale, color: 'text-purple-400', description: 'Settle or fight? With ranges' },
  { id: 'devil', label: "Devil's Advocate", icon: AlertTriangle, color: 'text-orange-400', description: 'Ruthless case destruction' },
];

const AIPartner = () => {
  const { activeCase } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<AnalysisTab | null>(null);
  const [loading, setLoading] = useState<AnalysisTab | null>(null);

  // Results
  const [healthReport, setHealthReport] = useState<CaseHealthReport | null>(null);
  const [opposingBrief, setOpposingBrief] = useState<OpposingCounselBrief | null>(null);
  const [checklist, setChecklist] = useState<PreTrialChecklist | null>(null);
  const [settlement, setSettlement] = useState<SettlementAssessment | null>(null);
  const [devilBrief, setDevilBrief] = useState<DevilsAdvocateBrief | null>(null);

  const runAnalysis = async (tab: AnalysisTab) => {
    if (!activeCase) { toast.error('Select a case first'); return; }
    setActiveTab(tab);
    setLoading(tab);

    try {
      switch (tab) {
        case 'health': setHealthReport(await assessCaseHealth(activeCase)); break;
        case 'opposing': setOpposingBrief(await predictOpposingCounsel(activeCase)); break;
        case 'checklist': setChecklist(await generatePreTrialChecklist(activeCase)); break;
        case 'settlement': setSettlement(await assessSettlement(activeCase)); break;
        case 'devil': setDevilBrief(await runDevilsAdvocate(activeCase)); break;
      }
      toast.success(`${TABS.find(t => t.id === tab)?.label} analysis complete`);
    } catch (err) {
      console.error(`Partner analysis failed:`, err);
      toast.error('Analysis failed — check API key');
    } finally {
      setLoading(null);
    }
  };

  // ── Helpers ──

  const severityBadge = (s: string) => {
    const colors: Record<string, string> = {
      critical: 'text-red-400 bg-red-500/10 border-red-500/30',
      high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      low: 'text-slate-400 bg-slate-700/50 border-slate-600',
    };
    return colors[s] || colors.medium;
  };

  const scoreColor = (n: number) => n >= 70 ? 'text-emerald-400' : n >= 50 ? 'text-yellow-400' : 'text-red-400';

  // ── No Case ──

  if (!activeCase) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Brain size={48} className="mx-auto text-slate-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">AI Partner — War Room</h2>
          <p className="text-slate-400">Select a case to begin strategic analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-red-500/20 border border-purple-500/30">
            <Brain size={20} className="text-purple-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">AI Partner — War Room</h1>
            <p className="text-xs text-slate-500">{activeCase.title}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">

        {/* Analysis Selector */}
        {!activeTab && (
          <div className="grid gap-3 max-w-2xl mx-auto">
            <div className="text-center mb-4">
              <h2 className="text-white text-xl font-bold">What do you need, counsel?</h2>
              <p className="text-slate-400 text-sm mt-1">Select an analysis to run on your case.</p>
            </div>

            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => runAnalysis(tab.id)}
                  disabled={!!loading}
                  className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800/70 hover:border-slate-600 transition-all text-left group"
                >
                  <div className={`p-2.5 rounded-xl bg-slate-800 border border-slate-700 group-hover:border-slate-600 transition-colors`}>
                    <Icon size={22} className={tab.color} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold group-hover:text-white">{tab.label}</p>
                    <p className="text-sm text-slate-400">{tab.description}</p>
                  </div>
                  {loading === tab.id ? (
                    <Loader2 size={18} className="text-slate-400 animate-spin" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="text-purple-400 animate-spin mb-4" />
            <p className="text-white font-bold">Analyzing case...</p>
            <p className="text-slate-400 text-sm mt-1">Your AI partner is reviewing everything.</p>
          </div>
        )}

        {/* Results */}
        {!loading && activeTab && (
          <div className="max-w-3xl mx-auto">
            {/* Back button */}
            <button
              onClick={() => setActiveTab(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
            >
              ← Back to analyses
            </button>

            {/* ── Case Health Report ──────────────────── */}
            {activeTab === 'health' && healthReport && (
              <div className="space-y-6">
                {/* Score Card */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <span className={`text-6xl font-black ${scoreColor(healthReport.overallScore)}`}>
                      {healthReport.overallScore}
                    </span>
                    <span className="text-2xl text-slate-600">/100</span>
                  </div>
                  <p className="text-white font-bold text-lg">{healthReport.verdict}</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-sm text-slate-400">Win Probability:</span>
                    <span className={`text-lg font-bold ${scoreColor(healthReport.winProbability)}`}>
                      {healthReport.winProbability}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">{healthReport.winExplanation}</p>
                </div>

                {/* Critical Issues */}
                {healthReport.criticalIssues?.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                    <h3 className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} /> Critical Issues
                    </h3>
                    <ul className="space-y-1.5">
                      {healthReport.criticalIssues.map((issue, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2">
                          <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strengths */}
                <div>
                  <h3 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-2">
                    <Shield size={16} /> Strengths
                  </h3>
                  <div className="space-y-2">
                    {healthReport.strengths?.map((s, i) => (
                      <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-white font-medium text-sm">{s.title}</p>
                        <p className="text-slate-400 text-xs mt-1">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weaknesses */}
                <div>
                  <h3 className="text-orange-400 font-bold text-sm mb-3 flex items-center gap-2">
                    <Target size={16} /> Weaknesses
                  </h3>
                  <div className="space-y-2">
                    {healthReport.weaknesses?.map((w, i) => (
                      <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityBadge(w.severity)}`}>
                            {w.severity}
                          </span>
                          <p className="text-white font-medium text-sm">{w.title}</p>
                        </div>
                        <p className="text-slate-400 text-xs">{w.detail}</p>
                        {w.mitigation && (
                          <p className="text-emerald-400 text-xs mt-1.5">
                            💡 Mitigation: {w.mitigation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Re-run button */}
                <button
                  onClick={() => runAnalysis('health')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Zap size={14} /> Re-analyze
                </button>
              </div>
            )}

            {/* ── Opposing Counsel Brief ──────────────── */}
            {activeTab === 'opposing' && opposingBrief && (
              <div className="space-y-6">
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                  <h3 className="text-red-400 font-bold text-sm mb-2">Their Theory of the Case</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{opposingBrief.theirTheory}</p>
                </div>

                <div>
                  <h3 className="text-white font-bold text-sm mb-3">Key Arguments They'll Make</h3>
                  <div className="space-y-3">
                    {opposingBrief.keyArguments?.map((arg, i) => (
                      <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                            arg.strength === 'strong' ? 'text-red-400 bg-red-500/10 border-red-500/30'
                            : arg.strength === 'moderate' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                            : 'text-slate-400 bg-slate-700/50 border-slate-600'
                          }`}>{arg.strength}</span>
                        </div>
                        <p className="text-white text-sm mb-2">{arg.argument}</p>
                        <p className="text-emerald-400 text-xs">↩️ Your counter: {arg.yourCounter}</p>
                        {arg.caseLaw && <p className="text-slate-500 text-[10px] mt-1 italic">📜 {arg.caseLaw}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {opposingBrief.likelyMotions?.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold text-sm mb-2">Likely Motions</h3>
                    <ul className="space-y-1">
                      {opposingBrief.likelyMotions.map((m, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2"><FileText size={12} className="text-slate-500 mt-1 flex-shrink-0" />{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {opposingBrief.surpriseMoves?.length > 0 && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                    <h3 className="text-orange-400 font-bold text-sm mb-2 flex items-center gap-2">
                      <AlertTriangle size={14} /> Potential Surprise Moves
                    </h3>
                    <ul className="space-y-1.5">
                      {opposingBrief.surpriseMoves.map((s, i) => (
                        <li key={i} className="text-sm text-slate-300">⚡ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Pre-Trial Checklist ─────────────────── */}
            {activeTab === 'checklist' && checklist && (
              <div className="space-y-6">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="#1e293b" strokeWidth="4" fill="none" />
                      <circle cx="32" cy="32" r="28" stroke="#22c55e" strokeWidth="4" fill="none"
                        strokeDasharray={`${(checklist.completionPercentage / 100) * 176} 176`}
                        strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                      {checklist.completionPercentage}%
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-bold">Trial Readiness</p>
                    <p className="text-slate-400 text-sm">{checklist.items?.length || 0} items · {checklist.nextDeadline ? `Next deadline: ${checklist.nextDeadline}` : 'No immediate deadlines'}</p>
                  </div>
                </div>

                {['discovery', 'motions', 'witnesses', 'evidence', 'strategy', 'logistics'].map(cat => {
                  const catItems = checklist.items?.filter(i => i.category === cat) || [];
                  if (catItems.length === 0) return null;

                  return (
                    <div key={cat}>
                      <h3 className="text-white font-bold text-sm mb-2 capitalize flex items-center gap-2">
                        {cat === 'discovery' ? <FileText size={14} /> : cat === 'witnesses' ? <Users size={14} /> : <Briefcase size={14} />}
                        {cat}
                      </h3>
                      <div className="space-y-1.5">
                        {catItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-2.5 bg-slate-800/30 rounded-lg">
                            <div className={`mt-0.5 ${
                              item.status === 'done' ? 'text-green-400' :
                              item.status === 'overdue' ? 'text-red-400' :
                              item.status === 'in_progress' ? 'text-yellow-400' :
                              'text-slate-600'
                            }`}>
                              {item.status === 'done' ? <CheckCircle size={14} /> :
                               item.status === 'overdue' ? <AlertTriangle size={14} /> :
                               item.status === 'in_progress' ? <Clock size={14} /> :
                               <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm ${item.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{item.task}</p>
                                <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${severityBadge(item.priority)}`}>{item.priority}</span>
                              </div>
                              {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                              {item.deadline && <p className="text-xs text-slate-500 mt-0.5">📅 {item.deadline}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Settlement vs Trial ─────────────────── */}
            {activeTab === 'settlement' && settlement && (
              <div className="space-y-6">
                <div className={`rounded-xl p-6 text-center border ${
                  settlement.recommendation === 'settle' ? 'bg-purple-500/10 border-purple-500/30' :
                  settlement.recommendation === 'trial' ? 'bg-red-500/10 border-red-500/30' :
                  'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Recommendation</p>
                  <p className="text-3xl font-black text-white uppercase">{settlement.recommendation}</p>
                  <p className="text-sm text-slate-400 mt-1">Confidence: {settlement.confidence}%</p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{settlement.reasoning}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-xs text-purple-400 font-bold uppercase mb-2">Settlement Range</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Low</span><span className="text-white font-mono">${settlement.settlementRange?.low?.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Mid</span><span className="text-purple-400 font-bold font-mono">${settlement.settlementRange?.mid?.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">High</span><span className="text-white font-mono">${settlement.settlementRange?.high?.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-xs text-red-400 font-bold uppercase mb-2">Trial Verdict Range</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Low</span><span className="text-white font-mono">${settlement.trialRange?.low?.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Mid</span><span className="text-red-400 font-bold font-mono">${settlement.trialRange?.mid?.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">High</span><span className="text-white font-mono">${settlement.trialRange?.high?.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>

                {settlement.riskFactors?.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold text-sm mb-2">Risk Factors</h3>
                    <ul className="space-y-1.5">
                      {settlement.riskFactors.map((r, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2"><AlertTriangle size={12} className="text-orange-400 mt-1 flex-shrink-0" />{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Devil's Advocate ────────────────────── */}
            {activeTab === 'devil' && devilBrief && (
              <div className="space-y-6">
                <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-5">
                  <h3 className="text-red-400 font-bold text-sm mb-2">⚠️ Worst Case Scenario</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{devilBrief.worstCaseScenario}</p>
                </div>

                <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                  <h3 className="text-orange-400 font-bold text-sm mb-2 flex items-center gap-2">
                    <Eye size={14} /> Blind Spots
                  </h3>
                  <ul className="space-y-1.5">
                    {devilBrief.blindSpots?.map((b, i) => (
                      <li key={i} className="text-sm text-slate-300">🔍 {b}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-white font-bold text-sm mb-2">Questions You Can't Answer Well</h3>
                  <div className="space-y-2">
                    {devilBrief.uncomfortableQuestions?.map((q, i) => (
                      <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                        <p className="text-sm text-red-300 italic">"{q}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {devilBrief.evidenceProblems?.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold text-sm mb-2">Evidence Problems</h3>
                    <ul className="space-y-1.5">
                      {devilBrief.evidenceProblems.map((e, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2"><XCircle size={12} className="text-red-400 mt-1 flex-shrink-0" />{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {devilBrief.witnessVulnerabilities?.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold text-sm mb-2">Witness Vulnerabilities</h3>
                    <ul className="space-y-1.5">
                      {devilBrief.witnessVulnerabilities.map((w, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2"><Users size={12} className="text-yellow-400 mt-1 flex-shrink-0" />{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                  <h3 className="text-blue-400 font-bold text-sm mb-2">👥 How a Jury Sees This</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{devilBrief.juryPerception}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPartner;
