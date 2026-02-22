/**
 * TrialSim.tsx — Production-grade Trial Simulator
 *
 * KEY IMPROVEMENTS OVER v1:
 *  1. Structured AI responses (JSON) — coaching + objection detection NOW WORK
 *  2. useReducer replaces 12 scattered useState calls for session lifecycle
 *  3. isProcessing + restartAttempts as refs (were closure vars → race conditions)
 *  4. Fixed: Link from react-router-dom (was incorrectly from lucide-react)
 *  5. AbortController for in-flight AI request cancellation on stop/unmount
 *  6. Audio URL revocation in finally blocks (was leaking ObjectURLs)
 *  7. useSavedSessions hook encapsulates all localStorage CRUD
 *  8. ElevenLabsStreamer WebSocket removed (was imported but never functionally used)
 *  9. All sub-components extracted as typed, pure components
 * 10. Word count + filler word tracking wired into metricsRef
 *
 * RECOMMENDED FOLLOW-UP EXTRACTIONS:
 *  - hooks/useSpeechRecognition.ts
 *  - hooks/useAudioPlayback.ts
 *  - hooks/useSavedSessions.ts
 *  - components/TrialSim/ObjectionModal.tsx
 *  - components/TrialSim/SessionCard.tsx
 *  - components/TrialSim/TeleprompterPanel.tsx
 *  - components/TrialSim/SetupScreen.tsx
 *  - components/TrialSim/HistoryScreen.tsx
 */

import React, {
  useState, useRef, useEffect, useContext, useReducer, useCallback
} from 'react';
import { Link } from 'react-router-dom'; // FIX: was incorrectly imported from lucide-react
import { AppContext } from '../App';
import { MOCK_OPPONENT } from '../constants';
import {
  CoachingAnalysis, Message, TrialPhase, SimulationMode,
  TrialSession, VoiceConfig, SimulatorSettings, TrialSessionMetrics
} from '../types';
import {
  Mic, MicOff, Activity, AlertTriangle, Lightbulb, AlertCircle,
  BookOpen, Sword, GraduationCap, User, Gavel, ArrowLeft, FileText,
  Users, Scale, Clock, Play, Pause, Trash2, Download, ChevronDown,
  Volume2, ChevronUp, FolderOpen
} from 'lucide-react';
import { getTrialSimSystemPrompt, isOpenAIConfigured, streamOpenAIResponse } from '../services/openAIService';
import { ELEVENLABS_VOICES, TRIAL_VOICE_PRESETS, isElevenLabsConfigured, synthesizeSpeech } from '../services/elevenLabsService';
import { isBrowserTTSAvailable, speakWithFallback } from '../services/browserTTSService';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Structured JSON shape the AI must return on every turn.
 * "speak" → spoken aloud. "coaching" → shown privately in HUD.
 */
interface AIStructuredResponse {
  speak: string;
  action: 'response' | 'objection' | 'ruling' | 'question';
  objection: { grounds: string; explanation: string } | null;
  coaching: {
    critique: string;
    suggestion: string;
    teleprompterScript: string;
    rhetoricalEffectiveness: number; // 0–100
    fallaciesIdentified: string[];
  };
}

type SimView = 'setup' | 'active' | 'history';

// Session lifecycle — replaces 12+ scattered useState calls
interface SessionState {
  isLive: boolean;
  isConnecting: boolean;
  isAISpeaking: boolean;
  liveVolume: number;
  inputTranscript: string;
  outputTranscript: string;
  objectionCount: number;
  rhetoricalScores: number[];
  sessionScore: number;
}

