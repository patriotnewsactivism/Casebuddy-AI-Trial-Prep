import { corsHeaders, errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

const DEFAULT_MODEL = 'gemini-1.5-flash';

export async function createGeminiPayload(request: GeminiRequest) {
  const contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> = [];

  if (request.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `System: ${request.systemPrompt}\n\nUser: ${request.prompt}` }],
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: request.prompt }],
    });
  }

  return {
    contents,
    generationConfig: {
      temperature: request.options?.temperature ?? 0.7,
      maxOutputTokens: request.options?.maxOutputTokens ?? 2048,
      topP: request.options?.topP ?? 0.95,
      topK: request.options?.topK ?? 40,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    if (!GEMINI_API_KEY) {
      return errorResponse('Gemini API key not configured', 500);
    }

    const authHeader = req.headers.get('Authorization');
    const user = await validateAuth(authHeader);

    const rateLimit = await checkRateLimit(user.id, 'gemini-proxy');
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429, {
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
    }

    const body: GeminiRequest = await req.json();

    if (!body.prompt) {
      return errorResponse('Missing required field: prompt');
    }

    const model = body.model ?? DEFAULT_MODEL;
    const payload = await createGeminiPayload(body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(
        `${GEMINI_API_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        return errorResponse('Gemini API request failed', response.status, error);
      }

      const data = await response.json();

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      return jsonResponse({
        success: true,
        text,
        model,
        usage: data.usageMetadata ?? null,
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
    console.error('Error in gemini-proxy:', error);
    return errorResponse(
      error.message ?? 'Internal server error',
      error.message?.includes('Authorization') || error.message?.includes('token') ? 401 : 500
    );
  }
});
