import { corsHeaders, errorResponse, handleOptions } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface ElevenLabsRequest {
  text: string;
  voiceId?: string;
  options?: {
    model_id?: string;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    output_format?: string;
  };
}

// Default: authoritative male voice for opposing counsel
const DEFAULT_VOICE_ID = 'TxGEqnHWrfWFTfGW9XjX'; // Josh - deep, professional
const DEFAULT_MODEL = 'eleven_turbo_v2_5';          // Fastest + highest quality

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    if (!ELEVENLABS_API_KEY) return errorResponse('ElevenLabs API key not configured', 500);

    const authHeader = req.headers.get('Authorization');
    const user = await validateAuth(authHeader);

    const rateLimit = await checkRateLimit(user.id, 'elevenlabs-proxy');
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429, {
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
    }

    const body: ElevenLabsRequest = await req.json();
    if (!body.text) return errorResponse('Missing required field: text');
    if (body.text.length > 5000) return errorResponse('Text exceeds 5000 character limit', 413);

    const voiceId = body.voiceId ?? DEFAULT_VOICE_ID;
    const modelId = body.options?.model_id ?? DEFAULT_MODEL;

    const payload = {
      text: body.text,
      model_id: modelId,
      voice_settings: {
        stability: body.options?.stability ?? 0.45,
        similarity_boost: body.options?.similarity_boost ?? 0.80,
        style: body.options?.style ?? 0.3,
        use_speaker_boost: body.options?.use_speaker_boost ?? true,
      },
    };

    // Prefer mp3_44100_128 — best quality/size tradeoff for real-time
    const outputFormat = body.options?.output_format ?? 'mp3_44100_128';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        console.error('ElevenLabs API error:', error);
        return errorResponse('ElevenLabs API request failed', response.status, error);
      }

      const audioBuffer = await response.arrayBuffer();

      return new Response(audioBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
          'Cache-Control': 'no-cache',
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    console.error('ElevenLabs proxy error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Internal error: ${msg}`, 500);
  }
});
