import React, { useState, useRef, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import { MOCK_OPPONENT } from '../constants';
import { CoachingAnalysis, Message, TrialPhase, SimulationMode, TrialSession, VoiceConfig, SimulatorSettings, TrialSessionMetrics } from '../types';
import { Mic, MicOff, Activity, AlertTriangle, Lightbulb, AlertCircle, PlayCircle, BookOpen, Sword, GraduationCap, User, Gavel, ArrowLeft, FileText, Users, Scale, Clock, Play, Pause, Trash2, Download, List, ChevronDown, Link, Settings, Volume2, ChevronUp, FolderOpen, X } from 'lucide-react';
import { getTrialSimSystemPrompt, isOpenAIConfigured, streamOpenAIResponse } from '../services/openAIService';
import { ElevenLabsStreamer, ELEVENLABS_VOICES, TRIAL_VOICE_PRESETS, isElevenLabsConfigured } from '../services/elevenLabsService';
import { toast } from 'react-toastify';

interface EvidenceDataForSim {
  summary: string;
  entities: string[];
  keyDates: string[];
}

interface GenAIBlob {
  data: string;
  mimeType: string;
}

function createBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const TrialSim = () => {
  const { activeCase } = useContext(AppContext);
  const [phase, setPhase] = useState<TrialPhase | null>(null);
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [simState, setSimState] = useState<'setup' | 'active' | 'history'>('setup');
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [objectionAlert, setObjectionAlert] = useState<{grounds: string, explanation: string} | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [coachingTip, setCoachingTip] = useState<CoachingAnalysis | null>(null);
  const [savedSessions, setSavedSessions] = useState<TrialSession[]>([]);
  const [playingSession, setPlayingSession] = useState<string | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    voiceName: 'josh',
    personality: 'neutral',
    languageCode: 'en-US',
  });
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [simulatorSettings, setSimulatorSettings] = useState<SimulatorSettings>({
    voice: { voiceName: 'josh', personality: 'neutral', languageCode: 'en-US' },
    realismLevel: 'professional',
    interruptionFrequency: 'medium',
    coachingVerbosity: 'moderate',
    audioQuality: 'high',
  });
  const [evidenceData, setEvidenceData] = useState<EvidenceDataForSim[]>([]);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [objectionCount, setObjectionCount] = useState(0);
  const [sessionScore, setSessionScore] = useState(50);
  const [avgRhetoricalScore, setAvgRhetoricalScore] = useState(50);
  const [rhetoricalScores, setRhetoricalScores] = useState<number[]>([]);
  const [useElevenLabs, setUseElevenLabs] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const keepaliveRef = useRef<NodeJS.Timeout | null>(null);
  const isLiveRef = useRef<boolean>(false);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const sessionStartTime = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3;
  const elevenLabsRef = useRef<ElevenLabsStreamer | null>(null);
  const metricsRef = useRef<TrialSessionMetrics>({
    objectionsReceived: 0,
    fallaciesCommitted: 0,
    avgRhetoricalScore: 50,
    wordCount: 0,
    fillerWordsCount: 0,
  });

  useEffect(() => {
    if (activeCase) {
      const saved = localStorage.getItem(`trial_sessions_${activeCase.id}`);
      if (saved) setSavedSessions(JSON.parse(saved));
      
      const evidence: EvidenceDataForSim[] = (activeCase.evidence || []).map(e => ({
        summary: e.summary || e.title,
        entities: e.keyEntities || [],
        keyDates: []
      }));
      setEvidenceData(evidence);
    }
  }, [activeCase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (objectionAlert) {
      setObjectionCount(prev => {
        const newCount = prev + 1;
        metricsRef.current.objectionsReceived = newCount;
        return newCount;
      });
    }
  }, [objectionAlert]);

  useEffect(() => {
    if (coachingTip) {
      const score = coachingTip.rhetoricalEffectiveness || 50;
      setRhetoricalScores(prev => {
        const updated = [...prev, score];
        const avg = Math.round(updated.reduce((a, b) => a + b, 0) / updated.length);
        setAvgRhetoricalScore(avg);
        metricsRef.current.avgRhetoricalScore = avg;
        return updated;
      });
      setSessionScore(score);
      
      if (coachingTip.fallaciesIdentified && coachingTip.fallaciesIdentified.length > 0) {
        metricsRef.current.fallaciesCommitted += coachingTip.fallaciesIdentified.length;
      }
    }
  }, [coachingTip]);

  const opponentName = activeCase?.opposingCounsel && activeCase.opposingCounsel !== 'Unknown' 
    ? activeCase.opposingCounsel 
    : MOCK_OPPONENT.name;

  const saveSession = () => {
    if (recordedChunksRef.current.length === 0 || !activeCase) return;
    
    const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(blob);
    
    const session: TrialSession = {
      id: `session-${Date.now()}`,
      caseId: activeCase.id,
      caseTitle: activeCase.title,
      phase: phase || 'unknown',
      mode: mode || 'practice',
      date: new Date().toISOString(),
      duration: Math.round((Date.now() - sessionStartTime.current) / 1000),
      transcript: messages.map(m => ({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp
      })),
      audioUrl,
      score: avgRhetoricalScore,
      metrics: { ...metricsRef.current }
    };
    
    const updated = [session, ...savedSessions].slice(0, 20);
    setSavedSessions(updated);
    localStorage.setItem(`trial_sessions_${activeCase.id}`, JSON.stringify(updated));
    toast.success('Session saved!');
  };

  const stopLiveSession = (preserveForReconnect = false) => {
    console.log('[TrialSim] Stopping session, preserveForReconnect:', preserveForReconnect);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (!preserveForReconnect) {
      saveSession();
      reconnectAttemptsRef.current = 0; // Reset on intentional stop
    }
    
    // Cleanup ElevenLabs
    if (elevenLabsRef.current) {
      elevenLabsRef.current.disconnect();
      elevenLabsRef.current = null;
    }
    
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
    
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch (e) {}
      if (!preserveForReconnect) scriptProcessorRef.current = null;
    }
    
    if (!preserveForReconnect) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      inputContextRef.current?.close();
      inputContextRef.current = null;
      outputContextRef.current?.close();
      outputContextRef.current = null;
    }
    
    setIsLive(false);
    isLiveRef.current = false;
    setIsConnecting(false);
    setLiveVolume(0);
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    metricsRef.current = {
      objectionsReceived: objectionCount,
      fallaciesCommitted: 0,
      avgRhetoricalScore: 50,
      wordCount: 0,
      fillerWordsCount: 0,
    };
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (e) {
      console.error('Recording failed', e);
    }
  };

  const playSession = (session: TrialSession) => {
    if (playingSession === session.id) {
      audioRef.current?.pause();
      setPlayingSession(null);
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (session.audioUrl) {
      audioRef.current = new Audio(session.audioUrl);
      audioRef.current.onended = () => setPlayingSession(null);
      audioRef.current.play();
      setPlayingSession(session.id);
    }
  };

  const deleteSession = (id: string) => {
    if (window.confirm('Delete this session?')) {
      const updated = savedSessions.filter(s => s.id !== id);
      setSavedSessions(updated);
      if (activeCase) {
        localStorage.setItem(`trial_sessions_${activeCase.id}`, JSON.stringify(updated));
      }
      toast.success('Session deleted');
    }
  };

  const downloadAudio = (session: TrialSession) => {
    if (!session.audioUrl) {
      toast.error('No audio available');
      return;
    }
    const a = document.createElement('a');
    a.href = session.audioUrl;
    a.download = `trial-session-${session.phase}-${new Date(session.date).toISOString().slice(0, 10)}.webm`;
    a.click();
  };

  const exportTranscript = (session: TrialSession) => {
    let content = `TRIAL SIMULATION TRANSCRIPT\n`;
    content += `========================\n\n`;
    content += `Case: ${session.caseTitle}\n`;
    content += `Phase: ${session.phase}\n`;
    content += `Mode: ${session.mode}\n`;
    content += `Date: ${new Date(session.date).toLocaleString()}\n`;
    content += `Duration: ${Math.floor(session.duration / 60)}m ${session.duration % 60}s\n`;
    content += `Score: ${session.score}%\n`;
    if (session.metrics) {
      content += `\nSession Metrics:\n`;
      content += `- Objections Received: ${session.metrics.objectionsReceived || 0}\n`;
      content += `- Fallacies Committed: ${session.metrics.fallaciesCommitted || 0}\n`;
      content += `- Avg Rhetorical Score: ${session.metrics.avgRhetoricalScore || 50}%\n`;
    }
    content += `\n========================\n`;
    content += `TRANSCRIPT\n`;
    content += `========================\n\n`;
    
    if (session.transcript && session.transcript.length > 0) {
      session.transcript.forEach(msg => {
        const sender = msg.sender === 'user' ? 'YOU' : msg.sender === 'opponent' ? 'OPPONENT' : msg.sender.toUpperCase();
        content += `[${sender}]: ${msg.text}\n\n`;
      });
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${session.phase}-${new Date(session.date).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported');
  };

  const sendQuickResponse = async (response: string) => {
    if (!sessionRef.current || !isLive) return;
    
    setObjectionAlert(null);
    
    setMessages(prev => [...prev, { 
      id: Date.now() + '-qr', 
      sender: 'user', 
      text: `[Response to objection]: ${response}`, 
      timestamp: Date.now() 
    }]);
    
    try {
      const session = await sessionRef.current;
      session.sendRealtimeInput({
        text: response
      });
    } catch (e) {
      console.error('Failed to send response', e);
    }
  };

  const startLiveSession = async () => {
    console.log('[TrialSim] startLiveSession called', { activeCase: !!activeCase, phase, mode });
    
    if (!activeCase || !phase || !mode) {
      console.log('[TrialSim] Missing required state, aborting');
      toast.error('Please select a case, phase, and mode first');
      return;
    }

    // Check for OpenAI API key
    if (!isOpenAIConfigured()) {
      toast.error('OpenAI API key not configured. Add OPENAI_API_KEY to .env.local');
      return;
    }

    // Check for ElevenLabs
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    console.log('[TrialSim] ElevenLabs API Key present:', !!elevenLabsKey, 'Length:', elevenLabsKey?.length || 0);
    
    const shouldUseElevenLabs = useElevenLabs && isElevenLabsConfigured();
    console.log('[TrialSim] Using ElevenLabs for voice:', shouldUseElevenLabs, '(useElevenLabs:', useElevenLabs, ')');

    if (!elevenLabsKey || elevenLabsKey.length < 10) {
      toast.error('ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to .env.local for voice output.');
      console.error('[TrialSim] ELEVENLABS_API_KEY is missing or invalid');
    } else if (!shouldUseElevenLabs) {
      toast.warning('ElevenLabs disabled in settings. Enable it for voice output.');
    }

    setIsConnecting(true);
    console.log('[TrialSim] Starting session...');
    sessionStartTime.current = Date.now();
    setObjectionCount(0);
    setRhetoricalScores([]);
    setAvgRhetoricalScore(50);
    setSessionScore(50);
    
    try {
      // Request microphone access
      console.log('[TrialSim] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      console.log('[TrialSim] Microphone access granted');

      // Initialize ElevenLabs if enabled
      if (shouldUseElevenLabs) {
        const voiceId = ELEVENLABS_VOICES[voiceConfig.voiceName as keyof typeof ELEVENLABS_VOICES]?.id || ELEVENLABS_VOICES['josh'].id;
        console.log('[TrialSim] Initializing ElevenLabs with voice:', voiceId);
        
        elevenLabsRef.current = new ElevenLabsStreamer({
          voiceId,
          stability: 0.5,
          similarityBoost: 0.75,
        });
        
        await elevenLabsRef.current.initAudio(24000);
        await elevenLabsRef.current.connect();
        console.log('[TrialSim] ElevenLabs connected');
      }

      // Initialize Web Speech API for speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast.error('Speech recognition not supported in this browser. Try Chrome.');
        setIsConnecting(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let isProcessing = false;
      let silenceTimer: NodeJS.Timeout | null = null;
      let currentTranscript = '';

      recognition.onresult = async (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update volume indicator based on speech
        if (interimTranscript || finalTranscript) {
          setLiveVolume(50 + Math.random() * 30);
        }

        // Show interim results
        if (interimTranscript) {
          currentTranscript = interimTranscript;
        }

        // Process final transcript
        if (finalTranscript && !isProcessing) {
          console.log('[TrialSim] User said:', finalTranscript);
          currentTranscript = '';
          isProcessing = true;

          // Add user message to chat
          setMessages(prev => [...prev, { 
            id: Date.now() + 'u', 
            sender: 'user', 
            text: finalTranscript, 
            timestamp: Date.now() 
          }]);

          // Get AI response
          try {
            const systemPrompt = getTrialSimSystemPrompt(phase!, mode!, opponentName, activeCase.summary);
            
            let fullResponse = '';
            
            // Stream response from OpenAI
            for await (const chunk of streamOpenAIResponse(systemPrompt, finalTranscript, [])) {
              fullResponse += chunk;
              
              // Send to ElevenLabs as we receive it
              if (shouldUseElevenLabs && elevenLabsRef.current) {
                elevenLabsRef.current.sendText(chunk);
              }
            }

            console.log('[TrialSim] AI response:', fullResponse);

            // Flush ElevenLabs and add message to chat
            if (shouldUseElevenLabs && elevenLabsRef.current) {
              elevenLabsRef.current.flush();
            }

            setMessages(prev => [...prev, { 
              id: Date.now() + 'o', 
              sender: 'opponent', 
              text: fullResponse, 
              timestamp: Date.now() 
            }]);

          } catch (err) {
            console.error('[TrialSim] Error getting response:', err);
            toast.error('Error getting response. Check console.');
          }

          isProcessing = false;
        }
      };

      recognition.onerror = (event: any) => {
        console.error('[TrialSim] Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Restart recognition
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.onend = () => {
        console.log('[TrialSim] Speech recognition ended');
        // Restart if still live
        if (isLiveRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      // Store recognition for cleanup
      (window as any).trialSimRecognition = recognition;

      // Start recognition
      recognition.start();
      
      setIsLive(true);
      isLiveRef.current = true;
      setIsConnecting(false);
      
      startRecording(stream);
      toast.success('Session started - Speak to begin');

    } catch (e) {
      console.error('[TrialSim] Failed to start session:', e);
      setIsConnecting(false);
      toast.error(`Failed to start: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const PHASES = [
    { id: 'pre-trial-motions', label: 'Pre-Trial', icon: FileText },
    { id: 'voir-dire', label: 'Voir Dire', icon: Users },
    { id: 'opening-statement', label: 'Opening', icon: BookOpen },
    { id: 'direct-examination', label: 'Direct', icon: User },
    { id: 'cross-examination', label: 'Cross', icon: Sword },
    { id: 'defendant-testimony', label: 'Defendant', icon: Mic },
    { id: 'closing-argument', label: 'Closing', icon: Scale },
    { id: 'sentencing', label: 'Sentencing', icon: Gavel },
  ];

  if (!activeCase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-500 p-4">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-semibold">No Active Case</p>
        <Link to="/app/cases" className="mt-4 bg-gold-600 hover:bg-gold-500 text-slate-900 font-bold px-6 py-3 rounded-lg">Select Case</Link>
      </div>
    );
  }

  if (simState === 'setup') {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Trial Simulator</h1>
          <button onClick={() => setSimState('history')} className="flex items-center gap-2 text-gold-500">
            <Clock size={18} /> History ({savedSessions.length})
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h2 className="text-gold-500 font-semibold mb-3">Select Phase</h2>
            <div className="grid grid-cols-4 gap-2">
              {PHASES.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPhase(p.id as TrialPhase)}
                    className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                      phase === p.id ? 'bg-gold-500 text-slate-900' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-xs mt-1">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-gold-500 font-semibold mb-3">Select Mode</h2>
            <div className="space-y-2">
              {[
                { id: 'learn', label: 'Learn', desc: 'AI guides you with scripts', icon: GraduationCap, color: 'blue' },
                { id: 'practice', label: 'Practice', desc: 'Balanced feedback', icon: Mic, color: 'green' },
                { id: 'trial', label: 'Simulate', desc: 'Aggressive objections', icon: Sword, color: 'red' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as SimulationMode)}
                  className={`w-full p-4 rounded-lg text-left flex items-center gap-4 transition-all ${
                    mode === m.id ? `bg-${m.color}-600 text-white` : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <m.icon size={24} />
                  <div>
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-xs opacity-80">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <button 
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className="w-full flex items-center justify-between p-4 bg-slate-800 rounded-lg text-slate-300"
            >
              <div className="flex items-center gap-3">
                <Volume2 size={20} className="text-gold-500" />
                <div className="text-left">
                  <p className="font-semibold">Voice & Settings</p>
                  <p className="text-xs opacity-60">{voiceConfig.voiceName} • {simulatorSettings.realismLevel}</p>
                </div>
              </div>
              {showVoiceSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {showVoiceSettings && (
              <div className="mt-3 p-4 bg-slate-800 rounded-lg space-y-4 border border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-400">Use ElevenLabs Voices</label>
                  <button
                    onClick={() => setUseElevenLabs(!useElevenLabs)}
                    className={`w-12 h-6 rounded-full transition-all ${useElevenLabs ? 'bg-gold-500' : 'bg-slate-600'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${useElevenLabs ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {useElevenLabs ? 'ElevenLabs: Realistic voices (recommended)' : 'Gemini: Built-in voices'}
                </p>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Voice Selection</label>
                  <select
                    value={voiceConfig.voiceName}
                    onChange={(e) => {
                      setVoiceConfig(prev => ({ ...prev, voiceName: e.target.value }));
                      setSimulatorSettings(prev => ({ ...prev, voice: { ...prev.voice, voiceName: e.target.value } }));
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  >
                    {Object.entries(ELEVENLABS_VOICES).map(([id, voice]) => (
                      <option key={id} value={id}>
                        {voice.name} - {voice.description}
                      </option>
                    ))}
                  </select>
                </div>

                {phase && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Role Presets</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(TRIAL_VOICE_PRESETS).map(([id, preset]) => (
                        <button
                          key={id}
                          onClick={() => {
                            setVoiceConfig(prev => ({ 
                              ...prev, 
                              voiceName: preset.voice
                            }));
                            setSimulatorSettings(prev => ({ 
                              ...prev, 
                              voice: { 
                                ...prev.voice, 
                                voiceName: preset.voice
                              } 
                            }));
                          }}
                          className={`p-2 rounded-lg text-left text-xs transition-all ${
                            voiceConfig.voiceName === preset.voice 
                              ? 'bg-gold-500 text-slate-900' 
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <p className="font-semibold capitalize">{id.replace('-', ' ')}</p>
                          <p className="opacity-70 line-clamp-2">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Realism Level</label>
                  <div className="flex gap-2">
                    {(['casual', 'professional', 'intense'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setSimulatorSettings(prev => ({ ...prev, realismLevel: level }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                          simulatorSettings.realismLevel === level 
                            ? 'bg-gold-500 text-slate-900' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Interruption Frequency</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setSimulatorSettings(prev => ({ ...prev, interruptionFrequency: freq }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                          simulatorSettings.interruptionFrequency === freq 
                            ? 'bg-gold-500 text-slate-900' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Coaching Detail</label>
                  <div className="flex gap-2">
                    {(['minimal', 'moderate', 'detailed'] as const).map((verbosity) => (
                      <button
                        key={verbosity}
                        onClick={() => setSimulatorSettings(prev => ({ ...prev, coachingVerbosity: verbosity }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                          simulatorSettings.coachingVerbosity === verbosity 
                            ? 'bg-gold-500 text-slate-900' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {verbosity}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            disabled={!phase || !mode}
            onClick={() => { setMessages([]); setCoachingTip(null); setObjectionCount(0); setRhetoricalScores([]); setSimState('active'); }}
            className="w-full bg-gold-500 disabled:bg-slate-700 text-slate-900 font-bold py-4 rounded-xl text-lg"
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  if (simState === 'history') {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 p-4 flex items-center gap-4">
          <button onClick={() => setSimState('setup')} className="text-slate-400">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Session History</h1>
        </div>

        <div className="p-4">
          {savedSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p>No recorded sessions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSessions.map((session) => (
                <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white capitalize">{session.phase.replace('-', ' ')}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(session.date).toLocaleDateString()} • {Math.floor(session.duration / 60)}m {session.duration % 60}s
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{session.mode} mode • Score: {session.score}%</p>
                      {session.metrics && (
                        <p className="text-xs text-slate-500">
                          Objections: {session.metrics.objectionsReceived || 0} • Avg Rhetorical: {session.metrics.avgRhetoricalScore || 50}%
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => playSession(session)} className="p-2 bg-gold-500 text-slate-900 rounded-lg" title="Play Audio">
                        {playingSession === session.id ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <button onClick={() => downloadAudio(session)} className="p-2 bg-slate-700 text-gold-400 rounded-lg" title="Download Audio">
                        <Download size={18} />
                      </button>
                      <button onClick={() => exportTranscript(session)} className="p-2 bg-slate-700 text-blue-400 rounded-lg" title="Export Transcript">
                        <FileText size={18} />
                      </button>
                      <button onClick={() => deleteSession(session.id)} className="p-2 bg-slate-700 text-red-400 rounded-lg" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  {session.transcript && session.transcript.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-400 line-clamp-3">
                        {session.transcript.map(m => `${m.sender}: ${m.text}`).join('\n')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      {objectionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-red-600 p-6 rounded-2xl text-center max-w-sm w-full">
            <div className="text-4xl font-black text-white mb-2">OBJECTION!</div>
            <div className="text-xl text-red-100 font-bold">{objectionAlert.grounds}</div>
            <div className="text-sm text-white/80 mt-2 mb-4">{objectionAlert.explanation}</div>
            
            <div className="space-y-2">
              <button 
                onClick={() => sendQuickResponse("Your Honor, I withdraw the question.")}
                className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-all"
              >
                Withdraw the question
              </button>
              <button 
                onClick={() => sendQuickResponse("Your Honor, let me rephrase the question.")}
                className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-all"
              >
                Rephrase the question
              </button>
              <button 
                onClick={() => sendQuickResponse("Your Honor, this question goes to the heart of the matter and is directly relevant to the issues in this case.")}
                className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-all"
              >
                Argue relevance
              </button>
              <button 
                onClick={() => setObjectionAlert(null)}
                className="w-full py-2 text-white/60 text-sm hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800 border-b border-slate-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { stopLiveSession(); setSimState('setup'); }} className="text-slate-400">
            <ArrowLeft size={24} />
          </button>
          <div>
            <p className="font-bold text-white text-sm capitalize">{phase?.replace('-', ' ')}</p>
            <p className="text-xs text-slate-400">{mode} mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-700 rounded-full">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs text-slate-300">{objectionCount} objections</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-700 rounded-full">
            <Volume2 size={14} className="text-gold-500" />
            <span className="text-xs text-slate-300">{voiceConfig.voiceName}</span>
          </div>
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-900/50 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-300 font-bold">REC</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-slate-400">Score</p>
              <p className="text-2xl font-bold text-gold-500">{sessionScore}%</p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <p className="text-xs text-slate-400">Avg</p>
              <p className="text-2xl font-bold text-slate-300">{avgRhetoricalScore}%</p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <p className="text-xs text-slate-400">Objections</p>
              <p className="text-2xl font-bold text-red-400">{objectionCount}</p>
            </div>
          </div>

          <div className={`w-32 h-32 rounded-full border-4 transition-all ${isLive && liveVolume > 5 ? 'border-red-500 scale-105' : 'border-slate-700'}`}>
            <img 
              src={phase === 'defendant-testimony' ? 'https://picsum.photos/id/1005/200/200' : 'https://picsum.photos/id/1025/200/200'} 
              alt="Opponent" 
              className="w-full h-full rounded-full object-cover opacity-80"
            />
          </div>
          <p className="mt-4 text-white font-semibold text-center">
            {phase === 'defendant-testimony' ? 'Prosecutor' : 'Opposing Counsel'}
          </p>
          <p className="text-slate-400 text-sm">{isConnecting ? 'Connecting...' : isLive ? 'Listening...' : 'Ready'}</p>

          {isLive && (
            <div className="w-full max-w-xs mt-4">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gold-500 transition-all"
                  style={{ width: `${Math.min(100, liveVolume * 2)}%` }}
                />
              </div>
            </div>
          )}

          {activeCase.evidence && activeCase.evidence.length > 0 && (
            <div className="w-full max-w-sm mt-4">
              <button 
                onClick={() => setShowEvidencePanel(!showEvidencePanel)}
                className="w-full flex items-center justify-between p-2 bg-slate-800 rounded-lg text-slate-300 text-sm"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-gold-500" />
                  Evidence Quick-Reference ({activeCase.evidence.length})
                </span>
                <ChevronDown size={16} className={`transition-transform ${showEvidencePanel ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ${showEvidencePanel ? 'max-h-48' : 'max-h-0'}`}>
                <div className="mt-2 p-2 bg-slate-800 rounded-lg space-y-2 max-h-48 overflow-y-auto">
                  {activeCase.evidence.map((evidence, idx) => (
                    <div key={idx} className="p-2 bg-slate-700 rounded text-xs">
                      <p className="font-semibold text-white truncate">{evidence.title}</p>
                      <p className="text-slate-400 line-clamp-2">{evidence.summary?.slice(0, 100) || 'No summary'}{evidence.summary && evidence.summary.length > 100 ? '...' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-20 px-4 overflow-hidden hidden md:block">
          <div className="flex flex-col gap-1">
            {messages.slice(-2).map(m => (
              <div key={m.id} className={`text-xs p-2 rounded-lg max-w-[80%] ${m.sender === 'user' ? 'self-end bg-blue-900/50 text-blue-200' : 'self-start bg-slate-800 text-slate-300'}`}>
                <span className="opacity-50 mr-1">{m.sender === 'user' ? 'You:' : 'Opp:'}</span>
                {m.text.slice(0, 80)}...
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`fixed md:relative bottom-0 left-0 right-0 z-40 transition-all duration-300 ${showTeleprompter ? 'max-h-[50vh] md:max-h-[40vh]' : 'max-h-14'}`}>
        <div className="bg-slate-800 border-t-2 border-gold-500">
          <button 
            onClick={() => setShowTeleprompter(!showTeleprompter)}
            className="w-full p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={20} className="text-gold-400" />
              <span className="text-gold-300 text-sm md:text-base font-bold">WHAT TO SAY</span>
            </div>
            <ChevronDown size={20} className={`text-gold-400 transition-transform ${showTeleprompter ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 ${showTeleprompter ? 'opacity-100' : 'opacity-0 max-h-0'}`}>
            <div className="p-4 md:p-6 bg-slate-900 border-t border-gold-500/30">
              {coachingTip?.teleprompterScript ? (
                <div>
                  <p className="text-xs text-gold-400 uppercase font-bold mb-2">Suggested Response:</p>
                  <p className="text-xl md:text-2xl text-white leading-relaxed">{coachingTip.teleprompterScript}</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-sm">Start speaking to receive guidance...</p>
                  <p className="text-slate-500 text-xs mt-1">The AI will suggest what to say based on the conversation</p>
                </div>
              )}
              
              {coachingTip && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <button 
                    onClick={() => setShowCoaching(!showCoaching)}
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <BookOpen size={14} />
                    {showCoaching ? 'Hide' : 'Show'} detailed coaching feedback
                    <ChevronDown size={14} className={`transition-transform ${showCoaching ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCoaching && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-slate-300"><strong className="text-slate-400">Critique:</strong> {coachingTip.critique}</p>
                      <p className="text-gold-300"><strong className="text-gold-400">Tip:</strong> {coachingTip.suggestion}</p>
                      {coachingTip.fallaciesIdentified && coachingTip.fallaciesIdentified.length > 0 && (
                        <p className="text-red-300"><strong className="text-red-400">Fallacies:</strong> {coachingTip.fallaciesIdentified.join(', ')}</p>
                      )}
                      <p className="text-slate-400"><strong>Effectiveness:</strong> {coachingTip.rhetoricalEffectiveness}%</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-4">
        <div className="flex items-center justify-center gap-6">
          {!isLive ? (
            <button onClick={startLiveSession} disabled={isConnecting} className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gold-500 flex items-center justify-center text-slate-900 shadow-lg">
                {isConnecting ? <Activity className="animate-spin" size={32} /> : <Mic size={32} />}
              </div>
              <span className="text-xs text-gold-500 mt-2 font-bold">{isConnecting ? 'Connecting' : 'Start'}</span>
            </button>
          ) : (
            <button onClick={() => stopLiveSession()} className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg animate-pulse">
                <MicOff size={32} />
              </div>
              <span className="text-xs text-red-500 mt-2 font-bold">Stop & Save</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialSim;