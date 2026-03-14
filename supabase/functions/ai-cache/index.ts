/**
 * AI Cache Edge Function
 *
 * Provides server-side caching for AI analysis results.
 * Checks cache before calling AI APIs, stores results after successful calls.
 */

import { corsHeaders, handleOptions, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface CacheRequest {
  prompt: string;
  analysisType: string;
  documentId?: string;
  model?: string;
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
  skipCache?: boolean;
}

// Simple hash function for prompt deduplication
function hashString(str: string): string {
  let hash = 0;
  const normalized = str.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const lengthHash = (normalized.length * 31).toString(16).padStart(4, '0');
  return `${hex}${lengthHash}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.user) {
      return errorResponse('Unauthorized', 401);
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(authResult.user.id, 'gemini-proxy');
    if (!rateLimit.allowed) {
      return jsonResponse({
        success: false,
        error: 'Rate limit exceeded',
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
      }, 429);
    }

    const body: CacheRequest = await req.json();
    const { prompt, analysisType, documentId, model, options, skipCache } = body;

    if (!prompt || !analysisType) {
      return errorResponse('prompt and analysisType are required', 400);
    }

    const promptHash = hashString(prompt);

    // Check cache (unless explicitly skipped)
    if (!skipCache) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: cached, error: cacheError } = await supabase
        .from('analysis_cache')
        .select('id, result, model_used')
        .eq('prompt_hash', promptHash)
        .eq('analysis_type', analysisType)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!cacheError && cached) {
        // Record cache hit
        await supabase.rpc('record_cache_hit', { p_cache_id: cached.id });

        return jsonResponse({
          success: true,
          text: typeof cached.result === 'string' ? cached.result : JSON.stringify(cached.result),
          model: cached.model_used,
          cached: true,
          cacheId: cached.id,
          rateLimit: {
            remaining: rateLimit.remaining,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
        });
      }
    }

    // Cache miss - call Gemini API
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return errorResponse('GEMINI_API_KEY not configured', 500);
    }

    const selectedModel = model || 'gemini-2.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const geminiPayload: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxOutputTokens ?? 8192,
      },
    };

    if (options?.responseMimeType) {
      geminiPayload.generationConfig.responseMimeType = options.responseMimeType;
    }
    if (options?.responseSchema) {
      geminiPayload.generationConfig.responseSchema = options.responseSchema;
    }

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      return errorResponse(`Gemini API error: ${error}`, aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokenCount = aiData.usageMetadata?.totalTokenCount || 0;

    // Store in cache
    if (!skipCache) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        await supabase.from('analysis_cache').upsert({
          prompt_hash: promptHash,
          analysis_type: analysisType,
          document_id: documentId,
          result: responseText,
          model_used: selectedModel,
          token_count: tokenCount,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'prompt_hash,analysis_type' });
      } catch (cacheErr) {
        console.error('Failed to store cache:', cacheErr);
        // Non-critical, continue
      }
    }

    // Track usage
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.rpc('increment_usage', {
        p_user_id: authResult.user.id,
        p_action: 'ai_requests',
        p_increment: 1,
      });
    } catch {
      // Non-critical
    }

    return jsonResponse({
      success: true,
      text: responseText,
      model: selectedModel,
      cached: false,
      usage: aiData.usageMetadata,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
    });
  } catch (err) {
    console.error('AI Cache function error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});
