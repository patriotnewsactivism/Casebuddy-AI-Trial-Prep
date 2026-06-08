import React, { useState, useContext, useCallback } from 'react';
import { AppContext } from '../App';
import { useKnowledge } from '../contexts/KnowledgeContext';
import {
  TrendingUp, BarChart2, Target, AlertTriangle, Sparkles,
  Loader2, RefreshCw, Scale, Users, MapPin, Gavel,
  ChevronRight, FileText, Clock, Award,
} from 'lucide-react';
import { callGeminiProxy } from '../services/apiProxy';
import { toast } from 'react-toastify';
import { trackAICompletion } from '../services/roiIntegration';

/* ─── Types ──────────────────────────────────────────── */

interface PredictionResult {
  overallWinProbability: number;
  confidence: string;
  breakdown: {
    category: string;
    score: number;
    analysis: string;
    icon: string;
  }[];
  riskFactors: {
    factor: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
  }[];
  recommendations: string[];
  comparableCases: {
    name: string;
    outcome: string;
    similarity: number;
  }[];
  timelineEstimate: string;
  settlementRange: {
    low: number;
    mid: number;
    high: number;
  };
}

/* ─── Component ──────────────────────────────────────── */

const PredictiveAnalytics: React.FC = () => {
  const { activeCase } = useContext(AppContext);
  const { getKnowledgeContext } = useKnowledge();

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  const runAnalysis = useCallback(async () => {
    if (!activeCase) {
      toast.error('Please select a case first');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setProgress(0);

    const steps = [
      { pct: 15, label: 'Analyzing case facts and evidence...' },
      { pct: 30, label: 'Evaluating legal theories...' },
      { pct: 45, label: 'Researching judge tendencies...' },
      { pct: 60, label: 'Comparing similar cases...' },
      { pct: 75, label: 'Calculating settlement ranges...' },
      { pct: 90, label: 'Generating risk assessment...' },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].pct);
        setProgressLabel(steps[stepIdx].label);
        stepIdx++;
      }
    }, 2500);

    try {
      const knowledge = getKnowledgeContext(activeCase.id);

      const prompt = `You are a senior litigation analytics expert. Analyze this case and provide a detailed predictive analysis.

CASE: ${activeCase.title}
CLIENT: ${activeCase.client}
TYPE: ${(activeCase as any).caseType || 'Civil Rights'}
SUMMARY: ${activeCase.summary}
JUDGE: ${activeCase.judge || 'Unknown'}
OPPOSING COUNSEL: ${activeCase.opposingCounsel || 'Unknown'}
KEY FACTS: ${(activeCase as any).keyFacts?.join('; ') || 'See summary'}
${knowledge ? `\nCASE KNOWLEDGE:\n${knowledge}` : ''}

Respond in VALID JSON only (no markdown, no code blocks) with this exact structure:
{
  "overallWinProbability": <number 0-100>,
  "confidence": "<low|medium|high>",
  "breakdown": [
    {"category": "Strength of Evidence", "score": <0-100>, "analysis": "<1-2 sentences>", "icon": "📊"},
    {"category": "Legal Theory Viability", "score": <0-100>, "analysis": "<1-2 sentences>", "icon": "⚖️"},
    {"category": "Judge/Jurisdiction Factors", "score": <0-100>, "analysis": "<1-2 sentences>", "icon": "🏛️"},
    {"category": "Opposing Counsel Assessment", "score": <0-100>, "analysis": "<1-2 sentences>", "icon": "👤"},
    {"category": "Procedural Posture", "score": <0-100>, "analysis": "<1-2 sentences>", "icon": "📋"},
    {"category": "Damages/Relief Available", "score": <0-100>, "analysis": "<1-2 sentences>", "icon": "💰"}
  ],
  "riskFactors": [
    {"factor": "<risk description>", "severity": "<high|medium|low>", "mitigation": "<how to address>"}
  ],
  "recommendations": ["<action item 1>", "<action item 2>", "<action item 3>", "<action item 4>", "<action item 5>"],
  "comparableCases": [
    {"name": "<real case name with citation>", "outcome": "<plaintiff won/defendant won/settled>", "similarity": <0-100>}
  ],
  "timelineEstimate": "<estimated timeline to resolution>",
  "settlementRange": {"low": <number>, "mid": <number>, "high": <number>}
}

Include 3-5 risk factors, 5 recommendations, and 3-5 comparable cases. Use REAL case law citations. Be analytical and realistic.`;

      const response = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.4 },
      });

      clearInterval(interval);

      if (!response.success) throw new Error(response.error?.message || 'Analysis failed');

      let text = response.text || '';
      // Strip any markdown code fence
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      const parsed: PredictionResult = JSON.parse(text);
      setResult(parsed);
      setProgress(100);
      setProgressLabel('Complete!');

      trackAICompletion('Predictive Analytics', 'Case outcome prediction', {
        caseId: activeCase.id,
        caseName: activeCase.title,
        taskType: 'legal_research',
      });

      toast.success('Predictive analysis complete');
    } catch (err: any) {
      clearInterval(interval);
      console.error('[PredictiveAnalytics]', err);
      toast.error('Analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeCase, getKnowledgeContext]);

  const probColor = (pct: number) =>
    pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';

  const probBg = (pct: number) =>
    pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const severityColor = (s: string) =>
    s === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    s === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
    'bg-blue-500/20 text-blue-400 border-blue-500/30';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">
            Predictive Analytics
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            AI-powered win probability, risk assessment, and settlement projections
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={isAnalyzing || !activeCase}
          className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 hover:bg-gold-600 disabled:bg-slate-700 rounded-lg text-sm text-slate-900 disabled:text-slate-500 font-semibold transition-colors"
        >
          {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isAnalyzing ? 'Analyzing...' : result ? 'Re-Analyze' : 'Run Analysis'}
        </button>
      </div>

      {/* No Case Warning */}
      {!activeCase && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-400" />
          <p className="text-sm text-amber-300">Select a case from the sidebar to run predictive analytics.</p>
        </div>
      )}

      {/* Loading */}
      {isAnalyzing && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="animate-spin text-gold-500" size={24} />
              <div>
                <p className="text-white font-semibold">Analyzing {activeCase?.title}...</p>
                <p className="text-sm text-slate-400">{progressLabel}</p>
              </div>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-500 to-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <>
          {/* Win Probability Hero */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Circular gauge */}
              <div className="relative w-40 h-40">
                <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#334155" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke={result.overallWinProbability >= 70 ? '#10b981' : result.overallWinProbability >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${result.overallWinProbability * 2.64} ${264 - result.overallWinProbability * 2.64}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${probColor(result.overallWinProbability)}`}>
                    {result.overallWinProbability}%
                  </span>
                  <span className="text-xs text-slate-500 uppercase">Win Probability</span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold text-white">{activeCase?.title}</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Confidence: <span className="capitalize text-white">{result.confidence}</span>
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Est. Timeline: <span className="text-white">{result.timelineEstimate}</span>
                </p>

                {/* Settlement Range */}
                <div className="mt-4 bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase mb-2">Settlement Range</p>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-center">
                      <p className="text-red-400 text-xs">Low</p>
                      <p className="text-white font-bold">${result.settlementRange.low.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 h-2 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full" />
                    <div className="text-center">
                      <p className="text-amber-400 text-xs">Mid</p>
                      <p className="text-white font-bold">${result.settlementRange.mid.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 h-2 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" />
                    <div className="text-center">
                      <p className="text-emerald-400 text-xs">High</p>
                      <p className="text-white font-bold">${result.settlementRange.high.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.breakdown.map((b, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{b.icon}</span>
                  <span className={`text-lg font-bold ${probColor(b.score)}`}>{b.score}%</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{b.category}</h3>
                <div className="h-1.5 bg-slate-700 rounded-full mb-2">
                  <div className={`h-full rounded-full ${probBg(b.score)}`} style={{ width: `${b.score}%` }} />
                </div>
                <p className="text-xs text-slate-400">{b.analysis}</p>
              </div>
            ))}
          </div>

          {/* Risk Factors */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <AlertTriangle size={16} />
              Risk Factors
            </h3>
            <div className="space-y-3">
              {result.riskFactors.map((rf, i) => (
                <div key={i} className={`border rounded-lg p-3 ${severityColor(rf.severity)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{rf.factor}</p>
                    <span className="text-xs uppercase font-bold">{rf.severity}</span>
                  </div>
                  <p className="text-xs opacity-75">Mitigation: {rf.mitigation}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recommendations */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Target size={16} />
                Recommendations
              </h3>
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gold-500 font-bold text-sm mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-slate-300">{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparable Cases */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Scale size={16} />
                Comparable Cases
              </h3>
              <div className="space-y-3">
                {result.comparableCases.map((cc, i) => (
                  <div key={i} className="bg-slate-900 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-white font-medium">{cc.name}</p>
                      <span className="text-xs text-slate-500">{cc.similarity}% similar</span>
                    </div>
                    <p className={`text-xs font-medium ${
                      cc.outcome.toLowerCase().includes('plaintiff') ? 'text-emerald-400' :
                      cc.outcome.toLowerCase().includes('settled') ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {cc.outcome}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !isAnalyzing && activeCase && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <TrendingUp size={48} className="mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-semibold text-white mb-2">Ready to Analyze</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Run predictive analytics on <span className="text-gold-500">{activeCase.title}</span> to get
            win probability, risk factors, settlement projections, and comparable case research.
          </p>
          <button
            onClick={runAnalysis}
            className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            <Sparkles size={16} className="inline mr-2" />
            Run Predictive Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default PredictiveAnalytics;
