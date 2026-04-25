import React, { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../App';
import { useAuth } from '../contexts/AuthContext';
import {
  Scale, Mic, Brain, FileText, Users, BarChart2, Gavel, Calculator,
  BookOpen, Send, Loader2, ChevronRight, Sparkles, Shield,
  Briefcase, MessageSquare, ScanLine, Lightbulb, AlertCircle
} from 'lucide-react';
import { Message } from '../types';
import { callGeminiProxy } from '../services/apiProxy';
import { toast } from 'react-toastify';

type PersonaTab = 'cocounsel' | 'paralegal';
type AIStatus = 'idle' | 'thinking' | 'responding';

const STATUS_CONFIG: Record<AIStatus, { label: string; ringClass: string; dotClass: string }> = {
  idle:       { label: 'Standing by',  ringClass: 'ring-slate-600',   dotClass: 'bg-slate-500' },
  thinking:   { label: 'Analyzing…',  ringClass: 'ring-gold-500/60', dotClass: 'bg-gold-500 animate-pulse' },
  responding: { label: 'Responding…', ringClass: 'ring-green-500/50', dotClass: 'bg-green-400 animate-pulse' },
};

const quickActions = [
  { label: 'Trial Simulator',    icon: Mic,         path: '/app/practice',    color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { label: 'Witness Lab',        icon: Users,        path: '/app/witness-lab', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { label: 'Strategy Room',      icon: Brain,        path: '/app/strategy',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { label: 'Draft Document',     icon: FileText,     path: '/app/docs',        color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  { label: 'Mock Jury',          icon: Scale,        path: '/app/mock-jury',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { label: 'DiscoveryLens',      icon: ScanLine,     path: 'https://discovery.casebuddy.live', color: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
];

const suggestedPrompts = [
  'What are the strongest arguments in my case?',
  'Who are the key witnesses I should call?',
  'What legal risks should I be aware of?',
  'Prepare a cross-examination strategy for opposing witnesses.',
  'Summarize the case timeline and key events.',
  'What motions should I file before trial?',
];

const CoCounselAvatar = ({ status }: { status: AIStatus }) => {
  const { ringClass, dotClass } = STATUS_CONFIG[status];
  return (
    <div className={`relative w-10 h-10 rounded-full ring-2 ${ringClass} transition-all duration-300 shrink-0`}>
      <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-slate-700">
        <Scale size={18} className="text-gold-500" />
      </div>
      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${dotClass} transition-colors duration-300`} />
    </div>
  );
};

const AICoCounsel: React.FC = () => {
  const { activeCase } = useContext(AppContext);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<PersonaTab>('cocounsel');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiStatus, setAiStatus] = useState<AIStatus>('idle');
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Greeting on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (hasGreeted) return;
    setHasGreeted(true);
    const caseName = activeCase?.title ? `"${activeCase.title}"` : 'your active case';
    const greeting: Message = {
      id: `greeting-${Date.now()}`,
      sender: 'system',
      text: `Hello${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}. I'm your AI Co-Counsel, ready to assist with ${caseName}. Ask me anything about case strategy, witness examination, motions, or trial preparation. How can I help you today?`,
      timestamp: Date.now(),
    };
    setMessages([greeting]);
  }, []);

  // ── Build system prompt ──────────────────────────────────────────────────────
  const buildSystemPrompt = useCallback((): string => {
    const caseCtx = activeCase
      ? `You are assisting with case: "${activeCase.title}".
Client: ${activeCase.client || 'Unknown'}
Status: ${activeCase.status}
Summary: ${activeCase.summary || 'No summary provided'}
Judge: ${activeCase.judge || 'TBD'}
Opposing Counsel: ${activeCase.opposingCounsel || 'Unknown'}
Next Court Date: ${activeCase.nextCourtDate || 'TBD'}
Win Probability: ${activeCase.winProbability}%
Evidence (${activeCase.evidence?.length || 0} items):
${(activeCase.evidence || []).slice(0, 10).map((e: any, i: number) => `  ${i + 1}. ${e.title || e.fileName || 'Untitled'} — ${e.summary || 'No summary available'}`).join('\n') || '  None uploaded yet'}
Witnesses (${activeCase.witnesses?.length || 0}):
Key Issues: ${activeCase.keyIssues?.join(', ') || 'None listed'}`
      : 'No active case selected. Provide general legal strategy advice.';

    return `You are an expert AI Co-Counsel — a senior trial attorney and legal strategist with deep expertise in criminal defense, civil litigation, and courtroom advocacy. You are professional, confident, and direct, like a trusted law partner.

${caseCtx}

Your role:
- Provide precise, actionable legal strategy and analysis
- Help prepare for trial with specific examination questions, arguments, and motions
- Identify strengths, weaknesses, risks, and opportunities
- Give concrete coaching, never vague advice
- Use proper legal terminology and cite applicable rules or standards when relevant

Keep responses focused and professional. Lead with your most important point. Use bullet points for lists. Never give disclaimers about being an AI — just provide expert legal guidance.`;
  }, [activeCase]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || aiStatus !== 'idle') return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAiStatus('thinking');

    try {
      const history = messages
        .filter(m => m.sender === 'user' || m.sender === 'opponent')
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'model' as const,
          parts: [{ text: m.text }],
        }));

      setAiStatus('responding');
      const result = await callGeminiProxy({
        prompt: trimmed,
        systemPrompt: buildSystemPrompt(),
        model: 'gemini-2.5-flash',
        options: { temperature: 0.7 },
        conversationHistory: history,
      });

      const responseText = result.text || 'I was unable to generate a response. Please try again.';
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'opponent', // reusing 'opponent' as the AI counsel sender
        text: responseText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      toast.error('AI Co-Counsel is unavailable — check your API configuration.');
      console.error('[AICoCounsel]', err);
    } finally {
      setAiStatus('idle');
    }
  }, [messages, aiStatus, buildSystemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const firstName = user?.fullName?.split(' ')[0] || 'Counselor';

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3.5rem)] bg-slate-900">
      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 px-6 py-5">
        {/* Decorative glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/5 via-transparent to-gold-500/5 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-gold-500/30 flex items-center justify-center shadow-lg animate-pulseGold">
              <Scale size={28} className="text-gold-500" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${STATUS_CONFIG[aiStatus].dotClass} transition-colors`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-serif text-white">CaseBuddy AI</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/20 font-medium">Co-Counsel</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {STATUS_CONFIG[aiStatus].label} · {activeCase ? `Working on "${activeCase.title}"` : 'No active case'}
            </p>
          </div>
          {activeCase && (
            <div className="ml-auto hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl">
              <Briefcase size={12} className="text-slate-400" />
              <span className="text-slate-300 font-medium">{activeCase.title}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                activeCase.winProbability >= 65 ? 'bg-green-500/20 text-green-400' :
                activeCase.winProbability >= 40 ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>{activeCase.winProbability}%</span>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="relative mt-4 flex gap-1 bg-slate-800/60 rounded-xl p-1 w-fit border border-slate-700">
          {([['cocounsel', Scale, 'AI Co-Counsel'], ['paralegal', ScanLine, 'AI Paralegal']] as const).map(
            ([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-gold-500 text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      {activeTab === 'cocounsel' ? (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-56 shrink-0 border-r border-slate-800 flex flex-col bg-slate-950 overflow-y-auto hidden lg:flex">
            <div className="p-4 space-y-4">
              {/* AI Status */}
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                <CoCounselAvatar status={aiStatus} />
                <div>
                  <p className="text-xs font-semibold text-white">AI Co-Counsel</p>
                  <p className="text-xs text-slate-500">{STATUS_CONFIG[aiStatus].label}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick Launch</p>
                <div className="space-y-1">
                  {quickActions.map(({ label, icon: Icon, path, color }) => (
                    <Link
                      key={path}
                      to={path}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors group"
                    >
                      <div className={`p-1.5 rounded-lg border ${color}`}>
                        <Icon size={12} />
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-white transition-colors">{label}</span>
                      <ChevronRight size={10} className="ml-auto text-slate-600 group-hover:text-slate-400" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Case Stats */}
              {activeCase && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Case Stats</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Evidence', val: activeCase.evidence?.length || 0, icon: FileText, color: 'text-green-400' },
                      { label: 'Witnesses', val: activeCase.witnesses?.length || 0, icon: Users, color: 'text-purple-400' },
                      { label: 'Tasks', val: activeCase.tasks?.filter(t => t.status !== 'done').length || 0, icon: BarChart2, color: 'text-amber-400' },
                    ].map(({ label, val, icon: Icon, color }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 rounded-lg">
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Icon size={11} className={color} />
                          {label}
                        </span>
                        <span className="text-xs font-semibold text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Scale size={28} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">AI Co-Counsel</p>
                    <p className="text-sm text-slate-500 mt-1">Your AI law partner is ready to assist</p>
                  </div>
                </div>
              )}

              {messages.map(msg => {
                const isUser = msg.sender === 'user';
                const isSystem = msg.sender === 'system';
                return (
                  <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {!isUser && (
                      <CoCounselAvatar status={isSystem ? 'idle' : aiStatus} />
                    )}
                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-white">{firstName.charAt(0)}</span>
                      </div>
                    )}
                    <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`
                        px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                        ${isUser
                          ? 'bg-gold-500/10 border border-gold-500/20 text-white rounded-tr-sm'
                          : isSystem
                            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-200 rounded-tl-sm'
                            : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm'}
                      `}>
                        {msg.text}
                      </div>
                      <span className="text-xs text-slate-600 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {aiStatus === 'thinking' && (
                <div className="flex gap-3">
                  <CoCounselAvatar status="thinking" />
                  <div className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-gold-500" />
                    <span className="text-sm text-slate-400">Analyzing…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts (when empty) */}
            {messages.length <= 1 && aiStatus === 'idle' && (
              <div className="px-4 pb-2">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Lightbulb size={11} /> Suggested questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.slice(0, 3).map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300
                                 hover:border-gold-500/40 hover:text-white transition-all duration-150"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-800 p-4 bg-slate-900">
              {!activeCase && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle size={12} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">
                    No active case — <Link to="/app/cases" className="underline">select one</Link> for context-aware advice
                  </p>
                </div>
              )}
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your AI Co-Counsel anything about your case…"
                  rows={2}
                  disabled={aiStatus !== 'idle'}
                  className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white
                             placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40
                             disabled:opacity-50 transition-all"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || aiStatus !== 'idle'}
                  className="flex items-center justify-center w-11 h-11 rounded-xl bg-gold-500 hover:bg-gold-600
                             disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                             text-slate-900 transition-all duration-200 shrink-0 mb-0.5"
                >
                  {aiStatus !== 'idle'
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Send size={18} />
                  }
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Paralegal Tab ────────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Paralegal header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
              <ScanLine size={18} className="text-gold-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI Paralegal · DiscoveryLens</p>
              <p className="text-xs text-slate-500">Upload case documents — AI will OCR, analyze, and auto-populate your case</p>
            </div>
            {activeCase && (
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <Briefcase size={12} />
                <span>{activeCase.title}</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col items-center justify-center gap-4 p-6">
            <ScanLine size={40} className="text-gold-400 opacity-60" />
            <div className="text-center">
              <p className="text-white font-semibold mb-1">DiscoveryLens is a standalone app</p>
              <p className="text-slate-400 text-sm mb-4">Upload and OCR your case documents, then AI extracts key facts, timeline events, witnesses, and tasks automatically.</p>
              <a
                href="https://discovery.casebuddy.live"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-slate-900 font-bold rounded-lg text-sm transition-all"
              >
                <ScanLine size={15} /> Open DiscoveryLens
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICoCounsel;
