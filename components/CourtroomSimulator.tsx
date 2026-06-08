import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../App';
import {
  Gavel, Mic, MicOff, Volume2, VolumeX, Play, Square,
  RotateCcw, ChevronRight, Loader2, AlertTriangle,
  CheckCircle, Scale, Brain,
  TrendingUp, Award, Zap, X, Radio, RadioTower
} from 'lucide-react';
import { toast } from 'react-toastify';

// ── Voice config ─────────────────────────────────────────────────────────────
const VOICES = {
  judge:    { id: 'nPczCjzI2devNBz1zQrb', name: 'Judge',            color: 'amber'  },
  opposing: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Opposing Counsel', color: 'red'    },
  witness:  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'Witness',          color: 'blue'   },
  coach:    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'AI Coach',         color: 'violet' },
};

type Speaker   = keyof typeof VOICES;
type Phase     = 'setup' | 'trial' | 'results';
type TrialMode = 'opening' | 'examination' | 'cross' | 'closing' | 'full';
type VoiceMode = 'push' | 'open'; // push-to-talk | always-on open mic

// Wake words that trigger submission in open-mic mode
const WAKE_WORDS = [
  'submit', 'send', 'done', 'finished', 'over', 'go ahead',
  'objection', 'your honor', 'counsel', 'no further questions',
  'nothing further', 'i rest', 'i yield', 'proceed'
];

interface Message {
  id: string;
  speaker: Speaker | 'attorney';
  text: string;
  ts: number;
  coaching?: string;
}

interface PerformanceScore {
  overall: number;
  categories: { label: string; score: number; feedback: string }[];
  strengths: string[];
  weaknesses: string[];
  verdict: string;
  recommendation: string;
}

// ── ElevenLabs TTS ───────────────────────────────────────────────────────────
async function speak(text: string, speaker: Speaker, muted: boolean): Promise<void> {
  if (muted) return;
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const voice  = VOICES[speaker];

  if (apiKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/stream`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: speaker === 'judge' ? 0.8 : 0.5,
            similarity_boost: 0.75,
            style: speaker === 'opposing' ? 0.6 : 0.3,
            use_speaker_boost: true,
          },
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = reject;
        audio.play();
      });
    } catch { /* fall through to browser TTS */ }
  }
  return new Promise(resolve => {
    const utt   = new SpeechSynthesisUtterance(text);
    utt.rate    = speaker === 'judge' ? 0.85 : 0.92;
    utt.pitch   = speaker === 'judge' ? 0.7 : speaker === 'opposing' ? 1.1 : 1.0;
    utt.onend   = () => resolve();
    window.speechSynthesis.speak(utt);
  });
}

// ── Gemini: courtroom response ───────────────────────────────────────────────
async function getCourtResponse(
  speaker: Speaker,
  history: Message[],
  attorneyStatement: string,
  caseContext: string,
  mode: TrialMode,
): Promise<{ text: string; coaching: string }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const personas: Record<Speaker, string> = {
    judge:    `You are a federal district court judge — strict, fair, procedurally rigorous. Rule on objections instantly, cut off rambling, demand precision. Keep responses under 3 sentences unless ruling on a major motion.`,
    opposing: `You are aggressive opposing counsel — sharp, tactical, always looking for weaknesses. Object frequently, challenge credibility, exploit procedural missteps. Keep responses concise and combative.`,
    witness:  `You are a witness on the stand. Respond based on the case context. Be realistic — sometimes evasive, sometimes forthcoming, react naturally to the questioning style.`,
    coach:    `You are a master trial attorney coaching after the attorney's statement. Give sharp, specific feedback in 1-2 sentences. Focus on what they should do NEXT and any immediate tactical improvement.`,
  };

  const history_text = history.slice(-8).map(m =>
    `${m.speaker === 'attorney' ? 'ATTORNEY' : VOICES[m.speaker as Speaker]?.name || m.speaker}: ${m.text}`
  ).join('\n');

  const prompt = `${personas[speaker]}

CASE CONTEXT: ${caseContext}
TRIAL MODE: ${mode}
RECENT EXCHANGE:
${history_text}

ATTORNEY JUST SAID: "${attorneyStatement}"

${speaker === 'coach' ? 'Provide coaching feedback on what the attorney just said.' : 'Respond in character.'}

Respond in JSON: {"text": "<your response>", "coaching": "<1 tactical tip for the attorney right now>"}`;

  const res  = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) },
  );
  const data  = await res.json();
  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(clean); }
  catch { return { text: raw.substring(0, 200), coaching: '' }; }
}

