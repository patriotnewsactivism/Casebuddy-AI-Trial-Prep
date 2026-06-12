import React, { useState, useRef, useEffect } from 'react';
import { Swords, Send, Loader2, Settings, Users, BarChart2, Brain, ChevronDown, ChevronUp, Mic, MicOff } from 'lucide-react';
import { trialCoach } from '../lib/api';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { useActiveCase, buildCaseContext, CASE_UPDATE_DIRECTIVE, ingestAgentReply } from '../lib/caseStore';
import { useLiveVoice } from '../hooks/useLiveVoice';

type Tab = 'coach' | 'witness' | 'jury';

interface Message { role: 'user' | 'assistant'; content: string; }

const ROLES = [
  { id: 'opposing_counsel', label: 'Opposing Counsel' },
  { id: 'judge', label: 'Federal Judge' },
  { id: 'hostile_witness', label: 'Hostile Witness' },
  { id: 'friendly_witness', label: 'Friendly Witness' },
  { id: 'expert_witness', label: 'Expert Witness' },
  { id: 'prosecutor', label: 'Prosecutor (AUSA)' },
  { id: 'juror', label: 'Skeptical Juror' },
];

const MODES = ['Cross Examination', 'Direct Examination', 'Opening Statement', 'Closing Argument', 'Voir Dire', 'Motion Argument'];
const DIFFICULTIES = ['Learn', 'Practice', 'Trial'];

interface WitnessForm {
  name: string; witness_type: 'fact' | 'expert' | 'character'; side: 'ours' | 'theirs';
  occupation: string; expected_testimony: string; prior_statements: string; vulnerabilities: string;
}

// Jury profiles
const JURY_PROFILES = [
  { id: 1, name: 'Margaret Chen', age: 52, occupation: 'Retired Teacher', lean: 'plaintiff', traits: ['Empathetic', 'Detail-oriented', 'Values fairness'] },
  { id: 2, name: 'Robert Williams', age: 41, occupation: 'Small Business Owner', lean: 'defense', traits: ['Skeptical of lawsuits', 'Pro-business', 'Practical'] },
  { id: 3, name: 'Desiree Johnson', age: 34, occupation: 'Social Worker', lean: 'plaintiff', traits: ['Community-focused', 'Distrusts authority', 'Emotional'] },
  { id: 4, name: 'Thomas Miller', age: 67, occupation: 'Retired Military', lean: 'neutral', traits: ['Follows rules', 'Respects process', 'Stoic'] },
  { id: 5, name: 'Sarah Davis', age: 28, occupation: 'Software Engineer', lean: 'neutral', traits: ['Analytical', 'Wants data', 'Skeptical'] },
  { id: 6, name: 'Marcus Brown', age: 45, occupation: 'Construction Foreman', lean: 'plaintiff', traits: ['Blue-collar empathy', 'Understands injury', 'Direct'] },
  { id: 7, name: 'Jennifer Park', age: 38, occupation: 'HR Manager', lean: 'defense', traits: ['Policy-oriented', 'Balanced', 'Risk-averse'] },
  { id: 8, name: 'David Garcia', age: 55, occupation: 'Insurance Adjuster', lean: 'defense', traits: ['Understands claims', 'Financially conservative', 'Detail reader'] },
  { id: 9, name: 'Lisa Thompson', age: 31, occupation: 'Nurse', lean: 'plaintiff', traits: ['Medical knowledge', 'Compassionate', 'Understands suffering'] },
  { id: 10, name: 'James Wilson', age: 60, occupation: 'Retired Police', lean: 'neutral', traits: ['Law & order', 'Credibility-focused', 'Experienced'] },
  { id: 11, name: 'Emily Rodriguez', age: 25, occupation: 'Graduate Student', lean: 'plaintiff', traits: ['Idealistic', 'Justice-oriented', 'Impressionable'] },
  { id: 12, name: 'William Anderson', age: 48, occupation: 'Accountant', lean: 'defense', traits: ['Numbers-focused', 'Conservative', 'Follows evidence'] },
];

