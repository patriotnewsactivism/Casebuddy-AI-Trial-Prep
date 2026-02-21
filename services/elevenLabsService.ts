/**
 * ElevenLabs Text-to-Speech Service
 * Provides realistic voice synthesis for trial simulator
 * Free tier: 10,000 characters per month
 */

// Available voices - these are free-tier compatible
export const ELEVENLABS_VOICES = {
  // Male voices
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

// Voice presets for different trial roles
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

// Default config for trial simulation
const DEFAULT_CONFIG: Partial<ElevenLabsConfig> = {
  modelId: 'eleven_monolingual_v1', // Free tier compatible
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.3,
  useSpeakerBoost: true,
};

/**
 * Check if ElevenLabs is configured
 */
export const isElevenLabsConfigured = (): boolean => {
  const key = process.env.ELEVENLABS_API_KEY;
  return !!(key && key.length > 10);
};

/**
 * Get available voices
 */
export const getAvailableVoices = () => {
  return Object.entries(ELEVENLABS_VOICES).map(([id, voice]) => ({
    id,
    ...voice,
  }));
};

/**
 * Get voice preset for a trial role
 */
export const getTrialVoicePreset = (preset: TrialVoicePreset) => {
  return TRIAL_VOICE_PRESETS[preset];
};

/**
 * ElevenLabs WebSocket TTS for streaming audio
 */
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

  /**
   * Initialize the audio context
   */
  async initAudio(sampleRate: number = 24000): Promise<AudioContext> {
    console.log('[ElevenLabs] initAudio called, sampleRate:', sampleRate);
    
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        // Use the browser's preferred sample rate to avoid device conflicts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        console.log('[ElevenLabs] Created new AudioContext');
        console.log('[ElevenLabs] AudioContext sampleRate:', this.audioContext.sampleRate);
        console.log('[ElevenLabs] AudioContext state:', this.audioContext.state);
        console.log('[ElevenLabs] AudioContext baseLatency:', this.audioContext.baseLatency);
        
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        console.log('[ElevenLabs] GainNode created and connected to destination');
        console.log('[ElevenLabs] GainNode volume:', this.gainNode.gain.value);
      }
      
      if (this.audioContext.state === 'suspended') {
        console.log('[ElevenLabs] AudioContext suspended, attempting resume...');
        await this.audioContext.resume();
        console.log('[ElevenLabs] AudioContext after resume:', this.audioContext.state);
      }
      
      if (this.audioContext.state !== 'running') {
        console.warn('[ElevenLabs] AudioContext is not running, state:', this.audioContext.state);
        throw new Error(`AudioContext failed to start, state: ${this.audioContext.state}`);
      }
      
      console.log('[ElevenLabs] AudioContext ready, state:', this.audioContext.state);
      return this.audioContext;
    } catch (err) {
      console.error('[ElevenLabs] AudioContext initialization failed:', err);
      throw err;
    }
  }

  /**
   * Connect to ElevenLabs WebSocket for streaming TTS
   */
  async connect(onReady?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const voiceId = this.config.voiceId;
      const modelId = this.config.modelId || 'eleven_monolingual_v1';
      
      // WebSocket URL for ElevenLabs streaming
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;
      
      console.log('[ElevenLabs] Connecting to WebSocket...');
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[ElevenLabs] WebSocket connected');
        
        // Send initial configuration
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
            // Decode base64 audio chunk
            const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
            console.log('[ElevenLabs] Received audio chunk, size:', audioBytes.byteLength, 'bytes, queue length:', this.audioQueue.length);
            this.audioQueue.push(audioBytes);
            this.onAudioChunk?.(audioBytes);
            
            // Auto-play if not already playing
            if (!this.isPlaying && this.audioContext) {
              console.log('[ElevenLabs] Starting playback (not currently playing)');
              this.playNextChunk();
            } else if (!this.audioContext) {
              console.error('[ElevenLabs] ERROR: No audioContext available for playback!');
            } else {
              console.log('[ElevenLabs] Already playing, chunk queued');
            }
          }
          
          if (data.isFinal) {
            console.log('[ElevenLabs] Stream complete, remaining queue:', this.audioQueue.length);
          }
          
          if (data.error) {
            console.error('[ElevenLabs] Server error:', data.error);
            // Don't throw for timeout errors - they're recoverable
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
        // Clear the playing state so we can restart
        this.isPlaying = false;
      };
    });
  }

  /**
   * Reconnect if connection was lost
   */
  async ensureConnected(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    console.log('[ElevenLabs] Reconnecting...');
    await this.connect();
  }

  /**
   * Send text to be synthesized
   */
  async sendText(text: string, flush = false): Promise<void> {
    if (!this.ws || !this.isConnected) {
      console.warn('[ElevenLabs] Not connected, buffering text');
      this.textBuffer += text;
      return;
    }

    // Send any buffered text first
    if (this.textBuffer) {
      const message = {
        text: this.textBuffer,
        flush: false,
      };
      this.ws.send(JSON.stringify(message));
      this.textBuffer = '';
    }

    const message = {
      text,
      flush,
    };
    this.ws.send(JSON.stringify(message));
    console.log('[ElevenLabs] Sent text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  }

  /**
   * Flush any remaining text and close input stream
   */
  flush(): void {
    if (!this.ws || !this.isConnected) return;
    
    // Send any buffered text
    if (this.textBuffer) {
      this.ws.send(JSON.stringify({ text: this.textBuffer, flush: false }));
      this.textBuffer = '';
    }
    
    // Send flush signal
    this.ws.send(JSON.stringify({ text: '', flush: true }));
    console.log('[ElevenLabs] Flushed stream');
  }

  /**
   * Play the next audio chunk in the queue
   */
  private async playNextChunk(): Promise<void> {
    console.log('[ElevenLabs] playNextChunk called, audioContext:', !!this.audioContext, 'queue length:', this.audioQueue.length, 'isPlaying:', this.isPlaying);
    
    if (!this.audioContext) {
      console.error('[ElevenLabs] playNextChunk: No audioContext!');
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
      // Check AudioContext state
      console.log('[ElevenLabs] AudioContext state before decode:', this.audioContext.state);
      
      if (this.audioContext.state === 'suspended') {
        console.log('[ElevenLabs] AudioContext suspended, resuming...');
        await this.audioContext.resume();
      }
      
      // Decode MP3 chunk to AudioBuffer
      console.log('[ElevenLabs] Decoding audio data...');
      const audioBuffer = await this.audioContext.decodeAudioData(chunk.buffer.slice(0));
      console.log('[ElevenLabs] Decoded audio, duration:', audioBuffer.duration, 'seconds, sampleRate:', audioBuffer.sampleRate);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      console.log('[ElevenLabs] Connecting source to gainNode, gain:', this.gainNode?.gain.value);
      source.connect(this.gainNode!);
      
      source.onended = () => {
        console.log('[ElevenLabs] Chunk playback ended');
        this.sourceNode = null;
        // Play next chunk
        this.playNextChunk();
      };
      
      this.sourceNode = source;
      console.log('[ElevenLabs] Starting source playback...');
      source.start();
      console.log('[ElevenLabs] source.start() called successfully');
    } catch (err) {
      console.error('[ElevenLabs] Error playing audio chunk:', err);
      // Try next chunk on error
      this.playNextChunk();
    }
  }

  /**
   * Set callback for audio chunks
   */
  onAudio(callback: (chunk: Uint8Array) => void): void {
    this.onAudioChunk = callback;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    this.isPlaying = false;
    this.audioQueue = [];
    this.textBuffer = '';
    
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {}
      this.sourceNode = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
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

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Simple TTS function (non-streaming) for quick synthesis
 */
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

/**
 * Play synthesized audio from ArrayBuffer
 */
export async function playAudioBuffer(
  audioData: ArrayBuffer,
  audioContext?: AudioContext
): Promise<void> {
  console.log('[ElevenLabs] playAudioBuffer called, data size:', audioData.byteLength);
  
  const ctx = audioContext || new AudioContext();
  console.log('[ElevenLabs] AudioContext state:', ctx.state);
  
  if (ctx.state === 'suspended') {
    console.log('[ElevenLabs] AudioContext suspended, attempting to resume...');
    await ctx.resume();
    console.log('[ElevenLabs] AudioContext resumed, new state:', ctx.state);
  }
  
  console.log('[ElevenLabs] Decoding audio data...');
  const audioBuffer = await ctx.decodeAudioData(audioData);
  console.log('[ElevenLabs] Audio decoded, duration:', audioBuffer.duration, 'seconds');
  
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  
  console.log('[ElevenLabs] Starting playback...');
  
  return new Promise((resolve) => {
    source.onended = () => {
      console.log('[ElevenLabs] Playback ended');
      resolve();
    };
    source.start();
    console.log('[ElevenLabs] Playback started');
  });
}

// Export singleton instance management
let activeStreamer: ElevenLabsStreamer | null = null;

export const getActiveStreamer = (): ElevenLabsStreamer | null => activeStreamer;
export const setActiveStreamer = (streamer: ElevenLabsStreamer | null): void => {
  if (activeStreamer) {
    activeStreamer.disconnect();
  }
  activeStreamer = streamer;
};
