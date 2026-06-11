import React, { useState } from 'react';
import { BarChart2, Loader2, Play, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { trialCoach } from '../lib/api';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { useActiveCase, buildCaseContext, logActivity, completeAgentTask } from '../lib/caseStore';
import AgentHeader from '../components/AgentHeader';
import { AGENTS } from '../agents/personas';

const jules = AGENTS.jules;

interface Juror {
  id: number;
  name: string;
  age: number;
  occupation: string;
  lean: 'plaintiff' | 'defense' | 'neutral';
  traits: string[];
  personality: string;
  plaintiff_pct: number;
  reaction: string;
  verdict: 'plaintiff' | 'defense';
  persuaded_by: string;
}

const JUROR_PROFILES: Omit<Juror, 'plaintiff_pct' | 'reaction' | 'verdict' | 'persuaded_by'>[] = [
  { id: 1, name: 'Margaret Chen', age: 52, occupation: 'Retired Teacher', lean: 'plaintiff', traits: ['Empathetic', 'Detail-oriented', 'Values fairness'], personality: 'empathetic' },
  { id: 2, name: 'Robert Williams', age: 41, occupation: 'Small Business Owner', lean: 'defense', traits: ['Skeptical of lawsuits', 'Pro-business', 'Practical'], personality: 'skeptic' },
  { id: 3, name: 'Desiree Johnson', age: 34, occupation: 'Social Worker', lean: 'plaintiff', traits: ['Community-focused', 'Distrusts authority', 'Emotional'], personality: 'emotional' },
  { id: 4, name: 'Thomas Miller', age: 67, occupation: 'Retired Military', lean: 'neutral', traits: ['Follows rules', 'Respects process', 'Stoic'], personality: 'analytical' },
  { id: 5, name: 'Sarah Davis', age: 28, occupation: 'Software Engineer', lean: 'neutral', traits: ['Analytical', 'Wants data', 'Skeptical'], personality: 'analytical' },
  { id: 6, name: 'Marcus Brown', age: 45, occupation: 'Construction Foreman', lean: 'plaintiff', traits: ['Blue-collar empathy', 'Understands injury', 'Direct'], personality: 'empathetic' },
];

const LEAN_COLORS = {
  plaintiff: 'text-blue-400',
  defense: 'text-red-400',
  neutral: 'text-slate-400',
};

const PERSONALITY_ICONS: Record<string, string> = {
  empathetic: '💙',
  skeptic: '🤨',
  emotional: '❤️',
  analytical: '🧮',
  conservative: '🏛️',
  undecided: '⚖️',
};

type SimMode = 'opening' | 'closing' | 'evidence' | 'rebuttal';

const MODES: { id: SimMode; label: string; desc: string }[] = [
  { id: 'opening', label: 'Opening Statement', desc: 'Test your opening argument' },
  { id: 'evidence', label: 'Evidence Presentation', desc: 'See how jurors react to key evidence' },
  { id: 'closing', label: 'Closing Argument', desc: 'Measure final persuasion' },
  { id: 'rebuttal', label: 'Rebuttal', desc: 'Counter opposing counsel' },
];

export default function JurySimulator() {
  const activeCase = useActiveCase();
  const [mode, setMode] = useState<SimMode>('opening');
  const [caseType, setCaseType] = useState('Civil Rights');
  const [statement, setStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [jurors, setJurors] = useState<Juror[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [forPlaintiff, setForPlaintiff] = useState(0);
  const [juliesAnalysis, setJuliesAnalysis] = useState('');
  const [expandedJuror, setExpandedJuror] = useState<number | null>(null);
  const [deliberating, setDeliberating] = useState(false);
  const [deliberationResult, setDeliberationResult] = useState('');

  const simulate = async () => {
    if (!statement.trim()) return;
    setLoading(true);
    setJurors([]);
    setVerdict(null);
    setDeliberationResult('');

    const prompt = `${jules.systemPrompt}
${activeCase ? `\n${buildCaseContext(activeCase)}\n` : ''}
JURY SIMULATION REQUEST:
Case Type: ${activeCase?.caseType || caseType}
Mode: ${mode.replace('_', ' ').toUpperCase()}
Statement/Argument Presented: "${statement}"

Analyze how each of these 6 jurors would react to this argument. For each juror, consider their personality, occupation, lean, and traits.

Jurors:
${JUROR_PROFILES.map(j => `- ${j.name}, ${j.age}, ${j.occupation}, lean: ${j.lean}, traits: ${j.traits.join(', ')}`).join('\n')}

Respond with valid JSON only:
{
  "overall_analysis": "Jules's overall assessment of how persuasive this argument was and why",
  "jurors": [
    {
      "id": 1,
      "plaintiff_pct": 0-100,
      "reaction": "specific reaction to this argument in 1-2 sentences",
      "verdict": "plaintiff or defense",
      "persuaded_by": "what specific element moved them"
    }
  ],
  "strongest_point": "the most persuasive element of the argument",
  "weakest_point": "what fell flat or could backfire",
  "recommendations": ["specific improvement 1", "specific improvement 2", "specific improvement 3"]
}`;

    const res = await trialCoach({
      messages: [{ role: 'user', content: prompt }],
      config: { role: 'juror', mode: 'Jury Simulation', difficulty: 'Trial', case_facts: statement }
    });

    if (res.reply) {
      try {
        const match = res.reply.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const enriched: Juror[] = JUROR_PROFILES.map(profile => {
            const jurorResult = parsed.jurors?.find((j: any) => j.id === profile.id) || {};
            return {
              ...profile,
              plaintiff_pct: jurorResult.plaintiff_pct ?? (profile.lean === 'plaintiff' ? 60 : profile.lean === 'defense' ? 40 : 50),
              reaction: jurorResult.reaction ?? 'No specific reaction recorded.',
              verdict: jurorResult.verdict ?? profile.lean === 'plaintiff' ? 'plaintiff' : 'defense',
              persuaded_by: jurorResult.persuaded_by ?? '',
            };
          });
          const plaintiffCount = enriched.filter(j => j.verdict === 'plaintiff').length;
          setJurors(enriched);
          setForPlaintiff(plaintiffCount);
          setJuliesAnalysis(parsed.overall_analysis || '');
          setVerdict(
            plaintiffCount >= 5 ? '🏆 PLAINTIFF WINS' :
            plaintiffCount <= 2 ? '🛡️ DEFENSE WINS' : '⚖️ HUNG JURY'
          );
          if (activeCase) {
            logActivity(activeCase.id, 'jules', 'Ran jury simulation', `${mode} — ${plaintiffCount}/6 jurors for plaintiff. ${(parsed.overall_analysis || '').slice(0, 120)}`);
            completeAgentTask(activeCase.id, 'jules');
          }
        }
      } catch {
        setJuliesAnalysis(res.reply);
      }
    }
    setLoading(false);
  };

  const runDeliberation = async () => {
    if (jurors.length === 0) return;
    setDeliberating(true);

    const prompt = `${jules.systemPrompt}

The jury has heard the argument. Now simulate a realistic 2-3 paragraph jury deliberation based on these juror positions:

${jurors.map(j => `${j.name} (${j.occupation}): ${j.verdict === 'plaintiff' ? 'FOR PLAINTIFF' : 'FOR DEFENSE'} — ${j.reaction}`).join('\n')}

Write the deliberation as a dramatic but realistic scene. Show the debate between the jurors. Include who tries to persuade whom, what arguments are made, and how they reach (or fail to reach) a verdict. End with the final outcome.`;

    const res = await trialCoach({
      messages: [{ role: 'user', content: prompt }],
      config: { role: 'juror', mode: 'Jury Simulation', difficulty: 'Trial', case_facts: '' }
    });

    setDeliberationResult(res.reply || '');
    setDeliberating(false);
  };

  const verdictColor = verdict?.includes('PLAINTIFF') ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
    verdict?.includes('DEFENSE') ? 'text-red-400 border-red-500/30 bg-red-500/10' :
    'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Jury Simulator</h1>
        <p className="text-slate-400 text-sm">Test your arguments on 6 AI jurors with distinct personalities. Measure persuasion and predict your verdict before trial.</p>
      </div>

      <AgentHeader agent={jules} subtitle="Present your argument and I'll show you exactly who you've won, who you've lost, and how to fix it." />

      <ActiveCaseBar agentId="jules" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">Simulation Setup</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Case Type</label>
              <input value={caseType} onChange={e => setCaseType(e.target.value)}
                placeholder="e.g. Civil Rights, Personal Injury"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-2">Simulation Mode</label>
              <div className="space-y-2">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${mode === m.id ? 'bg-pink-600/20 border-pink-500/50 text-pink-300' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs opacity-70">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Your {MODES.find(m2 => m2.id === mode)?.label} *</label>
              <textarea value={statement} onChange={e => setStatement(e.target.value)}
                rows={6} placeholder={`Paste or type your ${mode.replace('_', ' ')} here. The more detail, the more accurate the juror reactions.`}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500 resize-none" />
            </div>

            <button onClick={simulate} disabled={loading || !statement.trim()}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-700 text-white font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Simulating...</> : <><Play size={14} /> Run Jury Simulation</>}
            </button>
          </div>

          {/* Juror roster */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3">Your Jury Panel</p>
            <div className="space-y-2">
              {JUROR_PROFILES.map(j => (
                <div key={j.id} className="flex items-center gap-2 text-xs">
                  <span className="text-base">{PERSONALITY_ICONS[j.personality]}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium">{j.name}</span>
                    <span className="text-slate-500 ml-1">{j.occupation}</span>
                  </div>
                  <span className={`font-medium capitalize ${LEAN_COLORS[j.lean]}`}>{j.lean}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {!jurors.length && !loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">🎭</div>
              <h3 className="text-white font-semibold mb-2">6 jurors are ready</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Present your opening, evidence, or closing argument and Jules will simulate how each juror reacts — including persuasion scores and a predicted verdict.</p>
            </div>
          )}

          {loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
              <Loader2 size={32} className="animate-spin text-pink-500 mx-auto mb-4" />
              <p className="text-white font-medium">Jules is reading the room...</p>
              <p className="text-slate-400 text-sm mt-1">Analyzing juror psychology and persuasion factors</p>
            </div>
          )}

          {jurors.length > 0 && (
            <>
              {/* Verdict banner */}
              <div className={`rounded-xl border p-5 ${verdictColor}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Predicted Verdict</p>
                    <p className="text-2xl font-black">{verdict}</p>
                    <p className="text-sm mt-1 opacity-80">{forPlaintiff}/6 jurors for plaintiff · {6 - forPlaintiff}/6 for defense</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black">{Math.round((forPlaintiff / 6) * 100)}%</div>
                    <div className="text-xs opacity-70">Plaintiff probability</div>
                  </div>
                </div>
                {/* Meter */}
                <div className="mt-4 h-3 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all duration-700" style={{ width: `${(forPlaintiff / 6) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-1 opacity-60">
                  <span>Defense</span><span>Plaintiff</span>
                </div>
              </div>

              {/* Jules's analysis */}
              {juliesAnalysis && (
                <div className="bg-slate-800 border border-pink-500/20 rounded-xl p-5">
                  <p className="text-pink-400 text-xs font-semibold uppercase tracking-wider mb-2">🎭 Jules's Analysis</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{juliesAnalysis}</p>
                </div>
              )}

              {/* Juror cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jurors.map(j => (
                  <div key={j.id}
                    className={`bg-slate-800 border rounded-xl overflow-hidden cursor-pointer transition-colors ${j.verdict === 'plaintiff' ? 'border-blue-500/30' : 'border-red-500/30'}`}
                    onClick={() => setExpandedJuror(expandedJuror === j.id ? null : j.id)}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{PERSONALITY_ICONS[j.personality]}</span>
                          <div>
                            <p className="text-white text-sm font-semibold">{j.name}</p>
                            <p className="text-slate-400 text-xs">{j.occupation}, {j.age}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${j.verdict === 'plaintiff' ? 'bg-blue-600/20 text-blue-400' : 'bg-red-600/20 text-red-400'}`}>
                          {j.verdict === 'plaintiff' ? 'FOR PLAINTIFF' : 'FOR DEFENSE'}
                        </span>
                      </div>

                      {/* Persuasion meter */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-500 to-blue-500 rounded-full transition-all duration-700"
                            style={{ width: `${j.plaintiff_pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{j.plaintiff_pct}%</span>
                      </div>

                      {expandedJuror === j.id && (
                        <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                          <p className="text-slate-300 text-xs leading-relaxed">{j.reaction}</p>
                          {j.persuaded_by && (
                            <p className="text-xs text-slate-400"><span className="text-pink-400">Moved by:</span> {j.persuaded_by}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {j.traits.map(t => (
                              <span key={t} className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Deliberation */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">🗣️ Jury Deliberation</h3>
                  <button onClick={runDeliberation} disabled={deliberating}
                    className="flex items-center gap-1.5 bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors">
                    {deliberating ? <><Loader2 size={12} className="animate-spin" /> Deliberating...</> : <><Play size={12} /> Simulate Deliberation</>}
                  </button>
                </div>
                {deliberationResult ? (
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{deliberationResult}</p>
                ) : (
                  <p className="text-slate-500 text-xs">Click "Simulate Deliberation" to see how your jury would debate and reach a verdict in the jury room.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