export default function TrialCenter() {
  const [tab, setTab] = useState<Tab>('coach');

  // === COACH STATE ===
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ role: 'opposing_counsel', mode: 'Cross Examination', difficulty: 'Practice', case_facts: '', witness_profile: '' });
  const [showConfig, setShowConfig] = useState(true);
  const [started, setStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // === WITNESS STATE ===
  const [witnessForm, setWitnessForm] = useState<WitnessForm>({
    name: '', witness_type: 'fact', side: 'theirs', occupation: '',
    expected_testimony: '', prior_statements: '', vulnerabilities: ''
  });
  const [witnessLoading, setWitnessLoading] = useState(false);
  const [witnessResult, setWitnessResult] = useState<any>(null);
  const [expanded, setExpanded] = useState<string[]>(['cross', 'direct']);

  // === JURY STATE ===
  const [caseType, setCaseType] = useState('Civil Rights');
  const [jurySimResult, setJurySimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [caseSummaryJury, setCaseSummaryJury] = useState('');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Pull the active case file into the coaching session so Rex knows the case
  const activeCase = useActiveCase();
  useEffect(() => {
    if (!activeCase) return;
    const facts = `${buildCaseContext(activeCase)}\n${CASE_UPDATE_DIRECTIVE}`;
    setConfig(c => c.case_facts ? c : { ...c, case_facts: facts });
    setCaseSummaryJury(prev => prev || activeCase.summary || facts);
    if (activeCase.caseType) setCaseType(activeCase.caseType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id]);

  // Voice recognition
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const startCoach = () => { setShowConfig(false); setStarted(true); setMessages([]); };

  // Live two-way courtroom sparring — speak, Rex objects out loud, keeps listening
  const sendCoachRef = useRef<(text: string) => void>(() => {});
  const liveVoice = useLiveVoice({ onUtterance: text => sendCoachRef.current(text) });

  const sendCoachText = async (text: string) => {
    if (!text.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages); setInput(''); setLoading(true);
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    const res = await trialCoach({ messages: newMessages, config });
    if (res.reply) {
      // Anything new Rex surfaces mid-sparring gets merged into the case file
      const clean = ingestAgentReply(activeCase?.id, 'rex', res.reply);
      setMessages(prev => [...prev, { role: 'assistant', content: clean }]);
      liveVoice.speak(clean);
    }
    setLoading(false);
  };
  sendCoachRef.current = sendCoachText;
  const sendCoach = () => sendCoachText(input);

  // Witness
  const toggle = (k: string) => setExpanded(e => e.includes(k) ? e.filter(x => x !== k) : [...e, k]);
  const generateWitness = async () => {
    if (!witnessForm.name || !witnessForm.expected_testimony) return;
    setWitnessLoading(true); setWitnessResult(null);
    const prompt = `You are a senior trial attorney preparing witness examination questions.
WITNESS: ${witnessForm.name} | TYPE: ${witnessForm.witness_type} | SIDE: ${witnessForm.side === 'ours' ? 'Our witness' : 'Opposing'}
OCCUPATION: ${witnessForm.occupation}
TESTIMONY: ${witnessForm.expected_testimony}
PRIOR STATEMENTS: ${witnessForm.prior_statements || 'None'}
VULNERABILITIES: ${witnessForm.vulnerabilities || 'None'}
Respond JSON: {"ai_prep_notes":"overview","direct_questions":["Q"],"cross_questions":["Q"],"anticipated_answers":["A"],"credibility_assessment":"1-10","vulnerabilities":["v"],"opening_gambit":"first Q","closing_question":"last Q","danger_zones":["avoid"]}`;
    const res = await trialCoach({ messages: [{ role: 'user', content: prompt }], config: { role: 'opposing_counsel', mode: 'Witness Prep', difficulty: 'Practice', case_facts: witnessForm.expected_testimony } });
    if (res.reply) { try { const m = res.reply.match(/\{[\s\S]*\}/); setWitnessResult(m ? JSON.parse(m[0]) : { ai_prep_notes: res.reply }); } catch { setWitnessResult({ ai_prep_notes: res.reply }); } }
    setWitnessLoading(false);
  };

  // Jury sim
  const simulateJury = async () => {
    setSimulating(true); setJurySimResult(null);
    await new Promise(r => setTimeout(r, 2000));
    const results = JURY_PROFILES.map(j => {
      const base = j.lean === 'plaintiff' ? 65 : j.lean === 'defense' ? 35 : 50;
      const variance = Math.random() * 30 - 15;
      return { ...j, plaintiff_pct: Math.min(95, Math.max(5, Math.round(base + variance))), verdict: base + variance > 50 ? 'plaintiff' : 'defense' };
    });
    const forPlaintiff = results.filter(r => r.verdict === 'plaintiff').length;
    setJurySimResult({ jurors: results, forPlaintiff, forDefense: 12 - forPlaintiff, verdict: forPlaintiff >= 7 ? 'PLAINTIFF WINS' : forPlaintiff <= 5 ? 'DEFENSE WINS' : 'HUNG JURY' });
    setSimulating(false);
  };

  const diffColor: Record<string, string> = { Learn: 'bg-green-600', Practice: 'bg-yellow-600', Trial: 'bg-red-600' };
  const Section = ({ id, title, color, children }: any) => (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-750">
        <div className={`font-semibold text-sm ${color}`}>{title}</div>
        {expanded.includes(id) ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {expanded.includes(id) && <div className="px-5 pb-4">{children}</div>}
    </div>
  );

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'coach', label: 'Trial Coach', icon: Swords },
    { id: 'witness', label: 'Witness Prep', icon: Users },
    { id: 'jury', label: 'Jury Simulator', icon: BarChart2 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Swords className="text-orange-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Trial Command Center</h1>
          <p className="text-slate-400 text-sm">Voice-activated coaching, witness prep, and jury simulation</p>
        </div>
      </div>

      <ActiveCaseBar agentId="rex" />

      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== COACH TAB ===== */}
      {tab === 'coach' && (
        <>
          {showConfig && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
              <div className="text-white font-semibold">Session Configuration</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">AI Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => (
                      <button key={r.id} onClick={() => setConfig(c => ({ ...c, role: r.id }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                          config.role === r.id ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Mode</label>
                    <select value={config.mode} onChange={e => setConfig(c => ({ ...c, mode: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                      {MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Difficulty</label>
                    <div className="flex gap-2">
                      {DIFFICULTIES.map(d => (
                        <button key={d} onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            config.difficulty === d ? diffColor[d] + ' text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Case Facts</label>
                    <textarea value={config.case_facts} onChange={e => setConfig(c => ({ ...c, case_facts: e.target.value }))} rows={3} placeholder="Brief case summary..."
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none" />
                  </div>
                </div>
              </div>
              <button onClick={startCoach} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
                <Swords size={18} /> Begin Simulation
              </button>
            </div>
          )}
          {started && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl flex flex-col h-[600px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                  <span className="text-sm text-slate-300 font-medium">{ROLES.find(r => r.id === config.role)?.label} — {config.mode}</span>
                </div>
                <div className="flex items-center gap-2">
                  {liveVoice.supported && (
                    <button
                      onClick={() => (liveVoice.live ? liveVoice.stopLive() : liveVoice.startLive())}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        liveVoice.live ? 'bg-red-600/20 border border-red-500/50 text-red-300' : 'bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${liveVoice.live ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`} />
                      {liveVoice.live ? 'LIVE' : 'Go Live'}
                    </button>
                  )}
                  <span className={`text-xs px-2 py-1 rounded font-medium ${diffColor[config.difficulty]} text-white`}>{config.difficulty}</span>
                  <button onClick={() => { setShowConfig(true); setStarted(false); }} className="text-slate-400 hover:text-white"><Settings size={16} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && <div className="text-center text-slate-500 mt-8"><Swords className="mx-auto mb-3 opacity-30" size={40} /><div>Session ready. Speak or type your first question.</div></div>}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                      <div className="text-xs opacity-60 mb-1">{m.role === 'user' ? 'You (Attorney)' : ROLES.find(r => r.id === config.role)?.label}</div>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && <div className="flex justify-start"><div className="bg-slate-700 rounded-xl px-4 py-3"><Loader2 className="text-orange-400 animate-spin" size={18} /></div></div>}
                <div ref={bottomRef} />
              </div>
              {liveVoice.live && (
                <div className="px-4 pt-2 flex items-center gap-2">
                  {liveVoice.speaking ? (
                    <span className="text-orange-300 text-xs font-medium">⚔️ Speaking…</span>
                  ) : liveVoice.interim ? (
                    <span className="text-slate-300 text-xs italic truncate">“{liveVoice.interim}”</span>
                  ) : (
                    <span className="text-green-300 text-xs font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Listening — speak, it sends when you pause
                    </span>
                  )}
                </div>
              )}
              <div className="p-4 border-t border-slate-700 flex gap-2">
                <button onClick={toggleVoice}
                  className={`p-2.5 rounded-lg transition-colors ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCoach()} placeholder={isListening ? 'Listening...' : 'Speak or type your question...'}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <button onClick={sendCoach} disabled={loading || !input.trim()} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white p-2.5 rounded-lg"><Send size={18} /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== WITNESS TAB ===== */}
      {tab === 'witness' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400 block mb-1">Witness Name</label><input value={witnessForm.name} onChange={e => setWitnessForm(f => ({...f, name: e.target.value}))} placeholder="Full name" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
              <div><label className="text-xs text-slate-400 block mb-1">Occupation</label><input value={witnessForm.occupation} onChange={e => setWitnessForm(f => ({...f, occupation: e.target.value}))} placeholder="Job title" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400 block mb-1">Type</label><select value={witnessForm.witness_type} onChange={e => setWitnessForm(f => ({...f, witness_type: e.target.value as any}))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"><option value="fact">Fact Witness</option><option value="expert">Expert Witness</option><option value="character">Character Witness</option></select></div>
              <div><label className="text-xs text-slate-400 block mb-1">Side</label><select value={witnessForm.side} onChange={e => setWitnessForm(f => ({...f, side: e.target.value as any}))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"><option value="ours">Our Witness</option><option value="theirs">Their Witness</option></select></div>
            </div>
            <div><label className="text-xs text-slate-400 block mb-1">Expected Testimony</label><textarea value={witnessForm.expected_testimony} onChange={e => setWitnessForm(f => ({...f, expected_testimony: e.target.value}))} rows={4} placeholder="What will this witness say?" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Prior Statements</label><textarea value={witnessForm.prior_statements} onChange={e => setWitnessForm(f => ({...f, prior_statements: e.target.value}))} rows={2} placeholder="Deposition excerpts, inconsistencies..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Vulnerabilities</label><textarea value={witnessForm.vulnerabilities} onChange={e => setWitnessForm(f => ({...f, vulnerabilities: e.target.value}))} rows={2} placeholder="Bias, prior convictions..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" /></div>
            <button onClick={generateWitness} disabled={witnessLoading || !witnessForm.name || !witnessForm.expected_testimony}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
              {witnessLoading ? <><Loader2 className="animate-spin" size={18} />Generating...</> : <><Brain size={18} />Generate Witness Prep</>}
            </button>
          </div>
          <div className="space-y-3">
            {!witnessResult && !witnessLoading && <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center text-slate-500"><Users className="mx-auto mb-3 opacity-30" size={40} /><div>Fill in witness details</div></div>}
            {witnessResult && (
              <>
                {witnessResult.ai_prep_notes && <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-4"><div className="text-cyan-400 font-semibold text-sm mb-2">Strategic Overview</div><div className="text-slate-300 text-sm leading-relaxed">{witnessResult.ai_prep_notes}</div></div>}
                {witnessResult.opening_gambit && <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-4"><div className="text-yellow-400 font-semibold text-sm mb-1">⚡ Opening Gambit</div><div className="text-white text-sm">"{witnessResult.opening_gambit}"</div></div>}
                <Section id="cross" title={`Cross Exam (${witnessResult.cross_questions?.length || 0})`} color="text-red-400">
                  {witnessResult.cross_questions?.map((q: string, i: number) => <div key={i} className="py-2 border-b border-slate-700 last:border-0"><div className="text-white text-sm">{i+1}. {q}</div></div>)}
                </Section>
                <Section id="direct" title={`Direct Exam (${witnessResult.direct_questions?.length || 0})`} color="text-green-400">
                  {witnessResult.direct_questions?.map((q: string, i: number) => <div key={i} className="py-2 border-b border-slate-700 last:border-0"><div className="text-white text-sm">{i+1}. {q}</div></div>)}
                </Section>
                {witnessResult.danger_zones?.length > 0 && <Section id="danger" title="⚠️ Danger Zones" color="text-red-400">{witnessResult.danger_zones.map((d: string, i: number) => <div key={i} className="text-red-300 text-sm py-1">• {d}</div>)}</Section>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== JURY TAB ===== */}
      {tab === 'jury' && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Case Type</label>
                <select value={caseType} onChange={e => setCaseType(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  {['Civil Rights', 'Personal Injury', 'Police Misconduct', 'Employment', 'Medical Malpractice', 'Contract Dispute', 'Criminal Defense'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Case Summary</label>
                <input value={caseSummaryJury} onChange={e => setCaseSummaryJury(e.target.value)} placeholder="Brief summary..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={simulateJury} disabled={simulating} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                  {simulating ? <><Loader2 className="animate-spin" size={16} /> Simulating...</> : <><BarChart2 size={16} /> Run Simulation</>}
                </button>
              </div>
            </div>
          </div>
          {jurySimResult && (
            <>
              <div className={`rounded-2xl p-6 text-center border-2 ${jurySimResult.verdict === 'PLAINTIFF WINS' ? 'bg-green-500/10 border-green-500/40' : jurySimResult.verdict === 'DEFENSE WINS' ? 'bg-red-500/10 border-red-500/40' : 'bg-yellow-500/10 border-yellow-500/40'}`}>
                <div className="text-3xl font-bold text-white mb-2">{jurySimResult.verdict}</div>
                <div className="text-slate-400">{jurySimResult.forPlaintiff} for Plaintiff · {jurySimResult.forDefense} for Defense</div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {jurySimResult.jurors.map((j: any) => (
                  <div key={j.id} className={`bg-slate-800 border rounded-xl p-4 ${j.verdict === 'plaintiff' ? 'border-green-500/30' : 'border-red-500/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-medium text-sm">{j.name}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${j.verdict === 'plaintiff' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{j.plaintiff_pct}% P</span>
                    </div>
                    <div className="text-slate-500 text-xs">{j.occupation}, age {j.age}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {j.traits.map((t: string, i: number) => <span key={i} className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!jurySimResult && !simulating && <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500"><BarChart2 className="mx-auto mb-3 opacity-30" size={48} /><div>Configure and run a jury simulation</div></div>}
        </div>
      )}
    </div>
  );
}

