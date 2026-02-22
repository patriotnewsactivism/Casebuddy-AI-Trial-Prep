import { errorResponse, handleOptions, jsonResponse, streamResponse } from '../_shared/cors.ts';
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    if (!OPENAI_API_KEY) {
      return errorResponse('OpenAI API key not configured', 500);
    }

    const authHeader = req.headers.get('Authorization');
    const user = await validateAuth(authHeader);

    const rateLimit = await checkRateLimit(user.id, 'openai-proxy');
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429, {
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
    }

    const body: OpenAIRequest = await req.json();

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
      max_tokens: body.options?.max_tokens ?? 2048,
      top_p: body.options?.top_p ?? 1,
      presence_penalty: body.options?.presence_penalty ?? 0,
      frequency_penalty: body.options?.frequency_penalty ?? 0,
    };

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
        console.error('OpenAI API error:', error);
        return errorResponse('OpenAI API request failed', response.status, error);
      }

      if (stream) {
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk);
          },
        });

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

      return jsonResponse({
        success: true,
        text: data.choices?.[0]?.message?.content ?? '',
        model,
        usage: data.usage ?? null,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return errorResponse('Request timeout', 504);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in openai-proxy:', error);
    return errorResponse(
      error.message ?? 'Internal server error',
      error.message?.includes('Authorization') || error.message?.includes('token') ? 401 : 500
    );
  }
});
