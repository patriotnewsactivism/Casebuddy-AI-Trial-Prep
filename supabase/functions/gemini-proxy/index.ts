import { corsHeaders, errorResponse, handleOptions, jsonResponse, withCors } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  conversationHistory?: Array<{ role: string; parts: Array<{ text: string }> }>;
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    responseMimeType?: string;
    responseSchema?: any;
  };
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

export async function createGeminiPayload(request: GeminiRequest) {
  const contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> = [];

  // Add conversation history if provided
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    contents.push(...request.conversationHistory);
  }

  // Add current message
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

  const payload: any = {
    contents,
    generationConfig: {
      temperature: request.options?.temperature ?? 0.7,
      maxOutputTokens: request.options?.maxOutputTokens ?? 8192,
      topP: request.options?.topP ?? 0.95,
      topK: request.options?.topK ?? 40,
    },
  };

  // Add response schema if provided
  if (request.options?.responseMimeType) {
    payload.generationConfig.responseMimeType = request.options.responseMimeType;
  }
  if (request.options?.responseSchema) {
    payload.generationConfig.responseSchema = request.options.responseSchema;
  }

  return payload;
}

async function handler(req: Request): Promise<Response> {
  console.log('[gemini-proxy] Received request:', req.method, req.url);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    if (!GEMINI_API_KEY) {
      console.error('[gemini-proxy] GEMINI_API_KEY not configured');
      return errorResponse('Gemini API key not configured. Please set GEMINI_API_KEY in Supabase Edge Function secrets.', 500);
    }

    // Validate auth (will return anonymous user if in dev mode)
    const authHeader = req.headers.get('Authorization');
    let user;
    try {
      user = await validateAuth(authHeader);
    } catch (authError) {
      console.error('[gemini-proxy] Auth error:', authError);
      // Allow anonymous access in development
      user = { id: 'anonymous', email: 'anonymous@localhost' };
    }

    // Check rate limit (may not be configured)
    let rateLimitInfo = { allowed: true, remaining: 100, resetAt: Date.now() + 60000 };
    try {
      const rateLimit = await checkRateLimit(user.id, 'gemini-proxy');
      rateLimitInfo = rateLimit;
      if (!rateLimit.allowed) {
        return errorResponse('Rate limit exceeded', 429, {
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        });
      }
    } catch (rateLimitError) {
      // Rate limiting not configured, continue
      console.log('[gemini-proxy] Rate limiting not available, continuing');
    }

    let body: GeminiRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return errorResponse('Invalid JSON body', 400);
    }

    if (!body.prompt) {
      return errorResponse('Missing required field: prompt');
    }

    const model = body.model ?? DEFAULT_MODEL;
    const payload = await createGeminiPayload(body);

    console.log(`[gemini-proxy] Calling Gemini API with model: ${model}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90 second timeout

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
        console.error('[gemini-proxy] Gemini API error:', error);
        return errorResponse('Gemini API request failed', response.status, error);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      console.log(`[gemini-proxy] Success! Response length: ${text.length} chars`);

      return jsonResponse({
        success: true,
        text,
        model,
        usage: data.usageMetadata ?? null,
        rateLimit: {
          remaining: rateLimitInfo.remaining,
          resetAt: new Date(rateLimitInfo.resetAt).toISOString(),
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return errorResponse('Request timeout after 90 seconds', 504);
      }
      console.error('[gemini-proxy] Fetch error:', fetchError);
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[gemini-proxy] Unhandled error:', error);
    return errorResponse(
      error.message ?? 'Internal server error',
      500
    );
  }
}

// Wrap with CORS handling
Deno.serve(withCors(handler));