// ── Gemini: performance score ────────────────────────────────────────────────
async function scorePerformance(history: Message[], caseContext: string, mode: TrialMode): Promise<PerformanceScore> {
  const apiKey    = import.meta.env.VITE_GEMINI_API_KEY;
  const transcript = history.map(m =>
    `${m.speaker === 'attorney' ? 'ATTORNEY' : (VOICES[m.speaker as Speaker]?.name || m.speaker)}: ${m.text}`
  ).join('\n');

  const prompt = `You are a master trial advocacy coach scoring an attorney's courtroom performance.

CASE: ${caseContext}
MODE: ${mode}
TRANSCRIPT:
${transcript}

Score in VALID JSON only:
{
  "overall": <0-100>,
  "categories": [
    {"label": "Argument Quality",       "score": <0-100>, "feedback": "<specific>"},
    {"label": "Objection Handling",     "score": <0-100>, "feedback": "<specific>"},
    {"label": "Witness Control",        "score": <0-100>, "feedback": "<specific>"},
    {"label": "Persuasiveness",         "score": <0-100>, "feedback": "<specific>"},
    {"label": "Procedural Precision",   "score": <0-100>, "feedback": "<specific>"}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "verdict": "<likely win/loss if real and why — 1 sentence>",
  "recommendation": "<single most important thing to work on>"
}`;

  const res  = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) },
  );
  const data  = await res.json();
  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const speakerColors: Record<string, string> = {
  judge:    'border-amber-500/40 bg-amber-500/5',
  opposing: 'border-red-500/40 bg-red-500/5',
  witness:  'border-blue-500/40 bg-blue-500/5',
  coach:    'border-violet-500/40 bg-violet-500/10',
  attorney: 'border-emerald-500/40 bg-emerald-500/5',
};
const speakerLabel: Record<string, string> = {
  judge:    'text-amber-400',
  opposing: 'text-red-400',
  witness:  'text-blue-400',
  coach:    'text-violet-400',
  attorney: 'text-emerald-400',
};

