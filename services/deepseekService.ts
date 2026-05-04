/**
 * DeepSeek V4 Flash service — OpenAI-compatible API
 * $0.14/M input tokens, $0.28/M output tokens
 * https://api.deepseek.com
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

const getApiKey = (): string => {
  return (
    (import.meta as any).env?.VITE_DEEPSEEK_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.VITE_DEEPSEEK_API_KEY ||
    ''
  ).trim();
};

export const isDeepSeekConfigured = (): boolean => getApiKey().length > 10;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const generateDeepSeekResponse = async (
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  options: { temperature?: number; jsonMode?: boolean } = {}
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('VITE_DEEPSEEK_API_KEY not configured');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const body: any = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: 4096,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
};

export const deepSeekModelName = DEEPSEEK_MODEL;
