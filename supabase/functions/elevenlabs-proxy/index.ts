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

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL = 'eleven_monolingual_v1';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    if (!ELEVENLABS_API_KEY) {
      return errorResponse('ElevenLabs API key not configured', 500);
    }

    const authHeader = req.headers.get('Authorization');
    const user = await validateAuth(authHeader);

    const rateLimit = await checkRateLimit(user.id, 'elevenlabs-proxy');
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429, {
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
    }

    const body: ElevenLabsRequest = await req.json();

    if (!body.text) {
      return errorResponse('Missing required field: text');
    }

    if (body.text.length > 5000) {
      return errorResponse('Text exceeds maximum length of 5000 characters', 413);
    }

    const voiceId = body.voiceId ?? DEFAULT_VOICE_ID;
    const modelId = body.options?.model_id ?? DEFAULT_MODEL;

    const payload = {
      text: body.text,
      model_id: modelId,
      voice_settings: {
        stability: body.options?.stability ?? 0.5,
        similarity_boost: body.options?.similarity_boost ?? 0.75,
        style: body.options?.style ?? 0,
        use_speaker_boost: body.options?.use_speaker_boost ?? true,
      },
    };

    const outputFormat = body.options?.output_format ?? 'mp3_44100_128';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
            Accept: 'audio/mpeg',
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
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600',
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
    console.error('Error in elevenlabs-proxy:', error);
    return errorResponse(
      error.message ?? 'Internal server error',
      error.message?.includes('Authorization') || error.message?.includes('token') ? 401 : 500
    );
  }
});
