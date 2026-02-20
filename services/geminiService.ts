import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, StrategyInsight, CoachingAnalysis, TrialPhase, SimulationMode, SimulatorSettings } from "../types";
import { retryWithBackoff, withTimeout, isRateLimitError, getErrorMessage } from "../utils/errorHandler";
import { toast } from "react-toastify";
import { performDocumentOCR } from "./ocrService";

const apiKey = process.env.API_KEY || '';

if (!apiKey) {
  console.error('[Gemini] API key is missing. Set GEMINI_API_KEY in .env.local');
} else if (!apiKey.startsWith('AIzaSy')) {
  console.error('[Gemini] API key appears invalid. Get a valid key from https://aistudio.google.com/apikey');
}

const ai = new GoogleGenAI({ apiKey });

export const isApiKeyValid = (): boolean => {
  return !!(apiKey && apiKey.startsWith('AIzaSy'));
};

export const validateApiKey = (): void => {
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please set GEMINI_API_KEY in your .env.local file.');
  }
  if (!apiKey.startsWith('AIzaSy')) {
    throw new Error('Gemini API key appears invalid. Please get a valid key from https://aistudio.google.com/apikey');
  }
};

interface ChatSession {
  id: string;
  chat: ReturnType<typeof ai.chats.create>;
  type: 'witness' | 'opponent' | 'trial';
  createdAt: number;
}

const chatSessions = new Map<string, ChatSession>();

type QueuedRequest = {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
};

let requestQueue: QueuedRequest[] = [];
let isProcessing = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1500;

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    const request = requestQueue.shift();
    if (!request) continue;
    
    lastRequestTime = Date.now();
    
    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      if (isRateLimitError(error)) {
        console.log('Rate limited, waiting before retry...');
        toast.warning('Rate limit reached, waiting...');
        await new Promise(r => setTimeout(r, 10000));
        requestQueue.unshift(request);
        lastRequestTime = Date.now();
      } else {
        request.reject(error);
      }
    }
  }
  
  isProcessing = false;
};

const queueRequest = async <T>(fn: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
};

export const createChatSession = (
  id: string,
  type: 'witness' | 'opponent' | 'trial',
  systemInstruction: string,
  initialHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) => {
  const existing = chatSessions.get(id);
  if (existing) {
    return existing.chat;
  }

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      temperature: 0.9,
    },
    history: initialHistory
  });

  chatSessions.set(id, {
    id,
    chat,
    type,
    createdAt: Date.now()
  });

  return chat;
};

export const getChatSession = (id: string) => {
  return chatSessions.get(id)?.chat || null;
};

export const clearChatSession = (id: string) => {
  chatSessions.delete(id);
};

export const clearAllChatSessions = () => {
  chatSessions.clear();
};

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64Content = base64data.split(',')[1];
      
      let mimeType = file.type || 'application/octet-stream';
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (fileName.match(/\.(jpg|jpeg)$/)) {
        mimeType = 'image/jpeg';
      } else if (fileName.endsWith('.png')) {
        mimeType = 'image/png';
      } else if (fileName.endsWith('.webp')) {
        mimeType = 'image/webp';
      } else if (fileName.endsWith('.gif')) {
        mimeType = 'image/gif';
      } else if (fileName.match(/\.(mp3|m4a|wav|ogg|webm)$/)) {
        mimeType = file.type || 'audio/mpeg';
      } else if (fileName.match(/\.(mp4|mov|avi)$/)) {
        mimeType = file.type || 'video/mp4';
      } else if (file.type.startsWith('image/')) {
        mimeType = file.type;
      }
      
      resolve({
        inlineData: {
          data: base64Content,
          mimeType,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzePDFDocument = async (
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<{ 
  text: string; 
  pageCount: number; 
  summary: string;
  entities: string[];
  keyDates: string[];
  monetaryAmounts: string[];
  risks: string[];
}> => {
  onProgress?.(10, 'Extracting text with OCR...');
  const ocrResult = await performDocumentOCR(file, (p, s) => onProgress?.(10 + p * 0.6, s));
  
  const extractedText = ocrResult.text;
  const pageCount = ocrResult.pages?.length || 1;
  
  onProgress?.(80, 'Analyzing document...');
  
  const prompt = `Analyze this legal document text and extract key information.

Document Text:
${extractedText.substring(0, 50000)}

Provide:
1. A comprehensive summary (3-5 sentences)
2. All entities mentioned (people, organizations, companies)
3. All dates and deadlines
4. All monetary amounts with context
5. Potential legal risks or issues

Return JSON format.`;

  return queueRequest(async () => {
    return retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              entities: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyDates: { type: Type.ARRAY, items: { type: Type.STRING } },
              monetaryAmounts: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            }
          }
        }
      });

      const analysis = JSON.parse(response.text || '{}');
      
      return {
        text: extractedText,
        pageCount,
        summary: analysis.summary || 'No summary available',
        entities: analysis.entities || [],
        keyDates: analysis.keyDates || [],
        monetaryAmounts: analysis.monetaryAmounts || [],
        risks: analysis.risks || [],
      };
    }, 3, 2000);
  });
};

