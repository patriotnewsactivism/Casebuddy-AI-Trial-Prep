import React, { useState, useRef, useEffect, useContext } from 'react';
import { MOCK_WITNESSES } from '../constants';
import { AppContext } from '../App';
import { generateWitnessResponse, clearChatSession } from '../services/geminiService';
import { transcribeAudio } from '../services/transcriptionService';
import { synthesizeSpeech, playAudioBuffer, getTrialVoicePreset, TrialVoicePreset } from '../services/elevenLabsService';
import { Message, Witness, TranscriptionProvider } from '../types';
import { Send, Mic, User, ShieldAlert, HeartPulse, StopCircle, Volume2, Loader2 } from 'lucide-react';
import { handleError, handleSuccess } from '../utils/errorHandler';

const WitnessLab = () => {
  const { activeCase } = useContext(AppContext);
  const [selectedWitness, setSelectedWitness] = useState<Witness>(MOCK_WITNESSES[0]);
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', sender: 'system', text: 'Simulation initialized. You may begin your examination.', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const getSessionId = (witnessId: string) => `witness-${witnessId}-${activeCase?.id || 'default'}`;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isProcessingAudio]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      handleError(error, 'Could not access microphone', 'WitnessLab');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsProcessingAudio(true);
    try {
      // Use Gemini for speech-to-text
      const result = await transcribeAudio(
        audioBlob, 
        '', 
        { 
          provider: TranscriptionProvider.GEMINI,
          customVocabulary: [],
          legalMode: true,
          openaiKey: '', 
          assemblyAiKey: ''
        }
      );

      if (result.text) {
        setInput(result.text);
        // Automatically send the transcribed text
        await handleSendMessage(undefined, result.text);
      } else {
        handleError(new Error('No speech detected'), 'Could not transcribe audio', 'WitnessLab');
      }
    } catch (error) {
      handleError(error, 'Transcription failed', 'WitnessLab');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const getVoiceForWitness = (witness: Witness): string | undefined => {
    // Simple mapping strategy - ideally this would be a property on the Witness object
    let preset: TrialVoicePreset = 'witness-cooperative';
    
    if (witness.personality.toLowerCase().includes('hostile')) {
      preset = 'witness-hostile';
    } else if (witness.personality.toLowerCase().includes('nervous')) {
      preset = 'witness-nervous';
    } else if (witness.role.toLowerCase().includes('expert')) {
      preset = 'prosecutor'; // Use an authoritative voice
    }

    const voiceConfig = getTrialVoicePreset(preset);
    // You would map the preset to an actual ID here based on the imported voices in elevenLabsService
    // For now, we rely on the service to use defaults if we just pass the ID we can find or let it fallback
    // The verify service uses specific IDs. Let's look up the ID from the preset.
    // Since getTrialVoicePreset returns { voice: 'name', ... }, we need to map that name to an ID.
    // However, for simplicity, we'll let the synthesizeSpeech function handle the default or we can just pass undefined to use default.
    // Actually, let's just return undefined to use the default voice for now, or improve the mapping if needed.
    // But wait, the user specifically asked for Eleven Labs to read it.
    
    // We'll trust the default voice or add a selector later. 
    // Ideally we pass a voiceId. synthesizeSpeech takes a voiceId. 
    // We can map the 'voice' name from the preset to the ID in ELEVENLABS_VOICES if we had access to the object.
    // For now let's pass undefined and let the service use its default.
    return undefined; 
  };

  const playResponse = async (text: string) => {
    try {
      setIsPlayingAudio(true);
      // Determine voice based on witness personality
      let voicePreset: TrialVoicePreset = 'witness-cooperative';
      if (selectedWitness.personality === 'Hostile') voicePreset = 'witness-hostile';
      else if (selectedWitness.personality === 'Nervous') voicePreset = 'witness-nervous';
      
      const voiceConfig = getTrialVoicePreset(voicePreset);
      
      // DIAGNOSTIC: Check if ElevenLabs is configured
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      console.log('[WitnessLab TTS] ElevenLabs API Key present:', !!elevenLabsKey, 'Length:', elevenLabsKey?.length || 0);
      console.log('[WitnessLab TTS] Text to synthesize:', text.substring(0, 100) + '...');
      
      if (!elevenLabsKey || elevenLabsKey.length < 10) {
        console.warn('[WitnessLab TTS] ElevenLabs API key is missing or invalid - TTS disabled');
        handleError(new Error('ElevenLabs API key not configured'), 'Text-to-speech unavailable. Add ELEVENLABS_API_KEY to .env.local', 'WitnessLab');
        return;
      }
      
      console.log('[WitnessLab TTS] Calling synthesizeSpeech...');
      const audioBuffer = await synthesizeSpeech(text);
      console.log('[WitnessLab TTS] Audio buffer received, size:', audioBuffer.byteLength, 'bytes');
      
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        console.error('[WitnessLab TTS] Empty audio buffer received');
        handleError(new Error('Empty audio response'), 'TTS returned no audio', 'WitnessLab');
        return;
      }
      
      console.log('[WitnessLab TTS] Playing audio buffer...');
      await playAudioBuffer(audioBuffer);
      console.log('[WitnessLab TTS] Playback complete');
    } catch (error) {
      console.error('[WitnessLab TTS] Error:', error);
      handleError(error, 'Text-to-speech failed. Check console for details.', 'WitnessLab');
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const responseText = await generateWitnessResponse(
        getSessionId(selectedWitness.id),
        userMsg.text,
        selectedWitness.name, 
        selectedWitness.personality, 
        activeCase?.summary || "A generic legal case."
      );

      const witnessMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'witness',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, witnessMsg]);
      
      // Trigger TTS
      void playResponse(responseText);
      
    } catch (err) {
      handleError(err, 'Failed to get witness response', 'WitnessLab');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Sidebar: Witness Selection */}
      <div className="w-72 flex flex-col gap-4 bg-slate-800 border border-slate-700 rounded-xl p-4 overflow-y-auto hidden md:flex">
        <h3 className="text-white font-serif font-bold px-2">Witness List</h3>
        {MOCK_WITNESSES.map(w => (
          <button
            key={w.id}
            onClick={() => {
              clearChatSession(getSessionId(selectedWitness.id));
              setSelectedWitness(w);
              setMessages([{ id: '0', sender: 'system', text: `Simulation with ${w.name} started.`, timestamp: Date.now() }]);
            }}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${selectedWitness.id === w.id ? 'bg-slate-700 border border-gold-500/30' : 'hover:bg-slate-700/50 border border-transparent'}`}
          >
            <img src={w.avatarUrl} alt={w.name} className="w-10 h-10 rounded-full object-cover border border-slate-600" />
            <div>
              <p className="text-sm font-semibold text-white">{w.name}</p>
              <p className="text-xs text-slate-400">{w.role}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-700 rounded-xl overflow-hidden relative">
        {/* Chat Header */}
        <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-6 justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={selectedWitness.avatarUrl} alt="Active" className="w-10 h-10 rounded-full object-cover border-2 border-gold-500" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
            </div>
            <div>
              <h2 className="text-white font-semibold">{selectedWitness.name}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span className="capitalize">{selectedWitness.personality}</span>
                <span>•</span>
                <span>Credibility: {selectedWitness.credibilityScore}%</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-slate-400 text-xs">
            {isPlayingAudio && (
               <div className="flex items-center gap-1 text-gold-500 animate-pulse font-semibold">
                 <Volume2 size={16} />
                 Speaking...
               </div>
            )}
            <div className="flex items-center gap-1">
               <HeartPulse size={14} className={selectedWitness.personality === 'Nervous' ? 'text-red-400 animate-pulse' : 'text-green-400'} />
               Stress Level
            </div>
            <div className="flex items-center gap-1">
               <ShieldAlert size={14} className={selectedWitness.personality === 'Hostile' ? 'text-red-400' : 'text-slate-500'} />
               Hostility
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">{msg.text}</span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                  isUser 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            );
          })}
          
          {isProcessingAudio && (
             <div className="flex justify-end">
               <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-br-none px-5 py-3 flex items-center gap-2 text-gold-500 text-sm">
                 <Loader2 size={16} className="animate-spin" />
                 Transcribing audio...
               </div>
             </div>
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-5 py-3 flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-slate-800 border-t border-slate-700 p-4">
          <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2 items-center bg-slate-900 border border-slate-600 rounded-xl p-1 pr-2 focus-within:border-gold-500 focus-within:ring-1 focus-within:ring-gold-500 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? "Listening..." : "Ask your question..."}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder-slate-500"
              disabled={isTyping || isRecording || isProcessingAudio}
            />
            
            <button 
               type="button"
               onMouseDown={startRecording}
               onMouseUp={stopRecording}
               onMouseLeave={stopRecording}
               onTouchStart={startRecording}
               onTouchEnd={stopRecording}
               disabled={isTyping || isProcessingAudio}
               className={`p-2 transition-all rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
               title="Hold to speak"
            >
              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </button>

            <button 
              type="submit" 
              disabled={!input.trim() || isTyping || isRecording}
              className="p-2 bg-gold-600 hover:bg-gold-500 text-slate-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-500">Hold microphone button to speak • Uses Gemini Transcription • ElevenLabs Voice Synthesis</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WitnessLab;