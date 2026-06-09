import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { aiParalegal } from '../lib/api';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function IntakePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startIntake = async () => {
    setStarted(true);
    setLoading(true);
    const res = await aiParalegal({ messages: [] });
    if (res.reply) setMessages([{ role: 'assistant', content: res.reply }]);
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    const res = await aiParalegal({ messages: newMessages });
    if (res.reply) setMessages(prev => [...prev, { role: 'assistant', content: res.reply.replace(/<INTAKE_SUMMARY>[\s\S]*?<\/INTAKE_SUMMARY>/, '').trim() }]);
    if (res.intakeSummary) setSummary(res.intakeSummary);
    setLoading(false);
  };

  const urgencyColor: Record<string, string> = { low: 'text-green-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400' };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="text-violet-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">AI Client Intake</h1>
          <p className="text-slate-400 text-sm">Alex, your AI paralegal, will interview the client and build the case file</p>
        </div>
      </div>

      {!started ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto">
            <UserPlus className="text-violet-400" size={32} />
          </div>
          <h2 className="text-xl font-semibold text-white">Start Client Intake</h2>
          <p className="text-slate-400 max-w-md mx-auto">Alex will conduct a comprehensive intake interview, identify claims, flag deadlines, and assess case viability — all automatically.</p>
          <button onClick={startIntake} className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            Begin Intake Interview
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl flex flex-col h-[600px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-slate-300 font-medium">Alex — AI Paralegal</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed
                    ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 rounded-xl px-4 py-3">
                    <Loader2 className="text-violet-400 animate-spin" size={18} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-2">
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type your response..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button onClick={send} disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5 rounded-lg transition-colors">
                <Send size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {summary ? (
              <div className="bg-slate-800 border border-green-500/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-green-400 font-semibold">
                  <CheckCircle size={18} /> Intake Complete
                </div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-slate-400">Client:</span> <span className="text-white">{summary.client_name || '—'}</span></div>
                  <div><span className="text-slate-400">Case Type:</span> <span className="text-white">{summary.case_type || '—'}</span></div>
                  <div><span className="text-slate-400">Viability:</span> <span className="text-white">{summary.case_viability_score}/100</span></div>
                  <div><span className="text-slate-400">Urgency:</span> <span className={urgencyColor[summary.urgency] || 'text-white'}>{summary.urgency}</span></div>
                  {summary.statute_of_limitations_concern && (
                    <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3 mt-2">
                      <div className="flex items-center gap-1 text-red-400 text-xs font-semibold mb-1"><AlertCircle size={14} /> SOL Warning</div>
                      <div className="text-red-200 text-xs">{summary.statute_of_limitations_concern}</div>
                    </div>
                  )}
                  {summary.next_steps?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-slate-400 mb-1">Next Steps:</div>
                      {summary.next_steps.map((s: string, i: number) => (
                        <div key={i} className="text-slate-300 text-xs">• {s}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="text-slate-400 text-sm">Case summary will appear here once the intake interview is complete.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
