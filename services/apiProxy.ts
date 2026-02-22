import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface ProxyError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

export interface GeminiProxyRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
  conversationHistory?: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
}

export interface GeminiProxyResponse {
  success: boolean;
  text: string;
  model: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null;
  rateLimit?: {
    remaining: number;
    resetAt: string;
  };
  error?: ProxyError;
}

export interface OpenAIProxyRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
  };
  stream?: boolean;
}

export interface OpenAIProxyResponse {
  success: boolean;
  content: string;
  error?: ProxyError;
}

export interface WhisperProxyResponse {
  success: boolean;
  text: string;
  duration?: number;
  language?: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  error?: ProxyError;
}

export interface ElevenLabsProxyRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ElevenLabsProxyResponse {
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  error?: ProxyError;
}

let proxyHealth: 'unknown' | 'healthy' | 'unhealthy' = 'unknown';
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000;

const getEdgeFunctionUrl = (functionName: string): string => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured');
  }
  return `${supabaseUrl}/functions/v1/${functionName}`;
};

const getAuthToken = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[apiProxy] Error getting session:', error.message);
    return null;
  }
  return session?.access_token ?? null;
};

const createProxyError = (code: string, message: string, status?: number, details?: unknown): ProxyError => ({
  code,
  message,
  status,
  details,
});

const handleProxyError = (error: unknown, context: string): ProxyError => {
  if (error instanceof Error) {
    return createProxyError('PROXY_ERROR', error.message, undefined, { context, originalError: error.message });
  }
  return createProxyError('UNKNOWN_ERROR', `Unknown error in ${context}`, undefined, error);
};

export const checkProxyHealth = async (): Promise<boolean> => {
  const now = Date.now();
  if (proxyHealth !== 'unknown' && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return proxyHealth === 'healthy';
  }

  if (!isSupabaseConfigured()) {
    proxyHealth = 'unhealthy';
    lastHealthCheck = now;
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke('gemini-proxy', {
      body: { prompt: 'health check', options: { maxOutputTokens: 5 } },
    });

    proxyHealth = error ? 'unhealthy' : 'healthy';
    lastHealthCheck = now;
    return proxyHealth === 'healthy';
  } catch {
    proxyHealth = 'unhealthy';
    lastHealthCheck = now;
    return false;
  }
};

export const callGeminiProxy = async (
  request: GeminiProxyRequest
): Promise<GeminiProxyResponse> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: request,
  });

  if (error) {
    throw new Error(error.message || 'Proxy request failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Proxy returned unsuccessful response');
  }

  return data as GeminiProxyResponse;
};

export const callOpenAIProxy = async (
  request: OpenAIProxyRequest
): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('openai-proxy', {
    body: request,
  });

  if (error) {
    throw new Error(error.message || 'OpenAI proxy request failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'OpenAI proxy returned unsuccessful response');
  }

  return data.text || '';
};

export async function* streamOpenAIProxy(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { model?: string; temperature?: number; max_tokens?: number } = {}
): AsyncGenerator<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const accessToken = await getAuthToken();

  const response = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken || ''}`,
    },
    body: JSON.stringify({
      messages,
      model: options.model || 'gpt-4o-mini',
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI proxy error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body from OpenAI proxy');
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

export const callElevenLabsProxy = async (
  request: ElevenLabsProxyRequest
): Promise<ArrayBuffer> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const accessToken = await getAuthToken();

  const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken || ''}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs proxy error: ${response.status} - ${errorText}`);
  }

  return response.arrayBuffer();
};

export const getElevenLabsWebSocketUrl = (): string => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured for ElevenLabs proxy');
  }
  const wsUrl = supabaseUrl.replace(/^https?:\/\//, 'wss://');
  return `${wsUrl}/functions/v1/elevenlabs-proxy/stream`;
};

export const isProxyReady = (): boolean => {
  return isSupabaseConfigured() && proxyHealth !== 'unhealthy';
};