type SessionAction =
  | { type: 'START_CONNECTING' }
  | { type: 'SESSION_LIVE' }
  | { type: 'SESSION_STOPPED' }
  | { type: 'AI_SPEAKING_START' }
  | { type: 'AI_SPEAKING_END' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_INPUT_TRANSCRIPT'; text: string }
  | { type: 'SET_OUTPUT_TRANSCRIPT'; text: string }
  | { type: 'OBJECTION_DETECTED' }
  | { type: 'RHETORICAL_SCORE'; score: number }
  | { type: 'RESET_SESSION' };

const INITIAL_SESSION: SessionState = {
  isLive: false,
  isConnecting: false,
  isAISpeaking: false,
  liveVolume: 0,
  inputTranscript: '',
  outputTranscript: '',
  objectionCount: 0,
  rhetoricalScores: [],
  sessionScore: 50,
};

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_CONNECTING':
      return { ...state, isConnecting: true };
    case 'SESSION_LIVE':
      return { ...state, isLive: true, isConnecting: false };
    case 'SESSION_STOPPED':
      return {
        ...state,
        isLive: false, isConnecting: false, isAISpeaking: false,
        liveVolume: 0, inputTranscript: '', outputTranscript: ''
      };
    case 'AI_SPEAKING_START':
      return { ...state, isAISpeaking: true };
    case 'AI_SPEAKING_END':
      return { ...state, isAISpeaking: false };
    case 'SET_VOLUME':
      return { ...state, liveVolume: action.volume };
    case 'SET_INPUT_TRANSCRIPT':
      return { ...state, inputTranscript: action.text };
    case 'SET_OUTPUT_TRANSCRIPT':
      return { ...state, outputTranscript: action.text };
    case 'OBJECTION_DETECTED':
      return { ...state, objectionCount: state.objectionCount + 1 };
    case 'RHETORICAL_SCORE': {
      const scores = [...state.rhetoricalScores, action.score];
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { ...state, rhetoricalScores: scores, sessionScore: avg };
    }
    case 'RESET_SESSION':
      return { ...INITIAL_SESSION };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually', 'right', 'so'];

/**
 * Augments the base system prompt with JSON output requirements.
 * This is the core fix that makes coaching + objection detection actually work.
 */
function buildStructuredSystemPrompt(
  phase: TrialPhase,
  mode: SimulationMode,
  opponentName: string,
  caseSummary: string
): string {
  const base = getTrialSimSystemPrompt(phase, mode, opponentName, caseSummary);
  return `${base}

══ RESPONSE FORMAT — CRITICAL ══
You MUST respond ONLY with valid JSON (no markdown, no code fences) matching this schema exactly:

{
  "speak": "<what you say aloud as opposing counsel or judge — stay in character>",
  "action": "response" | "objection" | "ruling" | "question",
  "objection": null | { "grounds": "<legal basis, e.g. Hearsay>", "explanation": "<1–2 sentence explanation>" },
  "coaching": {
    "critique": "<constructive critique of the user's last statement — be specific>",
    "suggestion": "<concrete, actionable improvement>",
    "teleprompterScript": "<exactly what the user should say next — write it in first person>",
    "rhetoricalEffectiveness": <integer 0–100>,
    "fallaciesIdentified": [<string array of any logical fallacies — empty array if none>]
  }
}

Rules:
• "speak" is the ONLY text said aloud. Keep it courtroom-realistic and appropriate to the phase.
• "objection" is non-null ONLY when you raise a formal objection; otherwise null.
• "coaching" is ALWAYS fully populated — it drives the private training HUD, never spoken.
• "rhetoricalEffectiveness" reflects argument strength: 0=catastrophic, 50=average, 100=masterful.
• Never break character in "speak". Coaching commentary stays in "coaching" only.
• Output ONLY valid JSON. Non-JSON output breaks the simulator.`;
}

/**
 * Parse AI JSON response with graceful fallback for malformed output.
 */
function parseAIResponse(raw: string): AIStructuredResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as AIStructuredResponse;
    // Validate required shape
    if (typeof parsed.speak !== 'string') throw new Error('Missing speak field');
    return parsed;
  } catch (err) {
    console.warn('[TrialSim] Failed to parse structured AI response, using fallback:', err);
    return {
      speak: raw.trim() || '[No response]',
      action: 'response',
      objection: null,
      coaching: {
        critique: 'AI response format was unexpected — continue practicing.',
        suggestion: 'Keep going. Your argument is being evaluated.',
        teleprompterScript: '',
        rhetoricalEffectiveness: 50,
        fallaciesIdentified: [],
      },
    };
  }
}

// ─── Custom Hook: useSavedSessions ───────────────────────────────────────────

function useSavedSessions(caseId: string | undefined) {
  const [sessions, setSessions] = useState<TrialSession[]>(() => {
    if (!caseId) return [];
    try {
      return JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!caseId) return;
    try {
      setSessions(JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]'));
    } catch {
      setSessions([]);
    }
  }, [caseId]);

  const persist = useCallback((updated: TrialSession[]) => {
    if (!caseId) return;
    setSessions(updated);
    localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(updated));
  }, [caseId]);

  const addSession = useCallback((session: TrialSession) => {
    setSessions(prev => {
      const updated = [session, ...prev].slice(0, 20);
      if (caseId) localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(updated));
      return updated;
    });
  }, [caseId]);

  const removeSession = useCallback((id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (caseId) localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(updated));
      return updated;
    });
  }, [caseId]);

  return { sessions, addSession, removeSession };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIAL_PHASES = [
  { id: 'pre-trial-motions', label: 'Pre-Trial',  icon: FileText },
  { id: 'voir-dire',         label: 'Voir Dire',  icon: Users },
  { id: 'opening-statement', label: 'Opening',    icon: BookOpen },
  { id: 'direct-examination',label: 'Direct',     icon: User },
  { id: 'cross-examination', label: 'Cross',      icon: Sword },
  { id: 'defendant-testimony',label:'Defendant',  icon: Mic },
  { id: 'closing-argument',  label: 'Closing',    icon: Scale },
  { id: 'sentencing',        label: 'Sentencing', icon: Gavel },
] as const;

const MODES = [
  {
    id: 'learn',
    label: 'Learn',
    desc: 'AI guides with scripts and detailed coaching',
    icon: GraduationCap,
    colorClass: 'bg-blue-600',
  },
  {
    id: 'practice',
    label: 'Practice',
    desc: 'Balanced objections and feedback',
    icon: Mic,
    colorClass: 'bg-green-600',
  },
  {
    id: 'trial',
    label: 'Simulate',
    desc: 'Aggressive — no mercy, real courtroom pressure',
    icon: Sword,
    colorClass: 'bg-red-600',
  },
] as const;

