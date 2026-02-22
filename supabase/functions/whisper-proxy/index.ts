import { errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts';
import { validateAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'video/mp4',
  'video/webm',
];

interface TranscriptionOptions {
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

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

    const rateLimit = await checkRateLimit(user.id, 'whisper-proxy');
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429, {
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
    }

    const contentType = req.headers.get('Content-Type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Content-Type must be multipart/form-data');
    }

    const formData = await req.formData();

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return errorResponse('Missing required field: file');
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
    }

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      console.warn(`File type ${file.type} may not be supported`);
    }

    const options: TranscriptionOptions = {
      model: (formData.get('model') as string) ?? 'whisper-1',
      language: (formData.get('language') as string) ?? undefined,
      prompt: (formData.get('prompt') as string) ?? undefined,
      response_format: ((formData.get('response_format') as string) ?? 'json') as TranscriptionOptions['response_format'],
      temperature: formData.get('temperature') ? parseFloat(formData.get('temperature') as string) : 0,
    };

    const whisperFormData = new FormData();
    whisperFormData.append('file', file);
    whisperFormData.append('model', options.model!);
    if (options.language) whisperFormData.append('language', options.language);
    if (options.prompt) whisperFormData.append('prompt', options.prompt);
    whisperFormData.append('response_format', options.response_format!);
    if (options.temperature !== undefined) {
      whisperFormData.append('temperature', options.temperature.toString());
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: whisperFormData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        console.error('Whisper API error:', error);
        return errorResponse('Whisper API request failed', response.status, error);
      }

      const responseFormat = options.response_format;
      const isTextResponse = ['text', 'srt', 'vtt'].includes(responseFormat ?? '');

      if (isTextResponse) {
        const text = await response.text();
        return jsonResponse({
          success: true,
          text,
          format: responseFormat,
          rateLimit: {
            remaining: rateLimit.remaining,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
        });
      }

      const data = await response.json();

      return jsonResponse({
        success: true,
        text: data.text,
        duration: data.duration ?? null,
        language: data.language ?? options.language ?? null,
        segments: data.segments ?? null,
        words: data.words ?? null,
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
    console.error('Error in whisper-proxy:', error);
    return errorResponse(
      error.message ?? 'Internal server error',
      error.message?.includes('Authorization') || error.message?.includes('token') ? 401 : 500
    );
  }
});
