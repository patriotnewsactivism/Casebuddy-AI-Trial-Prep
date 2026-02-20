import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { TranscriptionProvider, TranscriptionSettings, TranscriptionResultData, TranscriptSegmentData } from "../types";

const getApiKey = () => process.env.API_KEY || process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';

// AssemblyAI API response interfaces
interface AssemblyAIUtterance {
  start: number; // milliseconds
  end: number;   // milliseconds
  speaker: string;
  text: string;
  confidence: number;
}

interface AssemblyAITranscriptResult {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  utterances?: AssemblyAIUtterance[];
  error?: string;
  language_code?: string;
  audio_duration?: number;
}

/**
 * Polls the Gemini File API until the uploaded file is in the 'ACTIVE' state.
 */
const waitForFileActive = async (fileUri: string, apiKey: string): Promise<void> => {
    const fileId = fileUri.split('/').pop();
    if (!fileId) return;

    const maxAttempts = 60;
    let attempt = 0;
    let delay = 500;

    while (attempt < maxAttempts) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}`);
        if (!response.ok) throw new Error("Failed to check file status");

        const data = await response.json();

        if (data.state === 'ACTIVE') {
            return;
        } else if (data.state === 'FAILED') {
            throw new Error("File processing failed on Google servers.");
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 3000);
        attempt++;
    }

    throw new Error("File processing timed out.");
};

/**
 * Uploads any file to Gemini's File API using the resumable upload flow.
 */
const uploadFileToGemini = async (
    file: Blob | File,
    apiKey: string,
    onProgress?: (percent: number) => void
): Promise<string> => {
    const startResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': file.size.toString(),
            'X-Goog-Upload-Header-Content-Type': file.type || 'audio/wav',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: file instanceof File ? file.name : 'Audio_Evidence' } })
    });

    if (!startResponse.ok) {
        const errorText = await startResponse.text().catch(() => '');
        throw new Error(`Failed to start upload: ${startResponse.status} ${errorText}`);
    }

    const uploadUrl = startResponse.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) throw new Error("Failed to initiate Gemini upload session.");

    return await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Content-Length', file.size.toString());
        xhr.setRequestHeader('X-Goog-Upload-Offset', '0');
        xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');

        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const fileData = JSON.parse(xhr.responseText);
                    resolve(fileData.file.uri);
                } catch (err) {
                    reject(new Error("Failed to parse upload response"));
                }
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network Error during upload"));
        xhr.send(file);
    });
};

// --- GEMINI IMPLEMENTATION ---
const transcribeWithGemini = async (
  file: Blob | File,
  settings: TranscriptionSettings,
  onProgress?: (percent: number) => void
): Promise<TranscriptionResultData> => {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error("Missing Gemini API Key in environment.");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const modelName = 'gemini-2.5-flash';

  const vocabList = settings.customVocabulary.length > 0
    ? `VOCABULARY/GLOSSARY (Prioritize these spellings): ${settings.customVocabulary.join(', ')}`
    : '';

  const prompt = `
  You are an expert Audio Transcription AI.
  ${vocabList}

  TASK:
  Transcribe the audio accurately.
  You MUST return the result as a raw JSON Array of objects. Do not use Markdown code blocks. Just the JSON.

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

  const parseGeminiResponse = (text: string): TranscriptionResultData => {
      try {
          const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const segments: TranscriptSegmentData[] = JSON.parse(cleanedText);

          const fullText = segments.map(s => `[${formatTimestamp(s.start)}] [${s.speaker}] ${s.text}`).join('\n');

          return {
              text: fullText,
              segments: segments,
              providerUsed: TranscriptionProvider.GEMINI
          };
      } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          console.warn("Failed to parse JSON from Gemini, falling back to raw text.", error);
          return {
              text: text,
              providerUsed: TranscriptionProvider.GEMINI
          };
      }
  };

  const formatTimestamp = (seconds: number) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  try {
      if (onProgress) onProgress(1);

      const fileUri = await uploadFileToGemini(file, API_KEY, onProgress);

      if (onProgress) onProgress(100);

      await waitForFileActive(fileUri, API_KEY);

      const response: GenerateContentResponse = await ai.models.generateContent({
          model: modelName,
          contents: {
              parts: [
                  { fileData: { fileUri: fileUri, mimeType: file.type || 'audio/wav' } },
                  { text: prompt }
              ]
          },
          config: {
              responseMimeType: "application/json"
          }
      });

      const rawResponseText = response.text || "[]";
      return parseGeminiResponse(rawResponseText);

  } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error("Gemini transcription failed:", error);

      // Fallback for small files
      if (file.size < 2 * 1024 * 1024) {
          try {
              const base64Audio = await file.arrayBuffer().then((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))));
              const mimeType = file.type || 'audio/webm';

              const response: GenerateContentResponse = await ai.models.generateContent({
                  model: modelName,
                  contents: {
                      parts: [
                          { inlineData: { mimeType: mimeType, data: base64Audio } },
                          { text: prompt }
                      ]
                  },
                  config: {
                      responseMimeType: "application/json",
                  }
              });

              const rawResponseText = response.text || "[]";
              return parseGeminiResponse(rawResponseText);
          } catch (fallbackErr) {
              console.error("Fallback transcription path also failed:", fallbackErr);
          }
      }

      throw new Error(`File processing failed: ${error.message}. Please try again on a stable connection.`);
  }
};

