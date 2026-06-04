/**
 * Gemini Live API Service
 *
 * Provides real-time bidirectional voice communication with Gemini AI
 * for courtroom simulation. Uses WebSocket-based Gemini Live API
 * for true 2-way audio (you speak → AI speaks back in real-time).
 *
 * Ported from CaseBuddy Trial-Preparation prototype.
 */

import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { TrialPhase, SimulationMode } from '../types';

// ─── Audio Context Setup ─────────────────────────────────────────────────────

export const setupAudioContexts = async (inputRate = 16000, outputRate = 24000) => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const inputAudioContext = new AudioContextClass({ sampleRate: inputRate });
  const outputAudioContext = new AudioContextClass({ sampleRate: outputRate });

  // Mobile fix: AudioContext starts suspended on iOS/Android — must resume after user gesture
  if (inputAudioContext.state === 'suspended') {
    try { await inputAudioContext.resume(); } catch { /* non-fatal */ }
  }
  if (outputAudioContext.state === 'suspended') {
    try { await outputAudioContext.resume(); } catch { /* non-fatal */ }
  }

  return { inputAudioContext, outputAudioContext };
};

// ─── PCM Audio Encoding/Decoding ─────────────────────────────────────────────

export function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
  }

  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

export function decodeAudio(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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

// ─── Mobile Audio Helpers ────────────────────────────────────────────────────

/**
 * On mobile, AudioContext suspends when the browser tab/app goes to background
 * or the phone locks. Call this once to auto-resume when the user returns.
 */
export const keepAudioAlive = (
  inputCtx: AudioContext,
  outputCtx: AudioContext,
) => {
  const handler = () => {
    if (document.visibilityState === 'visible') {
      if (inputCtx.state === 'suspended') inputCtx.resume().catch(() => {});
      if (outputCtx.state === 'suspended') outputCtx.resume().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
};

// ─── System Prompt Builder ───────────────────────────────────────────────────

function buildLiveSystemPrompt(
  phase: TrialPhase,
  mode: SimulationMode,
  caseContext: string,
): string {
  const modeInstructions = {
    learn: `MODE: EDUCATIONAL
- After your in-character response, add a brief coaching moment
- Explain WHY rules exist, not just what they are
- Be encouraging — this user is learning
- Offer specific suggestions on what to say next
- Mention relevant case law when appropriate`,
    practice: `MODE: GUIDED PRACTICE
- Stay in character but provide occasional coaching
- Point out errors constructively after they happen
- Give brief feedback on tone, word choice, and strategy
- Be moderately challenging`,
    trial: `MODE: FULL TRIAL REALISM
- Stay in character at ALL times — no coaching, no hand-holding
- Be aggressive, tactical, and ruthless
- Object frequently to any improper questions
- Challenge every weakness
- This is real courtroom combat`,
  };

  const phaseLabels: Record<TrialPhase, string> = {
    'pre-trial-motions': 'Pre-Trial Motions',
    'voir-dire': 'Voir Dire',
    'opening-statement': 'Opening Statement',
    'direct-examination': 'Direct Examination',
    'cross-examination': 'Cross-Examination',
    'defendant-testimony': 'Defendant Testimony',
    'closing-argument': 'Closing Argument',
    'sentencing': 'Sentencing',
  };

  return `You are an expert Legal Simulator providing LIVE VOICE courtroom training.
You will act as the Opposing Counsel, Judge, and/or Witnesses during a "${phaseLabels[phase]}" training session.

CASE INFORMATION & EVIDENCE SUMMARY:
${caseContext.substring(0, 25000)}

${modeInstructions[mode]}

VOICE INTERACTION RULES:
1. Respond naturally with spoken language — you are speaking out loud in a courtroom.
2. Keep responses concise (under 20 seconds) to allow natural back-and-forth.
3. Use actual courtroom language: "Objection, Your Honor", "May it please the court", "I'll rephrase", etc.
4. If the user asks an improper question, OBJECT with specific legal grounds (hearsay, leading, relevance, speculation, foundation, asked and answered, etc.).
5. If acting as Judge, rule on objections based on the evidence provided.
6. Use specific names, dates, and facts from the Case Information.
7. Be aggressive if the user is weak. Be agreeable if they are persuasive.
8. Vary your persona — be Judge for rulings, Opposing Counsel for objections, Witness when being examined.
9. For ${phase === 'opening-statement' || phase === 'closing-argument' ? 'this phase, respond to the attorney\'s statements and challenge weak points' : 'examination phases, respond to questions in character as the appropriate persona'}.

REALISM STANDARDS:
- Opposing counsel is sharp, aggressive, and uses real objections with proper legal grounds
- Judges are authoritative, impatient, and enforce procedure strictly
- Witnesses have personalities and may be evasive, emotional, or inconsistent
- Never break character during the simulation`;
}

// ─── Live Session Connection ─────────────────────────────────────────────────

export interface LiveSessionCallbacks {
  onAudioData: (base64Audio: string) => void;
  onClose: () => void;
  onTranscription: (text: string, isUser: boolean) => void;
  onError?: (error: any) => void;
}

export const connectLiveSession = async (
  phase: TrialPhase,
  mode: SimulationMode,
  caseContext: string,
  callbacks: LiveSessionCallbacks,
) => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set API_KEY or GEMINI_API_KEY in your environment.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = buildLiveSystemPrompt(phase, mode, caseContext);

  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => console.log('[GeminiLive] Session connected'),
      onmessage: (msg: LiveServerMessage) => {
        // Handle audio output
        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          callbacks.onAudioData(audioData);
        }

        // Handle transcriptions
        if (msg.serverContent?.outputTranscription) {
          callbacks.onTranscription(
            msg.serverContent.outputTranscription.text,
            false
          );
        } else if (msg.serverContent?.inputTranscription) {
          callbacks.onTranscription(
            msg.serverContent.inputTranscription.text,
            true
          );
        }
      },
      onclose: (e) => {
        console.log('[GeminiLive] Session closed', e);
        callbacks.onClose();
      },
      onerror: (e) => {
        console.error('[GeminiLive] Session error', e);
        callbacks.onError?.(e);
        callbacks.onClose();
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' },
        },
      },
      systemInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  });
};

// ─── Live Turn Evaluation ────────────────────────────────────────────────────

export interface LiveTurnGrade {
  score: number;
  color: 'green' | 'yellow' | 'red';
  feedback: string;
}

export const evaluateLiveTurn = async (
  phase: TrialPhase,
  userText: string,
  context: string,
): Promise<LiveTurnGrade> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return { score: 50, color: 'yellow', feedback: 'API key not configured.' };

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Role: Senior Trial Advocacy Instructor.
Task: Grade the student attorney's statement in a ${phase} simulation.
Context: ${context.substring(0, 5000)}
Student Statement: "${userText}"

Output JSON only:
- score: 0-100 (Be strict. 90+ is master class, <60 is poor).
- color: "green" (good), "yellow" (ok), "red" (bad).
- feedback: 1 sentence tactical advice on tone, objection usage, or argument logic.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text?.replace(/```json\n?|```/g, '').trim() || '{}';
    const result = JSON.parse(raw);
    return {
      score: result.score ?? 50,
      color: result.color ?? 'yellow',
      feedback: result.feedback ?? 'Analysis unavailable.',
    };
  } catch {
    return { score: 50, color: 'yellow', feedback: 'Analysis unavailable.' };
  }
};
