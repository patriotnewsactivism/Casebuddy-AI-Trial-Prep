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
    return {
      success: false,
      text: '',
      model: '',
      error: createProxyError('NOT_CONFIGURED', 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: request,
    });

    if (error) {
      return {
        success: false,
        text: '',
        model: '',
        error: createProxyError('FUNCTION_ERROR', error.message || 'Proxy request failed'),
      };
    }

    if (!data?.success) {
      return {
        success: false,
        text: '',
        model: '',
        error: createProxyError('FUNCTION_ERROR', data?.error || 'Proxy returned unsuccessful response'),
      };
    }

    return data as GeminiProxyResponse;
  } catch (err) {
    return {
      success: false,
      text: '',
      model: '',
      error: handleProxyError(err, 'callGeminiProxy'),
    };
  }
};

export const callOpenAIProxy = async (
  request: OpenAIProxyRequest
): Promise<OpenAIProxyResponse> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      content: '',
      error: createProxyError('NOT_CONFIGURED', 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
      body: { ...request, stream: false },
    });

    if (error) {
      return {
        success: false,
        content: '',
        error: createProxyError('FUNCTION_ERROR', error.message || 'OpenAI proxy request failed'),
      };
    }

    if (!data?.success) {
      return {
        success: false,
        content: '',
        error: createProxyError('FUNCTION_ERROR', data?.error || 'OpenAI proxy returned unsuccessful response'),
      };
    }

    return {
      success: true,
      content: data.text || data.content || '',
    };
  } catch (err) {
    return {
      success: false,
      content: '',
      error: handleProxyError(err, 'callOpenAIProxy'),
    };
  }
};

export async function* streamOpenAIProxy(
  request: OpenAIProxyRequest
): AsyncGenerator<string, void, unknown> {
  if (!isSupabaseConfigured()) {
    throw createProxyError('NOT_CONFIGURED', 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const url = getEdgeFunctionUrl('openai-proxy');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    let errorDetails: string;
    try {
      const errorData = await response.json();
      errorDetails = String(errorData.error ?? response.statusText);
    } catch {
      errorDetails = await response.text();
    }
    throw createProxyError('HTTP_ERROR', errorDetails, response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw createProxyError('NO_BODY', 'Response body is null');
  }

  const decoder = new TextDecoder();
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
          // Skip non-JSON lines
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
        // Ignore trailing partial event
      }
    }
  }
}

export const callWhisperProxy = async (file: File): Promise<WhisperProxyResponse> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      text: '',
      error: createProxyError('NOT_CONFIGURED', 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const url = getEdgeFunctionUrl('whisper-proxy');
    const token = await getAuthToken();

    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorDetails: unknown;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text();
      }

      const errorMessage = typeof errorDetails === 'object' && errorDetails !== null && 'error' in errorDetails
        ? String((errorDetails as Record<string, unknown>).error)
        : `HTTP ${response.status}`;

      return {
        success: false,
        text: '',
        error: createProxyError('HTTP_ERROR', errorMessage, response.status, errorDetails),
      };
    }

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        text: '',
        error: createProxyError('FUNCTION_ERROR', result.error),
      };
    }

    return {
      success: true,
      text: result.text ?? '',
      duration: result.duration,
      language: result.language,
      segments: result.segments,
    };
  } catch (err) {
    return {
      success: false,
      text: '',
      error: handleProxyError(err, 'callWhisperProxy'),
    };
  }
};

export const callElevenLabsProxy = async (
  request: ElevenLabsProxyRequest
): Promise<ElevenLabsProxyResponse> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: createProxyError('NOT_CONFIGURED', 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const url = getEdgeFunctionUrl('elevenlabs-proxy');
    const token = await getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorDetails: string;
      try {
        const errorData = await response.json();
        errorDetails = String(errorData.error ?? response.statusText);
      } catch {
        errorDetails = await response.text();
      }
      return {
        success: false,
        error: createProxyError('HTTP_ERROR', errorDetails, response.status),
      };
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const result = await response.json();
      if (result.error) {
        return {
          success: false,
          error: createProxyError('FUNCTION_ERROR', result.error),
        };
      }
      return {
        success: true,
        audioUrl: result.audioUrl,
        audioBase64: result.audioBase64,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    return {
      success: true,
      audioBase64: base64,
    };
  } catch (err) {
    return {
      success: false,
      error: handleProxyError(err, 'callElevenLabsProxy'),
    };
  }
};

export const isProxyReady = (): boolean => {
  return isSupabaseConfigured() && proxyHealth !== 'unhealthy';
};
