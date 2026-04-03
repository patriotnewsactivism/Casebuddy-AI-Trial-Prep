import React, { useState, useRef, useCallback, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Message, TrialPhase, SimulationMode } from '../types';
import {
  Mic, MicOff, ArrowLeft, GraduationCap, Sword, BookOpen,
  Volume2, VolumeX, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { getTrialSimSystemPrompt } from '../services/openAIService';
import { callGeminiProxy } from '../services/apiProxy';
import { Type } from '@google/genai';
import {
  ELEVENLABS_VOICES,
  isElevenLabsConfigured, synthesizeSpeech, ensureAudioUnlocked
} from '../services/elevenLabsService';
import { isBrowserTTSAvailable, speakWithFallback } from '../services/browserTTSService';
import { toast } from 'react-toastify';

// ─── Types ───────────────────────────────────────────────────
interface AIResponse {
  speak: string;
  action: 'response' | 'objection' | 'ruling' | 'question';
  objection: { grounds: string; explanation: string } | null;
  coaching: {
    critique: string;
    suggestion: string;
    teleprompterScript: string;
    rhetoricalEffectiveness: number;
  };
}

const PHASES: { id: TrialPhase; label: string }[] = [
  { id: 'pre-trial-motions', label: 'Pre-Trial Motions' },
  { id: 'voir-dire', label: 'Voir Dire' },
  { id: 'opening-statement', label: 'Opening Statement' },
  { id: 'direct-examination', label: 'Direct Examination' },
  { id: 'cross-examination', label: 'Cross-Examination' },
  { id: 'closing-argument', label: 'Closing Argument' },
  { id: 'sentencing', label: 'Sentencing' },
];

const MODES: { id: SimulationMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'learn', label: 'Learn', icon: <GraduationCap size={20} />, desc: 'Step-by-step teaching' },
  { id: 'practice', label: 'Practice', icon: <BookOpen size={20} />, desc: 'Guided with coaching' },
  { id: 'trial', label: 'Trial', icon: <Sword size={20} />, desc: 'Full realism' },
];

