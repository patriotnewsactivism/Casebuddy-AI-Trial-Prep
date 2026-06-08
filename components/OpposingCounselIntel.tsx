import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import {
  Search, Loader2, User, MapPin, Briefcase, TrendingUp, TrendingDown,
  AlertTriangle, Shield, Target, Zap, ChevronDown, ChevronUp,
  Scale, Award, Brain, Eye, Crosshair, BookOpen, BarChart2,
  CheckCircle, XCircle, AlertCircle, Swords
} from 'lucide-react';
import { toast } from 'react-toastify';

interface TacticPattern {
  tactic: string;
  frequency: 'always' | 'often' | 'sometimes';
  howToCounter: string;
}

interface CounselProfile {
  name: string;
  firm: string;
  barNumber?: string;
  jurisdiction: string;
  yearsExperience: number;
  practiceAreas: string[];
  overallDangerLevel: number; // 0-100
  winRate: number; // 0-100
  settlementRate: number; // 0-100
  trialRate: number; // 0-100
  background: string;
  reputation: string;
  favoriteMotions: string[];
  discoveryStyle: string;
  trialStyle: string;
  knownWeaknesses: string[];
  knownStrengths: string[];
  tacticPatterns: TacticPattern[];
  notableCases: string[];
  howToDefeatThem: string;
  negotiationStyle: string;
  keyIntel: string;
  warningLevel: 'low' | 'medium' | 'high' | 'extreme';
}

