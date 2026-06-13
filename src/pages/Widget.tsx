import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Loader2, Scale } from 'lucide-react';
import { aiParalegal } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const ACCENT_BG: Record<string, string> = {
  blue:    'bg-blue-600',
  violet:  'bg-violet-600',
  emerald: 'bg-emerald-600',
  orange:  'bg-orange-600',
  slate:   'bg-slate-700',
};

export default function Widget() {
  const [params] = useSearchParams();
  const firmName    = params.get('firm')     || 'Your Law Firm';
  const color       = params.get('color')    || 'blue';
  const initGreeting = params.get('greeting') || "Hello! I'm your AI Legal Secretary. How can I help you today?";

  const accentBg = ACCENT_BG[color] || ACCENT_BG.blue;

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: initGreeting },
  ]);
  const [input, setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    const history = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const res = await aiParalegal({
      message: userMsg,
      conversation_history: history,
      system_context: `You are a professional AI Legal Secretary for ${firmName}. You are warm, professional, and concise. You help website visitors by answering general legal process questions, collecting initial case information, and directing them to schedule a consultation. You do NOT provide specific legal advice — always encourage speaking with one of the attorneys. Keep responses under 3 sentences when possible.`,
    });

    setMessages(prev => [...prev, {
      role: 'assistant',
      text: res.reply || "I'd be happy to help connect you with our team. Could you tell me a bit more about your situation?",
    }]);
    setSending(false);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* Header */}
      <div className={`${accentBg} px-4 py-3 flex items-center gap-3 shrink-0`}>
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
          <Scale size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate">{firmName}</div>
          <div className="text-white/70 text-xs">AI Legal Secretary</div>
        </div>
        <div className="ml-auto w-2 h-2 bg-green-400 rounded-full shrink-0" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? `${accentBg} text-white`
                : 'bg-slate-800 text-slate-200 border border-slate-700/50'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-3">
              <Loader2 size={14} className="animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className={`${accentBg} disabled:opacity-40 text-white w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity`}
          >
            <Send size={14} />
          </button>
        </div>
        <div className="text-center text-xs text-slate-600 mt-2">
          Powered by{' '}
          <a href="https://casebuddy.live" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 transition-colors">
            CaseBuddy AI
          </a>
        </div>
      </div>
    </div>
  );
}
