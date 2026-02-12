/**
 * Standardized response helper for Edge Functions
 */

/**
 * Get allowed CORS origin from environment or use restrictive default
 */
function getAllowedOrigin(requestOrigin: string | null): string {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');

  // If multiple origins are configured (comma-separated), reflect only exact matches.
  // If there's no match, return empty string so callers can omit CORS headers.
  if (allowedOrigins) {
    const allowed = allowedOrigins
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
    return '';
  }

  // Default to localhost for development
  // In production, this should be set via environment variable
  return 'http://localhost:3000';
}

export function successResponse(
  data: any,
  status: number = 200,
  requestOrigin: string | null = null
): Response {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-shared-secret',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...headers,
      },
    }
  );
}

export function errorResponse(
  message: string,
  code: string = 'ERROR',
  details?: any,
  status: number = 400,
  requestOrigin: string | null = null
): Response {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-shared-secret',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message,
        code,
        details,
      },
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...headers,
      },
    }
  );
}

export function corsResponse(requestOrigin: string | null = null): Response {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-shared-secret',
    'Access-Control-Max-Age': '86400',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
    },
  });
}
