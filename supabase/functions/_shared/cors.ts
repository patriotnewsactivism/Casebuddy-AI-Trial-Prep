// CORS configuration for Supabase Edge Functions
// These headers allow requests from any origin

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Handle OPTIONS preflight requests
export function handleOptions(): Response {
  console.log('[CORS] Handling OPTIONS preflight request');
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Handle CORS for any request method
export function handleCors(req: Request): Response {
  console.log('[CORS] Handling CORS for request:', req.method);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// JSON response with CORS headers
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Error response with CORS headers
export function errorResponse(message: string, status = 400, details?: unknown): Response {
  console.error(`[CORS] Error response (${status}):`, message, details);
  return new Response(
    JSON.stringify({
      error: message,
      details,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

// Stream response with CORS headers
export function streamResponse(
  body: ReadableStream<Uint8Array>,
  contentType = 'text/event-stream'
): Response {
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// Wrap a handler with global error handling to ensure CORS headers on all responses
export function withCors(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Handle OPTIONS preflight immediately
    if (req.method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      const response = await handler(req);
      // Ensure CORS headers are on the response
      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        newHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error('[CORS] Unhandled error:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500,
        error instanceof Error ? error.stack : undefined
      );
    }
  };
}
