/**
 * ElevenLabs Text-to-Speech Service
 * Provides realistic voice synthesis for trial simulator
 * Free tier: 10,000 characters per month
 */

// Global audio unlock for browser autoplay policy
let audioUnlocked = false;
let unlockAudioContext: AudioContext | null = null;
let globalAudioContext: AudioContext | null = null;
let currentVolume = 1.0;

interface AudioState {
  unlocked: boolean;
  contextState: AudioContextState | null;
  lastUnlockAttempt: number | null;
  unlockError: string | null;
  lastPlaybackAttempt: number | null;
  playbackError: string | null;
}

const audioState: AudioState = {
  unlocked: false,
  contextState: null,
  lastUnlockAttempt: null,
  unlockError: null,
  lastPlaybackAttempt: null,
  playbackError: null,
};

export const getAudioState = (): AudioState => ({ ...audioState });

export const isAudioUnlocked = (): boolean => audioUnlocked;

export const forceUnlockAudio = async (): Promise<boolean> => {
  console.log('[Audio] forceUnlockAudio called - forcing fresh unlock');
  audioUnlocked = false;
  unlockAudioContext = null;
  audioState.lastUnlockAttempt = Date.now();
  audioState.unlockError = null;
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    unlockAudioContext = new AudioContextClass();
    
    audioState.contextState = unlockAudioContext.state;
    console.log('[Audio] Created fresh AudioContext, state:', unlockAudioContext.state);
    
    if (unlockAudioContext.state === 'suspended') {
      console.log('[Audio] AudioContext suspended, resuming...');
      await unlockAudioContext.resume();
      audioState.contextState = unlockAudioContext.state;
      console.log('[Audio] AudioContext resumed, new state:', unlockAudioContext.state);
    }
    
    const buffer = unlockAudioContext.createBuffer(1, 1, 22050);
    const source = unlockAudioContext.createBufferSource();
    source.buffer = buffer;
    const gainNode = unlockAudioContext.createGain();
    gainNode.gain.value = 0.01;
    source.connect(gainNode);
    gainNode.connect(unlockAudioContext.destination);
    
    source.start();
    
    audioUnlocked = true;
    audioState.unlocked = true;
    console.log('[Audio] Force unlock successful');
    
    globalAudioContext = unlockAudioContext;
    
    return true;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    audioState.unlockError = errorMsg;
    console.error('[Audio] Force unlock failed:', e);
    return false;
  }
};

export const unlockAudio = async (): Promise<void> => {
  if (audioUnlocked && unlockAudioContext && unlockAudioContext.state === 'running') {
    console.log('[Audio] Already unlocked and running');
    return;
  }
  
  audioState.lastUnlockAttempt = Date.now();
  audioState.unlockError = null;
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    if (!unlockAudioContext || unlockAudioContext.state === 'closed') {
      unlockAudioContext = new AudioContextClass();
      console.log('[Audio] Created new AudioContext for unlock');
    }
    
    audioState.contextState = unlockAudioContext.state;
    
    if (unlockAudioContext.state === 'suspended') {
      console.log('[Audio] AudioContext suspended, resuming...');
      await unlockAudioContext.resume();
      audioState.contextState = unlockAudioContext.state;
      console.log('[Audio] Resumed, state:', unlockAudioContext.state);
    }
    
    const buffer = unlockAudioContext.createBuffer(1, 1, 22050);
    const source = unlockAudioContext.createBufferSource();
    source.buffer = buffer;
    const gainNode = unlockAudioContext.createGain();
    gainNode.gain.value = 0.01;
    source.connect(gainNode);
    gainNode.connect(unlockAudioContext.destination);
    
    source.start();
    
    audioUnlocked = true;
    audioState.unlocked = true;
    globalAudioContext = unlockAudioContext;
    console.log('[Audio] Audio unlocked successfully');
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    audioState.unlockError = errorMsg;
    console.warn('[Audio] Failed to unlock audio:', e);
  }
};