function containsWakeWord(text: string): boolean {
  const lower = text.toLowerCase();
  return WAKE_WORDS.some(w => lower.includes(w));
}

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
const CourtroomSimulator: React.FC = () => {
  const { activeCase } = useContext(AppContext) as any;

  const [phase, setPhase]               = useState<Phase>('setup');
  const [mode, setMode]                 = useState<TrialMode>('full');
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState('');
  const [listening, setListening]       = useState(false);
  const [aiSpeaking, setAiSpeaking]     = useState<Speaker | null>(null);
  const [muted, setMuted]               = useState(false);
  const [loading, setLoading]           = useState(false);
  const [scores, setScores]             = useState<PerformanceScore | null>(null);
  const [showCoach, setShowCoach]       = useState(true);
  const [voiceMode, setVoiceMode]       = useState<VoiceMode>('push');
  const [openMicOn, setOpenMicOn]       = useState(false);
  const [interimText, setInterimText]   = useState('');
  const [silenceTimer, setSilenceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [judgeName, setJudgeName]       = useState(activeCase?.judge || 'Hon. Sarah Mitchell');
  const [opponentName, setOpponentName] = useState(activeCase?.opposingCounsel || 'opposing counsel');

  const recognitionRef  = useRef<any>(null);
  const bottomRef       = useRef<HTMLDivElement>(null);
  const loadingRef      = useRef(false);   // avoid stale closure in recognition handler
  const silenceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, interimText]);

  // Clean up on unmount
  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  const caseContext = activeCase
    ? `Case: ${activeCase.title} | Client: ${activeCase.client} | Judge: ${judgeName} | Opposing: ${opponentName} | Summary: ${activeCase.summary}`
    : `Civil rights case. Judge: ${judgeName}. Opposing: ${opponentName}.`;

  const addMsg = useCallback((speaker: Speaker | 'attorney', text: string, coaching?: string): Message => {
    const msg: Message = { id: Date.now().toString() + Math.random(), speaker, text, ts: Date.now(), coaching };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  // ── Handle attorney statement ─────────────────────────────────────────────
  const handleAttorneyStatement = useCallback(async (text: string) => {
    const statement = text.trim();
    if (!statement || loadingRef.current) return;
    setInput('');
    setInterimText('');
    addMsg('attorney', statement);
    loadingRef.current = true;
    setLoading(true);

    try {
      const speakers: Speaker[] = (mode === 'examination' || mode === 'cross')
        ? ['witness', 'opposing', 'judge']
        : ['judge', 'opposing'];
      const primary = speakers[Math.floor(Math.random() * Math.min(2, speakers.length))];

      const { text: responseText, coaching } = await getCourtResponse(
        primary, messages, statement, caseContext, mode,
      );

      addMsg(primary, responseText, showCoach ? coaching : undefined);
      setAiSpeaking(primary);
      await speak(responseText, primary, muted);
      setAiSpeaking(null);

      // Opposing objects ~30% of the time
      if ((mode === 'full' || mode === 'examination') && Math.random() < 0.3 && primary !== 'opposing') {
        const { text: objText } = await getCourtResponse('opposing', messages, statement, caseContext, mode);
        addMsg('opposing', objText);
        setAiSpeaking('opposing');
        await speak(objText, 'opposing', muted);
        setAiSpeaking(null);
      }
    } catch {
      toast.error('Response failed — check API connection');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [addMsg, caseContext, messages, mode, muted, showCoach]);

  // ── PUSH-TO-TALK ──────────────────────────────────────────────────────────
  const startPushListen = useCallback(() => {
    if (voiceMode !== 'push') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported in this browser'); return; }
    const r = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = 'en-US';
    let finalText     = '';

    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setInterimText(finalText + interim);
    };
    r.onend   = () => {};
    r.onerror = () => setListening(false);

    recognitionRef.current = r;
    r.start();
    setListening(true);
    finalText = '';
    setInterimText('');
  }, [voiceMode]);

  const stopPushListen = useCallback(() => {
    if (voiceMode !== 'push') return;
    recognitionRef.current?.stop();
    setListening(false);
    // Submit whatever was captured
    const captured = interimText.trim();
    if (captured) handleAttorneyStatement(captured);
    setInterimText('');
  }, [voiceMode, interimText, handleAttorneyStatement]);

  // ── OPEN MIC ──────────────────────────────────────────────────────────────
  const startOpenMic = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported in this browser'); return; }

    let buffer = '';
    let lastResult = Date.now();

    const r = new SR();
    r.continuous     = true;
    r.interimResults = true;
    r.lang           = 'en-US';

    r.onresult = (e: any) => {
      lastResult = Date.now();
      let final  = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final  += e.results[i][0].transcript + ' '; buffer += e.results[i][0].transcript + ' '; }
        else interim += e.results[i][0].transcript;
      }
      setInterimText(buffer + interim);

      // Clear any pending silence timer
      if (silenceRef.current) clearTimeout(silenceRef.current);

      // If wake word detected → submit immediately
      if (final && containsWakeWord(final)) {
        r.stop();
        const toSend = buffer.trim();
        buffer = '';
        setInterimText('');
        if (toSend && !loadingRef.current) handleAttorneyStatement(toSend);
        return;
      }

      // Auto-submit after 2.5s of silence
      silenceRef.current = setTimeout(() => {
        const sinceLastResult = Date.now() - lastResult;
        if (sinceLastResult >= 2400 && buffer.trim() && !loadingRef.current) {
          const toSend = buffer.trim();
          buffer = '';
          setInterimText('');
          handleAttorneyStatement(toSend);
        }
      }, 2500);
    };

    r.onend = () => {
      // Auto-restart if open mic is still supposed to be on
      if (openMicOn) {
        setTimeout(() => { try { r.start(); } catch {} }, 300);
      } else {
        setListening(false);
        setInterimText('');
      }
    };

    r.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.warn('[OpenMic]', e.error);
    };

    recognitionRef.current = r;
    r.start();
    setListening(true);
    setOpenMicOn(true);
  }, [handleAttorneyStatement, openMicOn]);

  const stopOpenMic = useCallback(() => {
    setOpenMicOn(false);
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText('');
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  // When voiceMode changes, stop any active mic
  useEffect(() => {
    if (openMicOn) stopOpenMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode]);

  // ── Start trial ───────────────────────────────────────────────────────────
  const startTrial = useCallback(async () => {
    setPhase('trial');
    setMessages([]);
    setScores(null);
    setLoading(true);
    loadingRef.current = true;

    const openings: Record<TrialMode, string> = {
      opening:     `Court is now in session. ${judgeName} presiding. Counsel, you may begin your opening statement.`,
      examination: `Court is in session. Call your first witness.`,
      cross:       `${opponentName} has concluded direct. You may begin cross-examination.`,
      closing:     `We've heard all the evidence. Counsel, your closing argument.`,
      full:        `Court is now in session — ${activeCase?.title || 'the matter before this court'}. ${judgeName} presiding. Are counsel ready? You may proceed with opening statements.`,
    };

    const text = openings[mode];
    addMsg('judge', text);
    setAiSpeaking('judge');
    await speak(text, 'judge', muted);
    setAiSpeaking(null);
    loadingRef.current = false;
    setLoading(false);
  }, [mode, muted, judgeName, opponentName, activeCase, addMsg]);

  // ── End trial & score ─────────────────────────────────────────────────────
  const endTrial = useCallback(async () => {
    if (openMicOn) stopOpenMic();
    setLoading(true);
    loadingRef.current = true;
    const closingText = 'Court is adjourned. This simulation is concluded. Counsel, your performance is being evaluated.';
    addMsg('judge', closingText);
    await speak(closingText, 'judge', muted);
    try {
      const score = await scorePerformance(messages, caseContext, mode);
      setScores(score);
      setPhase('results');
    } catch {
      toast.error('Scoring failed');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [messages, caseContext, mode, muted, openMicOn, stopOpenMic, addMsg]);

  // ════════════════════════════════════════════════════════════════════════
  // SETUP PHASE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'setup') {
    const modes: { id: TrialMode; label: string; desc: string }[] = [
      { id: 'full',        label: '⚖️ Full Trial',         desc: 'Opening → Evidence → Closing' },
      { id: 'opening',     label: '🎤 Opening Statement',  desc: 'Practice your opening' },
      { id: 'examination', label: '🔍 Direct Examination', desc: 'Question your witnesses' },
      { id: 'cross',       label: '⚔️ Cross-Examination',  desc: 'Attack opposing witnesses' },
      { id: 'closing',     label: '🏁 Closing Argument',   desc: 'Seal the deal' },
    ];

    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Scale size={20} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Courtroom Simulator</h1>
              <p className="text-slate-400 text-sm">Real voices. Real pressure. Real preparation.</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-4">
            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Judge Name</label>
                <input value={judgeName} onChange={e => setJudgeName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Opposing Counsel</label>
                <input value={opponentName} onChange={e => setOpponentName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>

            {/* Trial mode */}
            <label className="text-xs text-slate-400 mb-2 block">Select Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {modes.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${mode === m.id ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                  <div className="font-medium text-sm">{m.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            {/* Voice mode */}
            <label className="text-xs text-slate-400 mb-2 block">Voice Input Mode</label>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button onClick={() => setVoiceMode('push')}
                className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'push' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                <div className="flex items-center gap-2 mb-1"><Mic size={14} className="text-emerald-400" /><span className="font-medium text-sm">Push-to-Talk</span></div>
                <div className="text-xs text-slate-400">Hold button while speaking, release to send</div>
              </button>
              <button onClick={() => setVoiceMode('open')}
                className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'open' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                <div className="flex items-center gap-2 mb-1"><RadioTower size={14} className="text-blue-400" /><span className="font-medium text-sm">Open Mic</span></div>
                <div className="text-xs text-slate-400">Always-on — auto-sends after pause or wake word</div>
              </button>
            </div>

            {voiceMode === 'open' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-6 text-xs text-blue-300">
                <span className="font-semibold">Wake words:</span> Say <span className="font-mono bg-blue-500/20 px-1 rounded">"submit"</span>, <span className="font-mono bg-blue-500/20 px-1 rounded">"objection"</span>, <span className="font-mono bg-blue-500/20 px-1 rounded">"your honor"</span>, <span className="font-mono bg-blue-500/20 px-1 rounded">"done"</span>, <span className="font-mono bg-blue-500/20 px-1 rounded">"no further questions"</span> — or just pause for 2.5 seconds to auto-send.
              </div>
            )}

            {/* Options */}
            <div className="flex items-center gap-3 mb-6">
              <input type="checkbox" id="coach" checked={showCoach} onChange={e => setShowCoach(e.target.checked)}
                className="w-4 h-4 accent-violet-500" />
              <label htmlFor="coach" className="text-sm text-slate-300">Show real-time AI coaching tips after each exchange</label>
            </div>

            <button onClick={startTrial}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Play size={20} /> Enter the Courtroom
            </button>
          </div>

          {activeCase && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-400">
              <span className="text-slate-300 font-medium">Active case:</span> {activeCase.title} — {activeCase.client}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TRIAL PHASE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'trial') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">

        {/* Header */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Gavel size={18} className="text-amber-400 flex-shrink-0" />
            <span className="text-white font-semibold text-sm truncate">{judgeName} presiding</span>
            {aiSpeaking && (
              <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${speakerColors[aiSpeaking]} ${speakerLabel[aiSpeaking]}`}>
                {VOICES[aiSpeaking].name} speaking…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Voice mode toggle */}
            <button
              onClick={() => setVoiceMode(v => v === 'push' ? 'open' : 'push')}
              title={voiceMode === 'push' ? 'Switch to Open Mic' : 'Switch to Push-to-Talk'}
              className={`p-2 rounded-lg transition-colors text-sm flex items-center gap-1 ${voiceMode === 'open' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}>
              {voiceMode === 'open' ? <RadioTower size={16} /> : <Radio size={16} />}
            </button>
            <button onClick={() => setMuted(m => !m)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button onClick={endTrial} disabled={loading || messages.length < 4}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs transition-colors">
              <Square size={12} /> End & Score
            </button>
            <button onClick={() => { if (openMicOn) stopOpenMic(); setPhase('setup'); }}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Open mic status bar */}
        {voiceMode === 'open' && (
          <div className={`px-4 py-2 text-xs flex items-center justify-between ${openMicOn ? 'bg-blue-500/10 border-b border-blue-500/20 text-blue-300' : 'bg-slate-900 border-b border-slate-800 text-slate-500'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${openMicOn ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
              {openMicOn ? 'Open mic active — speak freely, pause 2.5s or say a wake word to send' : 'Open mic off — click the mic button to activate'}
            </div>
            {openMicOn && (
              <button onClick={stopOpenMic} className="text-blue-400 hover:text-white transition-colors">Stop</button>
            )}
          </div>
        )}

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`rounded-xl border p-3 sm:p-4 ${speakerColors[m.speaker]}`}>
              <div className={`text-xs font-bold mb-1.5 uppercase tracking-wide ${speakerLabel[m.speaker]}`}>
                {m.speaker === 'attorney' ? '⚖️ You (Attorney)' : VOICES[m.speaker as Speaker]?.name || m.speaker}
              </div>
              <p className="text-slate-200 text-sm leading-relaxed">{m.text}</p>
              {m.coaching && showCoach && (
                <div className="mt-2 pt-2 border-t border-violet-500/20 flex items-start gap-1.5">
                  <Brain size={12} className="text-violet-400 flex-shrink-0 mt-0.5" />
                  <span className="text-violet-300 text-xs italic">{m.coaching}</span>
                </div>
              )}
            </div>
          ))}

          {/* Interim speech bubble */}
          {interimText && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 sm:p-4 opacity-70">
              <div className="text-xs font-bold mb-1 uppercase tracking-wide text-emerald-400 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                You (speaking…)
              </div>
              <p className="text-slate-300 text-sm leading-relaxed italic">{interimText}</p>
            </div>
          )}

          {loading && !interimText && (
            <div className="flex items-center gap-2 text-slate-400 text-sm p-2">
              <Loader2 size={16} className="animate-spin" />
              <span>{aiSpeaking ? `${VOICES[aiSpeaking]?.name} is responding…` : 'Processing…'}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">

            {/* Voice button — behaviour depends on mode */}
            {voiceMode === 'push' ? (
              <button
                onMouseDown={startPushListen}
                onMouseUp={stopPushListen}
                onTouchStart={e => { e.preventDefault(); startPushListen(); }}
                onTouchEnd={e => { e.preventDefault(); stopPushListen(); }}
                disabled={loading}
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all select-none ${
                  listening ? 'bg-red-500 shadow-lg shadow-red-500/40 scale-110 ring-4 ring-red-500/30' : 'bg-slate-700 hover:bg-emerald-600'
                } text-white disabled:opacity-50`}
                title="Hold to talk, release to send">
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            ) : (
              <button
                onClick={openMicOn ? stopOpenMic : startOpenMic}
                disabled={loading && !openMicOn}
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  openMicOn ? 'bg-blue-500 shadow-lg shadow-blue-500/40 scale-110 ring-4 ring-blue-500/30 animate-pulse' : 'bg-slate-700 hover:bg-blue-600'
                } text-white disabled:opacity-50`}
                title={openMicOn ? 'Click to stop open mic' : 'Click to start open mic'}>
                {openMicOn ? <RadioTower size={20} /> : <Radio size={20} />}
              </button>
            )}

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && input.trim() && handleAttorneyStatement(input)}
              disabled={loading || listening}
              placeholder={
                listening && voiceMode === 'push' ? 'Listening… release to send' :
                openMicOn ? 'Open mic active — or type here…' :
                'State your argument, objection, or question…'
              }
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />

            <button onClick={() => input.trim() && handleAttorneyStatement(input)}
              disabled={!input.trim() || loading}
              className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
            </button>
          </div>

          <p className="text-center text-slate-600 text-xs mt-2">
            {voiceMode === 'push'
              ? 'Hold mic to talk • Release to send • Enter to send typed text'
              : 'Open mic mode — speak freely • Pause 2.5s or say "submit/objection/done" to send'}
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RESULTS PHASE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'results' && scores) {
    const grade      = scores.overall >= 85 ? 'A' : scores.overall >= 70 ? 'B' : scores.overall >= 55 ? 'C' : scores.overall >= 40 ? 'D' : 'F';
    const gradeColor = scores.overall >= 85 ? 'text-emerald-400' : scores.overall >= 70 ? 'text-blue-400' : scores.overall >= 55 ? 'text-yellow-400' : 'text-red-400';

    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Award size={24} className="text-violet-400" />
            <h2 className="text-xl font-bold">Performance Review</h2>
          </div>

          {/* Overall */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-slate-400 text-sm mb-1">Overall Score</div>
                <div className="text-5xl font-black text-white">{scores.overall}<span className="text-2xl text-slate-500">/100</span></div>
              </div>
              <div className={`text-6xl font-black ${gradeColor}`}>{grade}</div>
            </div>
            <div className="h-2 bg-slate-800 rounded-full mb-4">
              <div className={`h-full rounded-full ${scores.overall >= 70 ? 'bg-emerald-500' : scores.overall >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${scores.overall}%` }} />
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Scale size={12} /> Simulated Verdict</div>
              <p className="text-white text-sm font-medium">{scores.verdict}</p>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-blue-400" /> Breakdown</h3>
            <div className="space-y-4">
              {scores.categories.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{c.label}</span>
                    <span className="text-white font-medium">{c.score}/100</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mb-1">
                    <div className={`h-full rounded-full ${c.score >= 70 ? 'bg-emerald-500' : c.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${c.score}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{c.feedback}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3"><CheckCircle size={14} className="text-emerald-400" /><span className="text-emerald-400 font-semibold text-sm">Strengths</span></div>
              {scores.strengths.map((s, i) => <p key={i} className="text-slate-300 text-sm mb-1">✓ {s}</p>)}
            </div>
            <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-red-400" /><span className="text-red-400 font-semibold text-sm">Needs Work</span></div>
              {scores.weaknesses.map((w, i) => <p key={i} className="text-slate-300 text-sm mb-1">✗ {w}</p>)}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2"><Zap size={16} className="text-violet-400" /><span className="text-violet-400 font-bold text-sm">Priority Improvement</span></div>
            <p className="text-white">{scores.recommendation}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setPhase('setup'); setMessages([]); setScores(null); }}
              className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-medium transition-colors">
              <RotateCcw size={16} /> Try Again
            </button>
            <button onClick={() => window.location.href = '/app/judge-profiler'}
              className="flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-medium transition-colors">
              <Gavel size={16} /> Profile the Judge
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CourtroomSimulator;
