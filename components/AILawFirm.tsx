import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX,
  Scale, FileText, Brain, Briefcase, ChevronRight,
  Loader2, CheckCircle, AlertCircle, Star, TrendingUp,
  MessageSquare, User, Sparkles, ArrowRight, X, Send
} from 'lucide-react';
import { toast } from 'react-toastify';

// ── Voice IDs ────────────────────────────────────────────────────────────────
const VOICES = {
  maya:   { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Maya',   role: 'AI Receptionist',  color: 'emerald' },
  lex:    { id: 'cjVigY5qzO86Huf0OWal', name: 'Lex',    role: 'AI Co-Counsel',     color: 'violet'  },
  parker: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Parker', role: 'AI Paralegal',      color: 'blue'    },
  judge:  { id: 'nPczCjzI2devNBz1zQrb', name: 'Judge',  role: 'Trial Judge',       color: 'amber'   },
};

type Agent = keyof typeof VOICES;
type Phase = 'lobby' | 'intake' | 'analyzing' | 'results' | 'handoff';

interface Message {
  id: string;
  role: 'agent' | 'user';
  agent?: Agent;
  text: string;
  ts: number;
}

interface CaseStrength {
  score: number;           // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendedActions: string[];
  estimatedValue?: string;
  winProbability?: string;
}

// ── ElevenLabs TTS ───────────────────────────────────────────────────────────
async function speak(text: string, agent: Agent): Promise<void> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Fallback to browser TTS
    return new Promise((resolve) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;
      utt.pitch = agent === 'maya' ? 1.1 : agent === 'parker' ? 1.05 : 0.9;
      utt.onend = () => resolve();
      window.speechSynthesis.speak(utt);
    });
  }

  const voice = VOICES[agent];
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
      })
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = reject;
      audio.play();
    });
  } catch (e) {
    console.warn('[TTS] ElevenLabs failed, using browser TTS:', e);
    return new Promise((resolve) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.onend = () => resolve();
      window.speechSynthesis.speak(utt);
    });
  }
}

// ── Gemini intake analysis ───────────────────────────────────────────────────
async function analyzeCase(transcript: string): Promise<CaseStrength> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt = `You are a senior trial attorney AI evaluating a potential case from a client intake transcript.

INTAKE TRANSCRIPT:
${transcript}

Analyze this case and respond with ONLY valid JSON (no markdown):
{
  "score": <0-100 integer>,
  "grade": "<A|B|C|D|F>",
  "summary": "<2-3 sentence executive summary of the case>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "recommendedActions": ["<action 1>", "<action 2>", "<action 3>"],
  "estimatedValue": "<dollar range or N/A>",
  "winProbability": "<percentage range>"
}

Score rubric: 90-100=A (exceptional, take immediately), 80-89=B (strong case), 70-79=C (viable with work), 60-69=D (uphill battle), below 60=F (unlikely to succeed).`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