export const ensureAudioUnlocked = async (): Promise<boolean> => {
  console.log('[Audio] ensureAudioUnlocked called, current state:', {
    audioUnlocked,
    contextState: unlockAudioContext?.state,
    globalContextState: globalAudioContext?.state
  });
  
  if (audioUnlocked) {
    if (unlockAudioContext && unlockAudioContext.state === 'running') {
      console.log('[Audio] Audio already unlocked and running');
      return true;
    }
    if (globalAudioContext && globalAudioContext.state === 'running') {
      console.log('[Audio] Global audio context running');
      return true;
    }
  }
  
  console.log('[Audio] Audio not properly unlocked, attempting unlock...');
  await unlockAudio();
  
  if (!audioUnlocked) {
    console.log('[Audio] Standard unlock failed, trying force unlock...');
    await forceUnlockAudio();
  }
  
  return audioUnlocked;
};

if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
  const unlockHandler = () => {
    console.log('[Audio] User interaction detected, unlocking audio...');
    unlockAudio();
    unlockEvents.forEach(e => window.removeEventListener(e, unlockHandler));
  };
  unlockEvents.forEach(e => window.addEventListener(e, unlockHandler, { once: true }));
}

export const ELEVENLABS_VOICES = {
  'rachel': { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', description: 'Calming, natural' },
  'domi': { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'female', description: 'Strong, confident' },
  'bella': { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', description: 'Soft, smooth' },
  'antoni': { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male', description: 'Deep, authoritative' },
  'elli': { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'female', description: 'Emotional, young' },
  'josh': { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', description: 'Confident, conversational' },
  'arnold': { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'male', description: 'Dramatic, deep' },
  'adam': { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', description: 'Deep, calm' },
  'sam': { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'male', description: 'Grainy, raspy' },
} as const;

export type ElevenLabsVoiceId = keyof typeof ELEVENLABS_VOICES;

export const TRIAL_VOICE_PRESETS = {
  'prosecutor': { voice: 'adam', description: 'Authoritative, serious prosecutor' },
  'defense': { voice: 'josh', description: 'Confident, persuasive defense attorney' },
  'judge': { voice: 'arnold', description: 'Deep, commanding judicial presence' },
  'witness-hostile': { voice: 'sam', description: 'Grainy, defensive witness' },
  'witness-nervous': { voice: 'elli', description: 'Young, nervous witness' },
  'witness-cooperative': { voice: 'rachel', description: 'Calm, helpful witness' },
  'opponent-aggressive': { voice: 'domi', description: 'Strong, aggressive opposing counsel' },
  'opponent-calm': { voice: 'antoni', description: 'Deep, methodical opposing counsel' },
} as const;

export type TrialVoicePreset = keyof typeof TRIAL_VOICE_PRESETS;

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

const DEFAULT_CONFIG: Partial<ElevenLabsConfig> = {
  modelId: 'eleven_monolingual_v1',
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.3,
  useSpeakerBoost: true,
};

export const isElevenLabsConfigured = (): boolean => {
  const key = process.env.ELEVENLABS_API_KEY;
  return !!(key && key.length > 10);
};

export const getAvailableVoices = () => {
  return Object.entries(ELEVENLABS_VOICES).map(([id, voice]) => ({
    id,
    ...voice,
  }));
};

export const getTrialVoicePreset = (preset: TrialVoicePreset) => {
  return TRIAL_VOICE_PRESETS[preset];
};

export class ElevenLabsStreamer {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioQueue: Uint8Array[] = [];
  private isPlaying = false;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private onAudioChunk?: (chunk: Uint8Array) => void;
  private config: ElevenLabsConfig;
  private isConnected = false;
  private textBuffer = '';
  private audioElement: HTMLAudioElement | null = null;
  private useAudioElement = true;
  private volume: number = 1.0;

  constructor(config: Partial<ElevenLabsConfig>) {
    const apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    this.config = {
      apiKey,
      voiceId: config.voiceId || ELEVENLABS_VOICES['josh'].id,
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  async initAudio(sampleRate: number = 24000): Promise<AudioContext | null> {
    console.log('[ElevenLabs] initAudio called');
    
    const unlocked = await ensureAudioUnlocked();
    console.log('[ElevenLabs] Audio unlock status:', unlocked);
    
    if (this.useAudioElement) {
      console.log('[ElevenLabs] Using HTML5 Audio element for playback');
      this.audioElement = new Audio();
      this.audioElement.volume = this.volume;
      console.log('[ElevenLabs] HTML5 Audio volume set to:', this.volume);
      return null;
    }
    
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        console.log('[ElevenLabs] Created new AudioContext, state:', this.audioContext.state);
        
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);
        console.log('[ElevenLabs] Gain node volume set to:', this.volume);
      }
      
      if (this.audioContext.state === 'suspended') {
        console.log('[ElevenLabs] AudioContext suspended, resuming...');
        await this.audioContext.resume();
        console.log('[ElevenLabs] AudioContext resumed, state:', this.audioContext.state);
      }
      
      return this.audioContext;
    } catch (err) {
      console.error('[ElevenLabs] AudioContext initialization failed, falling back to HTML5 Audio:', err);
      this.useAudioElement = true;
      this.audioElement = new Audio();
      this.audioElement.volume = this.volume;
      return null;
    }
  }

  async connect(onReady?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const voiceId = this.config.voiceId;
      const modelId = this.config.modelId || 'eleven_monolingual_v1';
      
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;
      
      console.log('[ElevenLabs] Connecting to WebSocket...');
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[ElevenLabs] WebSocket connected');
        
        const bosMessage = {
          text: ' ',
          voice_settings: {
            stability: this.config.stability || 0.5,
            similarity_boost: this.config.similarityBoost || 0.75,
            style: this.config.style || 0.3,
            use_speaker_boost: this.config.useSpeakerBoost ?? true,
          },
          xi_api_key: this.config.apiKey,
        };
        
        this.ws?.send(JSON.stringify(bosMessage));
        this.isConnected = true;
        onReady?.();
        resolve();
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.audio) {
            const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
            console.log('[ElevenLabs] Received audio chunk, size:', audioBytes.byteLength, 'bytes, queue length:', this.audioQueue.length);
            this.audioQueue.push(audioBytes);
            this.onAudioChunk?.(audioBytes);
            
            if (!this.isPlaying) {
              console.log('[ElevenLabs] Starting playback (not currently playing)');
              this.playNextChunk();
            } else {
              console.log('[ElevenLabs] Already playing, chunk queued');
            }
          }
          
          if (data.isFinal) {
            console.log('[ElevenLabs] Stream complete, remaining queue:', this.audioQueue.length);
          }
          
          if (data.error) {
            console.error('[ElevenLabs] Server error:', data.error);
            if (data.error === 'input_timeout_exceeded' || data.error === 'input_timeout') {
              console.log('[ElevenLabs] Input timeout - this is normal if no text was sent yet');
            }
          }
          
          if (data.code === 'input_timeout_exceeded' || data.code === 'input_timeout') {
            console.log('[ElevenLabs] Input timeout exceeded - will reconnect on next text');
          }
        } catch (err) {
          console.error('[ElevenLabs] Error processing message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[ElevenLabs] WebSocket error:', err);
        this.isConnected = false;
        reject(err);
      };

      this.ws.onclose = (event) => {
        console.log('[ElevenLabs] WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.isPlaying = false;
      };
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    console.log('[ElevenLabs] Reconnecting...');
    await this.connect();
  }

  async sendText(text: string, flush = false): Promise<void> {
    if (!this.ws || !this.isConnected) {
      console.warn('[ElevenLabs] Not connected, buffering text and attempting reconnect');
      this.textBuffer += text;
      try {
        await this.ensureConnected();
      } catch (err) {
        console.error('[ElevenLabs] Reconnect failed:', err);
        return;
      }
    }

    if (this.textBuffer) {
      const message = {
        text: this.textBuffer,
        flush: false,
      };
      this.ws?.send(JSON.stringify(message));
      this.textBuffer = '';
    }

    const message = {
      text,
      flush,
    };
    this.ws?.send(JSON.stringify(message));
    console.log('[ElevenLabs] Sent text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  }

  flush(): void {
    if (!this.ws || !this.isConnected) return;
    
    if (this.textBuffer) {
      this.ws.send(JSON.stringify({ text: this.textBuffer, flush: false }));
      this.textBuffer = '';
    }
    
    this.ws.send(JSON.stringify({ text: '', flush: true }));
    console.log('[ElevenLabs] Flushed stream');
  }

  private async playNextChunk(): Promise<void> {
    console.log('[ElevenLabs] playNextChunk called, queue length:', this.audioQueue.length, 'isPlaying:', this.isPlaying, 'useAudioElement:', this.useAudioElement, 'volume:', this.volume);
    
    audioState.lastPlaybackAttempt = Date.now();
    audioState.playbackError = null;
    
    const unlocked = await ensureAudioUnlocked();
    if (!unlocked) {
      console.error('[ElevenLabs] Cannot play - audio not unlocked');
      audioState.playbackError = 'Audio not unlocked - user interaction required';
      this.isPlaying = false;
      return;
    }

    if (this.audioQueue.length === 0) {
      console.log('[ElevenLabs] playNextChunk: Queue empty, stopping');
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const chunk = this.audioQueue.shift()!;
    console.log('[ElevenLabs] playNextChunk: Processing chunk, size:', chunk.byteLength, 'bytes');

    try {
      if (this.useAudioElement || !this.audioContext) {
        console.log('[ElevenLabs] Playing via HTML5 Audio element...');
        
        const blob = new Blob([chunk], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        const audioElement = new Audio();
        audioElement.src = url;
        audioElement.volume = this.volume;
        audioElement.preload = 'auto';
        
        console.log('[ElevenLabs] Created fresh audio element, volume:', audioElement.volume);
        
        audioElement.onended = () => {
          console.log('[ElevenLabs] HTML5 Audio chunk ended');
          URL.revokeObjectURL(url);
          this.playNextChunk();
        };
        
        audioElement.onerror = (e) => {
          console.error('[ElevenLabs] HTML5 Audio error:', e, 'errorCode:', audioElement.error?.code, 'errorMessage:', audioElement.error?.message);
          audioState.playbackError = `HTML5 Audio error: ${audioElement.error?.message || 'unknown'}`;
          URL.revokeObjectURL(url);
          this.playNextChunk();
        };
        
        console.log('[ElevenLabs] Starting audio playback...');
        
        try {
          await audioElement.play();
          console.log('[ElevenLabs] HTML5 Audio playback started successfully');
        } catch (playError) {
          console.error('[ElevenLabs] HTML5 Audio play() failed:', playError);
          audioState.playbackError = playError instanceof Error ? playError.message : String(playError);
          
          if (playError instanceof Error && playError.name === 'NotAllowedError') {
            console.log('[ElevenLabs] Autoplay blocked, attempting to unlock audio...');
            await forceUnlockAudio();
            try {
              await audioElement.play();
              console.log('[ElevenLabs] Playback succeeded after force unlock');
            } catch (retryError) {
              console.error('[ElevenLabs] Still failed after unlock:', retryError);
              URL.revokeObjectURL(url);
              this.playNextChunk();
              return;
            }
          } else {
            URL.revokeObjectURL(url);
            this.playNextChunk();
            return;
          }
        }
        return;
      }
      
      console.log('[ElevenLabs] Playing via AudioContext...');
      
      if (this.audioContext.state === 'closed') {
        console.error('[ElevenLabs] AudioContext is closed');
        audioState.playbackError = 'AudioContext is closed';
        this.isPlaying = false;
        return;
      }
      
      if (this.audioContext.state === 'suspended') {
        console.log('[ElevenLabs] AudioContext suspended, resuming...');
        await this.audioContext.resume();
        console.log('[ElevenLabs] AudioContext state after resume:', this.audioContext.state);
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(chunk.buffer.slice(0));
      console.log('[ElevenLabs] Decoded audio, duration:', audioBuffer.duration);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);
      }
      
      source.connect(this.gainNode);
      
      source.onended = () => {
        this.sourceNode = null;
        this.playNextChunk();
      };
      
      this.sourceNode = source;
      source.start();
      console.log('[ElevenLabs] AudioContext playback started');
    } catch (err) {
      console.error('[ElevenLabs] Error playing audio chunk:', err);
      audioState.playbackError = err instanceof Error ? err.message : String(err);
      this.playNextChunk();
    }
  }

  onAudio(callback: (chunk: Uint8Array) => void): void {
    this.onAudioChunk = callback;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log('[ElevenLabs] Volume set to:', this.volume);
    
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.value = this.volume;
    }
    
    currentVolume = this.volume;
  }

  getVolume(): number {
    return this.volume;
  }

  stop(): void {
    this.isPlaying = false;
    this.audioQueue = [];
    this.textBuffer = '';
    
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.src = '';
      } catch (e) {
        console.warn('[ElevenLabs] Error stopping audio element:', e);
      }
    }
    
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
        console.warn('[ElevenLabs] Error stopping source node:', e);
      }
      this.sourceNode = null;
    }
  }

  disconnect(): void {
    this.stop();
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    
    this.isConnected = false;
    console.log('[ElevenLabs] Disconnected');
  }

  isActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string = ELEVENLABS_VOICES['josh'].id,
  options?: Partial<ElevenLabsConfig>
): Promise<ArrayBuffer> {
  const apiKey = options?.apiKey || process.env.ELEVENLABS_API_KEY;
  
  console.log('[ElevenLabs] synthesizeSpeech called');
  console.log('[ElevenLabs] API Key present:', !!apiKey, 'Length:', apiKey?.length || 0);
  console.log('[ElevenLabs] Voice ID:', voiceId);
  console.log('[ElevenLabs] Text length:', text.length);
  
  if (!apiKey) {
    console.error('[ElevenLabs] API key is missing');
    throw new Error('ElevenLabs API key is required');
  }

  console.log('[ElevenLabs] Sending request to ElevenLabs API...');
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: options?.modelId || 'eleven_monolingual_v1',
      voice_settings: {
        stability: options?.stability || 0.5,
        similarity_boost: options?.similarityBoost || 0.75,
        style: options?.style || 0.3,
        use_speaker_boost: options?.useSpeakerBoost ?? true,
      },
    }),
  });

  console.log('[ElevenLabs] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const error = await response.text();
    console.error('[ElevenLabs] API error:', response.status, error);
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log('[ElevenLabs] Audio data received, size:', arrayBuffer.byteLength, 'bytes');
  
  return arrayBuffer;
}