export const batchAnalyzeDocuments = async (
  files: File[], 
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<Array<{ fileName: string; result: any; error?: string }>> => {
  const results: Array<{ fileName: string; result: any; error?: string }> = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length, file.name);
    
    try {
      const isPDF = file.name.toLowerCase().endsWith('.pdf');
      
      if (isPDF) {
        const result = await analyzePDFDocument(file);
        results.push({ fileName: file.name, result });
      } else {
        const filePart = await fileToGenerativePart(file);
        const result = await analyzeDocument("Analyze this uploaded document.", filePart);
        results.push({ fileName: file.name, result });
      }
    } catch (error) {
      results.push({ 
        fileName: file.name, 
        result: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return results;
};

export const analyzeDocument = async (text: string, filePart?: any) => {
  return queueRequest(async () => {
    const prompt = `You are a legal document analyst. Analyze the following document thoroughly.

Extract and provide:
1. A comprehensive summary (3-5 sentences for complex documents)
2. Key entities: people, organizations, statutes, dates, case citations
3. Potential legal risks, contradictions, or issues
4. Document type classification
5. Key dates and deadlines mentioned
6. Monetary amounts if present

Return JSON format.`;

    const parts: any[] = [];
    if (filePart) {
      parts.push(filePart);
    }
    parts.push({ text: prompt + "\n\n" + (text || "Analyze this uploaded document.") });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            entities: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            documentType: { type: Type.STRING },
            keyDates: { type: Type.ARRAY, items: { type: Type.STRING } },
            monetaryAmounts: { type: Type.ARRAY, items: { type: Type.STRING } },
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  });
};

export const generateWitnessResponse = async (
  sessionId: string,
  message: string,
  witnessName: string,
  personality: string,
  caseContext: string,
  forceNew: boolean = false
) => {
  return queueRequest(async () => {
    const systemInstruction = `You are roleplaying as a witness named ${witnessName} in a legal trial.
    Your personality is: ${personality}.
    Case Context: ${caseContext}.

    Rules:
    1. Stay in character at all times.
    2. If you are 'hostile', be short, evasive, and defensive.
    3. If you are 'nervous', stutter occasionally and be unsure.
    4. If you are 'cooperative', provide helpful details but only what you know.
    5. Do not break character or mention you are an AI.
    6. Keep responses relatively concise, as in a courtroom cross-examination.`;

    if (forceNew) {
      clearChatSession(sessionId);
    }

    let chat = getChatSession(sessionId);
    if (!chat) {
      chat = createChatSession(sessionId, 'witness', systemInstruction);
    }

    const response = await chat.sendMessage({ message });
    return response.text;
  });
};

export const predictStrategy = async (caseSummary: string, opponentProfile: string): Promise<StrategyInsight[]> => {
  return queueRequest(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze this case and the opposing counsel profile.
      Case: ${caseSummary}
      Opponent: ${opponentProfile}

      Provide 3 strategic insights (Risks, Opportunities, or Predictions).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ['risk', 'opportunity', 'prediction'] }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  });
};

export const getTrialSimSystemInstruction = (
  phase: TrialPhase,
  mode: SimulationMode,
  opponentName: string,
  caseContext: string,
  settings?: SimulatorSettings
) => {
  const baseRole = `You are an advanced legal AI simulator. The user is a practicing attorney. You must simulate the courtroom environment realistically.`;
  
  const realismLevel = settings?.realismLevel || 'professional';
  const interruptionFreq = settings?.interruptionFrequency || 'medium';
  const coachingVerbosity = settings?.coachingVerbosity || 'moderate';
  
  let objectionPolicy = "";
  if (mode === 'trial') {
    objectionPolicy = `MODE: TRIAL (HARD). Be aggressive. Interrupt immediately on mistakes. No hints. Object to everything objectionable.`;
  } else if (mode === 'practice') {
    objectionPolicy = `MODE: PRACTICE (MEDIUM). Object on clear errors. Offer brief guidance after objections.`;
  } else {
    objectionPolicy = `MODE: LEARN (EASY). Rarely object. Focus on guiding the user.`;
  }

  objectionPolicy += `\n\nREALISM: ${realismLevel.toUpperCase()}. ${realismLevel === 'intense' ? 'High-stakes, high-pressure environment.' : realismLevel === 'casual' ? 'Relaxed, educational environment.' : 'Professional courtroom atmosphere.'}`;
  objectionPolicy += `\nINTERRUPTION FREQUENCY: ${interruptionFreq.toUpperCase()}. ${interruptionFreq === 'high' ? 'Frequent interruptions and objections.' : interruptionFreq === 'low' ? 'Minimal interruptions.' : 'Balanced interruption pattern.'}`;
  objectionPolicy += `\nCOACHING DETAIL: ${coachingVerbosity.toUpperCase()}. ${coachingVerbosity === 'detailed' ? 'Provide extensive, thorough coaching feedback.' : coachingVerbosity === 'minimal' ? 'Brief, concise feedback only.' : 'Balanced coaching feedback.'}`;

  const phaseInstructions: Record<TrialPhase, string> = {
    'pre-trial-motions': `PHASE: PRE-TRIAL MOTIONS. Role: JUDGE and OPPOSING COUNSEL (${opponentName}).`,
    'voir-dire': `PHASE: VOIR DIRE. Role: JURORS and OPPOSING COUNSEL (${opponentName}).`,
    'opening-statement': `PHASE: OPENING STATEMENT. Role: JUDGE and OPPOSING COUNSEL (${opponentName}). Object to argumentative statements.`,
    'direct-examination': `PHASE: DIRECT EXAMINATION. Role: WITNESS (Cooperative). Object to leading questions.`,
    'cross-examination': `PHASE: CROSS EXAMINATION. Role: HOSTILE WITNESS. Be evasive.`,
    'closing-argument': `PHASE: CLOSING ARGUMENT. Role: JUDGE and OPPOSING COUNSEL (${opponentName}).`,
    'defendant-testimony': `PHASE: DEFENDANT TESTIMONY. Role: PROSECUTOR (${opponentName}). Cross-examine aggressively.`,
    'sentencing': `PHASE: SENTENCING. Role: JUDGE. Listen and deliver sentence.`
  };

  return `${baseRole}
${phaseInstructions[phase] || ''}
${objectionPolicy}
Case Context: ${caseContext}

CRITICAL: Use 'sendCoachingTip' for feedback and 'raiseObjection' to flash objections on screen.`;
};

export const generateTranscriptSummary = async (transcript: string): Promise<string> => {
  return queueRequest(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Summarize the following transcript concisely. Focus on key points, decisions made, and any action items. Keep the summary brief but comprehensive.

Transcript:
${transcript.substring(0, 30000)}

Provide a clear, well-structured summary in 2-4 paragraphs.`,
      config: {
        temperature: 0.3,
      }
    });

    return response.text || 'Unable to generate summary.';
  });
};

export const translateTranscript = async (transcript: string, targetLanguage: string): Promise<string> => {
  return queueRequest(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following transcript to ${targetLanguage}. Preserve the speaker labels and formatting. Maintain the same level of formality and tone.

Transcript:
${transcript.substring(0, 30000)}

Provide the translation with the same structure as the original.`,
      config: {
        temperature: 0.3,
      }
    });

    return response.text || 'Unable to translate transcript.';
  });
};