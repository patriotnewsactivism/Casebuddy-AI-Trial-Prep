import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Download, Plus } from 'lucide-react';
import { trialCoach } from '../lib/api';
import AgentHeader from '../components/AgentHeader';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { AGENTS } from '../agents/personas';
import { useActiveCase, buildCaseContext, addCaseWitness, logActivity, completeAgentTask } from '../lib/caseStore';

const rex = AGENTS.rex;

interface WitnessForm {
  name: string;
  witness_type: 'fact' | 'expert' | 'character';
  side: 'ours' | 'theirs';
  occupation: string;
  expected_testimony: string;
  prior_statements: string;
  vulnerabilities: string;
}

interface WitnessResult {
  ai_prep_notes: string;
  direct_questions: string[];
  cross_questions: string[];
  anticipated_answers: string[];
  credibility_assessment: string;
  vulnerabilities: string[];
  opening_gambit: string;
  closing_question: string;
  danger_zones: string[];
}

const blankWitness = (): WitnessForm => ({
  name: '',
  witness_type: 'fact',
  side: 'theirs',
  occupation: '',
  expected_testimony: '',
  prior_statements: '',
  vulnerabilities: '',
});

export default function WitnessPrep() {
  const activeCase = useActiveCase();
  const [form, setForm] = useState<WitnessForm>(blankWitness());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WitnessResult | null>(null);
  const [expanded, setExpanded] = useState<string[]>(['direct', 'cross', 'strategy']);
  const [witnesses, setWitnesses] = useState<{ form: WitnessForm; result: WitnessResult }[]>([]);
  const [activeWitness, setActiveWitness] = useState<number | null>(null);

  const toggle = (k: string) => setExpanded(e => e.includes(k) ? e.filter(x => x !== k) : [...e, k]);

  const generatePrep = async () => {
    if (!form.name || !form.expected_testimony) return;
    setLoading(true);
    setResult(null);

    const prompt = `${rex.systemPrompt}
${activeCase ? `\n${buildCaseContext(activeCase)}\n` : ''}
WITNESS PREP REQUEST:
Witness: ${form.name}
Type: ${form.witness_type} witness
Side: ${form.side === 'ours' ? 'Our witness (direct exam focus)' : 'Opposing witness (cross exam focus)'}
Occupation: ${form.occupation || 'Unknown'}
Expected Testimony: ${form.expected_testimony}
Prior Statements/Depositions: ${form.prior_statements || 'None provided'}
Known Vulnerabilities: ${form.vulnerabilities || 'None identified'}

Generate comprehensive examination preparation. Respond with valid JSON only:
{
  "ai_prep_notes": "strategic overview and key themes to establish or attack",
  "direct_questions": ["question 1", "question 2", ...],
  "cross_questions": ["question 1", "question 2", ...],
  "anticipated_answers": ["anticipated answer to cross Q1", ...],
  "credibility_assessment": "credibility rating 1-10 with explanation",
  "vulnerabilities": ["vulnerability 1", "vulnerability 2", ...],
  "opening_gambit": "the very first question to ask and why",
  "closing_question": "the final question to end on and why",
  "danger_zones": ["topic to avoid", "question that could backfire", ...]
}`;

    const res = await trialCoach({
      messages: [{ role: 'user', content: prompt }],
      config: { role: 'opposing_counsel', mode: 'Witness Prep', difficulty: 'Trial', case_facts: form.expected_testimony }
    });

    if (res.reply) {
      try {
        const match = res.reply.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : { ai_prep_notes: res.reply };
        setResult(parsed);
        setWitnesses(prev => [...prev, { form: { ...form }, result: parsed }]);
        setActiveWitness(witnesses.length);
        if (activeCase) {
          addCaseWitness(activeCase.id, {
            name: form.name,
            side: form.side === 'ours' ? 'ours' : 'opposing',
            expectedTestimony: form.expected_testimony,
            preparedAt: new Date().toISOString(),
          });
          logActivity(activeCase.id, 'rex', 'Prepared witness examination package', `${form.name} (${form.side === 'ours' ? 'direct exam' : 'cross exam'})`, 90);
          completeAgentTask(activeCase.id, 'rex', '/witnesses');
        }
      } catch {
        setResult({ ai_prep_notes: res.reply, direct_questions: [], cross_questions: [], anticipated_answers: [], credibility_assessment: '', vulnerabilities: [], opening_gambit: '', closing_question: '', danger_zones: [] });
      }
    }
    setLoading(false);
  };

  const exportPrepPackage = () => {
    if (!result) return;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Witness Prep — ${form.name}</title>
<style>
body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{font-size:22px;border-bottom:2px solid #1a1a1a;padding-bottom:8px}
h2{font-size:16px;color:#444;margin-top:28px;text-transform:uppercase;letter-spacing:1px}
.meta{color:#666;font-size:13px;margin-bottom:20px}
ol{padding-left:20px}li{margin-bottom:8px}
.badge{display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:12px;margin:2px}
.danger{color:#c00} .strategy{background:#fafafa;padding:16px;border-left:3px solid #333;margin:16px 0}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}
@media print{body{margin:0}}
</style></head><body>
<h1>⚔️ Witness Preparation Package</h1>
<div class="meta">
  <strong>Witness:</strong> ${form.name} · <strong>Type:</strong> ${form.witness_type} · <strong>Side:</strong> ${form.side === 'ours' ? 'Our Witness' : 'Opposing'}
  ${form.occupation ? ` · <strong>Occupation:</strong> ${form.occupation}` : ''}
  <br>Prepared by CaseBuddy AI (Rex) · ${new Date().toLocaleDateString()}
</div>
<div class="strategy"><strong>Strategic Overview:</strong><br>${result.ai_prep_notes || ''}</div>
<p><strong>Credibility Assessment:</strong> ${result.credibility_assessment || 'N/A'}</p>
${result.opening_gambit ? `<h2>🎯 Opening Gambit</h2><p>${result.opening_gambit}</p>` : ''}
<h2>✅ Direct Examination Questions (${result.direct_questions?.length || 0})</h2>
<ol>${(result.direct_questions || []).map((q: string) => `<li>${q}</li>`).join('')}</ol>
<h2>⚡ Cross Examination Questions (${result.cross_questions?.length || 0})</h2>
<ol>${(result.cross_questions || []).map((q: string) => `<li>${q}</li>`).join('')}</ol>
<h2>🎯 Vulnerabilities to Exploit</h2>
<ul>${(result.vulnerabilities || []).map((v: string) => `<li>${v}</li>`).join('')}</ul>
<h2 class="danger">⚠️ Danger Zones — Avoid These</h2>
<ul>${(result.danger_zones || []).map((d: string) => `<li class="danger">${d}</li>`).join('')}</ul>
${result.closing_question ? `<h2>🏁 Closing Question</h2><p>${result.closing_question}</p>` : ''}
<div class="footer">Generated by CaseBuddy AI · casebuddy.live · This is a legal preparation tool, not legal advice.</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) { setTimeout(() => { win.print(); }, 500); }
  };

  const Section = ({ id, title, color, children }: { id: string; title: string; color: string; children: React.ReactNode }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-750 text-left">
        <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
        {expanded.includes(id) ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {expanded.includes(id) && <div className="px-5 pb-5">{children}</div>}
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Witness Preparation</h1>
        <p className="text-slate-400 text-sm">Rex generates direct & cross examination questions, credibility analysis, and trial strategy for every witness</p>
      </div>

      <AgentHeader agent={rex} subtitle="Give me a witness, I'll give you every question you need — and every trap to set." />

      <ActiveCaseBar agentId="rex" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1 space-y-4">
          {/* Witness list */}
          {witnesses.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3">Prepped Witnesses</p>
              <div className="space-y-2">
                {witnesses.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveWitness(i); setResult(w.result); setForm(w.form); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeWitness === i ? 'bg-orange-600/20 border border-orange-500/40 text-orange-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    <span className="font-medium">{w.form.name}</span>
                    <span className="text-xs ml-2 opacity-60">{w.form.side === 'ours' ? 'Direct' : 'Cross'}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setForm(blankWitness()); setResult(null); setActiveWitness(null); }} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white py-1.5 border border-dashed border-slate-600 rounded-lg transition-colors">
                <Plus size={12} /> Add Witness
              </button>
            </div>
          )}

          {/* Input form */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">Witness Details</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Witness Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Type</label>
                <select value={form.witness_type} onChange={e => setForm(f => ({ ...f, witness_type: e.target.value as any }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="fact">Fact</option>
                  <option value="expert">Expert</option>
                  <option value="character">Character</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Side</label>
                <select value={form.side} onChange={e => setForm(f => ({ ...f, side: e.target.value as any }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="ours">Ours</option>
                  <option value="theirs">Opposing</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Occupation / Role</label>
              <input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
                placeholder="e.g. Police Officer, Doctor, Neighbor" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Expected Testimony *</label>
              <textarea value={form.expected_testimony} onChange={e => setForm(f => ({ ...f, expected_testimony: e.target.value }))}
                rows={3} placeholder="What will this witness say? What do you expect them to claim?"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Prior Statements / Deposition</label>
              <textarea value={form.prior_statements} onChange={e => setForm(f => ({ ...f, prior_statements: e.target.value }))}
                rows={2} placeholder="Any prior inconsistent statements, depositions, police reports..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Known Vulnerabilities</label>
              <textarea value={form.vulnerabilities} onChange={e => setForm(f => ({ ...f, vulnerabilities: e.target.value }))}
                rows={2} placeholder="Bias, motive to lie, credibility issues, contradictions..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
            </div>

            <button onClick={generatePrep} disabled={loading || !form.name || !form.expected_testimony}
              className="w-full bg-gradient-to-r from-orange-600 to-red-700 text-white font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : '⚔️ Generate Prep Package'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {!result && !loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">⚔️</div>
              <h3 className="text-white font-semibold mb-2">Ready to prep your witness</h3>
              <p className="text-slate-400 text-sm">Fill in the witness details and Rex will generate a complete examination package — direct questions, cross questions, credibility analysis, and strategy.</p>
            </div>
          )}

          {loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
              <Loader2 size={32} className="animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-white font-medium">Rex is preparing your examination strategy...</p>
              <p className="text-slate-400 text-sm mt-1">Building direct questions, cross questions, and trial tactics</p>
            </div>
          )}

          {result && (
            <>
              {/* Strategy overview */}
              <div className="bg-slate-800 border border-orange-500/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-orange-400 font-semibold text-sm flex-1">⚔️ Rex's Strategic Overview — {form.name}</h3>
                  <button onClick={exportPrepPackage} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0">
                    <Download size={12} /> Export PDF
                  </button>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Credibility:</span>
                    <span className="text-white font-bold">{result.credibility_assessment}</span>
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{result.ai_prep_notes}</p>
              </div>

              {/* Opening & Closing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 border border-green-500/20 rounded-xl p-4">
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">🎯 Opening Gambit</p>
                  <p className="text-slate-300 text-sm">{result.opening_gambit}</p>
                </div>
                <div className="bg-slate-800 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">🏁 Closing Question</p>
                  <p className="text-slate-300 text-sm">{result.closing_question}</p>
                </div>
              </div>

              <Section id="direct" title={`✅ Direct Examination Questions (${result.direct_questions?.length || 0})`} color="text-green-400">
                <ol className="space-y-2 mt-1">
                  {result.direct_questions?.map((q, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-slate-500 font-mono text-xs mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-slate-200">{q}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section id="cross" title={`⚡ Cross Examination Questions (${result.cross_questions?.length || 0})`} color="text-red-400">
                <ol className="space-y-2 mt-1">
                  {result.cross_questions?.map((q, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-slate-500 font-mono text-xs mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-slate-200">{q}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section id="vulnerabilities" title={`🎯 Vulnerabilities to Exploit (${result.vulnerabilities?.length || 0})`} color="text-yellow-400">
                <ul className="space-y-2 mt-1">
                  {result.vulnerabilities?.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-yellow-400 flex-shrink-0">→</span>{v}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section id="danger" title={`⚠️ Danger Zones — Avoid These (${result.danger_zones?.length || 0})`} color="text-red-400">
                <ul className="space-y-2 mt-1">
                  {result.danger_zones?.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-red-400 flex-shrink-0">✕</span>{d}
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
