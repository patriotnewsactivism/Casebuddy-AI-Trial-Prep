/**
 * LiveTrialSim — Real-time bidirectional voice trial simulator
 *
 * Uses Gemini Live API for true 2-way audio:
 *   User speaks → AI hears in real-time → AI speaks back immediately
 *
 * Features ported from CaseBuddy Trial-Preparation + enhancements from
 * the main CaseBuddy architecture:
 *   - 8 trial phases (pre-trial motions → sentencing)
 *   - 3 difficulty modes (learn / practice / trial)
 *   - Live audio visualizer
 *   - Real-time transcription (both sides)
 *   - Per-turn AI grading with rolling score
 *   - Teleprompter / clipboard with AI-generated prep
 *   - Quick objection buttons
 *   - Mobile-responsive layout
 */

import React, {
  useState, useEffect, useRef, useCallback, useContext,
} from 'react';
import { AppContext } from '../App';
import { TrialPhase, SimulationMode } from '../types';
import {
  Mic, Square, Activity, BookOpen, AlertCircle,
  GraduationCap, Sword, ArrowLeft, List, Volume2,
  ChevronRight,
} from 'lucide-react';
import {
  connectLiveSession,
  setupAudioContexts,
  createPcmBlob,
  decodeAudio,
  decodeAudioData,
  evaluateLiveTurn,
  keepAudioAlive,
  LiveTurnGrade,
} from '../services/geminiLiveService';
import {
  evaluateForEvents,
  evaluateJuryMood,
  QUICK_OBJECTION_EVENTS,
  JUDGE_INTERRUPTIONS,
  CourtroomEvent,
  JuryMood,
} from '../services/courtroomEventsService';
import { toast } from 'react-toastify';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptItem {
  user: boolean;
  text: string;
  grade?: LiveTurnGrade;
  timestamp: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASES: { id: TrialPhase; label: string; icon: string }[] = [
  { id: 'pre-trial-motions', label: 'Pre-Trial Motions', icon: '📋' },
  { id: 'voir-dire', label: 'Voir Dire', icon: '👥' },
  { id: 'opening-statement', label: 'Opening Statement', icon: '🎤' },
  { id: 'direct-examination', label: 'Direct Examination', icon: '🔍' },
  { id: 'cross-examination', label: 'Cross-Examination', icon: '⚔️' },
  { id: 'defendant-testimony', label: 'Defendant Testimony', icon: '🧍' },
  { id: 'closing-argument', label: 'Closing Argument', icon: '🏛️' },
  { id: 'sentencing', label: 'Sentencing', icon: '⚖️' },
];

const MODES: { id: SimulationMode; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { id: 'learn', label: 'Learn', icon: <GraduationCap size={20} />, desc: 'Step-by-step teaching. Perfect for beginners.', color: 'emerald' },
  { id: 'practice', label: 'Practice', icon: <BookOpen size={20} />, desc: 'Guided coaching with hints and feedback.', color: 'blue' },
  { id: 'trial', label: 'Trial', icon: <Sword size={20} />, desc: 'Full realism. No hints. Opposing counsel fights hard.', color: 'red' },
];

const QUICK_OBJECTIONS = ['Hearsay', 'Relevance', 'Speculation', 'Leading', 'Foundation', 'Asked & Answered'];

// Phase-specific coaching tips for the clipboard
const PHASE_TIPS: Record<TrialPhase, string[]> = {
  'pre-trial-motions': ['Cite specific case law for each motion', 'Focus on constitutional grounds', 'Be concise — judges are busy', 'Know your Brady/Giglio obligations'],
  'voir-dire': ['Ask open-ended questions to surface bias', 'Watch for body language cues', 'Use challenges strategically', 'Build rapport — jurors who like you listen more'],
  'opening-statement': ['Tell a compelling story — not a legal argument', 'Preview key evidence without over-promising', 'State your theme early and repeat it', 'Use present tense for immediacy'],
  'direct-examination': ['Use open-ended questions: who, what, where, when, how', 'Let the witness tell the story', 'Avoid leading questions on your own witness', 'Loop key phrases for emphasis'],
  'cross-examination': ['Use short, leading, closed questions', 'Never ask a question you don\'t know the answer to', 'Attack credibility with prior inconsistencies', 'Control — don\'t let the witness explain'],
  'defendant-testimony': ['Prepare for unexpected questions', 'Control emotional responses', 'Keep answers concise', '"I don\'t recall" — only when genuinely uncertain'],
  'closing-argument': ['Tie evidence to your theory of the case', 'Address weaknesses head-on', 'Use the Rule of Three', 'End with a strong call to action'],
  'sentencing': ['Humanize your client with specifics', 'Cite applicable sentencing guidelines', 'Address mitigating factors methodically', 'Acknowledge the harm — then pivot to mercy'],
};

// ─── Component ───────────────────────────────────────────────────────────────

const LiveTrialSim: React.FC = () => {
  const { activeCase } = useContext(AppContext);

  // ── View state ──
  const [view, setView] = useState<'setup' | 'active'>('setup');
  const [phase, setPhase] = useState<TrialPhase>('cross-examination');
  const [mode, setMode] = useState<SimulationMode>('practice');

  // ── Session state ──
  const [isConnected, setIsConnected] = useState(false);
  const [mobileTab, setMobileTab] = useState<'stage' | 'clipboard'>('stage');

  // ── Grading ──
  const [currentScore, setCurrentScore] = useState(50);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  // ── Courtroom Events ──
  const [activeEvent, setActiveEvent] = useState<CourtroomEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<CourtroomEvent[]>([]);
  const [juryMood, setJuryMood] = useState<JuryMood>({ attention: 60, sympathy: 50, confusion: 10, engagement: 50, leaningToward: 'neutral', notableReactions: [] });
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const eventCheckRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── Clipboard ──
  const [activeClipTab, setActiveClipTab] = useState<'script' | 'notes'>('script');

  // ── Refs ──
  const audioCtxRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isConnectedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Grading loop — evaluate user turns ──
  useEffect(() => {
    const lastItem = transcript[transcript.length - 1];
    if (lastItem && lastItem.user && !lastItem.grade) {
      const caseCtx = activeCase
        ? `${activeCase.title} — ${activeCase.summary || ''}`
        : 'Generic legal practice';

      evaluateLiveTurn(phase, lastItem.text, caseCtx).then(grade => {
        setTranscript(prev => {
          const updated = [...prev];
          const idx = updated.length - 1;
          if (updated[idx] && updated[idx].user && !updated[idx].grade) {
            updated[idx] = { ...updated[idx], grade };
          }
          return updated;
        });
        setCurrentScore(prev => {
          const newScore = Math.min(100, Math.max(0, Math.round((prev + grade.score) / 2)));
          return newScore;
        });
      });
    }
  }, [transcript.length, phase, activeCase]);

  // ── Visualizer ──
  useEffect(() => {
    if (!isConnected || !analyzerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyzer = analyzerRef.current;
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const draw = () => {
      if (!isConnectedRef.current) return;
      animationFrameRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i] / 2;
        ctx.fillStyle = `rgba(99, 102, 241, ${barHeight / 100})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected]);

  // ── Courtroom Events Loop — check for interruptions/objections periodically ──
  useEffect(() => {
    if (!isConnected) {
      if (eventCheckRef.current) clearInterval(eventCheckRef.current);
      return;
    }

    const caseCtx = activeCase
      ? `${activeCase.title} — ${activeCase.summary || ''}`
      : 'Generic legal practice';

    eventCheckRef.current = setInterval(async () => {
      if (transcript.length < 2 || activeEvent) return;

      try {
        const event = await evaluateForEvents(transcript, phase, mode, caseCtx, eventHistory);
        if (event) {
          setActiveEvent(event);
          setEventHistory(prev => [...prev, event]);

          // Auto-dismiss after duration
          eventTimerRef.current = setTimeout(() => {
            setActiveEvent(null);
          }, event.duration);
        }
      } catch (err) {
        console.warn('[LiveTrialSim] Event evaluation error:', err);
      }

      // Update jury mood every ~3 checks
      if (transcript.length > 4 && Math.random() < 0.33) {
        try {
          const mood = await evaluateJuryMood(transcript, phase, caseCtx);
          setJuryMood(mood);
        } catch {}
      }
    }, 12000); // Check every 12 seconds

    return () => {
      if (eventCheckRef.current) clearInterval(eventCheckRef.current);
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current);
    };
  }, [isConnected, transcript.length, phase, mode, activeCase, activeEvent]);

  // ── Fire Quick Objection (user clicks objection button) ──
  const fireQuickObjection = useCallback((objectionType: string) => {
    const key = objectionType.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
    const eventData = QUICK_OBJECTION_EVENTS[key];
    if (!eventData) return;

    const event: CourtroomEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
    };

    setActiveEvent(event);
    setEventHistory(prev => [...prev, event]);

    // Randomly follow up with judge ruling
    setTimeout(() => {
      const isOverruled = Math.random() > 0.5;
      const ruling = isOverruled ? JUDGE_INTERRUPTIONS.overruled : JUDGE_INTERRUPTIONS.sustained;
      const rulingEvent: CourtroomEvent = {
        ...ruling,
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: Date.now(),
      };
      setActiveEvent(rulingEvent);
      setEventHistory(prev => [...prev, rulingEvent]);

      eventTimerRef.current = setTimeout(() => setActiveEvent(null), rulingEvent.duration);
    }, eventData.duration);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
      if (eventCheckRef.current) clearInterval(eventCheckRef.current);
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current);
    };
  }, []);

  // ── Start Session ──
  const startSession = useCallback(async () => {
    try {
      // Set up audio contexts
      const { inputAudioContext, outputAudioContext } = await setupAudioContexts();
      audioCtxRef.current = { input: inputAudioContext, output: outputAudioContext };
      nextStartTimeRef.current = 0;

      // Mobile: auto-resume audio when returning from background/lock
      const cleanupAudioKeepAlive = keepAudioAlive(inputAudioContext, outputAudioContext);
      // Store cleanup so stopSession can remove it
      (audioCtxRef.current as any)._cleanupKeepAlive = cleanupAudioKeepAlive;

      // Set up analyzer for visualizer
      const analyzer = inputAudioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzerRef.current = analyzer;

      // Get microphone — mobile-optimized constraints
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(isMobile ? { sampleRate: 16000, channelCount: 1 } : {}),
        },
      });
      streamRef.current = stream;

      const source = inputAudioContext.createMediaStreamSource(stream);
      const processor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(analyzer);
      analyzer.connect(processor);
      processor.connect(inputAudioContext.destination);

      // Build case context for the AI
      let contextText = '';
      if (activeCase) {
        contextText = `CASE: ${activeCase.title}
SUMMARY: ${activeCase.summary || 'No summary available'}
CLIENT TYPE: ${activeCase.clientType || 'unspecified'}
OPPOSING COUNSEL: ${activeCase.opposingCounsel || 'Opposing Counsel'}`;
      } else {
        contextText = 'No case files uploaded. Use generic legal knowledge for a civil rights case.';
      }

      // Connect to Gemini Live
      const session = await connectLiveSession(
        phase,
        mode,
        contextText,
        {
          onAudioData: async (base64Audio) => {
            if (!audioCtxRef.current) return;
            const ctx = audioCtxRef.current.output;
            try {
              const audioBuffer = await decodeAudioData(
                decodeAudio(base64Audio), ctx, 24000, 1,
              );
              const src = ctx.createBufferSource();
              src.buffer = audioBuffer;
              src.connect(ctx.destination);
              const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
              src.start(startTime);
              nextStartTimeRef.current = startTime + audioBuffer.duration;
              sourcesRef.current.add(src);
              src.onended = () => sourcesRef.current.delete(src);
            } catch (e) {
              console.warn('[LiveTrialSim] Audio decode error:', e);
            }
          },
          onClose: () => {
            if (isConnectedRef.current) {
              toast.info('Live session ended.', { autoClose: 3000 });
              stopSession();
            }
          },
          onTranscription: (text, isUser) => {
            if (text.trim()) {
              setTranscript(prev => [...prev, {
                user: isUser,
                text: text.trim(),
                timestamp: Date.now(),
              }]);
            }
          },
          onError: (e) => {
            console.error('[LiveTrialSim] Error:', e);
            toast.error('Live connection error. Check your API key and try again.');
          },
        },
      );

      sessionRef.current = session;

      // Wire up mic → Gemini
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const blob = createPcmBlob(inputData);
        try {
          sessionRef.current.sendRealtimeInput({ media: blob });
        } catch {
          // Session may have closed
        }
      };

      setIsConnected(true);
      setView('active');
      setTranscript([]);
      setCurrentScore(50);
      toast.success('🎤 Live session connected — speak naturally', { autoClose: 3000 });

    } catch (e: any) {
      console.error('[LiveTrialSim] Start failed:', e);
      if (e.name === 'NotAllowedError') {
        toast.error('Microphone permission denied. Allow mic access and try again.');
      } else if (e.message?.includes('API key')) {
        toast.error('Gemini API key not configured. Add it in Settings.');
      } else {
        toast.error(e.message || 'Failed to start live session.');
      }
    }
  }, [phase, mode, activeCase]);

  // ── Stop Session ──
  const stopSession = useCallback(() => {
    setIsConnected(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    (audioCtxRef.current as any)?._cleanupKeepAlive?.();
    audioCtxRef.current?.input.close().catch(() => {});
    audioCtxRef.current?.output.close().catch(() => {});
    audioCtxRef.current = null;
    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current.clear();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch {}
      sessionRef.current = null;
    }
  }, []);

  // ── Helpers ──
  const getScoreColor = (s: number) => s > 80 ? 'text-emerald-400' : s > 60 ? 'text-yellow-400' : 'text-red-400';
  const getScoreBorder = (s: number) => s > 80 ? 'border-emerald-400' : s > 60 ? 'border-yellow-400' : 'border-red-400';
  const currentPhase = PHASES.find(p => p.id === phase);
  const clipboardTips = PHASE_TIPS[phase] || [];

  // ─── SETUP VIEW ─────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-3">
            <Activity className="text-indigo-500 w-7 h-7" />
            Live Trial Simulator
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Real-time AI voice courtroom — speak naturally, AI responds instantly
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-indigo-400 text-xs font-medium">Powered by Gemini Live API</span>
          </div>
        </div>

        {/* Phase Selection */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
            Select Trial Phase
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PHASES.map(p => (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  phase === p.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span className="text-lg">{p.icon}</span>
                <p className="text-xs font-medium mt-1 leading-tight">{p.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Mode Selection */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
            Difficulty
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  mode === m.id
                    ? `bg-${m.color}-600/20 border-${m.color}-500 text-white`
                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {m.icon}
                  <span className="font-bold text-sm">{m.label}</span>
                </div>
                <p className="text-xs text-slate-400">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Active Case Info */}
        {activeCase && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-1">Active Case</h3>
            <p className="text-white font-medium">{activeCase.title}</p>
            {activeCase.summary && (
              <p className="text-slate-400 text-xs mt-1 line-clamp-2">{activeCase.summary}</p>
            )}
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={startSession}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-900/30"
        >
          <Mic size={24} />
          Enter Courtroom
        </button>

        {/* Info */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-400">How it works</h3>
          <ul className="text-xs text-slate-500 space-y-1">
            <li className="flex gap-2"><ChevronRight size={12} className="flex-shrink-0 mt-0.5" /> Your microphone streams directly to Gemini AI in real-time</li>
            <li className="flex gap-2"><ChevronRight size={12} className="flex-shrink-0 mt-0.5" /> AI responds with natural voice — no text-to-speech delay</li>
            <li className="flex gap-2"><ChevronRight size={12} className="flex-shrink-0 mt-0.5" /> Both sides are transcribed live for review</li>
            <li className="flex gap-2"><ChevronRight size={12} className="flex-shrink-0 mt-0.5" /> Each of your turns is scored in real-time</li>
          </ul>
        </div>
      </div>
    );
  }

  // ─── ACTIVE SESSION VIEW ───────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden pb-16 md:pb-0">
      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-950">
        <button
          onClick={() => setMobileTab('stage')}
          className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
            mobileTab === 'stage' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'
          }`}
        >
          <Mic className="w-4 h-4" /> Live Stage
        </button>
        <button
          onClick={() => setMobileTab('clipboard')}
          className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
            mobileTab === 'clipboard' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'
          }`}
        >
          <List className="w-4 h-4" /> Clipboard
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        {/* LEFT: Simulation Stage */}
        <div className={`flex-1 flex flex-col p-4 md:p-6 relative transition-all ${
          mobileTab === 'stage' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { stopSession(); setView('setup'); }}
                className="text-slate-400 hover:text-white p-1"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <Activity className="text-indigo-500 w-5 h-5 md:w-6 md:h-6" />
                  Live Trial Sim
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  {currentPhase?.icon} {currentPhase?.label} • {mode.charAt(0).toUpperCase() + mode.slice(1)} Mode
                </p>
              </div>
            </div>
          </header>

          {/* Main Visualizer Stage */}
          <div className="flex-shrink-0 h-40 sm:h-56 md:h-72 relative bg-slate-900/50 rounded-2xl border border-slate-800 flex flex-col items-center justify-center overflow-hidden mb-3 sm:mb-4 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/80 pointer-events-none" />

            {/* Score HUD */}
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 md:top-6 md:right-6 flex flex-col items-end z-20">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter ${getScoreColor(currentScore)} drop-shadow-lg transition-colors duration-700`}>
                  {currentScore}
                </span>
                <span className="text-xs text-slate-500 font-bold">/100</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Proficiency</div>
            </div>

            {/* Connection status */}
            <div className="absolute top-4 left-4 z-20">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {isConnected ? 'Live' : 'Disconnected'}
              </div>
            </div>

            {/* Central Mic Button + Visualizer */}
            <div className="relative z-10 w-28 h-28 sm:w-40 sm:h-40 md:w-56 md:h-56 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-2 ${getScoreBorder(currentScore)} opacity-20 ${
                isConnected ? 'animate-ping' : ''
              }`} style={{ animationDuration: '2s' }} />

              <canvas ref={canvasRef} width="300" height="150" className="absolute bottom-8 opacity-60 w-full" />

              <button
                onClick={isConnected ? () => { stopSession(); setView('setup'); } : startSession}
                className={`relative z-30 p-4 sm:p-5 md:p-7 rounded-full border shadow-2xl transition-all duration-300 ${
                  isConnected
                    ? 'bg-slate-950 border-red-500/50 shadow-red-900/20 hover:bg-red-950/30'
                    : 'bg-slate-950 border-slate-700 hover:border-indigo-500 hover:scale-105'
                }`}
              >
                {isConnected
                  ? <Square className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 text-red-500 fill-current" />
                  : <Mic className="w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 text-indigo-500" />
                }
              </button>
            </div>

            {/* Status Text */}
            <div className="absolute bottom-4 md:bottom-8 text-center z-10">
              <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">
                {isConnected ? 'Listening & Responding...' : 'Tap Mic to Reconnect'}
              </p>
            </div>
          </div>

          {/* Courtroom Event Overlay */}
          {activeEvent && (
            <div className={`mb-3 rounded-xl border p-4 transition-all animate-pulse-once ${
              activeEvent.severity === 'critical'
                ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-900/20'
                : activeEvent.severity === 'warning'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-blue-500/10 border-blue-500/20'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{activeEvent.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      activeEvent.speaker === 'judge' ? 'text-yellow-400'
                      : activeEvent.speaker === 'opposing_counsel' ? 'text-red-400'
                      : activeEvent.speaker === 'jury' ? 'text-blue-400'
                      : 'text-slate-400'
                    }`}>
                      {activeEvent.speaker === 'judge' ? 'THE COURT'
                        : activeEvent.speaker === 'opposing_counsel' ? 'OPPOSING COUNSEL'
                        : activeEvent.speaker === 'jury' ? 'JURY BOX'
                        : 'COURTROOM'}
                    </span>
                  </div>
                  <p className="text-white font-medium text-sm italic">{activeEvent.text}</p>
                  {activeEvent.subtext && (
                    <p className="text-slate-400 text-xs mt-1">{activeEvent.subtext}</p>
                  )}
                  {activeEvent.requiresResponse && activeEvent.suggestedResponse && mode !== 'trial' && (
                    <div className="mt-2 p-2 bg-slate-900/60 rounded-lg border border-slate-700/50">
                      <p className="text-xs text-slate-500">💡 Suggested response:</p>
                      <p className="text-xs text-emerald-400 italic mt-0.5">{activeEvent.suggestedResponse}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setActiveEvent(null)}
                  className="text-slate-600 hover:text-white text-xs flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Live Transcript */}
          <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-4 overflow-y-auto space-y-3 shadow-inner min-h-[180px]">
            <h3 className="text-xs font-bold text-slate-500 uppercase sticky top-0 bg-slate-900 py-2 border-b border-slate-800 mb-2 z-10">
              Live Transcript
            </h3>

            {transcript.length === 0 && (
              <div className="text-slate-600 text-sm text-center py-10 italic">
                Transcript will appear as you speak...
              </div>
            )}

            {transcript.map((t, i) => (
              <div key={i} className={`flex flex-col ${t.user ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 mb-1 ${t.user ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    {t.user ? 'You' : 'Court'}
                  </span>
                </div>
                <div className={`max-w-[90%] md:max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                  t.user
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-800 text-slate-300 rounded-tl-none border border-slate-700'
                }`}>
                  {t.text}
                </div>
                {t.user && t.grade && (
                  <div className={`mt-1.5 p-2 rounded border-l-2 max-w-[85%] bg-slate-950/50 text-xs ${
                    t.grade.color === 'green' ? 'border-emerald-500'
                    : t.grade.color === 'yellow' ? 'border-yellow-500'
                    : 'border-red-500'
                  }`}>
                    <span className={`font-bold mr-2 ${getScoreColor(t.grade.score)}`}>
                      {t.grade.score}/100
                    </span>
                    <span className="text-slate-400">{t.grade.feedback}</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* RIGHT: Clipboard / Teleprompter */}
        <div className={`w-full md:w-80 lg:w-96 bg-slate-950 md:border-l border-slate-900 flex flex-col h-full shadow-2xl z-20 absolute md:static inset-0 ${
          mobileTab === 'clipboard' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="p-4 border-b border-slate-900 bg-slate-900/50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="text-yellow-500 w-5 h-5" />
                Clipboard
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Quick reference & prep</p>
            </div>
          </div>

          <div className="flex p-2 gap-2 bg-slate-900/30">
            <button
              onClick={() => setActiveClipTab('script')}
              className={`flex-1 py-2 text-xs font-bold rounded uppercase tracking-wider transition-colors ${
                activeClipTab === 'script' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'
              }`}
            >
              Strategy
            </button>
            <button
              onClick={() => setActiveClipTab('notes')}
              className={`flex-1 py-2 text-xs font-bold rounded uppercase tracking-wider transition-colors ${
                activeClipTab === 'notes' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'
              }`}
            >
              Notes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-950 relative">
            {activeClipTab === 'script' && (
              <div className="space-y-5">
                {/* Phase Tips */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <h3 className="text-yellow-500 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> {currentPhase?.label} Tips
                  </h3>
                  <ul className="space-y-2.5">
                    {clipboardTips.map((tip, i) => (
                      <li key={i} className="flex gap-3 text-slate-300 text-sm leading-relaxed group cursor-pointer hover:bg-slate-900 p-2 rounded transition-colors">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-xs font-mono group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {i + 1}
                        </span>
                        <span className="group-hover:text-white">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Quick Objections (now functional) */}
                <div>
                  <h4 className="text-slate-500 text-xs font-bold uppercase mb-3">Quick Objections</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_OBJECTIONS.map(obj => (
                      <button
                        key={obj}
                        onClick={() => fireQuickObjection(obj)}
                        className="px-3 py-2.5 bg-slate-900 border border-slate-800 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-lg text-xs font-bold transition-all text-center active:scale-95"
                      >
                        🚫 {obj}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Jury Mood Panel */}
                {isConnected && (
                  <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <h4 className="text-slate-500 text-xs font-bold uppercase mb-3 flex items-center gap-1.5">
                      👥 Jury Reading
                    </h4>
                    <div className="space-y-2">
                      {[
                        { label: 'Attention', value: juryMood.attention, color: 'bg-blue-500' },
                        { label: 'Sympathy', value: juryMood.sympathy, color: 'bg-emerald-500' },
                        { label: 'Engagement', value: juryMood.engagement, color: 'bg-purple-500' },
                        { label: 'Confusion', value: juryMood.confusion, color: 'bg-red-500' },
                      ].map(m => (
                        <div key={m.label}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-slate-400">{m.label}</span>
                            <span className="text-slate-500">{m.value}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${m.color}`}
                              style={{ width: `${m.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                        <span className="text-slate-500">Leaning:</span>
                        <span className={`font-bold uppercase ${
                          juryMood.leaningToward === 'plaintiff' ? 'text-emerald-400'
                          : juryMood.leaningToward === 'defense' ? 'text-red-400'
                          : 'text-slate-400'
                        }`}>{juryMood.leaningToward}</span>
                      </div>
                      {juryMood.notableReactions.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {juryMood.notableReactions.slice(-2).map((r, i) => (
                            <p key={i} className="text-[10px] text-slate-500 italic">👁️ {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Event History (recent) */}
                {eventHistory.length > 0 && (
                  <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                    <h4 className="text-slate-500 text-xs font-bold uppercase mb-2">Recent Events</h4>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {eventHistory.slice(-5).reverse().map(evt => (
                        <div key={evt.id} className="flex items-center gap-2 text-[10px]">
                          <span>{evt.emoji}</span>
                          <span className="text-slate-400 truncate">{evt.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode indicator */}
                <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-xs">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-slate-400">Voice: Fenrir (Gemini Live)</span>
                  </div>
                </div>
              </div>
            )}

            {activeClipTab === 'notes' && (
              <textarea
                className="w-full h-full bg-slate-900/30 p-4 rounded-xl text-slate-300 resize-none outline-none font-mono text-sm leading-relaxed placeholder-slate-700 border border-transparent focus:border-slate-700"
                placeholder="Type your case notes here..."
                defaultValue={`Phase: ${currentPhase?.label}\nMode: ${mode}\n\nKey points:\n- [ ] \n- [ ] \n- [ ] `}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrialSim;
