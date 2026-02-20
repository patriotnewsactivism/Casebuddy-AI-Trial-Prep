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
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
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
            this.audioQueue.push(audioBytes);
            this.onAudioChunk?.(audioBytes);
            
            // Auto-play if not already playing
            if (!this.isPlaying && this.audioContext) {
              this.playNextChunk();
            }
          }
          
          if (data.isFinal) {
            console.log('[ElevenLabs] Stream complete');
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
      };
    });
  }

  /**
   * Send text to be synthesized
   */
  sendText(text: string, flush = false): void {
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
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const chunk = this.audioQueue.shift()!;

    try {
      // Decode MP3 chunk to AudioBuffer
      const audioBuffer = await this.audioContext.decodeAudioData(chunk.buffer.slice(0));
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode!);
      
      source.onended = () => {
        this.sourceNode = null;
        // Play next chunk
        this.playNextChunk();
      };
      
      this.sourceNode = source;
      source.start();
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
  
  if (!apiKey) {
    throw new Error('ElevenLabs API key is required');
  }

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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  return response.arrayBuffer();
}

/**
 * Play synthesized audio from ArrayBuffer
 */
export async function playAudioBuffer(
  audioData: ArrayBuffer,
  audioContext?: AudioContext
): Promise<void> {
  const ctx = audioContext || new AudioContext();
  
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  const audioBuffer = await ctx.decodeAudioData(audioData);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  
  return new Promise((resolve) => {
    source.onended = () => resolve();
    source.start();
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