export async function playAudioBuffer(
  audioData: ArrayBuffer,
  audioContext?: AudioContext
): Promise<void> {
  console.log('[ElevenLabs] playAudioBuffer called, data size:', audioData.byteLength);
  
  audioState.lastPlaybackAttempt = Date.now();
  audioState.playbackError = null;
  
  const unlocked = await ensureAudioUnlocked();
  console.log('[ElevenLabs] Audio unlocked before playback:', unlocked);
  
  if (!unlocked) {
    const error = 'Audio not unlocked - user interaction required. Click somewhere on the page first.';
    audioState.playbackError = error;
    throw new Error(error);
  }
  
  const ctx = audioContext || globalAudioContext || new AudioContext();
  console.log('[ElevenLabs] AudioContext state:', ctx.state);
  
  if (ctx.state === 'suspended') {
    console.log('[ElevenLabs] AudioContext suspended, attempting to resume...');
    try {
      await ctx.resume();
      console.log('[ElevenLabs] AudioContext resumed, new state:', ctx.state);
    } catch (resumeError) {
      console.error('[ElevenLabs] Failed to resume AudioContext:', resumeError);
      audioState.playbackError = `Failed to resume AudioContext: ${resumeError}`;
      throw new Error(`Failed to resume AudioContext: ${resumeError}`);
    }
  }
  
  if (ctx.state !== 'running') {
    const error = `AudioContext not running (state: ${ctx.state}). User interaction may be required.`;
    audioState.playbackError = error;
    throw new Error(error);
  }
  
  console.log('[ElevenLabs] Decoding audio data...');
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(audioData);
    console.log('[ElevenLabs] Audio decoded, duration:', audioBuffer.duration, 'seconds');
  } catch (decodeError) {
    console.error('[ElevenLabs] Failed to decode audio:', decodeError);
    audioState.playbackError = `Failed to decode audio: ${decodeError}`;
    throw new Error(`Failed to decode audio data: ${decodeError}`);
  }
  
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  
  const gainNode = ctx.createGain();
  gainNode.gain.value = currentVolume;
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  console.log('[ElevenLabs] Starting playback with volume:', currentVolume);
  
  return new Promise((resolve, reject) => {
    source.onended = () => {
      console.log('[ElevenLabs] Playback ended');
      resolve();
    };
    
    source.onerror = (e) => {
      console.error('[ElevenLabs] Source error:', e);
      audioState.playbackError = `Audio source error: ${e}`;
      reject(new Error(`Audio source error: ${e}`));
    };
    
    try {
      source.start();
      console.log('[ElevenLabs] Playback started');
    } catch (startError) {
      console.error('[ElevenLabs] Failed to start playback:', startError);
      audioState.playbackError = `Failed to start: ${startError}`;
      reject(startError);
    }
  });
}

