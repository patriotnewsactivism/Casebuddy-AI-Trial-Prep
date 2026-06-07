import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import { useKnowledge } from '../contexts/KnowledgeContext';
import { MOCK_OPPONENT } from '../constants';
import { predictStrategy } from '../services/geminiService';
import { trackAICompletion } from '../services/roiIntegration';
import { callGeminiProxy } from '../services/apiProxy';
import { StrategyInsight } from '../types';
import { BrainCircuit, Target, Shield, AlertOctagon, Lightbulb, RefreshCw, Loader2, Save, CheckCircle, Scale, FileText, TrendingUp, Crosshair } from 'lucide-react';
import { toast } from 'react-toastify';

interface CaseTheory {
  theory: string;
  strengths: string[];
  weaknesses: string[];
  keyEvidence: string[];
  winProbability: number;
}

interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface StrategyData {
  insights: StrategyInsight[];
  caseTheories: CaseTheory[];
  swot: SWOTAnalysis | null;
  notes: string;
  lastUpdated: string;
}

const StrategyRoom = () => {
  const { activeCase, updateCase } = useContext(AppContext);
  const { getKnowledgeContext } = useKnowledge();
  const [insights, setInsights] = useState<StrategyInsight[]>([]);
  const [caseTheories, setCaseTheories] = useState<CaseTheory[]>([]);
  const [swot, setSwot] = useState<SWOTAnalysis | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSwot, setLoadingSwot] = useState(false);
  const [loadingTheories, setLoadingTheories] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'theories' | 'swot' | 'notes'>('insights');
  const [saved, setSaved] = useState(false);

  const opponent = activeCase?.opposingProfile || MOCK_OPPONENT;

  // Load saved strategy data from case
  useEffect(() => {
    if (activeCase) {
      const stratData = activeCase.strategyInsights as any;
      if (stratData && typeof stratData === 'object' && !Array.isArray(stratData)) {
        // It's a StrategyData object
        setInsights(stratData.insights || []);
        setCaseTheories(stratData.caseTheories || []);
        setSwot(stratData.swot || null);
        setNotes(stratData.notes || '');
      } else if (Array.isArray(stratData)) {
        // Legacy: just an array of insights
        setInsights(stratData);
      }
    }
  }, [activeCase?.id]);

  // Save all strategy data to case (cloud-synced)
  const saveStrategy = async () => {
    if (!activeCase) return;
    const data: StrategyData = {
      insights,
      caseTheories,
      swot,
      notes,
      lastUpdated: new Date().toISOString()
    };
    await updateCase(activeCase.id, { strategyInsights: data as any });
    setSaved(true);
    toast.success('Strategy saved to cloud');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGenerateStrategy = async () => {
    if (!activeCase) return;
    setLoading(true);
    try {
      const knowledgeContext = getKnowledgeContext(activeCase.id);
      const result = await predictStrategy(
        activeCase.summary,
        JSON.stringify(opponent),
        knowledgeContext
      );
      setInsights(result);
      toast.success('Strategy insights generated');
      trackAICompletion('Strategy Room', 'Generated strategy insights', { caseId: activeCase?.id, caseName: activeCase?.title });
    } catch (err) {
      toast.error('Failed to generate strategy');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSWOT = async () => {
    if (!activeCase) return;
    setLoadingSwot(true);
    try {
      const prompt = `Perform a comprehensive SWOT analysis for this legal case.

Case: ${activeCase.title}
Summary: ${activeCase.summary}
${activeCase.keyIssues?.length ? `Key Issues: ${activeCase.keyIssues.join(', ')}` : ''}
${activeCase.legalTheory ? `Legal Theory: ${activeCase.legalTheory}` : ''}
Client Type: ${activeCase.clientType || 'unknown'}
Win Probability: ${activeCase.winProbability}%

Return JSON with: strengths (array of 4-6 strings), weaknesses (array of 4-6 strings), opportunities (array of 3-5 strings), threats (array of 3-5 strings). Be specific to THIS case.`;

      const response = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              strengths: { type: 'ARRAY', items: { type: 'STRING' } },
              weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
              opportunities: { type: 'ARRAY', items: { type: 'STRING' } },
              threats: { type: 'ARRAY', items: { type: 'STRING' } }
            }
          }
        }
      });

      if (!response.success) throw new Error(response.error?.message || 'SWOT generation failed');
      setSwot(JSON.parse(response.text || '{}'));
      toast.success('SWOT analysis complete');
      trackAICompletion('Strategy Room', 'Generated SWOT analysis', { caseId: activeCase?.id, caseName: activeCase?.title });
    } catch (err) {
      toast.error('SWOT analysis failed');
    } finally {
      setLoadingSwot(false);
    }
  };

  const handleGenerateTheories = async () => {
    if (!activeCase) return;
    setLoadingTheories(true);
    try {
      const prompt = `You are a senior litigation strategist. Develop 3 distinct case theories for this case.

Case: ${activeCase.title}
Summary: ${activeCase.summary}
${activeCase.keyIssues?.length ? `Key Issues: ${activeCase.keyIssues.join(', ')}` : ''}
${activeCase.legalTheory ? `Current Legal Theory: ${activeCase.legalTheory}` : ''}
Client Type: ${activeCase.clientType || 'unknown'}
${(activeCase.evidence || []).length > 0 ? `Available Evidence: ${activeCase.evidence!.map(e => e.title).join(', ')}` : ''}

For each theory, provide: theory (one-line name), strengths (array), weaknesses (array), keyEvidence (array of evidence needed), winProbability (0-100).`;

      const response = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                theory: { type: 'STRING' },
                strengths: { type: 'ARRAY', items: { type: 'STRING' } },
                weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
                keyEvidence: { type: 'ARRAY', items: { type: 'STRING' } },
                winProbability: { type: 'NUMBER' }
              }
            }
          }
        }
      });

      if (!response.success) throw new Error(response.error?.message || 'Theory generation failed');
      setCaseTheories(JSON.parse(response.text || '[]'));
      toast.success('Case theories generated');
      trackAICompletion('Strategy Room', 'Generated case theories with win probabilities', { caseId: activeCase?.id, caseName: activeCase?.title });
    } catch (err) {
      toast.error('Case theory generation failed');
    } finally {
      setLoadingTheories(false);
    }
  };

  // Auto-generate on first load if empty
  useEffect(() => {
    if (activeCase && insights.length === 0 && !loading) {
      handleGenerateStrategy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id]);

  const tabs = [
    { id: 'insights' as const, label: 'Strategy Insights', icon: BrainCircuit },
    { id: 'theories' as const, label: 'Case Theories', icon: Scale },
    { id: 'swot' as const, label: 'SWOT Analysis', icon: Target },
    { id: 'notes' as const, label: 'Strategy Notes', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-white flex items-center gap-3">
            <Crosshair className="text-gold-500" size={32} />
            War Room Strategy
          </h1>
          <p className="text-slate-400 mt-1">Deep-thought analysis against {opponent.name}</p>
        </div>
        <button
          onClick={saveStrategy}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all"
        >
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save Strategy'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-gold-500 text-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <tab.icon size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Opponent Profile Sidebar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 h-fit">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="text-red-500" size={20} />
            Opponent Profile
          </h3>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center text-xl font-bold text-slate-400">
              {opponent.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-white">{opponent.name}</div>
              <div className="text-sm text-slate-400">{opponent.firm}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Aggressiveness</span>
                <span className="text-white">{opponent.aggressiveness}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${opponent.aggressiveness}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Settlement Tendency</span>
                <span className="text-white">{opponent.settlementTendency}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${opponent.settlementTendency}%` }}></div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">Known Tactics</h4>
            <ul className="space-y-1.5">
              {opponent.commonTactics.map((t: string, i: number) => (
                <li key={i} className="text-xs bg-slate-900/50 px-2.5 py-1.5 rounded border border-slate-700 text-slate-400">
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Quick stats */}
          <div className="mt-6 pt-4 border-t border-slate-700 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Win Probability</span>
              <span className="text-gold-500 font-bold">{activeCase?.winProbability || 50}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Insights Generated</span>
              <span className="text-white">{insights.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Case Theories</span>
              <span className="text-white">{caseTheories.length}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* ── Insights Tab ── */}
          {activeTab === 'insights' && (
            <>
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateStrategy}
                  disabled={loading}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-gold-500 border border-gold-500/30 px-4 py-2 rounded-lg transition-all"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  {loading ? 'Analyzing...' : 'Regenerate'}
                </button>
              </div>

              {loading ? (
                <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col items-center justify-center animate-pulse">
                  <BrainCircuit size={48} className="text-gold-500 mb-4" />
                  <p className="text-slate-300 font-medium">Analyzing case precedents and opponent psychology...</p>
                </div>
              ) : insights.length > 0 ? (
                insights.map((insight, idx) => (
                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-500 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg shrink-0 ${
                        insight.type === 'risk' ? 'bg-red-500/20 text-red-400' :
                        insight.type === 'opportunity' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {insight.type === 'risk' && <AlertOctagon size={24} />}
                        {insight.type === 'opportunity' && <Lightbulb size={24} />}
                        {insight.type === 'prediction' && <Shield size={24} />}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">{insight.title}</h3>
                        <p className="text-slate-300 leading-relaxed mb-4">{insight.description}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Confidence:</span>
                          <div className="flex-1 bg-slate-900 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-1000 ${
                                insight.confidence >= 80 ? 'bg-green-500' :
                                insight.confidence >= 50 ? 'bg-gold-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${insight.confidence}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-bold ${
                            insight.confidence >= 80 ? 'text-green-400' :
                            insight.confidence >= 50 ? 'text-gold-500' :
                            'text-red-400'
                          }`}>{insight.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700 flex items-center justify-center text-slate-500">
                  No insights generated yet. Click "Regenerate" to start.
                </div>
              )}
            </>
          )}

          {/* ── Case Theories Tab ── */}
          {activeTab === 'theories' && (
            <>
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateTheories}
                  disabled={loadingTheories}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-all"
                >
                  {loadingTheories ? <Loader2 size={18} className="animate-spin" /> : <Scale size={18} />}
                  {loadingTheories ? 'Developing theories...' : 'Generate Case Theories'}
                </button>
              </div>

              {loadingTheories ? (
                <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col items-center justify-center animate-pulse">
                  <Scale size={48} className="text-purple-500 mb-4" />
                  <p className="text-slate-300 font-medium">Developing case theories and analyzing win probability...</p>
                </div>
              ) : caseTheories.length > 0 ? (
                caseTheories.map((theory, idx) => (
                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">Theory {idx + 1}: {theory.theory}</h3>
                      <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                        theory.winProbability >= 70 ? 'bg-green-500/20 text-green-400' :
                        theory.winProbability >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {theory.winProbability}% Win
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-green-400 mb-2">✅ Strengths</h4>
                        <ul className="space-y-1">
                          {theory.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-slate-300 bg-green-500/5 border border-green-500/20 rounded px-2 py-1">{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-red-400 mb-2">⚠️ Weaknesses</h4>
                        <ul className="space-y-1">
                          {theory.weaknesses.map((w, i) => (
                            <li key={i} className="text-xs text-slate-300 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">📋 Key Evidence Needed</h4>
                      <div className="flex flex-wrap gap-2">
                        {theory.keyEvidence.map((e, i) => (
                          <span key={i} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded px-2 py-1">{e}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700 flex items-center justify-center text-slate-500">
                  No case theories yet. Click "Generate Case Theories" to develop strategic approaches.
                </div>
              )}
            </>
          )}

          {/* ── SWOT Tab ── */}
          {activeTab === 'swot' && (
            <>
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateSWOT}
                  disabled={loadingSwot}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-all"
                >
                  {loadingSwot ? <Loader2 size={18} className="animate-spin" /> : <Target size={18} />}
                  {loadingSwot ? 'Analyzing...' : 'Generate SWOT Analysis'}
                </button>
              </div>

              {loadingSwot ? (
                <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col items-center justify-center animate-pulse">
                  <Target size={48} className="text-blue-500 mb-4" />
                  <p className="text-slate-300 font-medium">Performing SWOT analysis...</p>
                </div>
              ) : swot ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'strengths', label: 'Strengths', color: 'green', icon: '💪' },
                    { key: 'weaknesses', label: 'Weaknesses', color: 'red', icon: '⚠️' },
                    { key: 'opportunities', label: 'Opportunities', color: 'blue', icon: '🎯' },
                    { key: 'threats', label: 'Threats', color: 'orange', icon: '🔥' },
                  ].map(({ key, label, color, icon }) => (
                    <div key={key} className={`bg-slate-800 border border-${color}-500/30 rounded-xl p-5`}>
                      <h3 className={`text-lg font-bold text-${color}-400 mb-3 flex items-center gap-2`}>
                        <span>{icon}</span> {label}
                      </h3>
                      <ul className="space-y-2">
                        {(swot[key as keyof SWOTAnalysis] || []).map((item: string, i: number) => (
                          <li key={i} className={`text-sm text-slate-300 bg-${color}-500/5 border border-${color}-500/20 rounded-lg px-3 py-2`}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700 flex items-center justify-center text-slate-500">
                  No SWOT analysis yet. Click "Generate SWOT Analysis" to identify strategic factors.
                </div>
              )}
            </>
          )}

          {/* ── Notes Tab ── */}
          {activeTab === 'notes' && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-gold-500" />
                Strategy Notes
              </h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add your strategy notes here... Document key decisions, reasoning, and important observations about the case."
                className="w-full h-64 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 placeholder-slate-500 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 resize-y"
              />
              <p className="text-xs text-slate-500 mt-2">Notes are saved when you click "Save Strategy"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyRoom;
