import { errorResponse, handleOptions, jsonResponse, streamResponse, withCors } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
  };
}

const DEFAULT_MODEL = 'gpt-4o-mini';

async function handler(req: Request): Promise<Response> {
  console.log('[openai-proxy] Received request:', req.method, req.url);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    if (!OPENAI_API_KEY) {
      console.error('[openai-proxy] OPENAI_API_KEY not configured');
      return errorResponse('OpenAI API key not configured. Please set OPENAI_API_KEY in Supabase Edge Function secrets.', 500);
    }

    // Validate auth (will return anonymous user if in dev mode)
    const authHeader = req.headers.get('Authorization');
    let user;
    try {
      user = await validateAuth(authHeader);
    } catch (authError) {
      console.error('[openai-proxy] Auth error:', authError);
      // Allow anonymous access in development
      user = { id: 'anonymous', email: 'anonymous@localhost' };
    }

    // Check rate limit (may not be configured)
    let rateLimitInfo = { allowed: true, remaining: 100, resetAt: Date.now() + 60000 };
    try {
      const rateLimit = await checkRateLimit(user.id, 'openai-proxy');
      rateLimitInfo = rateLimit;
      if (!rateLimit.allowed) {
        return errorResponse('Rate limit exceeded', 429, {
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        });
      }
    } catch (rateLimitError) {
      // Rate limiting not configured, continue
      console.log('[openai-proxy] Rate limiting not available, continuing');
    }

    let body: OpenAIRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return errorResponse('Invalid JSON body', 400);
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return errorResponse('Missing or invalid required field: messages');
    }

    const model = body.model ?? DEFAULT_MODEL;
    const stream = body.stream ?? false;

    const payload = {
      model,
      messages: body.messages,
      stream,
      temperature: body.options?.temperature ?? 0.7,
      max_tokens: body.options?.max_tokens ?? 4096,
      top_p: body.options?.top_p ?? 1,
      presence_penalty: body.options?.presence_penalty ?? 0,
      frequency_penalty: body.options?.frequency_penalty ?? 0,
    };

    console.log(`[openai-proxy] Calling OpenAI API with model: ${model}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeout);
        const error = await response.text();
        console.error('[openai-proxy] OpenAI API error:', error);
        return errorResponse('OpenAI API request failed', response.status, error);
      }

      if (stream) {
        const reader = response.body?.getReader();
        if (!reader) {
          clearTimeout(timeout);
          return errorResponse('Failed to get response stream', 500);
        }

        const streamBody = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  clearTimeout(timeout);
                  break;
                }
                controller.enqueue(value);
              }
            } catch (error) {
              controller.error(error);
              clearTimeout(timeout);
            }
          },
        });

        return streamResponse(streamBody, 'text/event-stream');
      }

      clearTimeout(timeout);
      const data = await response.json();

      console.log(`[openai-proxy] Success! Response length: ${data.choices?.[0]?.message?.content?.length || 0} chars`);

      return jsonResponse({
        success: true,
        text: data.choices?.[0]?.message?.content ?? '',
        model,
        usage: data.usage ?? null,
        rateLimit: {
          remaining: rateLimitInfo.remaining,
          resetAt: new Date(rateLimitInfo.resetAt).toISOString(),
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return errorResponse('Request timeout after 120 seconds', 504);
      }
      console.error('[openai-proxy] Fetch error:', fetchError);
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[openai-proxy] Unhandled error:', error);
    return errorResponse(
      error.message ?? 'Internal server error',
      500
    );
  }
}

// Wrap with CORS handling
Deno.serve(withCors(handler));
