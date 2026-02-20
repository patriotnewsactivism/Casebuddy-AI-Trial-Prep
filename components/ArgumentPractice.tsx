import React, { useState, useRef, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import { MOCK_OPPONENT } from '../constants';
import { AVAILABLE_VOICES, VOICE_PROFILES, VOICE_DESCRIPTIONS, DEFAULT_VOICE_BY_PHASE } from '../constants/voiceConstants';
import { CoachingAnalysis, Message, TrialPhase, SimulationMode, TrialSession, VoiceConfig, SimulatorSettings } from '../types';
import { Mic, MicOff, Activity, AlertTriangle, Lightbulb, AlertCircle, PlayCircle, BookOpen, Sword, GraduationCap, User, Gavel, ArrowLeft, FileText, Users, Scale, Clock, Play, Pause, Trash2, Download, List, ChevronDown, Link, Settings, Volume2, ChevronUp } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { getTrialSimSystemInstruction } from '../services/geminiService';
  import { toast } from 'react-toastify';
  
  interface EvidenceDataForSim {
    summary: string;
    entities: string[];
    keyDates: string[];
  }

// Type for Google GenAI SDK media blob
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
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    voiceName: 'Schedar',
    personality: 'neutral',
    languageCode: 'en-US',
  });
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [simulatorSettings, setSimulatorSettings] = useState<SimulatorSettings>({
    voice: { voiceName: 'Schedar', personality: 'neutral', languageCode: 'en-US' },
    realismLevel: 'professional',
    interruptionFrequency: 'medium',
    coachingVerbosity: 'moderate',
    audioQuality: 'high',
  });
  
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

  useEffect(() => {
    if (activeCase) {
      const saved = localStorage.getItem(`trial_sessions_${activeCase.id}`);
      if (saved) setSavedSessions(JSON.parse(saved));
    }
  }, [activeCase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (objectionAlert) {
      const timer = setTimeout(() => setObjectionAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [objectionAlert]);

  useEffect(() => {
    if (phase && DEFAULT_VOICE_BY_PHASE[phase]) {
      setVoiceConfig(prev => ({ ...prev, voiceName: DEFAULT_VOICE_BY_PHASE[phase]! }));
      setSimulatorSettings(prev => ({
        ...prev,
        voice: { ...prev.voice, voiceName: DEFAULT_VOICE_BY_PHASE[phase]! }
      }));
    }
  }, [phase]);

  const opponentName = activeCase?.opposingCounsel && activeCase.opposingCounsel !== 'Unknown' 
    ? activeCase.opposingCounsel 
    : MOCK_OPPONENT.name;

  const stopLiveSession = (preserveForReconnect = false) => {
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
    
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch (e) {}
      if (!preserveForReconnect) scriptProcessorRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (!preserveForReconnect) {
      reconnectAttemptsRef.current = 0;
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

  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3;

  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        saveSession();
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (e) {
      console.error('Recording failed', e);
    }
  };

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
      score: coachingTip?.rhetoricalEffectiveness || 50
    };
    
    const updated = [session, ...savedSessions].slice(0, 20);
    setSavedSessions(updated);
    localStorage.setItem(`trial_sessions_${activeCase.id}`, JSON.stringify(updated));
    toast.success('Session saved!');
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
    
    audioRef.current = new Audio(session.audioUrl);
    audioRef.current.onended = () => setPlayingSession(null);
    audioRef.current.play();
    setPlayingSession(session.id);
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

  const startLiveSession = async () => {
    if (!activeCase || !phase || !mode) return;

    setIsConnecting(true);
    sessionStartTime.current = Date.now();
    
    try {
      if (!process.env.API_KEY) {
        setIsConnecting(false);
        toast.error('Missing API key');
        return;
      }

      let inputCtx = inputContextRef.current;
      let outputCtx = outputContextRef.current;
      
      if (!inputCtx || inputCtx.state === 'closed') {
        inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        await inputCtx.resume();
        inputContextRef.current = inputCtx;
      }
      
      if (!outputCtx || outputCtx.state === 'closed') {
        outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        await outputCtx.resume();
        outputContextRef.current = outputCtx;
      }
      
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      let stream = streamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 }
        });
        streamRef.current = stream;
      }

      startRecording(stream);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const coachingTool: FunctionDeclaration = {
        name: 'sendCoachingTip',
        description: 'Send coaching feedback.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            critique: { type: Type.STRING },
            suggestion: { type: Type.STRING },
            sampleResponse: { type: Type.STRING },
            teleprompterScript: { type: Type.STRING },
            fallaciesIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
            rhetoricalEffectiveness: { type: Type.NUMBER },
            rhetoricalFeedback: { type: Type.STRING },
          },
          required: ['critique', 'suggestion']
        }
      };

      const objectionTool: FunctionDeclaration = {
        name: 'raiseObjection',
        description: 'Trigger objection alert.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            grounds: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ['grounds', 'explanation']
        }
      };

      const systemInstruction = getTrialSimSystemInstruction(phase, mode, opponentName, activeCase.summary, simulatorSettings);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: voiceConfig.voiceName 
              } 
            },
            languageCode: voiceConfig.languageCode,
          },
          systemInstruction,
          tools: [{ functionDeclarations: [coachingTool, objectionTool] }],
        },
        callbacks: {
          onopen: () => {
            setIsLive(true);
            isLiveRef.current = true;
            setIsConnecting(false);
            
            const source = inputCtx!.createMediaStreamSource(stream!);
            const scriptProcessor = inputCtx!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              if (!isLiveRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setLiveVolume(Math.sqrt(sum / inputData.length) * 100);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => {
                if (isLiveRef.current) {
                  try { s.sendRealtimeInput({ media: pcmBlob }); } catch (err) {}
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx!.destination);
            
            toast.success('Session started - Recording');
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              if (outputCtx!.state === 'suspended') await outputCtx!.resume();
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx!.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioData), outputCtx!, 24000, 1);
              const source = outputCtx!.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.inputTranscription) currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            if (msg.serverContent?.outputTranscription) currentOutputTranscription.current += msg.serverContent.outputTranscription.text;

            if (msg.serverContent?.turnComplete) {
              if (currentInputTranscription.current.trim()) {
                setMessages(prev => [...prev, { id: Date.now()+'u', sender: 'user', text: currentInputTranscription.current, timestamp: Date.now() }]);
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current.trim()) {
                setMessages(prev => [...prev, { id: Date.now()+'o', sender: 'opponent', text: currentOutputTranscription.current, timestamp: Date.now() }]);
                currentOutputTranscription.current = '';
              }
            }

            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'sendCoachingTip') {
                  const args = fc.args as any;
                  setCoachingTip({
                    critique: args.critique,
                    suggestion: args.suggestion,
                    sampleResponse: args.sampleResponse,
                    teleprompterScript: args.teleprompterScript,
                    fallaciesIdentified: args.fallaciesIdentified || [],
                    rhetoricalEffectiveness: args.rhetoricalEffectiveness || 50,
                    rhetoricalFeedback: args.rhetoricalFeedback || ""
                  });
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "displayed" } } }));
                }
                else if (fc.name === 'raiseObjection') {
                  const args = fc.args as any;
                  setObjectionAlert({ grounds: args.grounds, explanation: args.explanation });
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "alert_shown" } } }));
                }
              }
            }
          },
          onclose: () => stopLiveSession(),
          onerror: () => stopLiveSession()
        }
      });
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error('Failed to start', e);
      setIsConnecting(false);
      toast.error('Failed to start session');
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

  // Setup Screen
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
                    {AVAILABLE_VOICES.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice} - {VOICE_DESCRIPTIONS[voice]?.tone || 'Custom voice'}
                      </option>
                    ))}
                  </select>
                  {voiceConfig.voiceName && VOICE_DESCRIPTIONS[voiceConfig.voiceName] && (
                    <p className="text-xs text-slate-500 mt-1">
                      Best for: {VOICE_DESCRIPTIONS[voiceConfig.voiceName].bestFor}
                    </p>
                  )}
                </div>

                {phase && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Personality Presets</label>
                    <div className="grid grid-cols-2 gap-2">
                      {VOICE_PROFILES.filter(p => p.recommendedFor.includes(phase)).map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => {
                            setVoiceConfig(prev => ({ 
                              ...prev, 
                              voiceName: profile.voiceName,
                              personality: profile.personality 
                            }));
                            setSimulatorSettings(prev => ({ 
                              ...prev, 
                              voice: { 
                                ...prev.voice, 
                                voiceName: profile.voiceName,
                                personality: profile.personality 
                              } 
                            }));
                          }}
                          className={`p-2 rounded-lg text-left text-xs transition-all ${
                            voiceConfig.voiceName === profile.voiceName 
                              ? 'bg-gold-500 text-slate-900' 
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <p className="font-semibold">{profile.name}</p>
                          <p className="opacity-70 line-clamp-2">{profile.description}</p>
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
            onClick={() => { setMessages([]); setCoachingTip(null); setSimState('active'); }}
            className="w-full bg-gold-500 disabled:bg-slate-700 text-slate-900 font-bold py-4 rounded-xl text-lg"
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  // History Screen
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
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => playSession(session)} className="p-2 bg-gold-500 text-slate-900 rounded-lg">
                        {playingSession === session.id ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <button onClick={() => deleteSession(session.id)} className="p-2 bg-slate-700 text-slate-400 rounded-lg">
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

  // Active Session Screen
  return (
    <div className="min-h-screen flex flex-col">
      {/* Objection Overlay */}
      {objectionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-red-600 p-6 rounded-2xl text-center max-w-sm w-full animate-pulse">
            <div className="text-4xl font-black text-white mb-2">OBJECTION!</div>
            <div className="text-xl text-red-100 font-bold">{objectionAlert.grounds}</div>
            <div className="text-sm text-white/80 mt-2">{objectionAlert.explanation}</div>
          </div>
        </div>
      )}

      {/* Header */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Visual Center */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900">
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

          {/* Volume Meter */}
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
        </div>

        {/* Recent Messages */}
        <div className="h-24 px-4 overflow-hidden">
          <div className="flex flex-col gap-1">
            {messages.slice(-2).map(m => (
              <div key={m.id} className={`text-xs p-2 rounded-lg max-w-[80%] ${m.sender === 'user' ? 'self-end bg-blue-900/50 text-blue-200' : 'self-start bg-slate-800 text-slate-300'}`}>
                <span className="opacity-50 mr-1">{m.sender === 'user' ? 'You:' : 'Opp:'}</span>
                {m.text.slice(0, 80)}...
              </div>
            ))}
          </div>
        </div>

        {/* Coaching Toggle */}
        {coachingTip && (
          <button 
            onClick={() => setShowCoaching(!showCoaching)} 
            className="mx-4 mb-2 p-3 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-between"
          >
            <span className="text-blue-400 text-sm font-medium">View Coaching Tip</span>
            <ChevronDown size={18} className={`text-blue-400 transition-transform ${showCoaching ? 'rotate-180' : ''}`} />
          </button>
        )}

        {showCoaching && coachingTip && (
          <div className="mx-4 mb-2 p-4 bg-slate-800 rounded-lg space-y-2">
            <p className="text-sm text-white"><strong>Critique:</strong> {coachingTip.critique}</p>
            <p className="text-sm text-gold-400"><strong>Tip:</strong> {coachingTip.suggestion}</p>
            {coachingTip.teleprompterScript && (
              <p className="text-xs text-slate-400 mt-2 p-2 bg-slate-900 rounded">{coachingTip.teleprompterScript}</p>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
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