// --- OPENAI WHISPER ---
const transcribeWithOpenAI = async (
  audioFile: Blob | File,
  apiKey: string,
  settings: TranscriptionSettings
): Promise<TranscriptionResultData> => {
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) throw new Error("OpenAI Error");
  const data = await response.json();

  return {
      text: data.text,
      providerUsed: TranscriptionProvider.OPENAI
  };
};

// --- ASSEMBLYAI ---
const transcribeWithAssemblyAI = async (
  audioFile: Blob | File,
  apiKey: string,
  settings: TranscriptionSettings,
  onProgress?: (percent: number) => void
): Promise<TranscriptionResultData> => {
    if (!apiKey) throw new Error("AssemblyAI API Key is missing. Please check Settings.");

    const uploadUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.assemblyai.com/v2/upload');
        xhr.setRequestHeader('Authorization', apiKey);

        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                   const percentComplete = Math.round((event.loaded / event.total) * 30);
                   onProgress(percentComplete);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve(response.upload_url);
            } else {
                reject(new Error(`AssemblyAI Upload failed: ${xhr.statusText}`));
            }
        };
        xhr.onerror = () => reject(new Error("Network error during AssemblyAI upload"));
        xhr.send(audioFile);
    });

    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            audio_url: uploadUrl,
            speaker_labels: true,
            word_boost: settings.customVocabulary,
            boost_param: settings.customVocabulary.length > 0 ? 'high' : undefined
        }),
    });

    if (!response.ok) {
        throw new Error(`AssemblyAI Transcription Request failed: ${response.statusText}`);
    }

    const { id } = await response.json();

    const MAX_POLLING_ATTEMPTS = 120;
    let pollingAttempt = 0;

    while (pollingAttempt < MAX_POLLING_ATTEMPTS) {
        pollingAttempt++;
        const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
            headers: { 'Authorization': apiKey },
        });

        if (!pollingResponse.ok) {
            throw new Error(`AssemblyAI polling failed: ${pollingResponse.statusText}`);
        }

        const result = await pollingResponse.json() as AssemblyAITranscriptResult;

        if (result.status === 'completed') {
            if (onProgress) onProgress(100);

            const segments: TranscriptSegmentData[] = (result.utterances || []).map((u: AssemblyAIUtterance) => ({
                start: u.start / 1000,
                end: u.end / 1000,
                speaker: `Speaker ${u.speaker}`,
                text: u.text
            }));

            if (segments.length === 0 && result.text) {
                segments.push({
                    start: 0,
                    end: result.audio_duration || 0,
                    speaker: 'Speaker',
                    text: result.text
                });
            }

            return {
                text: result.text || '',
                segments: segments,
                providerUsed: TranscriptionProvider.ASSEMBLYAI,
                detectedLanguage: result.language_code
            };
        } else if (result.status === 'error') {
            throw new Error(`AssemblyAI Processing Failed: ${result.error}`);
        } else {
            if (onProgress) {
                const fakeProgress = 30 + Math.min(60, pollingAttempt * 2);
                onProgress(fakeProgress);
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    throw new Error('AssemblyAI transcription polling timeout after 6 minutes');
};

// --- MAIN EXPORT ---
export const transcribeAudio = async (
  file: File | Blob,
  _base64: string,
  settings: TranscriptionSettings,
  onProgress?: (percent: number) => void
): Promise<TranscriptionResultData> => {
  switch (settings.provider) {
    case TranscriptionProvider.OPENAI:
      return await transcribeWithOpenAI(file, settings.openaiKey, settings);
    case TranscriptionProvider.ASSEMBLYAI:
      return await transcribeWithAssemblyAI(file, settings.assemblyAiKey, settings, onProgress);
    case TranscriptionProvider.GEMINI:
    default:
      return await transcribeWithGemini(file, settings, onProgress);
  }
};
