/**
 * PublicIntake.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Public-facing client intake page — no login required.
 * URL: /intake/:firmId  (or just /intake for the default firm)
 *
 * Flow:
 *  1. Client opens link → Maya greets them by voice
 *  2. Dynamic questions based on case type selected
 *  3. On completion → intake saved to Supabase intakes table
 *  4. Attorney sees new intake in their dashboard (/app/intake-inbox)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic, MicOff, RadioTower, Radio, Volume2, VolumeX,
  ChevronRight, Loader2, CheckCircle, Scale,
  Send, Shield, Lock, AlertCircle, Zap
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ── Supabase (anon key — read-only for intakes insert) ───────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// ── Case types ────────────────────────────────────────────────────────────────
const CASE_TYPES = [
  { id: 'personal-injury',  label: 'Personal Injury',                icon: '🚗' },
  { id: 'civil-rights',     label: 'Civil Rights',                   icon: '⚖️' },
  { id: 'criminal-defense', label: 'Criminal Defense',               icon: '🔒' },
  { id: 'family-law',       label: 'Family Law / Divorce',           icon: '👨‍👩‍👧' },
  { id: 'employment',       label: 'Employment / Wrongful Termination', icon: '💼' },
  { id: 'contract',         label: 'Contract Dispute',               icon: '📄' },
  { id: 'real-estate',      label: 'Real Estate',                    icon: '🏠' },
  { id: 'other',            label: 'Other / Not Sure',               icon: '❓' },
];

interface Question {
  id: string;
  text: string;
  field: string;
  type: 'text' | 'date' | 'choice' | 'multiline';
  choices?: string[];
}

const BASE_QUESTIONS: Question[] = [
  { id: 'client_name',   field: 'client_name',   type: 'text',      text: "What's your full legal name?" },
  { id: 'client_phone',  field: 'client_phone',  type: 'text',      text: "Best phone number to reach you?" },
  { id: 'client_email',  field: 'client_email',  type: 'text',      text: "Your email address?" },
  { id: 'incident_date', field: 'incident_date', type: 'text',      text: "When did this incident or situation occur? Approximate date is fine." },
  { id: 'summary',       field: 'summary',       type: 'multiline', text: "Tell me in your own words what happened. Take your time — as much detail as you can." },
  { id: 'injuries',      field: 'injuries',      type: 'multiline', text: "Were there any injuries, damages, or losses? Describe them." },
  { id: 'outcome',       field: 'desired_outcome', type: 'multiline', text: "What outcome are you hoping for?" },
  { id: 'urgency',       field: 'urgency',       type: 'choice',    text: "How urgent is this matter?",
    choices: ["There's an upcoming court date or deadline", "Moderately urgent", "No immediate deadline"] },
];

const TYPE_EXTRAS: Record<string, Question[]> = {
  'personal-injury': [
    { id: 'at_fault',  field: 'at_fault',  type: 'text',   text: "Who do you believe was at fault?" },
    { id: 'insurance', field: 'insurance', type: 'choice', text: "Has an insurance claim been filed?",
      choices: ['Not yet', 'Filed — pending', 'Filed — denied', 'Already settled'] },
    { id: 'medical',   field: 'medical',   type: 'multiline', text: "Have you seen a doctor? Which hospitals or providers?" },
  ],
  'civil-rights': [
    { id: 'defendant',      field: 'defendant',      type: 'text',      text: "Who violated your rights — police, agency, official?" },
    { id: 'right_violated', field: 'right_violated', type: 'multiline', text: "Which rights were violated — excessive force, unlawful search, discrimination?" },
    { id: 'documented',     field: 'documented',     type: 'choice',    text: "Is there documentation — video, police reports, medical records?",
      choices: ['Yes — I have it', 'Yes — need to request it', 'Unknown', 'No'] },
  ],
  'criminal-defense': [
    { id: 'charges',    field: 'charges',    type: 'multiline', text: "What charges are you facing?" },
    { id: 'court_date', field: 'court_date', type: 'text',      text: "Do you have a court date? When?" },
    { id: 'detained',   field: 'detained',   type: 'choice',    text: "Are you currently detained?",
      choices: ['No — out free', 'Out on bail/bond', 'Currently detained'] },
  ],
  'family-law': [
    { id: 'children', field: 'children', type: 'choice', text: "Are there minor children involved?",
      choices: ['No', 'Yes — 1 child', 'Yes — 2 or more'] },
    { id: 'assets',   field: 'assets',   type: 'choice', text: "Significant shared assets — property, retirement, business?",
      choices: ['No', 'Some', 'Yes — significant'] },
  ],
  'employment': [
    { id: 'employer',    field: 'employer',    type: 'text',   text: "Who is your employer or former employer?" },
    { id: 'termination', field: 'termination', type: 'choice', text: "Were you terminated or is this ongoing?",
      choices: ['Terminated', 'Resigned under pressure', 'Still employed — hostile environment'] },
  ],
  'contract': [
    { id: 'other_party',     field: 'other_party',     type: 'text',      text: "Who is the other party in this dispute?" },
    { id: 'contract_amount', field: 'contract_amount', type: 'text',      text: "What is the approximate value in dispute?" },
    { id: 'breach',          field: 'breach',          type: 'multiline', text: "How was the contract breached?" },
  ],
  'real-estate': [
    { id: 're_party',   field: 're_party',   type: 'text',      text: "Who is the other party — landlord, tenant, seller?" },
    { id: 're_issue',   field: 're_issue',   type: 'multiline', text: "Core issue — eviction, lease violation, title dispute?" },
  ],
  'other': [
    { id: 'more_detail', field: 'more_detail', type: 'multiline', text: "Can you describe the legal issue in a bit more detail?" },
  ],
};

// ── ElevenLabs / browser TTS ─────────────────────────────────────────────────
const MAYA_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

async function mayaSpeak(text: string, muted: boolean): Promise<void> {
  if (muted) return;
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MAYA_VOICE_ID}/stream`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true },
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      return new Promise(resolve => {
        const a = new Audio(url);
        a.onended = () => { URL.revokeObjectURL(url); resolve(); };
        a.onerror = () => resolve();
        a.play().catch(() => resolve());
      });
    } catch {}
  }
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92; u.pitch = 1.05;
    u.onend = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// ── Gemini: clean up raw speech answer ───────────────────────────────────────
async function cleanAnswer(question: string, raw: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return raw;
  try {
    const prompt = `The client was asked: "${question}"\nThey responded (via voice transcription): "${raw}"\n\nClean up the transcription into a clear, professional 1-3 sentence answer for a legal intake form. Remove filler words. Keep all facts intact. Return plain text only — no JSON, no quotes.`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || raw;
  } catch { return raw; }
}

// ── Wake words ────────────────────────────────────────────────────────────────
const WAKE_WORDS = ['done', 'finished', 'submit', "that's it", 'nothing more', 'next', 'continue', 'move on', 'next question'];
const hasWakeWord = (t: string) => WAKE_WORDS.some(w => t.toLowerCase().includes(w));

type Phase     = 'welcome' | 'select-type' | 'intake' | 'complete';
type VoiceMode = 'push' | 'open';

// ════════════════════════════════════════════════════════════════════════════
const PublicIntake: React.FC = () => {
  const [phase, setPhase]               = useState<Phase>('welcome');
  const [selectedType, setSelectedType] = useState('');
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [qIndex, setQIndex]             = useState(0);
  const [answers, setAnswers]           = useState<Record<string, string>>({});
  const [transcript, setTranscript]     = useState<{ q: string; a: string }[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [interimText, setInterimText]   = useState('');
  const [listening, setListening]       = useState(false);
  const [openMicOn, setOpenMicOn]       = useState(false);
  const [voiceMode, setVoiceMode]       = useState<VoiceMode>('open');
  const [muted, setMuted]               = useState(false);
  const [mayaTalking, setMayaTalking]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [submitError, setSubmitError]   = useState('');

  const recognitionRef = useRef<any>(null);
  const silenceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef     = useRef(false);
  const openMicRef     = useRef(false);
  const bottomRef      = useRef<HTMLDivElement>(null);

  useEffect(() => { loadingRef.current = loading || mayaTalking; }, [loading, mayaTalking]);
  useEffect(() => { openMicRef.current = openMicOn; }, [openMicOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [qIndex, transcript, interimText]);
  useEffect(() => () => { recognitionRef.current?.stop(); if (silenceRef.current) clearTimeout(silenceRef.current); }, []);

  // ── Start intake after type selected ────────────────────────────────────
  const startIntake = useCallback(async (type: string) => {
    const extras = TYPE_EXTRAS[type] || [];
    const all    = [...BASE_QUESTIONS, ...extras];
    setQuestions(all);
    setSelectedType(type);
    setQIndex(0);
    setAnswers({});
    setTranscript([]);
    setPhase('intake');

    const label = CASE_TYPES.find(t => t.id === type)?.label || type;
    const intro = `Thank you for reaching out. I'm Maya, and I'm here to help get your ${label} matter set up with our legal team. Everything you share is completely confidential. Let's begin — ${all[0].text}`;
    setMayaTalking(true);
    await mayaSpeak(intro, muted);
    setMayaTalking(false);
    if (voiceMode === 'open') startOpenMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, voiceMode]);

  // ── Submit an answer ──────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (raw: string) => {
    if (!raw.trim() || loadingRef.current) return;
    stopMic();
    setCurrentInput('');
    setInterimText('');
    setLoading(true);
    loadingRef.current = true;

    const currentQ = questions[qIndex];
    const cleaned  = await cleanAnswer(currentQ.text, raw);
    const newAnswers = { ...answers, [currentQ.field]: cleaned };
    setAnswers(newAnswers);
    setTranscript(prev => [...prev, { q: currentQ.text, a: cleaned }]);

    const nextIndex = qIndex + 1;

    if (nextIndex >= questions.length) {
      // All done — save to Supabase
      setLoading(false);
      loadingRef.current = false;
      await finishIntake(newAnswers, [...transcript, { q: currentQ.text, a: cleaned }]);
      return;
    }

    setQIndex(nextIndex);
    setLoading(false);
    loadingRef.current = false;

    const nextQ = questions[nextIndex];
    setMayaTalking(true);
    await mayaSpeak(nextQ.text, muted);
    setMayaTalking(false);
    if (voiceMode === 'open') startOpenMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, questions, answers, transcript, muted, voiceMode]);

  // ── Finish — save intake to Supabase ─────────────────────────────────────
  const finishIntake = useCallback(async (
    finalAnswers: Record<string, string>,
    finalTranscript: { q: string; a: string }[]
  ) => {
    setMayaTalking(true);
    await mayaSpeak("Perfect. Thank you so much for sharing all of that. Our legal team will review your information and reach out to you shortly. You'll receive a confirmation once everything is on file.", muted);
    setMayaTalking(false);

    try {
      const label = CASE_TYPES.find(t => t.id === selectedType)?.label || selectedType;
      const { error } = await supabase.from('client_intakes').insert({
        case_type:         label,
        answers:           finalAnswers,
        transcript:        finalTranscript,
        client_name:       finalAnswers.client_name || 'Unknown',
        client_email:      finalAnswers.client_email || '',
        client_phone:      finalAnswers.client_phone || '',
        summary:           finalAnswers.summary || '',
        status:            'new',
        submitted_at:      new Date().toISOString(),
      });

      if (error) {
        console.error('Supabase error:', error);
        setSubmitError('Your answers were recorded but could not be saved to our system. Please screenshot this page or contact us directly.');
      }
      setSubmitted(true);
      setPhase('complete');
    } catch (e) {
      setSubmitError('Network error — please contact us directly.');
      setSubmitted(true);
      setPhase('complete');
    }
  }, [muted, selectedType]);

  // ── Open mic ──────────────────────────────────────────────────────────────
  const startOpenMic = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let buffer = '';
    const r    = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';

    r.onresult = (e: any) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final += e.results[i][0].transcript + ' '; buffer += e.results[i][0].transcript + ' '; }
        else interim += e.results[i][0].transcript;
      }
      setInterimText(buffer + interim);
      if (silenceRef.current) clearTimeout(silenceRef.current);
      if (final && hasWakeWord(final)) {
        r.stop();
        const toSend = buffer.replace(/(done|finished|submit|that's it|nothing more|next question|next|continue|move on)/gi, '').trim();
        buffer = '';
        setInterimText('');
        if (toSend && !loadingRef.current) submitAnswer(toSend);
        return;
      }
      silenceRef.current = setTimeout(() => {
        if (buffer.trim() && !loadingRef.current) {
          const toSend = buffer.trim(); buffer = ''; setInterimText('');
          submitAnswer(toSend);
        }
      }, 3000);
    };

    r.onend = () => {
      if (openMicRef.current && !loadingRef.current) {
        setTimeout(() => { try { r.start(); } catch {} }, 400);
      } else {
        setListening(false);
      }
    };
    r.onerror = (e: any) => { if (e.error !== 'no-speech') console.warn(e.error); };

    recognitionRef.current = r;
    r.start();
    setListening(true);
    setOpenMicOn(true);
  }, [submitAnswer]);

  const stopMic = useCallback(() => {
    setOpenMicOn(false);
    openMicRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText('');
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  // ── Push-to-talk ──────────────────────────────────────────────────────────
  const bufferRef = useRef('');

  const startPush = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    bufferRef.current = '';
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) bufferRef.current += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setInterimText(bufferRef.current + interim);
    };
    r.onend = () => {};
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, []);

  const stopPush = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    const captured = bufferRef.current.trim() || interimText.trim();
    setInterimText('');
    bufferRef.current = '';
    if (captured && !loadingRef.current) submitAnswer(captured);
  }, [interimText, submitAnswer]);

  const progress = questions.length ? Math.round((qIndex / questions.length) * 100) : 0;

  // ════════════════════════════════════════════════════════════════════════
  // WELCOME
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Scale size={28} className="text-violet-400" />
            <span className="text-2xl font-bold">CaseBuddy</span>
          </div>

          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-4xl mx-auto mb-6">
            👩‍⚖️
          </div>

          <h1 className="text-2xl font-bold mb-2">Hi, I'm Maya</h1>
          <p className="text-slate-400 mb-6">I'm your AI legal intake specialist. I'll walk you through a few quick questions so our legal team can review your situation and reach out to you.</p>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle size={14} className="text-emerald-400" /> Takes about 3-5 minutes</div>
            <div className="flex items-center gap-2 text-sm text-slate-300"><Lock size={14} className="text-emerald-400" /> Everything you share is confidential</div>
            <div className="flex items-center gap-2 text-sm text-slate-300"><Mic size={14} className="text-emerald-400" /> Speak your answers or type — your choice</div>
            <div className="flex items-center gap-2 text-sm text-slate-300"><Shield size={14} className="text-emerald-400" /> No account needed</div>
          </div>

          {/* Voice mode */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setVoiceMode('open')}
              className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'open' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700'}`}>
              <div className="flex items-center gap-1.5 mb-1"><RadioTower size={13} className="text-emerald-400" /><span className="font-medium text-sm">Open Mic</span></div>
              <div className="text-xs text-slate-400">Just speak — pause to send</div>
            </button>
            <button onClick={() => setVoiceMode('push')}
              className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'push' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700'}`}>
              <div className="flex items-center gap-1.5 mb-1"><Mic size={13} className="text-blue-400" /><span className="font-medium text-sm">Push-to-Talk</span></div>
              <div className="text-xs text-slate-400">Hold to talk, release to send</div>
            </button>
          </div>

          <button onClick={() => setPhase('select-type')}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
            Get Started →
          </button>

          <p className="text-slate-600 text-xs mt-4 flex items-center justify-center gap-1">
            <Lock size={10} /> Secured by CaseBuddy · Attorney-client privilege protected
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SELECT TYPE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'select-type') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center">
        <div className="max-w-lg w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">👩‍⚖️</span>
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-slate-200">What type of legal matter brings you here today?</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mb-6 ml-9">Pick the closest match — we'll figure out the details together</p>
          <div className="grid grid-cols-2 gap-3">
            {CASE_TYPES.map(t => (
              <button key={t.id} onClick={() => startIntake(t.id)}
                className="p-4 bg-slate-900 border border-slate-700 hover:border-violet-500 hover:bg-violet-500/5 rounded-2xl text-left transition-all group">
                <div className="text-2xl mb-2">{t.icon}</div>
                <div className="text-sm font-medium text-slate-200 group-hover:text-white leading-tight">{t.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // INTAKE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'intake') {
    const currentQ = questions[qIndex];

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">

        {/* Top bar */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-violet-400" />
            <span className="text-white text-sm font-semibold">CaseBuddy Intake</span>
            {mayaTalking && <span className="text-xs text-emerald-400 animate-pulse ml-2">Maya speaking…</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setVoiceMode(v => v === 'push' ? 'open' : 'push')}
              className={`p-2 rounded-lg transition-colors ${voiceMode === 'open' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
              {voiceMode === 'open' ? <RadioTower size={15} /> : <Radio size={15} />}
            </button>
            <button onClick={() => setMuted(m => !m)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 border-b border-slate-800">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Question {Math.min(qIndex + 1, questions.length)} of {questions.length}</span>
            <span>{progress}% complete</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Open mic bar */}
        {voiceMode === 'open' && (
          <div className={`px-4 py-2 text-xs flex items-center gap-2 border-b ${openMicOn && !mayaTalking ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${openMicOn && !mayaTalking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {openMicOn && !mayaTalking ? 'Listening — speak your answer, then pause 3 seconds to send' : mayaTalking ? 'Maya speaking…' : 'Tap mic to start listening'}
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transcript.map((t, i) => (
            <React.Fragment key={i}>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0 flex items-center justify-center text-xs">👩‍⚖️</div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-slate-200 text-sm">{t.q}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-violet-600/20 border border-violet-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-slate-200 text-sm">{t.a}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs">👤</div>
              </div>
            </React.Fragment>
          ))}

          {/* Current question */}
          {currentQ && !loading && (
            <div className="flex gap-2">
              <div className={`w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0 flex items-center justify-center text-xs ${mayaTalking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950' : ''}`}>
                👩‍⚖️
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-white text-sm">{currentQ.text}</p>
                {currentQ.type === 'choice' && currentQ.choices && !mayaTalking && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {currentQ.choices.map(c => (
                      <button key={c} onClick={() => submitAnswer(c)}
                        className="text-xs px-3 py-2 bg-slate-700 hover:bg-violet-600 border border-slate-600 hover:border-violet-500 rounded-full text-slate-300 hover:text-white transition-all">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interim speech */}
          {interimText && (
            <div className="flex gap-2 justify-end opacity-75">
              <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                <p className="text-violet-300 text-sm italic">{interimText}</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs">👤</div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm ml-9">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              <span>Processing…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 max-w-xl mx-auto">
            {voiceMode === 'push' ? (
              <button
                onMouseDown={startPush} onMouseUp={stopPush}
                onTouchStart={e => { e.preventDefault(); startPush(); }}
                onTouchEnd={e => { e.preventDefault(); stopPush(); }}
                disabled={mayaTalking || loading}
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all select-none ${listening ? 'bg-red-500 scale-110 ring-4 ring-red-500/20 shadow-lg shadow-red-500/30' : 'bg-slate-700 hover:bg-emerald-600'} text-white disabled:opacity-40`}>
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            ) : (
              <button onClick={openMicOn ? stopMic : startOpenMic}
                disabled={mayaTalking || loading}
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${openMicOn && !mayaTalking ? 'bg-emerald-500 scale-110 ring-4 ring-emerald-500/20 animate-pulse' : 'bg-slate-700 hover:bg-emerald-600'} text-white disabled:opacity-40`}>
                {openMicOn ? <RadioTower size={20} /> : <Radio size={20} />}
              </button>
            )}

            <input
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && currentInput.trim() && submitAnswer(currentInput)}
              disabled={mayaTalking || loading}
              placeholder={listening ? 'Listening…' : openMicOn ? 'Mic active — or type here…' : 'Type your answer here…'}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
            <button onClick={() => currentInput.trim() && submitAnswer(currentInput)}
              disabled={!currentInput.trim() || mayaTalking || loading}
              className="w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center flex-shrink-0 text-white disabled:opacity-40 transition-colors">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-center text-slate-600 text-xs mt-2">
            {voiceMode === 'open' ? 'Pause 3 seconds to send • Say "done" or "next" to move on' : 'Hold mic to speak • Release to send'}
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // COMPLETE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'complete') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-4xl mx-auto mb-6">
            {submitError ? '⚠️' : '✅'}
          </div>

          <h2 className="text-2xl font-bold mb-2">
            {submitError ? 'Almost There' : 'You\'re All Set!'}
          </h2>

          {submitError ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-200 text-sm">{submitError}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 mb-6">Your intake has been submitted. Our legal team will review your information and contact you within 1 business day.</p>
          )}

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6 text-left space-y-3">
            <div className="flex items-start gap-2 text-sm text-slate-300">
              <Zap size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Your information has been securely recorded</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-slate-300">
              <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>An attorney will review your case details</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-slate-300">
              <Shield size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Everything shared remains confidential</span>
            </div>
          </div>

          {answers.client_name && (
            <p className="text-slate-400 text-sm mb-6">
              Thank you, <span className="text-white font-medium">{answers.client_name}</span>. We look forward to speaking with you soon.
            </p>
          )}

          <div className="flex items-center justify-center gap-2 text-slate-600 text-xs">
            <Scale size={12} />
            <span>Powered by CaseBuddy AI</span>
            <Lock size={10} />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PublicIntake;
