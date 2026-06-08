import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import {
  Gavel, Search, Loader2, Star, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Brain, Scale, BarChart2, BookOpen, Lightbulb, Target,
  User, MapPin, Calendar, Award, AlertCircle, Zap
} from 'lucide-react';
import { toast } from 'react-toastify';

interface RulingPattern {
  category: string;
  tendency: string;
  percentage: number;
  direction: 'favorable' | 'unfavorable' | 'neutral';
}

interface JudgeProfile {
  name: string;
  court: string;
  jurisdiction: string;
  appointedBy?: string;
  yearsOnBench?: number;
  background?: string;
  overallFairness: number; // 0-100
  plaintiffFavorable: number; // 0-100
  rulingPatterns: RulingPattern[];
  argumentsTheyLove: string[];
  argumentsTheyHate: string[];
  proceduralQuirks: string[];
  notableRulings: string[];
  winningStrategy: string;
  warningFlags: string[];
  keyInsight: string;
}

const SAMPLE_JUDGES = [
  'Hon. Amy Coney Barrett', 'Hon. Ketanji Brown Jackson',
  'Hon. Neil Gorsuch', 'Hon. Sonia Sotomayor',
];

async function profileJudge(name: string, court: string, caseType: string): Promise<JudgeProfile> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt = `You are a legal intelligence analyst with access to comprehensive judicial records, published opinions, and court data.

Create a detailed judicial intelligence profile for: "${name}"
Court/Jurisdiction: "${court || 'Federal District Court'}"
Case Type: "${caseType || 'Civil litigation'}"

Based on general knowledge of this judge (or a judge with this profile type if not well-known), provide realistic, actionable intelligence. Respond in VALID JSON only (no markdown):

{
  "name": "${name}",
  "court": "<court name>",
  "jurisdiction": "<jurisdiction>",
  "appointedBy": "<appointing president/governor or 'Elected'>",
  "yearsOnBench": <number>,
  "background": "<2-sentence background — prior career, law school, notable history>",
  "overallFairness": <0-100 score>,
  "plaintiffFavorable": <0-100, 50=neutral, above=plaintiff-leaning, below=defense-leaning>,
  "rulingPatterns": [
    {"category": "<e.g. Motions to Dismiss>", "tendency": "<1-sentence tendency>", "percentage": <0-100>, "direction": "<favorable|unfavorable|neutral>"},
    {"category": "<e.g. Discovery Disputes>", "tendency": "<tendency>", "percentage": <0-100>, "direction": "<favorable|unfavorable|neutral>"},
    {"category": "<e.g. Summary Judgment>", "tendency": "<tendency>", "percentage": <0-100>, "direction": "<favorable|unfavorable|neutral>"},
    {"category": "<e.g. Evidentiary Rulings>", "tendency": "<tendency>", "percentage": <0-100>, "direction": "<favorable|unfavorable|neutral>"},
    {"category": "<e.g. Jury Instructions>", "tendency": "<tendency>", "percentage": <0-100>, "direction": "<favorable|unfavorable|neutral>"}
  ],
  "argumentsTheyLove": ["<argument type 1>", "<argument type 2>", "<argument type 3>", "<argument type 4>"],
  "argumentsTheyHate": ["<what to avoid 1>", "<what to avoid 2>", "<what to avoid 3>"],
  "proceduralQuirks": ["<courtroom rule/preference 1>", "<quirk 2>", "<quirk 3>"],
  "notableRulings": ["<notable ruling or pattern 1>", "<ruling 2>", "<ruling 3>"],
  "winningStrategy": "<2-3 sentence masterclass on how to win in front of this judge specifically>",
  "warningFlags": ["<red flag 1>", "<red flag 2>"],
  "keyInsight": "<The single most important thing to know about this judge — the insight that changes your approach>"
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    }
  );
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

const ScoreBar: React.FC<{ value: number; leftLabel: string; rightLabel: string; color: string }> = ({ value, leftLabel, rightLabel, color }) => (
  <div>
    <div className="flex justify-between text-xs text-slate-400 mb-1">
      <span>{leftLabel}</span>
      <span>{rightLabel}</span>
    </div>
    <div className="h-2.5 bg-slate-800 rounded-full relative">
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600 z-10" />
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
    <div className="text-center text-xs text-slate-500 mt-1">{value}/100</div>
  </div>
);

const JudgeProfiler: React.FC = () => {
  const { activeCase } = useContext(AppContext) as any;
  const [judgeName, setJudgeName] = useState(activeCase?.judge || '');
  const [court, setCourt] = useState(activeCase?.courtLocation || '');
  const [caseType, setCaseType] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<JudgeProfile | null>(null);
  const [expanded, setExpanded] = useState<string | null>('strategy');

  const handleProfile = async () => {
    if (!judgeName.trim()) { toast.error('Enter a judge name'); return; }
    setLoading(true);
    setProfile(null);
    try {
      const p = await profileJudge(judgeName, court, caseType);
      setProfile(p);
    } catch (e) {
      toast.error('Profile generation failed — check your API key');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => setExpanded(e => e === key ? null : key);

  const directionIcon = (d: string) =>
    d === 'favorable' ? <TrendingUp size={14} className="text-emerald-400" /> :
    d === 'unfavorable' ? <TrendingDown size={14} className="text-red-400" /> :
    <Scale size={14} className="text-slate-400" />;

  const directionColor = (d: string) =>
    d === 'favorable' ? 'bg-emerald-500' : d === 'unfavorable' ? 'bg-red-500' : 'bg-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Gavel size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Judge Intelligence Profiler</h1>
            <p className="text-slate-400 text-sm">AI-powered judicial analytics — know your judge before you walk in</p>
          </div>
        </div>

        {/* Search panel */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="sm:col-span-1">
              <label className="text-xs text-slate-400 mb-1.5 block">Judge Name *</label>
              <input
                value={judgeName}
                onChange={e => setJudgeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleProfile()}
                placeholder="Hon. Jane Smith"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Court / Jurisdiction</label>
              <input
                value={court}
                onChange={e => setCourt(e.target.value)}
                placeholder="e.g. S.D.N.Y., 9th Circuit"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Case Type</label>
              <input
                value={caseType}
                onChange={e => setCaseType(e.target.value)}
                placeholder="e.g. Civil Rights, Contract"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500">Quick:</span>
            {SAMPLE_JUDGES.map(j => (
              <button key={j} onClick={() => setJudgeName(j)}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors">
                {j}
              </button>
            ))}
          </div>

          <button
            onClick={handleProfile}
            disabled={loading || !judgeName.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Profiling Judge...</> : <><Search size={18} /> Generate Profile</>}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
            <Loader2 size={32} className="animate-spin text-amber-400 mx-auto mb-3" />
            <p className="text-white font-medium">Analyzing judicial record...</p>
            <p className="text-slate-400 text-sm mt-1">Reviewing opinions, patterns & tendencies</p>
          </div>
        )}

        {/* Profile results */}
        {profile && !loading && (
          <div className="space-y-4">

            {/* Judge card */}
            <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={16} className="text-amber-400" />
                    <h2 className="text-xl font-bold text-amber-300">{profile.name}</h2>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><MapPin size={13} />{profile.court}</span>
                    <span className="flex items-center gap-1"><Scale size={13} />{profile.jurisdiction}</span>
                    {profile.yearsOnBench && <span className="flex items-center gap-1"><Calendar size={13} />{profile.yearsOnBench} yrs on bench</span>}
                    {profile.appointedBy && <span className="flex items-center gap-1"><Award size={13} />Appt. by {profile.appointedBy}</span>}
                  </div>
                  {profile.background && (
                    <p className="text-slate-300 text-sm mt-3 leading-relaxed">{profile.background}</p>
                  )}
                </div>
              </div>

              {/* Score meters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                <ScoreBar value={profile.overallFairness} leftLabel="Unpredictable" rightLabel="Consistent" color="bg-blue-500" />
                <ScoreBar value={profile.plaintiffFavorable} leftLabel="Defense-leaning" rightLabel="Plaintiff-leaning" color={profile.plaintiffFavorable > 55 ? 'bg-emerald-500' : profile.plaintiffFavorable < 45 ? 'bg-red-500' : 'bg-slate-500'} />
              </div>
            </div>

            {/* KEY INSIGHT — always visible */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-amber-400" />
                <span className="text-amber-400 font-bold text-sm uppercase tracking-wide">Key Insight</span>
              </div>
              <p className="text-white leading-relaxed">{profile.keyInsight}</p>
            </div>

            {/* Winning Strategy */}
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden cursor-pointer"
              onClick={() => toggle('strategy')}
            >
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-violet-400" />
                  <span className="font-semibold">Winning Strategy</span>
                </div>
                {expanded === 'strategy' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'strategy' && (
                <div className="px-5 pb-5">
                  <p className="text-slate-200 leading-relaxed">{profile.winningStrategy}</p>
                </div>
              )}
            </div>

            {/* Ruling Patterns */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('patterns')}>
                <div className="flex items-center gap-2">
                  <BarChart2 size={18} className="text-blue-400" />
                  <span className="font-semibold">Ruling Patterns</span>
                </div>
                {expanded === 'patterns' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'patterns' && (
                <div className="px-5 pb-5 space-y-4">
                  {profile.rulingPatterns.map((p, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {directionIcon(p.direction)}
                          <span className="text-sm font-medium text-slate-200">{p.category}</span>
                        </div>
                        <span className="text-xs text-slate-400">{p.percentage}% track</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full mb-1.5">
                        <div className={`h-full rounded-full ${directionColor(p.direction)}`} style={{ width: `${p.percentage}%` }} />
                      </div>
                      <p className="text-xs text-slate-400">{p.tendency}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Arguments they love vs hate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="font-semibold text-emerald-400 text-sm">Arguments They Love</span>
                </div>
                <ul className="space-y-2">
                  {profile.argumentsTheyLove.map((a, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle size={16} className="text-red-400" />
                  <span className="font-semibold text-red-400 text-sm">Arguments They Hate</span>
                </div>
                <ul className="space-y-2">
                  {profile.argumentsTheyHate.map((a, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">✗</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Procedural quirks */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('quirks')}>
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-purple-400" />
                  <span className="font-semibold">Courtroom Quirks & Preferences</span>
                </div>
                {expanded === 'quirks' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'quirks' && (
                <div className="px-5 pb-5 space-y-2">
                  {profile.proceduralQuirks.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Lightbulb size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                      {q}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warning flags */}
            {profile.warningFlags?.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="font-semibold text-red-400 text-sm">Warning Flags</span>
                </div>
                <ul className="space-y-2">
                  {profile.warningFlags.map((w, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notable rulings */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('rulings')}>
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-blue-400" />
                  <span className="font-semibold">Notable Rulings & Patterns</span>
                </div>
                {expanded === 'rulings' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'rulings' && (
                <div className="px-5 pb-5 space-y-2">
                  {profile.notableRulings.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300 pb-2 border-b border-slate-800 last:border-0">
                      <Scale size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default JudgeProfiler;