// ─── Component ───────────────────────────────────────────────
const ArgumentPractice: React.FC = () => {
  const { activeCase } = useContext(AppContext);

  // Setup state
  const [view, setView] = useState<'setup' | 'active'>('setup');
  const [phase, setPhase] = useState<TrialPhase | null>(null);
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [voiceKey, setVoiceKey] = useState<string>('josh');

  // Session state
  const [isLive, setIsLive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [teleprompter, setTeleprompter] = useState('');
  const [coaching, setCoaching] = useState<{ critique: string; suggestion: string } | null>(null);
  const [showCoachingDetail, setShowCoachingDetail] = useState(false);
  const [objection, setObjection] = useState<{ grounds: string; explanation: string } | null>(null);
  const [score, setScore] = useState(0);
  const [scoreCount, setScoreCount] = useState(0);
  const [muted, setMuted] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const isLiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationHistory = useRef<Array<{ role: string; parts: Array<{ text: string }> }>>([]);

  // Keep refs in sync
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // ─── TTS ─────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (muted || !text.trim()) return;
    setIsSpeaking(true);

    try {
      if (isElevenLabsConfigured()) {
        const voice = ELEVENLABS_VOICES[voiceKey as keyof typeof ELEVENLABS_VOICES];
        const voiceId = voice?.id || ELEVENLABS_VOICES.josh.id;

        const audioData = await synthesizeSpeech(text, voiceId, {
          stability: 0.5,
          similarityBoost: 0.75,
          modelId: 'eleven_turbo_v2_5',
        });

        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        playbackRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Audio playback failed')); };
          audio.play().catch(reject);
        });
      } else if (isBrowserTTSAvailable()) {
        await speakWithFallback(text, { rate: 1, pitch: 1, volume: 1 });
      }
    } catch (e) {
      console.warn('[TrialSim] TTS error:', e);
    } finally {
      playbackRef.current = null;
      setIsSpeaking(false);
    }
  }, [voiceKey, muted]);

  // ─── AI Response ─────────────────────────────────────────
  const getAIResponse = useCallback(async (userText: string) => {
    if (!phase || !mode) return;
    setIsProcessing(true);

    const opponentName = activeCase?.opposingCounsel || 'Opposing Counsel';
    const caseSummary = activeCase
      ? `${activeCase.title}: ${activeCase.summary || 'No summary available'}`
      : 'General trial practice scenario';

    const systemPrompt = getTrialSimSystemPrompt(phase, mode, opponentName, caseSummary);

    // Add user message to history
    conversationHistory.current.push({ role: 'user', parts: [{ text: userText }] });

    try {
      const response = await callGeminiProxy({
        prompt: userText,
        systemPrompt,
        model: 'gemini-2.5-flash',
        conversationHistory: conversationHistory.current.slice(-20),
        options: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              speak: { type: Type.STRING },
              action: { type: Type.STRING, enum: ['response', 'objection', 'ruling', 'question'] },
              objection: {
                type: Type.OBJECT, nullable: true,
                properties: {
                  grounds: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
              },
              coaching: {
                type: Type.OBJECT,
                properties: {
                  critique: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                  teleprompterScript: { type: Type.STRING },
                  rhetoricalEffectiveness: { type: Type.NUMBER },
                },
              },
            },
            required: ['speak', 'coaching'],
          },
          temperature: 0.8,
        },
      });

      if (!response.success || !response.text) {
        throw new Error(response.error?.message || 'Empty AI response');
      }

      const parsed: AIResponse = JSON.parse(response.text.replace(/```json\n?|```/g, '').trim());

      // Update conversation history
      conversationHistory.current.push({ role: 'model', parts: [{ text: parsed.speak }] });

      // Update messages
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), sender: 'user' as const, text: userText, timestamp: Date.now() },
        { id: crypto.randomUUID(), sender: 'opponent' as const, text: parsed.speak, timestamp: Date.now() },
      ]);

      // Update coaching UI
      setAiTranscript(parsed.speak);
      setTeleprompter(parsed.coaching.teleprompterScript || '');
      setCoaching({ critique: parsed.coaching.critique, suggestion: parsed.coaching.suggestion });

      // Update running average score
      if (parsed.coaching.rhetoricalEffectiveness) {
        setScoreCount(prev => {
          const newCount = prev + 1;
          setScore(s => Math.round((s * prev + parsed.coaching.rhetoricalEffectiveness) / newCount));
          return newCount;
        });
      }

      // Handle objection
      if (parsed.action === 'objection' && parsed.objection) {
        setObjection(parsed.objection);
        setTimeout(() => setObjection(null), 6000);
      }

      // Speak the response
      await speakText(parsed.speak);

    } catch (e: any) {
      console.error('[TrialSim] AI response error:', e);
      toast.error('AI response failed. Try speaking again.');
    } finally {
      setIsProcessing(false);
    }
  }, [phase, mode, activeCase, speakText]);

  // ─── Speech Recognition ──────────────────────────────────
  const processTranscript = useCallback((text: string) => {
    if (!text.trim() || isProcessingRef.current || isSpeakingRef.current) return;
    setUserTranscript(text);
    getAIResponse(text);
  }, [getAIResponse]);

  const stopSession = useCallback(() => {
    setIsLive(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setView('setup');
  }, []);

  const startSession = useCallback(async () => {
    if (!phase || !mode) return;

    try {
      await ensureAudioUnlocked();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        toast.error('Speech recognition not supported. Use Chrome or Edge.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      let restartCount = 0;

      recognition.onresult = (event: any) => {
        // Don't capture while AI is speaking or processing
        if (isSpeakingRef.current || isProcessingRef.current) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }

        // Show live transcript
        setUserTranscript(final || interim);
        setIsListening(true);

        // Clear previous silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (final.trim()) {
          processTranscript(final.trim());
        } else if (interim.trim()) {
          // Wait 2s of silence then process interim
          silenceTimerRef.current = setTimeout(() => {
            if (!isProcessingRef.current && !isSpeakingRef.current && isLiveRef.current) {
              processTranscript(interim.trim());
            }
          }, 2000);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[TrialSim] Recognition error:', event.error);
        if (['not-allowed', 'audio-capture', 'service-not-allowed'].includes(event.error)) {
          toast.error(`Microphone error: ${event.error}`);
          stopSession();
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (isLiveRef.current && restartCount < 10) {
          restartCount++;
          setTimeout(() => {
            if (isLiveRef.current) {
              try { recognition.start(); } catch { /* ignore */ }
            }
          }, 150);
        }
      };

      recognition.start();
      setIsLive(true);
      setView('active');
      setMessages([]);
      conversationHistory.current = [];
      setScore(0);
      setScoreCount(0);
      setTeleprompter('');
      setCoaching(null);
      setAiTranscript('');
      setUserTranscript('');

      // Opening AI message
      const openingPrompt = mode === 'learn'
        ? `Session starting. Phase: ${phase}. Welcome the attorney, explain this phase, and suggest how to begin. Be encouraging and educational.`
        : `The ${phase} phase is now in session. Set the scene briefly and respond in character.`;

      setTimeout(() => getAIResponse(openingPrompt), 500);

    } catch (e: any) {
      console.error('[TrialSim] Start failed:', e);
      toast.error(e.message || 'Failed to start session');
    }
  }, [phase, mode, processTranscript, getAIResponse, stopSession]);

  // Cleanup on unmount
  useEffect(() => () => stopSession(), [stopSession]);

  // ─── SETUP VIEW ──────────────────────────────────────────
  if (view === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold text-white">Trial Simulator</h1>
        <p className="text-slate-400 text-sm">Select a trial phase and difficulty, then enter the courtroom.</p>

        {/* Phase */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Trial Phase</label>
          <div className="grid grid-cols-2 gap-2">
            {PHASES.map(p => (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className={`p-3 rounded-lg text-sm font-medium transition-all text-left ${
                  phase === p.id ? 'bg-gold-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-3 rounded-lg text-center transition-all ${
                  mode === m.id ? 'bg-gold-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="flex justify-center mb-1">{m.icon}</div>
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-xs opacity-70">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Voice */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">Opponent Voice (ElevenLabs)</label>
          <select
            value={voiceKey}
            onChange={e => setVoiceKey(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm"
          >
            {Object.entries(ELEVENLABS_VOICES).map(([key, v]) => (
              <option key={key} value={key}>{v.name} — {v.description}</option>
            ))}
          </select>
        </div>

        {/* Start */}
        <button
          onClick={startSession}
          disabled={!phase || !mode}
          className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold py-4 rounded-xl text-lg"
        >
          Enter Courtroom
        </button>
      </div>
    );
  }

  // ─── ACTIVE SESSION VIEW ─────────────────────────────────
  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={stopSession} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Exit
        </button>
        <div className="text-center">
          <span className="text-gold-500 font-semibold text-sm">{PHASES.find(p => p.id === phase)?.label}</span>
          <span className="text-slate-500 text-xs ml-2">({mode})</span>
        </div>
        <div className="flex items-center gap-3">
          {score > 0 && <span className="text-gold-500 font-bold text-sm">{score}%</span>}
          <button onClick={() => setMuted(!muted)} className="text-slate-400 hover:text-white">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* Objection Banner */}
      {objection && (
        <div className="bg-red-900/90 text-white px-4 py-3 text-center animate-pulse shrink-0">
          <div className="font-bold text-lg">OBJECTION! — {objection.grounds}</div>
          <div className="text-sm text-red-200">{objection.explanation}</div>
        </div>
      )}

      {/* Main scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* User transcript */}
        {userTranscript && (
          <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg p-3">
            <div className="text-blue-400 text-xs font-semibold mb-1">YOU</div>
            <div className="text-white text-base">{userTranscript}</div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Thinking...
          </div>
        )}

        {/* AI response */}
        {aiTranscript && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
            <div className="text-gold-500 text-xs font-semibold mb-1">OPPOSING COUNSEL</div>
            <div className="text-slate-200 text-base">{aiTranscript}</div>
          </div>
        )}

        {/* Transcript history */}
        {messages.length > 2 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-slate-500 text-xs font-semibold">TRANSCRIPT</div>
            {messages.slice(-10).map(msg => (
              <div key={msg.id} className={`text-sm ${msg.sender === 'user' ? 'text-blue-300' : 'text-slate-400'}`}>
                <span className="font-semibold">{msg.sender === 'user' ? 'You: ' : 'Counsel: '}</span>
                {msg.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TELEPROMPTER — fixed above mic bar ───────────── */}
      {(teleprompter || coaching) && (
        <div className="border-t border-slate-700 bg-slate-900/95 px-4 py-3 shrink-0">
          {teleprompter && (
            <div className="mb-2">
              <div className="text-gold-500 text-xs font-bold uppercase tracking-wide mb-1">Say This</div>
              <div className="text-white text-lg leading-relaxed font-medium">"{teleprompter}"</div>
            </div>
          )}
          {coaching && (
            <div>
              <button
                onClick={() => setShowCoachingDetail(!showCoachingDetail)}
                className="flex items-center gap-1 text-slate-400 text-xs hover:text-white"
              >
                {showCoachingDetail ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                Coaching Notes
              </button>
              {showCoachingDetail && (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="text-yellow-400">{coaching.critique}</div>
                  <div className="text-green-400">{coaching.suggestion}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MIC CONTROL ──────────────────────────────────── */}
      <div className="px-4 py-4 bg-slate-900 border-t border-slate-700 flex items-center justify-center gap-4 shrink-0">
        <button
          onClick={stopSession}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30'
              : isSpeaking
                ? 'bg-purple-600 shadow-lg shadow-purple-500/30'
                : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          <MicOff size={28} className="text-white" />
        </button>
        <div className="text-slate-400 text-xs">
          {isSpeaking ? 'AI speaking...' : isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Waiting...'}
        </div>
      </div>
    </div>
  );
};

export default ArgumentPractice;
