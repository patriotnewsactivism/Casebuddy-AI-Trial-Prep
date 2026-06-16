import React, { useState, useRef, useEffect } from 'react';
import { Mic, X, Send, Loader2, Sparkles } from 'lucide-react';
import { aiParalegal } from '../lib/api';
import { useActiveCase, buildCaseContext, CASE_UPDATE_DIRECTIVE, ingestAgentReply } from '../lib/caseStore';
import { AGENTS, NATURAL_CONVERSATION_DIRECTIVE } from '../agents/personas';
import { useLiveVoice } from '../hooks/useLiveVoice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Firm-wide voice assistant, floating on every page. Tap the mic, talk to
// the whole team hands-free — ask anything, dictate new case information,
// and everything it learns is merged straight into the active case file.
export default function CaseAssistant() {
  const activeCase = useActiveCase();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendTextRef = useRef<(text: string) => void>(() => {});
  const voice = useLiveVoice({ onUtterance: text => sendTextRef.current(text), voiceModel: AGENTS.maya.voiceModel });
  const loadingRef = useRef(false);
  const queuedRef = useRef('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const systemPrompt = `You are the CaseBuddy AI firm assistant — the voice of the whole legal team (Maya on intake, Sol on deadlines, Doc on documents, Lex on research, Rex on trial prep, Jules on juries, Max on filing). You answer questions about the case, capture new information the attorney dictates, and suggest which department should act next. Be concise and conversational — your replies are often spoken aloud, so keep them short and clear.
${activeCase ? `\n${buildCaseContext(activeCase)}` : '\nNo case file is currently active.'}
${NATURAL_CONVERSATION_DIRECTIVE}
${CASE_UPDATE_DIRECTIVE}`;

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
      // Merge anything new into the case file, then show/speak the clean reply
      const clean = ingestAgentReply(activeCase?.id, 'maya', res.reply);
      setMessages(prev => [...prev, { role: 'assistant', content: clean }]);
      voice.speak(clean);
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

  const openAndTalk = () => {
    setOpen(true);
    if (voice.supported) voice.startLive();
  };

  const close = () => {
    voice.stopLive();
    setOpen(false);
  };

  return (
    <>
      {/* Floating mic button */}
      {!open && (
        <button
          onClick={openAndTalk}
          title="Talk to your AI legal team"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-2xl shadow-violet-900/50 flex items-center justify-center hover:scale-105 transition-transform">
          <Mic size={22} />
        </button>
      )}

      {/* Assistant panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(24rem,calc(100vw-2.5rem))] bg-slate-900 border border-violet-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: 'min(34rem, 75vh)' }}>
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-bold">Your Legal Team</div>
              <div className="text-slate-400 text-xs truncate">
                {activeCase ? `Working: ${activeCase.clientName} — ${activeCase.caseType}` : 'No active case'}
              </div>
            </div>
            {voice.supported && (
              <button
                onClick={() => (voice.live ? voice.stopLive() : voice.startLive())}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  voice.live ? 'bg-red-600/20 border border-red-500/50 text-red-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${voice.live ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`} />
                {voice.live ? 'LIVE' : 'Voice'}
              </button>
            )}
            <button onClick={close} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-xs mt-10 px-6 leading-relaxed">
                {voice.live
                  ? 'Listening — ask anything, or dictate new case information. “The hospital just sent the records…” “What deadlines are coming up?” “Add a witness named…”'
                  : 'Ask the team anything about your case, or tell them something new — it goes straight into the case file.'}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                  m.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 px-3.5 py-3 rounded-xl rounded-bl-sm">
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Voice status */}
          {voice.live && (
            <div className="px-4 pb-1.5 flex items-center gap-2">
              {voice.speaking ? (
                <span className="text-violet-300 text-xs font-medium">Speaking…</span>
              ) : voice.interim ? (
                <span className="text-slate-300 text-xs italic truncate">“{voice.interim}”</span>
              ) : (
                <span className="text-green-300 text-xs font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Listening…
                </span>
              )}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-slate-700 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendText(input)}
              placeholder={voice.live ? 'Or type…' : 'Ask or dictate…'}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            />
            <button onClick={() => sendText(input)} disabled={loading || !input.trim()}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white p-2 rounded-lg transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