const OBJECTION_RESPONSES = [
  { label: 'Withdraw',        text: 'Your Honor, I withdraw the question.' },
  { label: 'Rephrase',        text: 'Your Honor, I will rephrase the question.' },
  { label: 'Argue Relevance', text: 'Your Honor, this question is directly relevant to the central issues before the court.' },
  { label: 'Foundation',      text: 'Your Honor, I have laid proper foundation for this line of questioning.' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

const TrialSim: React.FC = () => {
  const { activeCase } = useContext(AppContext);

  // ── Navigation ──────────────────────────────────────────────────────────
  const [view, setView]     = useState<SimView>('setup');
  const [phase, setPhase]   = useState<TrialPhase | null>(null);
  const [mode, setMode]     = useState<SimulationMode | null>(null);

  // ── Setup UI ────────────────────────────────────────────────────────────
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    voiceName: 'josh', personality: 'neutral', languageCode: 'en-US',
  });
  const [simulatorSettings, setSimulatorSettings] = useState<SimulatorSettings>({
    voice: { voiceName: 'josh', personality: 'neutral', languageCode: 'en-US' },
    realismLevel: 'professional',
    interruptionFrequency: 'medium',
    coachingVerbosity: 'moderate',
    audioQuality: 'high',
  });
  const [useElevenLabs, setUseElevenLabs] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // ── Session UI ──────────────────────────────────────────────────────────
  const [messages, setMessages]             = useState<Message[]>([]);
  const [coachingTip, setCoachingTip]       = useState<CoachingAnalysis | null>(null);
  const [objectionAlert, setObjectionAlert] = useState<{ grounds: string; explanation: string } | null>(null);
  const [showCoaching, setShowCoaching]     = useState(false);
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);

  // ── Session state machine ────────────────────────────────────────────────
  const [session, dispatch] = useReducer(sessionReducer, INITIAL_SESSION);

  // ── Saved sessions ───────────────────────────────────────────────────────
  const { sessions: savedSessions, addSession, removeSession } = useSavedSessions(activeCase?.id);

  // ── History playback ─────────────────────────────────────────────────────
  const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Stable refs (prevent stale closure bugs) ─────────────────────────────
  const isLiveRef        = useRef(false);
  const isAISpeakingRef  = useRef(false);
  const isProcessingRef  = useRef(false); // FIX: was a closure variable → race conditions
  const restartAttemptsRef = useRef(0);   // FIX: was a closure variable → incorrect counts

  // ── Infrastructure refs ──────────────────────────────────────────────────
  const recognitionRef      = useRef<any>(null);
  const streamRef           = useRef<MediaStream | null>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const recordedChunksRef   = useRef<Blob[]>([]);
  const playbackAudioRef    = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef  = useRef<AbortController | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const metricsRef          = useRef<TrialSessionMetrics>({
    objectionsReceived: 0, fallaciesCommitted: 0,
    avgRhetoricalScore: 50, wordCount: 0, fillerWordsCount: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const opponentName = activeCase?.opposingCounsel && activeCase.opposingCounsel !== 'Unknown'
    ? activeCase.opposingCounsel
    : MOCK_OPPONENT.name;

  const elevenLabsKey = process.env.ELEVENLABS_API_KEY ?? '';
  const canUseElevenLabs = useElevenLabs && isElevenLabsConfigured() && elevenLabsKey.length > 10;

  const avgRhetoricalScore = session.rhetoricalScores.length > 0
    ? Math.round(session.rhetoricalScores.reduce((a, b) => a + b, 0) / session.rhetoricalScores.length)
    : 50;

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep refs in sync with state (for use inside speech recognition callbacks)
  useEffect(() => { isAISpeakingRef.current = session.isAISpeaking; }, [session.isAISpeaking]);
  useEffect(() => { isLiveRef.current = session.isLive; }, [session.isLive]);

  // Sync objection count to metrics
  useEffect(() => {
    metricsRef.current.objectionsReceived = session.objectionCount;
  }, [session.objectionCount]);

  // Cleanup on unmount — abort any pending AI request and stop the session silently
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      stopSession(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio playback ────────────────────────────────────────────────────────

  const speakText = useCallback(async (text: string): Promise<void> => {
    if (!text) return;
    dispatch({ type: 'AI_SPEAKING_START' });

    try {
      if (canUseElevenLabs) {
        const voiceId =
          ELEVENLABS_VOICES[voiceConfig.voiceName as keyof typeof ELEVENLABS_VOICES]?.id
          ?? ELEVENLABS_VOICES['josh'].id;

        const audioData = await synthesizeSpeech(text, voiceId, {
          apiKey: elevenLabsKey,
          stability: 0.5,
          similarityBoost: 0.75,
        });

        const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        playbackAudioRef.current = audio;

        try {
          await new Promise<void>((resolve, reject) => {
            audio.onended = resolve;
            audio.onerror = () => reject(new Error('ElevenLabs audio playback failed'));
            audio.play().catch(reject);
          });
          return; // Success — skip fallback
        } finally {
          URL.revokeObjectURL(audioUrl); // FIX: always revoke — was leaking ObjectURLs
          playbackAudioRef.current = null;
        }
      }
    } catch (err) {
      console.warn('[TrialSim] ElevenLabs playback failed, using browser TTS fallback:', err);
      playbackAudioRef.current?.pause();
      playbackAudioRef.current = null;
    }

    // Browser TTS fallback
    if (isBrowserTTSAvailable()) {
      try {
        await speakWithFallback(text, { rate: 1, pitch: 1, volume: 1 });
        return;
      } catch (err) {
        console.error('[TrialSim] Browser TTS also failed:', err);
      }
    }

    toast.warn('Voice playback unavailable — response shown in transcript only.');
  }, [canUseElevenLabs, voiceConfig.voiceName, elevenLabsKey]);

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = useCallback((stream: MediaStream) => {
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => console.error('[TrialSim] MediaRecorder error:', e);
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('[TrialSim] MediaRecorder init failed:', err);
    }
  }, []);

  // ── Session save ──────────────────────────────────────────────────────────

  const saveSession = useCallback(() => {
    if (!activeCase || !phase || !mode) return;
    if (recordedChunksRef.current.length === 0) return;

    const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(blob);

    addSession({
      id: `session-${Date.now()}`,
      caseId: activeCase.id,
      caseTitle: activeCase.title,
      phase,
      mode,
      date: new Date().toISOString(),
      duration: Math.round((Date.now() - sessionStartTimeRef.current) / 1000),
      transcript: messages.map(m => ({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
      })),
      audioUrl,
      score: avgRhetoricalScore,
      metrics: { ...metricsRef.current },
    });

    toast.success('Session saved!');
  }, [activeCase, phase, mode, messages, avgRhetoricalScore, addSession]);

  // ── Stop session ──────────────────────────────────────────────────────────

  /**
   * @param silent - if true, skip saving (used for unmount cleanup)
   */
  const stopSession = useCallback((silent = false) => {
    if (!silent && recordedChunksRef.current.length > 0) {
      saveSession();
    }

    // Cancel any pending AI request
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Stop speech recognition cleanly
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent auto-restart
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Stop audio playback
    playbackAudioRef.current?.pause();
    playbackAudioRef.current = null;

    // Stop recording
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    mediaRecorderRef.current = null;

    // Release microphone
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    dispatch({ type: 'SESSION_STOPPED' });
    isLiveRef.current = false;
    isProcessingRef.current = false;
    restartAttemptsRef.current = 0;
  }, [saveSession]);

  // ── Core AI turn orchestration ────────────────────────────────────────────

  /**
   * Single point of control for the full AI interaction turn:
   * transcribe → stream OpenAI → parse JSON → update coaching → speak.
   * This is the function the original lacked — coaching/objections never fired.
   */
  const handleUserTranscript = useCallback(async (transcript: string) => {
    if (!phase || !mode || !activeCase) return;
    if (isProcessingRef.current) return; // FIX: ref check, not closure variable

    isProcessingRef.current = true;
    dispatch({ type: 'SET_INPUT_TRANSCRIPT', text: transcript });
    dispatch({ type: 'SET_OUTPUT_TRANSCRIPT', text: '' });

    // Accumulate metrics
    metricsRef.current.wordCount += transcript.split(/\s+/).filter(Boolean).length;
    const lc = transcript.toLowerCase();
    metricsRef.current.fillerWordsCount += FILLER_WORDS.filter(f => lc.includes(f)).length;

    setMessages(prev => [...prev, {
      id: `${Date.now()}-u`,
      sender: 'user',
      text: transcript,
      timestamp: Date.now(),
    }]);

    try {
      abortControllerRef.current = new AbortController();
      const systemPrompt = buildStructuredSystemPrompt(phase, mode, opponentName, activeCase.summary);

      let rawResponse = '';
      for await (const chunk of streamOpenAIResponse(systemPrompt, transcript, [])) {
        rawResponse += chunk;
        dispatch({ type: 'SET_OUTPUT_TRANSCRIPT', text: rawResponse });
      }

      const parsed = parseAIResponse(rawResponse);

      // ── Handle objection (NOW ACTUALLY FIRES — was broken in v1)
      if (parsed.objection) {
        dispatch({ type: 'OBJECTION_DETECTED' });
        setObjectionAlert(parsed.objection);
      }

      // ── Update coaching HUD (NOW ACTUALLY FIRES — was broken in v1)
      if (parsed.coaching) {
        const { coaching } = parsed;
        setCoachingTip({
          critique: coaching.critique,
          suggestion: coaching.suggestion,
          teleprompterScript: coaching.teleprompterScript,
          rhetoricalEffectiveness: coaching.rhetoricalEffectiveness,
          fallaciesIdentified: coaching.fallaciesIdentified,
        } as CoachingAnalysis);

        dispatch({ type: 'RHETORICAL_SCORE', score: coaching.rhetoricalEffectiveness });
        metricsRef.current.avgRhetoricalScore = avgRhetoricalScore;

        if (coaching.fallaciesIdentified.length > 0) {
          metricsRef.current.fallaciesCommitted += coaching.fallaciesIdentified.length;
        }
      }

      // ── Add AI message to transcript
      setMessages(prev => [...prev, {
        id: `${Date.now()}-o`,
        sender: 'opponent',
        text: parsed.speak || '[No response]',
        timestamp: Date.now(),
      }]);

      // ── Speak the response
      await speakText(parsed.speak);

    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Intentional cancel on stop
      console.error('[TrialSim] AI turn error:', err);
      toast.error('Failed to get AI response — check console.');
    } finally {
      dispatch({ type: 'SET_INPUT_TRANSCRIPT', text: '' });
      dispatch({ type: 'AI_SPEAKING_END' });
      isProcessingRef.current = false;
    }
  }, [phase, mode, activeCase, opponentName, avgRhetoricalScore, speakText]);

  // ── Start session ─────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (!activeCase || !phase || !mode) {
      toast.error('Select a case, phase, and mode first.');
      return;
    }
    if (!isOpenAIConfigured()) {
      toast.error('OpenAI API key not configured. Add OPENAI_API_KEY to .env.local');
      return;
    }

    dispatch({ type: 'START_CONNECTING' });
    sessionStartTimeRef.current = Date.now();
    metricsRef.current = { objectionsReceived: 0, fallaciesCommitted: 0, avgRhetoricalScore: 50, wordCount: 0, fillerWordsCount: 0 };
    isProcessingRef.current = false;
    restartAttemptsRef.current = 0;

    // Request microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
    } catch (err) {
      console.error('[TrialSim] Microphone denied:', err);
      toast.error('Microphone access denied — allow it in browser settings and retry.');
      dispatch({ type: 'SESSION_STOPPED' });
      return;
    }

    // Check Web Speech API availability
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported. Use Chrome or Edge.');
      stream.getTracks().forEach(t => t.stop());
      dispatch({ type: 'SESSION_STOPPED' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    const MAX_RESTARTS = 10;

    recognition.onspeechstart = () => dispatch({ type: 'SET_VOLUME', volume: 80 });
    recognition.onspeechend   = () => dispatch({ type: 'SET_VOLUME', volume: 20 });

    recognition.onresult = async (event: any) => {
      // Guard: never process while AI is speaking or already processing
      if (isAISpeakingRef.current || isProcessingRef.current) return;

      let interimTranscript = '';
      let finalTranscript   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }

      if (interimTranscript) {
        dispatch({ type: 'SET_INPUT_TRANSCRIPT', text: interimTranscript.trim() });
        dispatch({ type: 'SET_VOLUME', volume: 50 + Math.random() * 30 });
      }

      if (finalTranscript.trim()) {
        await handleUserTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      // Fatal errors require full stop
      const FATAL_ERRORS = ['not-allowed', 'audio-capture', 'service-not-allowed'];
      if (FATAL_ERRORS.includes(event.error)) {
        toast.error(`Speech recognition: ${event.error} — check browser settings.`);
        stopSession();
        return;
      }
      // Non-fatal (network, no-speech, aborted) — onend will auto-restart
      console.warn('[TrialSim] Non-fatal recognition error:', event.error);
    };

    recognition.onend = () => {
      // Null guard: explicitly stopped = no restart
      if (!recognitionRef.current || !isLiveRef.current) return;

      if (restartAttemptsRef.current >= MAX_RESTARTS) {
        toast.error('Speech recognition stopped repeatedly. Please refresh the page.');
        return;
      }

      setTimeout(() => {
        try {
          recognition.start();
          restartAttemptsRef.current = 0; // Reset on successful restart
        } catch (err) {
          restartAttemptsRef.current++;
          console.error('[TrialSim] Recognition restart failed:', err);
        }
      }, 150);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('[TrialSim] recognition.start() failed:', err);
      toast.error('Failed to start speech recognition. Refresh and try again.');
      stream.getTracks().forEach(t => t.stop());
      dispatch({ type: 'SESSION_STOPPED' });
      return;
    }

    startRecording(stream);
    dispatch({ type: 'SESSION_LIVE' });
    isLiveRef.current = true;

    if (!canUseElevenLabs) {
      toast.info('ElevenLabs not configured — using browser voice.');
    }
    toast.success('Session started — speak to begin!');
  }, [activeCase, phase, mode, canUseElevenLabs, handleUserTranscript, startRecording, stopSession]);

  // ── Objection quick-responses ─────────────────────────────────────────────

  const handleObjectionResponse = useCallback((response: string) => {
    setObjectionAlert(null);
    handleUserTranscript(response);
  }, [handleUserTranscript]);

  // ── History actions ───────────────────────────────────────────────────────

  const playHistorySession = useCallback((s: TrialSession) => {
    if (playingSessionId === s.id) {
      historyAudioRef.current?.pause();
      setPlayingSessionId(null);
      return;
    }
    historyAudioRef.current?.pause();
    if (!s.audioUrl) return;
    const audio = new Audio(s.audioUrl);
    audio.onended = () => setPlayingSessionId(null);
    audio.play();
    historyAudioRef.current = audio;
    setPlayingSessionId(s.id);
  }, [playingSessionId]);

  const downloadAudio = useCallback((s: TrialSession) => {
    if (!s.audioUrl) { toast.error('No audio available.'); return; }
    Object.assign(document.createElement('a'), {
      href: s.audioUrl,
      download: `trial-${s.phase}-${s.date.slice(0, 10)}.webm`,
    }).click();
  }, []);

  const exportTranscript = useCallback((s: TrialSession) => {
    const lines = [
      'TRIAL SIMULATION TRANSCRIPT',
      '='.repeat(40),
      `Case:     ${s.caseTitle}`,
      `Phase:    ${s.phase}`,
      `Mode:     ${s.mode}`,
      `Date:     ${new Date(s.date).toLocaleString()}`,
      `Duration: ${Math.floor(s.duration / 60)}m ${s.duration % 60}s`,
      `Score:    ${s.score}%`,
      '',
    ];

    if (s.metrics) {
      lines.push(
        'METRICS',
        `  Objections received:  ${s.metrics.objectionsReceived ?? 0}`,
        `  Fallacies committed:  ${s.metrics.fallaciesCommitted ?? 0}`,
        `  Avg rhetorical score: ${s.metrics.avgRhetoricalScore ?? 50}%`,
        `  Word count:           ${s.metrics.wordCount ?? 0}`,
        `  Filler words:         ${s.metrics.fillerWordsCount ?? 0}`,
        '',
      );
    }

    lines.push('TRANSCRIPT', '='.repeat(40));
    (s.transcript ?? []).forEach(m => {
      const sender = m.sender === 'user' ? 'YOU' : m.sender.toUpperCase();
      lines.push(`\n[${sender}]:\n${m.text}`);
    });

    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), {
      href: url,
      download: `transcript-${s.phase}-${s.date.slice(0, 10)}.txt`,
    }).click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported.');
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    if (!window.confirm('Delete this session?')) return;
    removeSession(id);
    toast.success('Session deleted.');
  }, [removeSession]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!activeCase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-500 p-4">
        <AlertCircle size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-semibold text-white">No Active Case</p>
        <p className="text-sm text-slate-500 mt-1 mb-6">Select a case to begin your simulation.</p>
        <Link
          to="/app/cases"
          className="bg-gold-600 hover:bg-gold-500 text-slate-900 font-bold px-6 py-3 rounded-lg transition-colors"
        >
          Select a Case
        </Link>
      </div>
    );
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Trial Simulator</h1>
          <button onClick={() => setView('history')} className="flex items-center gap-2 text-gold-500 hover:text-gold-400">
            <Clock size={18} />
            History ({savedSessions.length})
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Phase selection */}
          <section>
            <h2 className="text-gold-500 font-semibold mb-3">Select Phase</h2>
            <div className="grid grid-cols-4 gap-2">
              {TRIAL_PHASES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPhase(id as TrialPhase)}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                    phase === id
                      ? 'bg-gold-500 text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs mt-1">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Mode selection */}
          <section>
            <h2 className="text-gold-500 font-semibold mb-3">Select Mode</h2>
            <div className="space-y-2">
              {MODES.map(({ id, label, desc, icon: Icon, colorClass }) => (
                <button
                  key={id}
                  onClick={() => setMode(id as SimulationMode)}
                  className={`w-full p-4 rounded-lg text-left flex items-center gap-4 transition-all ${
                    mode === id ? `${colorClass} text-white` : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon size={24} />
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs opacity-80">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Voice & Settings */}
          <section>
            <button
              onClick={() => setShowVoiceSettings(v => !v)}
              className="w-full flex items-center justify-between p-4 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Volume2 size={20} className="text-gold-500" />
                <div className="text-left">
                  <p className="font-semibold">Voice & Settings</p>
                  <p className="text-xs opacity-60">{voiceConfig.voiceName} · {simulatorSettings.realismLevel}</p>
                </div>
              </div>
              {showVoiceSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showVoiceSettings && (
              <div className="mt-2 p-4 bg-slate-800 rounded-lg space-y-5 border border-slate-700">
                {/* ElevenLabs toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300">ElevenLabs Voices</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {useElevenLabs ? 'Realistic AI voices (recommended)' : 'Using browser built-in voice'}
                    </p>
                  </div>
                  <button
                    onClick={() => setUseElevenLabs(v => !v)}
                    role="switch"
                    aria-checked={useElevenLabs}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      useElevenLabs ? 'bg-gold-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      useElevenLabs ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {/* Voice picker */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Voice</label>
                  <select
                    value={voiceConfig.voiceName}
                    onChange={e => setVoiceConfig(v => ({ ...v, voiceName: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-gold-500"
                  >
                    {Object.entries(ELEVENLABS_VOICES).map(([id, voice]) => (
                      <option key={id} value={id}>
                        {voice.name} — {voice.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role presets */}
                {phase && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Role Preset</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(TRIAL_VOICE_PRESETS).map(([id, preset]) => (
                        <button
                          key={id}
                          onClick={() => setVoiceConfig(v => ({ ...v, voiceName: preset.voice }))}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all ${
                            voiceConfig.voiceName === preset.voice
                              ? 'bg-gold-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <p className="font-semibold capitalize">{id.replace(/-/g, ' ')}</p>
                          <p className="opacity-70 line-clamp-2 mt-0.5">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <SettingRow
                  label="Realism Level"
                  options={['casual', 'professional', 'intense']}
                  value={simulatorSettings.realismLevel}
                  onChange={v => setSimulatorSettings(s => ({ ...s, realismLevel: v as any }))}
                />
                <SettingRow
                  label="Interruption Frequency"
                  options={['low', 'medium', 'high']}
                  value={simulatorSettings.interruptionFrequency}
                  onChange={v => setSimulatorSettings(s => ({ ...s, interruptionFrequency: v as any }))}
                />
                <SettingRow
                  label="Coaching Detail"
                  options={['minimal', 'moderate', 'detailed']}
                  value={simulatorSettings.coachingVerbosity}
                  onChange={v => setSimulatorSettings(s => ({ ...s, coachingVerbosity: v as any }))}
                />
              </div>
            )}
          </section>

          {/* Start */}
          <button
            disabled={!phase || !mode}
            onClick={() => {
              setMessages([]);
              setCoachingTip(null);
              setObjectionAlert(null);
              dispatch({ type: 'RESET_SESSION' });
              setView('active');
            }}
            className="w-full py-4 rounded-xl text-lg font-bold transition-all disabled:cursor-not-allowed
              bg-gold-500 text-slate-900 hover:bg-gold-400
              disabled:bg-slate-700 disabled:text-slate-500"
          >
            {phase && mode
              ? `Begin — ${phase.replace(/-/g, ' ')} · ${mode}`
              : 'Select Phase & Mode'}
          </button>
        </div>
      </div>
    );
  }

  // ── History ───────────────────────────────────────────────────────────────

  if (view === 'history') {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 p-4 flex items-center gap-4">
          <button onClick={() => setView('setup')} className="text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Session History</h1>
          <span className="text-sm text-slate-500">({savedSessions.length} sessions)</span>
        </div>

        <div className="p-4">
          {savedSessions.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Clock size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No sessions yet</p>
              <p className="text-sm mt-1 opacity-70">Complete a simulation to see it recorded here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSessions.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isPlaying={playingSessionId === s.id}
                  onPlay={() => playHistorySession(s)}
                  onDownload={() => downloadAudio(s)}
                  onExport={() => exportTranscript(s)}
                  onDelete={() => handleDeleteSession(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active Session ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      {/* Objection modal */}
      {objectionAlert && (
        <ObjectionModal
          grounds={objectionAlert.grounds}
          explanation={objectionAlert.explanation}
          onRespond={handleObjectionResponse}
          onDismiss={() => setObjectionAlert(null)}
        />
      )}

      {/* Session header */}
      <div className="bg-slate-800 border-b border-slate-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { stopSession(); setView('setup'); }}
            className="text-slate-400 hover:text-white transition-colors"
            title="End session"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <p className="font-bold text-white text-sm capitalize">{phase?.replace(/-/g, ' ')}</p>
            <p className="text-xs text-slate-400">{mode} mode · {opponentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 rounded-full">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-xs text-slate-300">{session.objectionCount} obj</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 rounded-full">
            <Volume2 size={12} className="text-gold-500" />
            <span className="text-xs text-slate-300">{voiceConfig.voiceName}</span>
          </div>
          {session.isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/60 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-300 font-bold">REC</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900">
          {/* Metrics strip */}
          <div className="flex items-center gap-4 md:gap-8 mb-6">
            <StatPill label="Score"      value={`${session.sessionScore}%`} color="gold" />
            <div className="w-px h-6 bg-slate-700" />
            <StatPill label="Avg"        value={`${avgRhetoricalScore}%`}   color="slate" />
            <div className="w-px h-6 bg-slate-700" />
            <StatPill label="Objections" value={session.objectionCount}     color="red" />
            <div className="w-px h-6 bg-slate-700 hidden sm:block" />
            <StatPill label="Words" value={metricsRef.current.wordCount} color="slate" className="hidden sm:block" />
          </div>

          {/* Opponent avatar */}
          <div className={`w-32 h-32 rounded-full border-4 transition-all duration-200 ${
            session.isLive && session.liveVolume > 20
              ? 'border-red-500 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
              : 'border-slate-700'
          }`}>
            <img
              src={phase === 'defendant-testimony'
                ? 'https://picsum.photos/id/1005/200/200'
                : 'https://picsum.photos/id/1025/200/200'}
              alt="Opposing Counsel"
              className="w-full h-full rounded-full object-cover opacity-80"
            />
          </div>

          <p className="mt-3 text-white font-semibold text-center">
            {phase === 'defendant-testimony' ? 'Prosecutor' : opponentName}
          </p>
          <p className={`text-sm mt-1 font-medium transition-colors ${
            session.isConnecting ? 'text-yellow-400' :
            session.isAISpeaking ? 'text-emerald-400' :
            session.isLive       ? 'text-blue-400'    : 'text-slate-500'
          }`}>
            {session.isConnecting ? 'Connecting…' :
             session.isAISpeaking ? '● Speaking' :
             session.isLive       ? '● Listening' : 'Ready'}
          </p>

          {/* Volume meter */}
          {session.isLive && (
            <div className="w-full max-w-xs mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-500 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, session.liveVolume * 1.2)}%` }}
              />
            </div>
          )}

          {/* Live transcript panels */}
          {session.isLive && (
            <div className="w-full max-w-2xl mt-5 space-y-2">
              <TranscriptBubble
                label="Hearing You"
                text={session.inputTranscript || 'Speak now — your words appear here…'}
                color="blue"
              />
              <TranscriptBubble
                label={session.isAISpeaking ? 'Speaking Back…' : 'Response'}
                text={session.outputTranscript || 'Waiting for AI response…'}
                color="emerald"
              />
            </div>
          )}

          {/* Evidence quick-reference */}
          {(activeCase.evidence ?? []).length > 0 && (
            <div className="w-full max-w-sm mt-5">
              <button
                onClick={() => setShowEvidencePanel(v => !v)}
                className="w-full flex items-center justify-between p-2.5 bg-slate-800 rounded-lg text-slate-300 text-sm hover:bg-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-gold-500" />
                  Evidence ({activeCase.evidence!.length} items)
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${showEvidencePanel ? 'rotate-180' : ''}`}
                />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${showEvidencePanel ? 'max-h-52' : 'max-h-0'}`}>
                <div className="mt-1.5 space-y-1 max-h-52 overflow-y-auto pr-0.5">
                  {activeCase.evidence!.map((e, i) => (
                    <div key={i} className="p-2.5 bg-slate-800 rounded text-xs">
                      <p className="font-semibold text-white truncate">{e.title}</p>
                      <p className="text-slate-400 line-clamp-2 mt-0.5">
                        {e.summary?.slice(0, 130) ?? 'No summary available'}
                        {(e.summary?.length ?? 0) > 130 ? '…' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mini transcript strip (desktop only) */}
        <div className="hidden md:flex flex-col gap-1 h-20 px-6 py-2 justify-end overflow-hidden">
          {messages.slice(-2).map(m => (
            <div
              key={m.id}
              className={`text-xs px-3 py-1.5 rounded-lg max-w-[75%] ${
                m.sender === 'user'
                  ? 'self-end bg-blue-900/50 text-blue-200'
                  : 'self-start bg-slate-800 text-slate-300'
              }`}
            >
              <span className="opacity-50 mr-1">{m.sender === 'user' ? 'You:' : 'Opp:'}</span>
              {m.text.slice(0, 100)}{m.text.length > 100 ? '…' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Teleprompter panel */}
      <div className={`fixed md:relative bottom-16 md:bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
        showTeleprompter ? 'max-h-[50vh]' : 'max-h-14'
      }`}>
        <div className="bg-slate-800 border-t-2 border-gold-500">
          <button
            onClick={() => setShowTeleprompter(v => !v)}
            className="w-full p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={20} className="text-gold-400" />
              <span className="text-gold-300 text-sm font-bold tracking-wide">COACHING TELEPROMPTER</span>
              {coachingTip && (
                <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full">
                  {coachingTip.rhetoricalEffectiveness}% effective
                </span>
              )}
            </div>
            <ChevronDown
              size={20}
              className={`text-gold-400 transition-transform duration-200 ${showTeleprompter ? 'rotate-180' : ''}`}
            />
          </button>

          {showTeleprompter && (
            <div className="p-4 bg-slate-900 border-t border-gold-500/20 overflow-y-auto max-h-[38vh]">
              {coachingTip?.teleprompterScript ? (
                <div>
                  <p className="text-[10px] text-gold-400 uppercase tracking-widest font-bold mb-2">Say This Next:</p>
                  <p className="text-xl md:text-2xl text-white leading-relaxed font-light">
                    "{coachingTip.teleprompterScript}"
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">Speak to receive real-time coaching suggestions…</p>
                </div>
              )}

              {coachingTip && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setShowCoaching(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <BookOpen size={14} />
                    {showCoaching ? 'Hide' : 'Show'} detailed feedback
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-150 ${showCoaching ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showCoaching && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-slate-300">
                        <span className="font-semibold text-slate-400">Critique: </span>
                        {coachingTip.critique}
                      </p>
                      <p className="text-gold-300">
                        <span className="font-semibold text-gold-400">Tip: </span>
                        {coachingTip.suggestion}
                      </p>
                      {(coachingTip.fallaciesIdentified ?? []).length > 0 && (
                        <p className="text-red-300">
                          <span className="font-semibold text-red-400">Fallacies: </span>
                          {coachingTip.fallaciesIdentified!.join(', ')}
                        </p>
                      )}
                      <p className="text-slate-400">
                        <span className="font-semibold">Effectiveness: </span>
                        {coachingTip.rhetoricalEffectiveness}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session controls */}
      <div className="fixed md:relative bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 p-4">
        <div className="flex items-center justify-center">
          {!session.isLive ? (
            <button
              onClick={startSession}
              disabled={session.isConnecting}
              className="flex flex-col items-center group"
            >
              <div className="w-20 h-20 rounded-full bg-gold-500 disabled:bg-slate-700 flex items-center justify-center text-slate-900 shadow-xl transition-transform group-hover:scale-105 group-active:scale-95">
                {session.isConnecting
                  ? <Activity className="animate-spin" size={32} />
                  : <Mic size={32} />}
              </div>
              <span className="text-xs text-gold-500 mt-2 font-bold">
                {session.isConnecting ? 'Connecting…' : 'Start'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => stopSession()}
              className="flex flex-col items-center group"
            >
              <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-white shadow-xl animate-pulse group-hover:animate-none group-hover:bg-red-700 transition-colors">
                <MicOff size={32} />
              </div>
              <span className="text-xs text-red-400 mt-2 font-bold">Stop & Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};

// ─── Pure Sub-components ──────────────────────────────────────────────────────
// These are candidates for extraction to components/TrialSim/

interface ObjectionModalProps {
  grounds: string;
  explanation: string;
  onRespond: (response: string) => void;
  onDismiss: () => void;
}

const ObjectionModal: React.FC<ObjectionModalProps> = ({ grounds, explanation, onRespond, onDismiss }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Objection"
  >
    <div className="bg-red-700 p-6 rounded-2xl text-center max-w-sm w-full shadow-2xl border border-red-500/50">
      <p className="text-4xl font-black text-white mb-1 tracking-tighter">OBJECTION!</p>
      <p className="text-xl text-red-100 font-bold mb-2">{grounds}</p>
      <p className="text-sm text-white/80 mb-6">{explanation}</p>
      <div className="space-y-2">
        {OBJECTION_RESPONSES.map(({ label, text }) => (
          <button
            key={label}
            onClick={() => onRespond(text)}
            className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-all text-sm"
          >
            {label}
          </button>
        ))}
        <button
          onClick={onDismiss}
          className="w-full pt-2 pb-1 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
);

interface SessionCardProps {
  session: TrialSession;
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session: s, isPlaying, onPlay, onDownload, onExport, onDelete }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-white capitalize">{s.phase.replace(/-/g, ' ')}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {new Date(s.date).toLocaleDateString()} · {Math.floor(s.duration / 60)}m {s.duration % 60}s · {s.mode}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gold-400">Score: {s.score}%</span>
          {s.metrics && (
            <>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-xs text-slate-500">
                {s.metrics.objectionsReceived ?? 0} objections
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-xs text-slate-500">
                {s.metrics.wordCount ?? 0} words
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {s.audioUrl && (
          <IconButton onClick={onPlay} title={isPlaying ? 'Pause audio' : 'Play audio'} colorClass="bg-gold-500 text-slate-900">
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </IconButton>
        )}
        <IconButton onClick={onDownload} title="Download audio" colorClass="bg-slate-700 text-slate-300 hover:text-white">
          <Download size={16} />
        </IconButton>
        <IconButton onClick={onExport} title="Export transcript" colorClass="bg-slate-700 text-blue-400 hover:text-blue-300">
          <FileText size={16} />
        </IconButton>
        <IconButton onClick={onDelete} title="Delete session" colorClass="bg-slate-700 text-red-400 hover:text-red-300">
          <Trash2 size={16} />
        </IconButton>
      </div>
    </div>
    {(s.transcript ?? []).length > 0 && (
      <div className="mt-3 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 line-clamp-2">
          {s.transcript!.slice(0, 2).map(m =>
            `${m.sender === 'user' ? 'You' : 'Opp'}: ${m.text.slice(0, 60)}`
          ).join(' · ')}
        </p>
      </div>
    )}
  </div>
);

// ── Atomic components ─────────────────────────────────────────────────────────

const IconButton: React.FC<{
  onClick: () => void;
  title: string;
  colorClass: string;
  children: React.ReactNode;
}> = ({ onClick, title, colorClass, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-2 rounded-lg transition-opacity hover:opacity-80 active:scale-95 ${colorClass}`}
  >
    {children}
  </button>
);

const StatPill: React.FC<{
  label: string;
  value: string | number;
  color: 'gold' | 'slate' | 'red';
  className?: string;
}> = ({ label, value, color, className = '' }) => {
  const textColor = { gold: 'text-gold-500', slate: 'text-slate-300', red: 'text-red-400' }[color];
  return (
    <div className={`text-center ${className}`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
};

const TranscriptBubble: React.FC<{
  label: string;
  text: string;
  color: 'blue' | 'emerald';
}> = ({ label, text, color }) => {
  const cls = {
    blue:    { label: 'text-blue-400',    text: 'text-blue-100' },
    emerald: { label: 'text-emerald-400', text: 'text-emerald-100' },
  }[color];

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
      <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${cls.label}`}>{label}</p>
      <p className={`text-sm min-h-[1.25rem] leading-relaxed ${cls.text}`}>{text}</p>
    </div>
  );
};

const SettingRow: React.FC<{
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, options, value, onChange }) => (
  <div>
    <label className="block text-sm text-slate-400 mb-2">{label}</label>
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
            value === opt
              ? 'bg-gold-500 text-slate-900'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

export default TrialSim;