export async function testAudioPlayback(): Promise<{ success: boolean; message: string; details?: any }> {
  console.log('[Audio] testAudioPlayback called');
  
  try {
    const unlocked = await ensureAudioUnlocked();
    if (!unlocked) {
      return {
        success: false,
        message: 'Failed to unlock audio. Please click somewhere on the page and try again.',
        details: getAudioState()
      };
    }
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const testContext = new AudioContextClass();
    
    console.log('[Audio] Test AudioContext state:', testContext.state);
    
    if (testContext.state === 'suspended') {
      await testContext.resume();
    }
    
    const sampleRate = testContext.sampleRate;
    const duration = 0.5;
    const numSamples = sampleRate * duration;
    
    const buffer = testContext.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const frequency = 440;
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * 0.5 * Math.exp(-t * 4);
    }
    
    const source = testContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = testContext.createGain();
    gainNode.gain.value = currentVolume;
    source.connect(gainNode);
    gainNode.connect(testContext.destination);
    
    await new Promise<void>((resolve, reject) => {
      source.onended = () => resolve();
      source.onerror = (e) => reject(e);
      source.start();
    });
    
    console.log('[Audio] Test playback completed successfully');
    
    return {
      success: true,
      message: 'Audio test successful - you should have heard a 440Hz tone for 0.5 seconds.',
      details: {
        audioUnlocked: audioUnlocked,
        contextState: testContext.state,
        volume: currentVolume
      }
    };
  } catch (error) {
    console.error('[Audio] Test playback failed:', error);
    return {
      success: false,
      message: `Audio test failed: ${error instanceof Error ? error.message : String(error)}`,
      details: getAudioState()
    };
  }
}

let activeStreamer: ElevenLabsStreamer | null = null;

export const getActiveStreamer = (): ElevenLabsStreamer | null => activeStreamer;
export const setActiveStreamer = (streamer: ElevenLabsStreamer | null): void => {
  if (activeStreamer) {
    activeStreamer.disconnect();
  }
  activeStreamer = streamer;
};