async function profileCounsel(name: string, firm: string, caseType: string): Promise<CounselProfile> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const prompt = `You are a litigation intelligence analyst. Create a detailed opposing counsel intelligence profile.

Attorney: "${name}"
Firm: "${firm || 'Unknown firm'}"
Case Type: "${caseType || 'Civil litigation'}"

Generate a realistic, tactical intelligence profile. If this is a well-known attorney, use real information. Otherwise generate a plausible profile for an attorney with this name. Respond in VALID JSON only (no markdown):

{
  "name": "${name}",
  "firm": "<firm name>",
  "barNumber": "<state bar # or 'Not public'>",
  "jurisdiction": "<primary jurisdiction>",
  "yearsExperience": <number>,
  "practiceAreas": ["<area 1>", "<area 2>", "<area 3>"],
  "overallDangerLevel": <0-100>,
  "winRate": <0-100>,
  "settlementRate": <0-100>,
  "trialRate": <0-100>,
  "background": "<2-sentence background — education, career path, notable history>",
  "reputation": "<1-sentence reputation among opposing counsel and judges>",
  "favoriteMotions": ["<motion they file constantly 1>", "<motion 2>", "<motion 3>"],
  "discoveryStyle": "<1-2 sentences on how they approach discovery — aggressive, narrow, delay tactics, etc.>",
  "trialStyle": "<1-2 sentences on courtroom style — emotional, technical, aggressive cross, etc.>",
  "knownWeaknesses": ["<exploitable weakness 1>", "<weakness 2>", "<weakness 3>"],
  "knownStrengths": ["<genuine strength 1>", "<strength 2>", "<strength 3>"],
  "tacticPatterns": [
    {"tactic": "<specific tactic they use>", "frequency": "<always|often|sometimes>", "howToCounter": "<how to beat this tactic>"},
    {"tactic": "<tactic 2>", "frequency": "<always|often|sometimes>", "howToCounter": "<counter>"},
    {"tactic": "<tactic 3>", "frequency": "<always|often|sometimes>", "howToCounter": "<counter>"},
    {"tactic": "<tactic 4>", "frequency": "<always|often|sometimes>", "howToCounter": "<counter>"}
  ],
  "notableCases": ["<notable case or pattern 1>", "<case 2>", "<case 3>"],
  "howToDefeatThem": "<3-4 sentence masterclass on the exact strategy to beat this attorney — specific, tactical, actionable>",
  "negotiationStyle": "<1-2 sentences on how they negotiate — anchor high, bluff, delay, etc.>",
  "keyIntel": "<The single most important piece of intelligence about this attorney — what changes your entire approach>",
  "warningLevel": "<low|medium|high|extreme>"
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

const dangerColors = {
  low:     { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500', label: 'LOW THREAT' },
  medium:  { bg: 'bg-yellow-500/10 border-yellow-500/30',  text: 'text-yellow-400',  bar: 'bg-yellow-500',  label: 'MEDIUM THREAT' },
  high:    { bg: 'bg-orange-500/10 border-orange-500/30',  text: 'text-orange-400',  bar: 'bg-orange-500',  label: 'HIGH THREAT' },
  extreme: { bg: 'bg-red-500/10 border-red-500/30',        text: 'text-red-400',     bar: 'bg-red-500',     label: '⚠ EXTREME THREAT' },
};

const freqColors = {
  always:    'bg-red-500/20 text-red-300 border-red-500/30',
  often:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  sometimes: 'bg-slate-700 text-slate-300 border-slate-600',
};

const SAMPLE_ATTORNEYS = [
  'David Boies', 'Gloria Allred', 'Alan Dershowitz', 'Johnnie Cochran'
];

const OpposingCounselIntel: React.FC = () => {
  const { activeCase } = useContext(AppContext) as any;
  const [counselName, setCounselName] = useState(activeCase?.opposingCounsel || '');
  const [firm, setFirm] = useState('');
  const [caseType, setCaseType] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<CounselProfile | null>(null);
  const [expanded, setExpanded] = useState<string | null>('defeat');

  const toggle = (k: string) => setExpanded(e => e === k ? null : k);

  const handleProfile = async () => {
    if (!counselName.trim()) { toast.error('Enter opposing counsel name'); return; }
    setLoading(true);
    setProfile(null);
    try {
      const p = await profileCounsel(counselName, firm, caseType);
      setProfile(p);
    } catch {
      toast.error('Profile generation failed');
    } finally {
      setLoading(false);
    }
  };

  const danger = profile ? dangerColors[profile.warningLevel] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <Swords size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Opposing Counsel Intel</h1>
            <p className="text-slate-400 text-sm">Know their playbook before they play it</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Attorney Name *</label>
              <input
                value={counselName}
                onChange={e => setCounselName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleProfile()}
                placeholder="e.g. Jane Smith, Esq."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Law Firm</label>
              <input
                value={firm}
                onChange={e => setFirm(e.target.value)}
                placeholder="e.g. Smith & Partners LLP"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Case Type</label>
              <input
                value={caseType}
                onChange={e => setCaseType(e.target.value)}
                placeholder="e.g. Personal Injury"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500">Notable:</span>
            {SAMPLE_ATTORNEYS.map(a => (
              <button key={a} onClick={() => setCounselName(a)}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors">
                {a}
              </button>
            ))}
          </div>

          <button
            onClick={handleProfile}
            disabled={loading || !counselName.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
          >
            {loading
              ? <><Loader2 size={18} className="animate-spin" /> Running Intel...</>
              : <><Eye size={18} /> Generate Intel Report</>}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
            <Loader2 size={32} className="animate-spin text-red-400 mx-auto mb-3" />
            <p className="text-white font-medium">Compiling intelligence dossier...</p>
            <p className="text-slate-400 text-sm mt-1">Analyzing case history, tactics & patterns</p>
          </div>
        )}

        {/* Profile */}
        {profile && !loading && danger && (
          <div className="space-y-4">

            {/* Threat card */}
            <div className={`rounded-2xl border p-6 ${danger.bg}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={16} className={danger.text} />
                    <h2 className={`text-xl font-bold ${danger.text}`}>{profile.name}</h2>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-400 mb-2">
                    <span className="flex items-center gap-1"><Briefcase size={13} />{profile.firm}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} />{profile.jurisdiction}</span>
                    <span className="flex items-center gap-1"><Award size={13} />{profile.yearsExperience} yrs exp.</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.practiceAreas.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300">{a}</span>
                    ))}
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl border font-bold text-sm ${danger.bg} ${danger.text}`}>
                  {danger.label}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Win Rate', value: profile.winRate, color: profile.winRate > 65 ? 'text-red-400' : 'text-emerald-400' },
                  { label: 'Settles', value: profile.settlementRate, color: 'text-yellow-400' },
                  { label: 'Goes to Trial', value: profile.trialRate, color: 'text-blue-400' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-900/60 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}%</div>
                    <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Danger bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Threat Level</span>
                  <span>{profile.overallDangerLevel}/100</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full">
                  <div className={`h-full rounded-full ${danger.bar}`} style={{ width: `${profile.overallDangerLevel}%` }} />
                </div>
              </div>

              {profile.background && (
                <p className="text-slate-300 text-sm mt-4 leading-relaxed">{profile.background}</p>
              )}
              {profile.reputation && (
                <p className="text-slate-400 text-xs mt-2 italic">"{profile.reputation}"</p>
              )}
            </div>

            {/* KEY INTEL */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-red-400" />
                <span className="text-red-400 font-bold text-sm uppercase tracking-wide">Key Intel</span>
              </div>
              <p className="text-white leading-relaxed">{profile.keyIntel}</p>
            </div>

            {/* HOW TO DEFEAT THEM */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden cursor-pointer" onClick={() => toggle('defeat')}>
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-2">
                  <Crosshair size={18} className="text-emerald-400" />
                  <span className="font-semibold">How to Defeat Them</span>
                </div>
                {expanded === 'defeat' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'defeat' && (
                <div className="px-5 pb-5">
                  <p className="text-slate-200 leading-relaxed">{profile.howToDefeatThem}</p>
                </div>
              )}
            </div>

            {/* Tactic patterns */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('tactics')}>
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-orange-400" />
                  <span className="font-semibold">Known Tactics & Counters</span>
                </div>
                {expanded === 'tactics' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'tactics' && (
                <div className="px-5 pb-5 space-y-4">
                  {profile.tacticPatterns.map((t, i) => (
                    <div key={i} className="border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${freqColors[t.frequency]}`}>
                          {t.frequency.toUpperCase()}
                        </span>
                        <span className="text-white text-sm font-medium">{t.tactic}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-emerald-300">
                        <Shield size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-300"><span className="text-emerald-400 font-medium">Counter:</span> {t.howToCounter}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strengths vs Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-red-400" />
                  <span className="font-semibold text-red-400 text-sm">Their Strengths</span>
                </div>
                <ul className="space-y-2">
                  {profile.knownStrengths.map((s, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={16} className="text-emerald-400" />
                  <span className="font-semibold text-emerald-400 text-sm">Exploitable Weaknesses</span>
                </div>
                <ul className="space-y-2">
                  {profile.knownWeaknesses.map((w, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <CheckCircle size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Style breakdown */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('style')}>
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-violet-400" />
                  <span className="font-semibold">Style & Approach</span>
                </div>
                {expanded === 'style' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'style' && (
                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Discovery Style</div>
                    <p className="text-slate-300 text-sm">{profile.discoveryStyle}</p>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Trial Style</div>
                    <p className="text-slate-300 text-sm">{profile.trialStyle}</p>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Negotiation Style</div>
                    <p className="text-slate-300 text-sm">{profile.negotiationStyle}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Favorite motions */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('motions')}>
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-blue-400" />
                  <span className="font-semibold">Favorite Motions They File</span>
                </div>
                {expanded === 'motions' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'motions' && (
                <div className="px-5 pb-5 space-y-2">
                  {profile.favoriteMotions.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <Scale size={13} className="text-blue-400 flex-shrink-0" />{m}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notable cases */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle('cases')}>
                <div className="flex items-center gap-2">
                  <BarChart2 size={18} className="text-yellow-400" />
                  <span className="font-semibold">Notable Cases & Patterns</span>
                </div>
                {expanded === 'cases' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
              {expanded === 'cases' && (
                <div className="px-5 pb-5 space-y-2">
                  {profile.notableCases.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300 pb-2 border-b border-slate-800 last:border-0">
                      <XCircle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />{c}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pb-6">
              <button onClick={() => window.location.href = '/app/judge-profiler'}
                className="flex items-center justify-center gap-2 py-3 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 rounded-xl text-amber-300 font-medium transition-colors text-sm">
                <Scale size={16} /> Profile the Judge
              </button>
              <button onClick={() => window.location.href = '/app/courtroom'}
                className="flex items-center justify-center gap-2 py-3 bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 rounded-xl text-violet-300 font-medium transition-colors text-sm">
                <Swords size={16} /> Enter Courtroom Sim
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default OpposingCounselIntel;
