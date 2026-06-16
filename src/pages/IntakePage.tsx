import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, CheckCircle, AlertCircle, Mic, MicOff, Briefcase } from 'lucide-react';
import { aiParalegal } from '../lib/api';
import AgentHeader from '../components/AgentHeader';
import { AGENTS, AGENT_LIST, NATURAL_CONVERSATION_DIRECTIVE } from '../agents/personas';
import {
  createCaseFromIntake, useActiveCase, buildCaseContext,
  CASE_UPDATE_DIRECTIVE, ingestAgentReply,
} from '../lib/caseStore';
import { useLiveVoice } from '../hooks/useLiveVoice';
import { track } from '../lib/analytics';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const maya = AGENTS.maya;

// Fallback parser — extracts Maya's <INTAKE_SUMMARY> JSON from the raw reply
// in case the backend doesn't return a parsed intakeSummary field.
function parseIntakeSummary(reply: string): any | null {
  const match = reply.match(/<INTAKE_SUMMARY>([\s\S]*?)<\/INTAKE_SUMMARY>/);
  if (!match) return null;
  try {
    const jsonText = match[1].replace(/```json|```/g, '').trim();
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

export default function IntakePage() {
  const navigate = useNavigate();
  const activeCase = useActiveCase();
  const [updateMode, setUpdateMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Live two-way voice: speak with Maya hands-free — your words auto-send
  // when you pause, and she answers out loud, then keeps listening.
  const sendTextRef = useRef<(text: string) => void>(() => {});
  const voice = useLiveVoice({ onUtterance: text => sendTextRef.current(text), voiceModel: maya.voiceModel });
  // Words spoken while Maya is still thinking get queued, never dropped
  const loadingRef = useRef(false);
  const queuedRef = useRef('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // In update mode Maya works the EXISTING case: she already knows the file,
  // asks what's new, and merges every new fact straight into the case brain.
  // Single source of truth — used both to kick off the conversation and on
  // every turn, so the "don't re-ask" rule and case context never drift apart.
  const buildMayaPrompt = (asUpdate: boolean) => asUpdate && activeCase
    ? `${maya.systemPrompt}

CONTEXT: You are UPDATING an existing case, not starting a new intake. You already know the case file below — do NOT re-ask what you already know. Greet briefly, then ask what's new or changed (new documents, new events, new parties, responses from the other side, anything). Probe for legal significance.
${buildCaseContext(activeCase)}
${NATURAL_CONVERSATION_DIRECTIVE}
${CASE_UPDATE_DIRECTIVE}`
    : `${maya.systemPrompt}
${NATURAL_CONVERSATION_DIRECTIVE}
${CASE_UPDATE_DIRECTIVE}`;

  const systemPrompt = buildMayaPrompt(updateMode);

  const startIntake = async (liveMode = false, asUpdate = false) => {
    setUpdateMode(asUpdate);
    setStarted(true);
    setLoading(true);
    track('intake_started', { live: liveMode, update: asUpdate });
    if (liveMode) voice.startLive();
    const res = await aiParalegal({
      messages: [],
      agentPersona: buildMayaPrompt(asUpdate),
    });
    if (res.reply) {
      const clean = ingestAgentReply(asUpdate ? activeCase?.id : undefined, 'maya', res.reply);
      setMessages([{ role: 'assistant', content: clean }]);
      voice.speak(clean); // no-op unless live mode is on
    }
    setLoading(false);
  };

  const sendText = async (text: string) => {
    if (!text.trim()) return;
    if (loadingRef.current) {
      queuedRef.current = `${queuedRef.current} ${text}`.trim();
      return;
    }
    loadingRef.current = true;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    if (isListening) stopListening();

    const res = await aiParalegal({ messages: newMessages, agentPersona: systemPrompt });
    if (res.reply) {
      // Merge new facts into the case (update mode), strip protocol blocks
      const ingested = ingestAgentReply(updateMode ? activeCase?.id : undefined, 'maya', res.reply);
      const clean = ingested.replace(/<INTAKE_SUMMARY>[\s\S]*?<\/INTAKE_SUMMARY>/, '').trim();
      setMessages(prev => [...prev, { role: 'assistant', content: clean }]);
      voice.speak(clean);
    }
    if (!updateMode) {
      const parsed = res.intakeSummary || (res.reply ? parseIntakeSummary(res.reply) : null);
      if (parsed) setSummary(parsed);
    }
    loadingRef.current = false;
    setLoading(false);
    if (queuedRef.current) {
      setTimeout(() => {
        const q = queuedRef.current;
        queuedRef.current = '';
        if (q) sendTextRef.current(q);
      }, 80);
    }
  };
  sendTextRef.current = sendText;

  const send = () => sendText(input);

  const openCaseFile = () => {
    if (!summary) return;
    const transcript = messages.map(m => `${m.role === 'user' ? 'Client' : 'Maya'}: ${m.content}`).join('\n');
    const c = createCaseFromIntake({
      ...summary,
      summary: summary.summary || transcript.slice(0, 600),
    });
    navigate(`/cases/${c.id}`);
  };

  const toggleVoice = () => {
    if (isListening) { stopListening(); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const urgencyColor: Record<string, string> = {
    low: 'text-green-400', medium: 'text-yellow-400',
    high: 'text-orange-400', critical: 'text-red-400'
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Case Intake</h1>
        <p className="text-slate-400 text-sm">Maya will interview you, identify your claims, flag deadlines, and build your case file</p>
      </div>

      {/* Agent Header */}
      <AgentHeader
        agent={maya}
        subtitle="I'll guide you through a comprehensive intake interview to understand your situation and build your case file."
      />

      {!started ? (
        /* Pre-start screen */
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${maya.color} flex items-center justify-center text-4xl mx-auto mb-5 shadow-xl`}>
            {maya.emoji}
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Meet Maya</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-2">
            I'm Maya, your AI Case Intake Specialist. I'll conduct a comprehensive interview to understand your situation,
            identify your legal claims, flag any urgent deadlines, and assess your case viability — all automatically.
          </p>
          <p className="text-slate-500 text-xs max-w-md mx-auto mb-8">
            Everything you share is confidential and used only to build your case file.
            You can type or use your microphone to speak.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 text-left">
            {[
              { icon: '🎯', label: 'Identify Claims', desc: 'All potential legal theories' },
              { icon: '⏰', label: 'Flag Deadlines', desc: 'SOL and filing windows' },
              { icon: '📊', label: 'Assess Viability', desc: 'Case strength score 1-100' },
              { icon: '📋', label: 'Build Case File', desc: 'Structured summary & next steps' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-slate-700/50 rounded-xl p-3">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-white text-xs font-semibold">{label}</div>
                <div className="text-slate-400 text-xs">{desc}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => startIntake(false)}
              className={`bg-gradient-to-r ${maya.color} text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg text-sm`}
            >
              Begin Intake with Maya →
            </button>
            {voice.supported && (
              <button
                onClick={() => startIntake(true)}
                className="bg-slate-700 hover:bg-slate-600 border border-violet-500/50 text-white font-semibold px-8 py-3 rounded-xl transition-colors shadow-lg text-sm flex items-center gap-2"
              >
                <Mic size={15} className="text-violet-400" /> Talk Live with Maya
              </button>
            )}
          </div>
          {voice.supported && (
            <p className="text-slate-600 text-xs mt-3">
              Live mode is fully hands-free — speak naturally, Maya hears you, answers out loud, and keeps listening.
            </p>
          )}

          {/* Continuous growth: feed new developments into an existing case */}
          {activeCase && (
            <div className="mt-6 pt-5 border-t border-slate-700 max-w-md mx-auto">
              <p className="text-slate-400 text-xs mb-3">
                Or has something new happened in <span className="text-white font-semibold">{activeCase.clientName}</span>'s case?
              </p>
              <button
                onClick={() => startIntake(voice.supported, true)}
                className="w-full bg-slate-700 hover:bg-slate-600 border border-violet-500/40 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
                🔄 Update the Case — Tell Maya What's New
              </button>
              <p className="text-slate-600 text-xs mt-2">
                New facts, parties, claims and deadlines merge into the case file automatically — the whole team sees them instantly.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chat */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl flex flex-col" style={{ height: '600px' }}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
              <AgentHeader agent={maya} compact />
              {updateMode && activeCase && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-600/20 border border-violet-500/40 text-violet-300 font-semibold whitespace-nowrap">
                  Updating: {activeCase.clientName}
                </span>
              )}
              {voice.supported && (
                <button
                  onClick={() => (voice.live ? voice.stopLive() : voice.startLive())}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                    voice.live
                      ? 'bg-red-600/20 border border-red-500/50 text-red-300'
                      : 'bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300'
                  }`}
                  title={voice.live ? 'End live conversation' : 'Start hands-free live conversation'}
                >
                  <span className={`w-2 h-2 rounded-full ${voice.live ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`} />
                  {voice.live ? 'LIVE — tap to end' : 'Go Live'}
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${maya.color} flex items-center justify-center text-xs font-bold text-white mr-2 flex-shrink-0 mt-0.5`}>
                      {maya.avatar}
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${maya.color} flex items-center justify-center text-xs font-bold text-white mr-2 flex-shrink-0`}>
                    {maya.avatar}
                  </div>
                  <div className="bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-700">
              {voice.live && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  {voice.speaking ? (
                    <>
                      <span className="flex gap-0.5 items-end h-3">
                        <span className="w-1 bg-violet-400 rounded-full animate-pulse" style={{ height: '12px' }} />
                        <span className="w-1 bg-violet-400 rounded-full animate-pulse" style={{ height: '7px', animationDelay: '150ms' }} />
                        <span className="w-1 bg-violet-400 rounded-full animate-pulse" style={{ height: '10px', animationDelay: '300ms' }} />
                      </span>
                      <span className="text-violet-300 text-xs font-medium">Maya is speaking…</span>
                    </>
                  ) : voice.interim ? (
                    <span className="text-slate-300 text-xs italic truncate">“{voice.interim}”</span>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-300 text-xs font-medium">Listening — just talk, it sends when you pause</span>
                    </>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={toggleVoice}
                  className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                  title={isListening ? 'Stop listening' : 'Speak your answer'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder={isListening ? 'Listening...' : 'Type your response or use the mic...'}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white p-2.5 rounded-lg transition-colors flex-shrink-0"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Case Summary Panel */}
          <div className="space-y-4">
            {summary ? (
              <div className="bg-slate-800 border border-violet-500/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle size={16} className="text-green-400" />
                  <h3 className="text-white font-semibold text-sm">Intake Complete</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Client</p>
                    <p className="text-white font-medium">{summary.client_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Case Type</p>
                    <p className="text-white font-medium">{summary.case_type || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Viability Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${summary.case_viability_score || 0}%` }} />
                      </div>
                      <span className="text-violet-400 font-bold">{summary.case_viability_score}/100</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Urgency</p>
                    <p className={`font-semibold capitalize ${urgencyColor[summary.urgency] || 'text-white'}`}>{summary.urgency}</p>
                  </div>
                  {summary.statute_of_limitations_concern && (
                    <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertCircle size={13} className="text-red-400" />
                        <p className="text-red-400 text-xs font-semibold">SOL Warning</p>
                      </div>
                      <p className="text-slate-300 text-xs">{summary.statute_of_limitations_concern}</p>
                    </div>
                  )}
                  {summary.next_steps?.length > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Next Steps</p>
                      <ul className="space-y-1.5">
                        {summary.next_steps.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-violet-400 font-bold flex-shrink-0">→</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Hand the client off to the rest of the firm */}
                <div className="mt-5 pt-4 border-t border-slate-700">
                  <button
                    onClick={openCaseFile}
                    className={`w-full bg-gradient-to-r ${maya.color} text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg text-sm flex items-center justify-center gap-2`}>
                    <Briefcase size={16} /> Open Case File & Brief the Team →
                  </button>
                  <div className="flex items-center justify-center gap-1 mt-3">
                    {AGENT_LIST.filter(a => a.id !== 'maya' && a.id !== 'sierra').map(a => (
                      <div key={a.id} title={`${a.name} — ${a.title}`}
                        className={`w-6 h-6 rounded-full bg-gradient-to-br ${a.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                        {a.avatar}
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 text-xs text-center mt-2">
                    Maya will brief Sol, Doc, Lex, Max, Rex & Jules with their assignments automatically
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h3 className="text-slate-400 text-sm font-medium mb-3">Case Summary</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Maya will build your case summary here as the interview progresses. It will include claims identified, viability score, urgency level, and recommended next steps.
                </p>
                <div className="mt-4 space-y-2">
                  {['Client Name', 'Case Type', 'Viability Score', 'Urgency', 'Next Steps'].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                      <span className="text-slate-600 text-xs">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
              <p className="text-slate-400 text-xs font-medium mb-2">💡 Tips for best results</p>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li>• Be as specific as possible with dates</li>
                <li>• Name all parties involved</li>
                <li>• Mention any documents you have</li>
                <li>• Note any prior legal action</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
