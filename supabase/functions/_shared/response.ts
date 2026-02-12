/**
 * Standardized response helper for Edge Functions
 */

/**
 * Get allowed CORS origin from environment or use restrictive default
 */
function getAllowedOrigin(): string {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');

  // If multiple origins are configured (comma-separated), return the first one
  // In production, implement proper origin validation against the request Origin header
  if (allowedOrigins) {
    return allowedOrigins.split(',')[0].trim();
  }

  // Default to localhost for development
  // In production, this should be set via environment variable
  return 'http://localhost:3000';
}

export function successResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowedOrigin(),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  );
}

export function errorResponse(
  message: string,
  code: string = 'ERROR',
  details?: any,
  status: number = 400
): Response {
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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowedOrigin(),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  );
}

export function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