// ── Gemini Maya response ─────────────────────────────────────────────────────
async function getMayaResponse(history: Message[], userInput: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const systemPrompt = `You are Maya, the AI Receptionist at CaseBuddy Law — a cutting-edge AI law firm. You conduct client intake interviews.

Your personality: warm, professional, empathetic, efficient. You make clients feel heard and comfortable.

Your job during intake:
1. Welcome the client warmly
2. Ask for their name
3. Ask them to describe what happened (the incident/legal issue)
4. Ask when it occurred and where
5. Ask about any injuries, damages, or losses
6. Ask if they have any documentation or evidence
7. Ask about any prior legal action or attorneys on the case
8. Let them know you're compiling everything for your legal team

Keep responses concise — 2-3 sentences max. Be conversational, not robotic. 
When you have enough info (at least 4-5 exchanges), say: "Thank you [name], I have everything I need. Let me hand this over to our legal team for review right now."`;

  const contents = [
    ...history.map(m => ({
      role: m.role === 'agent' ? 'model' : 'user',
      parts: [{ text: m.text }]
    })),
    { role: 'user', parts: [{ text: userInput }] }
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, could you repeat that?";
}

// ── Grade colors ─────────────────────────────────────────────────────────────
const gradeColors: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  B: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  C: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  D: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  F: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const agentColors: Record<Agent, string> = {
  maya:   'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  lex:    'bg-violet-500/20 border-violet-500/40 text-violet-300',
  parker: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  judge:  'bg-amber-500/20 border-amber-500/40 text-amber-300',
};

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
const AILawFirm: React.FC = () => {
  const [phase, setPhase]         = useState<Phase>('lobby');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [muted, setMuted]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<CaseStrength | null>(null);
  const [activeAgent, setActiveAgent] = useState<Agent>('maya');
  const [transcript, setTranscript]   = useState('');

  const recognitionRef = useRef<any>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const wasSpeakingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: 'agent' | 'user', text: string, agent?: Agent) => {
    const msg: Message = { id: Date.now().toString(), role, text, agent, ts: Date.now() };
    setMessages(prev => [...prev, msg]);
    setTranscript(prev => prev + (role === 'agent' ? `\nMAYA: ${text}` : `\nCLIENT: ${text}`));
    return msg;
  }, []);

  const agentSay = useCallback(async (text: string, agent: Agent = 'maya') => {
    addMessage('agent', text, agent);
    setActiveAgent(agent);
    if (!muted) {
      setSpeaking(true);
      await speak(text, agent);
      setSpeaking(false);
    }
  }, [addMessage, muted]);

  // ── Start intake ──────────────────────────────────────────────────────────
  const startIntake = useCallback(async () => {
    setPhase('intake');
    setMessages([]);
    setTranscript('');
    await agentSay(
      "Hello! Welcome to CaseBuddy Law. I'm Maya, your intake specialist. I'll gather some information about your situation and connect you with our legal team. First, could you tell me your name?",
      'maya'
    );
  }, [agentSay]);

  // ── Handle user message ───────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');
    addMessage('user', userText);
    setLoading(true);

    try {
      const mayaReply = await getMayaResponse(messages, userText);
      const isHandoff = mayaReply.toLowerCase().includes('hand') || mayaReply.toLowerCase().includes('legal team') || messages.length >= 14;

      await agentSay(mayaReply, 'maya');

      if (isHandoff || messages.length >= 16) {
        // Trigger analysis
        setTimeout(() => runAnalysis(), 1000);
      }
    } catch (e) {
      toast.error('Connection issue — please try again');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, addMessage, agentSay]);

  // ── Run case analysis ─────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setPhase('analyzing');
    await agentSay("One moment while I compile your information for our attorneys...", 'maya');
    
    try {
      const analysis = await analyzeCase(transcript);
      setResult(analysis);

      // Parker (paralegal) speaks first
      await agentSay(
        `I've reviewed your intake, and I've organized all the key facts and documentation needs for our attorneys. Your case has been logged in our system.`,
        'parker'
      );
      
      // Lex (co-counsel) gives the verdict
      const lexOpening = analysis.score >= 80
        ? `This is a ${analysis.grade}-grade case — strong facts, good damages. I'm ready to move forward. ${analysis.summary}`
        : analysis.score >= 65
        ? `This is a viable case with some work to do. ${analysis.summary} I'd like to review the documentation before we commit.`
        : `I want to be transparent with you — this case scores a ${analysis.grade}. ${analysis.summary} Let's discuss realistic expectations.`;

      await agentSay(lexOpening, 'lex');
      setPhase('results');
    } catch (e) {
      toast.error('Analysis failed — please try again');
      setPhase('intake');
    }
  }, [transcript, agentSay]);

  // ── Voice recognition ─────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice not supported in this browser'); return; }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript || '';
      if (text) handleSend(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [handleSend]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // Keep ref in sync so the effect below can call it without circular deps
  startListeningRef.current = startListening;

  // Auto-activate mic after any agent finishes speaking during intake
  useEffect(() => {
    if (wasSpeakingRef.current && !speaking && !loading && phase === 'intake' && !muted) {
      const timer = setTimeout(() => {
        if (!listening) startListeningRef.current();
      }, 500);
      wasSpeakingRef.current = false;
      return () => clearTimeout(timer);
    }
    if (speaking) wasSpeakingRef.current = true;
  }, [speaking, loading, phase, muted, listening]);

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — Lobby
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Scale className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CaseBuddy Law</h1>
            <p className="text-slate-400 text-sm">AI-Powered Legal Firm</p>
          </div>
        </div>

        {/* Agents */}
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {(Object.entries(VOICES) as [Agent, typeof VOICES[Agent]][]).filter(([k]) => k !== 'judge').map(([key, v]) => (
            <div key={key} className={`rounded-xl border p-4 ${agentColors[key]} bg-opacity-10`}>
              <div className="text-lg font-semibold">{v.name}</div>
              <div className="text-xs opacity-70 mt-0.5">{v.role}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={startIntake}
          className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-violet-500/25 transition-all hover:scale-105 active:scale-95"
        >
          <Phone size={22} />
          Start Free Consultation
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-slate-500 text-sm mt-4">Speak or type — Maya will guide you through the intake</p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {['AI Case Analysis', 'Instant Strength Score', 'Voice Enabled', 'Real-Time Strategy'].map(f => (
            <span key={f} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-400 text-xs">{f}</span>
          ))}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — Intake Chat
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'intake' || phase === 'analyzing') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${speaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-white font-medium">
              {VOICES[activeAgent].name} — {VOICES[activeAgent].role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(m => !m)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={() => { setPhase('lobby'); setMessages([]); }} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(m => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border ${
                m.role === 'user' ? 'bg-slate-700 border-slate-600 text-slate-300' :
                m.agent ? `${agentColors[m.agent]} text-current` : 'bg-slate-700 border-slate-600'
              }`}>
                {m.role === 'user' ? <User size={14} /> : m.agent?.[0].toUpperCase()}
              </div>
              {/* Bubble */}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
              }`}>
                {m.role === 'agent' && m.agent && (
                  <div className="text-xs font-semibold mb-1 opacity-60">{VOICES[m.agent].name}</div>
                )}
                {m.text}
              </div>
            </div>
          ))}

          {/* Analyzing overlay */}
          {phase === 'analyzing' && (
            <div className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-2xl">
              <Loader2 size={20} className="animate-spin text-violet-400 flex-shrink-0" />
              <div>
                <div className="text-white text-sm font-medium">Analyzing your case...</div>
                <div className="text-slate-400 text-xs mt-0.5">Parker and Lex are reviewing your intake</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        {phase === 'intake' && (
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <button
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                disabled={loading}
                className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  listening
                    ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110'
                    : 'bg-slate-700 hover:bg-slate-600'
                } text-white disabled:opacity-50`}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={listening ? 'Listening...' : 'Type your response or hold mic to speak...'}
                disabled={loading || listening}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center flex-shrink-0 text-white disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <p className="text-center text-slate-600 text-xs mt-2">Hold mic button to speak • Press Enter or tap send to reply</p>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — Results
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'results' && result) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Scale className="text-violet-400" size={24} />
              <h2 className="text-xl font-bold text-white">Case Assessment</h2>
            </div>
            <button
              onClick={() => setPhase('lobby')}
              className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
            >
              <X size={16} /> Close
            </button>
          </div>

          {/* Score card */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-slate-400 text-sm mb-1">Case Strength Score</div>
                <div className="text-5xl font-black text-white">{result.score}<span className="text-2xl text-slate-500">/100</span></div>
              </div>
              <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-4xl font-black ${gradeColors[result.grade]}`}>
                {result.grade}
              </div>
            </div>
            {/* Score bar */}
            <div className="h-2 bg-slate-800 rounded-full mb-4">
              <div
                className={`h-full rounded-full transition-all ${result.score >= 80 ? 'bg-emerald-500' : result.score >= 65 ? 'bg-blue-500' : result.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${result.score}%` }}
              />
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {result.winProbability && (
                <div className="bg-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 text-xs mb-1">Win Probability</div>
                  <div className="text-white font-bold">{result.winProbability}</div>
                </div>
              )}
              {result.estimatedValue && result.estimatedValue !== 'N/A' && (
                <div className="bg-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 text-xs mb-1">Estimated Value</div>
                  <div className="text-white font-bold">{result.estimatedValue}</div>
                </div>
              )}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-sm">Strengths</span>
              </div>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-red-400 font-semibold text-sm">Challenges</span>
              </div>
              <ul className="space-y-2">
                {result.weaknesses.map((w, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommended Actions */}
          <div className="bg-slate-900 border border-violet-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-violet-400" />
              <span className="text-violet-400 font-semibold text-sm">Recommended Next Steps</span>
            </div>
            <ol className="space-y-2">
              {result.recommendedActions.map((a, i) => (
                <li key={i} className="text-slate-300 text-sm flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                  {a}
                </li>
              ))}
            </ol>
          </div>

          {/* Create Case Button */}
          <button
            onClick={() => {
              const newCase = {
                id: crypto.randomUUID(),
                title: `Case from Intake — ${new Date().toLocaleDateString()}`,
                client: 'New Client',
                status: 'Pre-Trial' as any,
                opposingCounsel: '',
                judge: '',
                nextCourtDate: 'TBD',
                summary: result.summary + '\n\nStrengths: ' + result.strengths.join(', ') + '\n\nChallenges: ' + result.weaknesses.join(', '),
                winProbability: parseInt(result.winProbability?.replace(/[^\d]/g, '') || '50') || 50,
                tags: ['intake'],
                evidence: [],
                tasks: result.recommendedActions.map((a: string, i: number) => ({
                  id: crypto.randomUUID(),
                  caseId: '',
                  title: a,
                  status: 'open' as const,
                  priority: i === 0 ? 'high' as const : 'medium' as const,
                })),
              };
              // Navigate to case manager to create case
              window.localStorage.setItem('pendingIntakeCase', JSON.stringify(newCase));
              window.location.href = '/app/cases';
              toast.success('Case created from intake — redirecting to Case Manager');
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-base transition-all flex items-center justify-center gap-2 mb-4"
          >
            <Briefcase size={20} />
            Create Case from This Intake
          </button>

          {/* Agent handoff buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => window.location.href = '/app/partner'}
              className="flex items-center gap-3 p-4 bg-violet-600/10 border border-violet-500/30 rounded-xl hover:bg-violet-600/20 transition-colors text-left group"
            >
              <Brain size={20} className="text-violet-400 flex-shrink-0" />
              <div>
                <div className="text-white font-medium text-sm">Talk to Lex</div>
                <div className="text-slate-400 text-xs">AI Co-Counsel — strategy & arguments</div>
              </div>
              <ChevronRight size={16} className="text-slate-500 ml-auto group-hover:text-violet-400 transition-colors" />
            </button>
            <button
              onClick={() => window.location.href = '/app/agents'}
              className="flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 transition-colors text-left group"
            >
              <FileText size={20} className="text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-white font-medium text-sm">Send to Parker</div>
                <div className="text-slate-400 text-xs">AI Paralegal — research & documents</div>
              </div>
              <ChevronRight size={16} className="text-slate-500 ml-auto group-hover:text-blue-400 transition-colors" />
            </button>
          </div>

          <button
            onClick={startIntake}
            className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-sm"
          >
            Start New Intake
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AILawFirm;
