import { callOpenAIProxy, streamOpenAIProxy, isProxyReady } from './apiProxy';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  choices: {
    message: {
      content: string;
    };
    finish_reason: string;
  }[];
}

export const isOpenAIConfigured = (): boolean => {
  return isProxyReady();
};

export const generateOpenAIResponse = async (
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> => {
  if (!isProxyReady()) {
    throw new Error('OpenAI proxy is not configured. Please check Supabase configuration.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  return callOpenAIProxy({
    messages,
    model: 'gpt-4o-mini',
    options: {
      temperature: 0.7,
      max_tokens: 500,
    },
  });
};

export async function* streamOpenAIResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string> {
  if (!isProxyReady()) {
    throw new Error('OpenAI proxy is not configured. Please check Supabase configuration.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  yield* streamOpenAIProxy(messages, {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 500,
  });
}

export const getTrialSimSystemPrompt = (
  phase: string,
  mode: string,
  opponentName: string,
  caseSummary: string
): string => {
  const phaseInstructions: Record<string, string> = {
    'pre-trial-motions': `You are OPPOSING COUNSEL (${opponentName}). Argue against the user's motions. Be strategic and cite procedural rules.`,
    'voir-dire': `You are OPPOSING COUNSEL (${opponentName}). Conduct voir dire and challenge the user's juror selections.`,
    'opening-statement': `You are OPPOSING COUNSEL (${opponentName}). Listen to their opening, then deliver yours. Object to argumentative statements.`,
    'direct-examination': `You are the WITNESS being questioned. Answer naturally based on the case facts. Do NOT object.`,
    'cross-examination': `You are a HOSTILE WITNESS being cross-examined. Be evasive, defensive, and difficult. Challenge unfair questions.`,
    'closing-argument': `You are OPPOSING COUNSEL (${opponentName}). Listen to their closing, then deliver yours.`,
    'defendant-testimony': `You are PROSECUTOR (${opponentName}). Cross-examine the defendant aggressively.`,
    'sentencing': `You are the JUDGE. Listen to arguments and deliver an appropriate sentence.`
  };

  return `You are a realistic courtroom simulator. The user is a practicing attorney speaking to you.

${phaseInstructions[phase] || 'You are opposing counsel.'}

CASE SUMMARY: ${caseSummary}

RULES:
1. Stay in character at all times
2. Respond naturally and conversationally
3. Keep responses brief (2-4 sentences typically)
4. Reference the case facts when relevant
5. Be realistic - don't be overly aggressive or too easy

Mode: ${mode === 'trial' ? 'Be aggressive and challenging' : mode === 'practice' ? 'Be moderately challenging' : 'Be helpful and educational'}`;
};
