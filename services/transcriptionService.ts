import { callGeminiProxy, callOpenAIProxy, callWhisperProxy } from './apiProxy';
import { Type } from "@google/genai";
import { TranscriptionProvider, TranscriptionSettings, TranscriptionResultData, TranscriptSegmentData } from "../types";

const vocabList = (settings: TranscriptionSettings) => settings.customVocabulary.length > 0
  ? `VOCABULARY/GLOSSARY (Prioritize these spellings): ${settings.customVocabulary.join(', ')}`
  : '';

const getPrompt = (settings: TranscriptionSettings) => `
You are an expert Audio Transcription AI.
${vocabList(settings)}

TASK:
Transcribe the audio accurately.
You MUST return the result as a raw JSON Array of objects. Just the JSON.

SCHEMA:
Array<{
  start: number; // Start time in seconds (e.g., 12.5)
  end: number;   // End time in seconds
  speaker: string; // e.g., "Speaker 1"
  text: string;    // The spoken text
}>

RULES:
1. Break text into natural sentence-level or phrase-level segments.
2. ${settings.legalMode ? 'Verbatim mode: Keep ums, ahs, and stuttering.' : 'Clean mode: Remove stuttering, but correct phonetic errors (e.g. "reel a state" -> "real estate").'}
3. Identify speakers carefully.
4. ACCURACY: If you see specific words in the provided Vocabulary list, use them.
`;

const formatTimestamp = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

export const fileToGenerativePart = async (file: File | Blob): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64Content = base64data.split(',')[1];
      resolve({
        data: base64Content,
        mimeType: file.type || 'audio/mpeg',
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const transcribeWithGemini = async (
  file: Blob | File,
  settings: TranscriptionSettings,
  onProgress?: (percent: number) => void
): Promise<TranscriptionResultData> => {
  try {
    if (onProgress) onProgress(10);
    
    const { data, mimeType } = await fileToGenerativePart(file);
    
    if (onProgress) onProgress(30);
    
    const prompt = getPrompt(settings);
    
    const response = await callGeminiProxy({
      prompt: "Transcribe the attached audio accurately following the provided rules. Output only the JSON array.",
      systemPrompt: prompt,
      model: 'gemini-2.5-flash',
      inlineData: {
        data,
        mimeType
      },
      options: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              speaker: { type: Type.STRING },
              text: { type: Type.STRING }
            },
            required: ['start', 'end', 'speaker', 'text']
          }
        }
      }
    });

    if (!response.success || !response.text) {
      throw new Error(response.error?.message || 'Transcription failed: No response text received');
    }

    const segments = JSON.parse(response.text);
    const fullText = segments.map((s: any) => `[${formatTimestamp(s.start)}] [${s.speaker}] ${s.text}`).join('\n');

    if (onProgress) onProgress(100);

    return {
      text: fullText,
      segments,
      providerUsed: TranscriptionProvider.GEMINI
    };
  } catch (error) {
    console.error("Gemini transcription via proxy failed:", error);
    throw error;
  }
};

const transcribeWithOpenAI = async (
  audioFile: Blob | File,
  settings: TranscriptionSettings
): Promise<TranscriptionResultData> => {
  const file = audioFile instanceof File ? audioFile : new File([audioFile], "audio.wav", { type: audioFile.type });
  
  const response = await callWhisperProxy(file);
  
  if (!response.success) {
    throw new Error(response.error?.message || "OpenAI Whisper transcription failed");
  }

  const segments: TranscriptSegmentData[] = (response.segments || []).map(s => ({
    start: s.start,
    end: s.end,
    speaker: s.speaker || "Speaker",
    text: s.text
  }));

  return {
    text: response.text,
    segments: segments.length > 0 ? segments : undefined,
    providerUsed: TranscriptionProvider.OPENAI
  };
};

export const transcribeAudio = async (
  file: File | Blob,
  _base64: string,
  settings: TranscriptionSettings,
  onProgress?: (percent: number) => void
): Promise<TranscriptionResultData> => {
  switch (settings.provider) {
    case TranscriptionProvider.OPENAI:
      return await transcribeWithOpenAI(file, settings);
    case TranscriptionProvider.GEMINI:
    default:
      return await transcribeWithGemini(file, settings, onProgress);
  }
};
