import React, { useState, useRef, useEffect } from 'react';
import { Scale, Send, Loader2, Mic, CheckCircle, Shield } from 'lucide-react';
import { aiParalegal } from '../lib/api';
import { AGENTS } from '../agents/personas';
import { createCaseFromIntake, stripCaseUpdate } from '../lib/caseStore';
import { useLiveVoice } from '../hooks/useLiveVoice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const maya = AGENTS.maya;

// The shareable client intake link (/start). No app chrome, no login —
// a client opens it, talks to Maya (voice or text), and the finished
// intake lands in the firm's case list automatically.
function parseIntakeSummary(reply: string): any | null {
  const match = reply.match(/<INTAKE_SUMMARY>([\s\S]*?)<\/INTAKE_SUMMARY>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

const cleanReply = (reply: string) =>
  stripCaseUpdate(reply.replace(/<INTAKE_SUMMARY>[\s\S]*?<\/INTAKE_SUMMARY>/g, '')).trim();

export default function PublicIntake() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [submitted, setSubmitted] = useState<{ id: string; client: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendTextRef = useRef<(text: string) => void>(() => {});
  const voice = useLiveVoice({ onUtterance: text => sendTextRef.current(text) });
  const loadingRef = useRef(false);
  const queuedRef = useRef('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const systemPrompt = `${maya.systemPrompt}

CONTEXT: You are speaking directly with a potential CLIENT who opened the firm's intake link — not with an attorney. Use plain language, no legal jargon. Be warm and patient. One question at a time. When you have what you need, give the structured summary and reassure them the legal team will review everything.`;

  const startIntake = async (liveMode: boolean) => {
    setStarted(true);
    setLoading(true);
    if (liveMode) voice.startLive();
    const res = await aiParalegal({ messages: [], agentPersona: systemPrompt });
    if (res.reply) {
      const clean = cleanReply(res.reply);
      setMessages([{ role: 'assistant', content: clean }]);
      voice.speak(clean);
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

    const res = await aiParalegal({ messages: newMessages, agentPersona: systemPrompt });
    if (res.reply) {
      const clean = cleanReply(res.reply);
      setMessages(prev => [...prev, { role: 'assistant', content: clean }]);
      voice.speak(clean);
      const parsed = res.intakeSummary || parseIntakeSummary(res.reply);
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

  const submitCase = () => {
    if (!summary) return;
    voice.stopLive();
    const transcript = messages.map(m => `${m.role === 'user' ? 'Client' : 'Maya'}: ${m.content}`).join('\n');
    const c = createCaseFromIntake(
      { ...summary, summary: summary.summary || transcript.slice(0, 600) },
      'client-link'
    );
    setSubmitted({ id: c.id, client: c.clientName });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Brand bar */}
      <div className="border-b border-slate-800/60 px-5 py-3.5 flex items-center justify-center gap-2">
        <Scale size={18} className="text-violet-400" />
        <span className="font-black text-sm tracking-tight">CaseBuddy <span className="text-violet-400">AI</span></span>
        <span className="text-slate-600 text-xs ml-1">· Secure Client Intake</span>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 flex flex-col">
        {submitted ? (
          /* ===== Confirmation ===== */
          <div className="m-auto text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={36} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-black mb-3">Your case has been submitted</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Thank you{submitted.client !== 'Unnamed Client' ? `, ${submitted.client}` : ''}. Maya has opened your case file
              and briefed the legal team — they'll review everything you shared and follow up with you.
            </p>
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 inline-block">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Case Reference</div>
              <div className="text-violet-300 font-mono font-bold">{submitted.id.toUpperCase()}</div>
            </div>
            <p className="text-slate-600 text-xs mt-8 flex items-center justify-center gap-1.5">
              <Shield size={12} /> Your information is confidential and shared only with the legal team.
            </p>
          </div>
        ) : !started ? (
          /* ===== Welcome ===== */
          <div className="m-auto text-center max-w-md">
            <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${maya.color} flex items-center justify-center text-5xl mx-auto mb-6 shadow-2xl shadow-violet-900/40`}>
              {maya.emoji}
            </div>
            <h1 className="text-3xl font-black mb-2">Hi, I'm Maya</h1>
            <p className={`text-sm font-semibold ${maya.textColor} mb-4`}>Your AI Case Intake Specialist</p>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              I'll listen to what happened, ask a few questions, and get everything to the legal team —
              no forms, no waiting room. You can just <strong className="text-white">talk to me out loud</strong> or type if you prefer.
            </p>
            <div className="space-y-3">
              {voice.supported && (
                <button onClick={() => startIntake(true)}
                  className={`w-full flex items-center justify-center gap-2.5 bg-gradient-to-r ${maya.color} text-white font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-opacity shadow-xl`}>
                  <Mic size={18} /> Tap & Talk to Maya
                </button>
              )}
              <button onClick={() => startIntake(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold py-3.5 rounded-2xl text-sm transition-colors">
                I'd rather type
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-6 flex items-center justify-center gap-1.5">
              <Shield size={12} /> Confidential. Free. Takes about 5 minutes.
            </p>
          </div>
        ) : (
          /* ===== Conversation ===== */
          <>
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${maya.color} flex items-center justify-center text-xs font-bold text-white mr-2 flex-shrink-0 mt-0.5`}>
                      {maya.avatar}
                    </div>
                  )}
                  <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/60'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${maya.color} flex items-center justify-center text-xs font-bold text-white mr-2 flex-shrink-0`}>
                    {maya.avatar}
                  </div>
                  <div className="bg-slate-800 border border-slate-700/60 px-4 py-3.5 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Submit banner once Maya has the summary */}
            {summary && (
              <button onClick={submitCase}
                className="mb-3 w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors shadow-lg">
                <CheckCircle size={16} /> Send My Case to the Legal Team
              </button>
            )}

            {/* Voice status */}
            {voice.live && (
              <div className="flex items-center justify-center gap-2 mb-2">
                {voice.speaking ? (
                  <span className="text-violet-300 text-xs font-medium">Maya is speaking…</span>
                ) : voice.interim ? (
                  <span className="text-slate-300 text-xs italic truncate max-w-full">“{voice.interim}”</span>
                ) : (
                  <span className="text-green-300 text-xs font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Listening — just talk, I'll hear you
                  </span>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              {voice.supported && (
                <button
                  onClick={() => (voice.live ? voice.stopLive() : voice.startLive())}
                  className={`p-3 rounded-xl transition-colors flex-shrink-0 ${
                    voice.live ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title={voice.live ? 'Stop voice mode' : 'Talk instead of typing'}>
                  <Mic size={18} />
                </button>
              )}
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendText(input)}
                placeholder={voice.live ? 'Or type here…' : 'Type your answer…'}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500"
              />
              <button onClick={() => sendText(input)} disabled={loading || !input.trim()}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white p-3 rounded-xl transition-colors flex-shrink-0">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="px-5 py-4 text-center text-slate-600 text-xs border-t border-slate-800/60">
        Powered by CaseBuddy AI · This conversation is not legal advice and does not create an attorney-client relationship until the firm accepts your case.
      </div>
    </div>
  );
}
