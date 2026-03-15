import { Case, CaseStatus } from '../types';
import { callGeminiProxy, isProxyReady } from './apiProxy';
import { Type } from '@google/genai';
import { retryWithBackoff } from '../utils/errorHandler';

export const generateRealisticCase = async (prompt: string): Promise<Partial<Case>> => {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Please enter a case description to generate.');
  }

  if (!isProxyReady()) {
    throw new Error(
      'AI is not configured. Please set GEMINI_API_KEY in .env.local or configure the Supabase proxy.'
    );
  }

  const systemPrompt = `You are a legal case generator. Create a highly realistic and detailed legal case based on the user's brief description.
  Include realistic parties, docket numbers, court locations (e.g., "Southern District of New York", "Harris County District Court"), and a detailed summary of the legal theory and key issues.
  Generate ALL fields — do not leave any field empty or null.
  The case should feel like it's pulled from a real law firm's database.`;

  return retryWithBackoff(async () => {
    const response = await callGeminiProxy({
      prompt: `Generate a realistic legal case based on this: ${prompt}`,
      systemPrompt,
      model: 'gemini-2.5-flash',
      options: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            client: { type: Type.STRING },
            opposingParty: { type: Type.STRING },
            opposingCounsel: { type: Type.STRING },
            judge: { type: Type.STRING },
            docketNumber: { type: Type.STRING },
            courtLocation: { type: Type.STRING },
            jurisdiction: { type: Type.STRING },
            summary: { type: Type.STRING },
            legalTheory: { type: Type.STRING },
            keyIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            clientType: { type: Type.STRING, enum: ['plaintiff', 'defendant', 'prosecution'] },
          },
          required: [
            'title', 'client', 'opposingParty', 'opposingCounsel',
            'judge', 'docketNumber', 'courtLocation', 'summary',
            'legalTheory', 'keyIssues', 'clientType'
          ]
        }
      }
    });

    if (!response.success || !response.text) {
      const errorMsg = response.error?.message || 'No response from AI';
      const errorCode = response.error?.code || 'UNKNOWN';
      console.error('[CaseGenerator] API error:', { code: errorCode, message: errorMsg, status: response.error?.status });
      throw new Error(`Case generation failed (${errorCode}): ${errorMsg}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(response.text);
    } catch (parseError) {
      console.error('[CaseGenerator] JSON parse failed. Raw response:', response.text.substring(0, 500));
      throw new Error('AI returned invalid response format. Please try again.');
    }

    // Ensure all required fields have values
    return {
      title: (data.title as string) || 'Untitled Case',
      client: (data.client as string) || 'Unknown Client',
      opposingParty: (data.opposingParty as string) || 'Unknown Party',
      opposingCounsel: (data.opposingCounsel as string) || 'Unknown Counsel',
      judge: (data.judge as string) || 'TBD',
      docketNumber: (data.docketNumber as string) || '',
      courtLocation: (data.courtLocation as string) || '',
      jurisdiction: (data.jurisdiction as string) || 'federal',
      summary: (data.summary as string) || '',
      legalTheory: (data.legalTheory as string) || '',
      keyIssues: (data.keyIssues as string[]) || [],
      clientType: (['plaintiff', 'defendant', 'prosecution'].includes(data.clientType as string)
        ? data.clientType
        : 'plaintiff') as Case['clientType'],
      status: CaseStatus.PRE_TRIAL,
      winProbability: 50,
      evidence: [],
      tasks: [],
      nextCourtDate: 'TBD',
    };
  }, 3, 2000); // Retry up to 3 times with 2s backoff
};
