/**
 * OpenAI Service for Trial Simulator
 * Used for conversation logic when Gemini is unavailable
 */

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

/**
 * Check if OpenAI is configured
 */
export const isOpenAIConfigured = (): boolean => {
  const key = process.env.OPENAI_API_KEY;
  return !!(key && key.length > 10);
};

/**
 * Generate a response from OpenAI
 */
export const generateOpenAIResponse = async (
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Fast and cheap
      messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data: OpenAIResponse = await response.json();
  return data.choices[0]?.message?.content || '';
};

/**
 * Stream a response from OpenAI
 */
export async function* streamOpenAIResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body');
  }

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip non-JSON lines/events.
        }
      }
    }

    if (done) break;
  }

  const trailing = (buffer + decoder.decode()).trim();
  if (trailing.startsWith('data:')) {
    const data = trailing.slice(5).trim();
    if (data && data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // Ignore trailing partial event.
      }
    }
  }
}

/**
 * Get system prompt for trial simulation
 */
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
