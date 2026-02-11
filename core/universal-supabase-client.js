/**
 * Universal Supabase Client
 *
 * A thin wrapper around BaseClient that standardizes how we call Supabase Edge
 * Functions from adapters, while preserving request auth passthrough.
 *
 * Important: BaseClient's auth injection is NOT used here because it would
 * override per-request Authorization passthrough. We set Authorization per call.
 */

'use strict';

const BaseClient = require('./base-client');

const stripTrailingSlashes = (value) => (value || '').toString().replace(/\/+$/, '');

const getHeader = (headers, key) => {
  if (!headers || typeof headers !== 'object') return undefined;
  if (key in headers) return headers[key];
  const lower = key.toLowerCase();
  // Node/Express often normalizes incoming headers to lowercase.
  if (lower in headers) return headers[lower];
  // Fall back to a case-insensitive scan.
  const foundKey = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return foundKey ? headers[foundKey] : undefined;
};

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;

  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const deriveSupabaseUrlFromTokens = () => {
  const candidates = [
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY
  ].filter(Boolean);

  for (const token of candidates) {
    const payload = decodeJwtPayload(token);
    const ref = payload && payload.ref;
    if (ref && typeof ref === 'string') {
      return `https://${ref}.supabase.co`;
    }
  }
  return null;
};

class UniversalSupabaseClient extends BaseClient {
  constructor(config = {}) {
    const envSupabaseUrl = process.env.SUPABASE_URL || deriveSupabaseUrlFromTokens() || '';
    const supabaseUrl = stripTrailingSlashes(config.supabaseUrl || envSupabaseUrl);
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required for UniversalSupabaseClient');
    }

    const baseUrl = `${supabaseUrl}/functions/v1`;
    super({
      name: config.serviceName || config.name || 'supabase',
      baseUrl,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 2,
      // Prevent BaseClient from overwriting per-call Authorization.
      authentication: { type: 'none', config: {} }
    });

    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = config.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '';
    this.defaultFunctionName = config.functionName || null;
  }

  buildHeaders(options = {}) {
    const rawHeaders = (options && typeof options.headers === 'object' && options.headers) ? options.headers : {};

    const anonKey = this.supabaseAnonKey || '';

    const authorization =
      options.authorization ||
      getHeader(rawHeaders, 'Authorization') ||
      getHeader(rawHeaders, 'authorization');

    const apiKey =
      options.apiKey ||
      getHeader(rawHeaders, 'X-API-Key') ||
      getHeader(rawHeaders, 'x-api-key');

    const projectScope =
      options.projectScope ||
      getHeader(rawHeaders, 'X-Project-Scope') ||
      getHeader(rawHeaders, 'x-project-scope');

    const requestId =
      options.requestId ||
      getHeader(rawHeaders, 'X-Request-ID') ||
      getHeader(rawHeaders, 'x-request-id');

    const sessionId =
      options.sessionId ||
      getHeader(rawHeaders, 'X-Session-ID') ||
      getHeader(rawHeaders, 'x-session-id');

    // Start from user-provided headers, but enforce our required Supabase headers.
    const headers = {
      ...rawHeaders,
      'Content-Type': 'application/json'
    };

    // Supabase requires apikey. Keep this in lowercase as that is what their docs show.
    headers.apikey = anonKey;

    // Authorization passthrough (preferred). Otherwise fall back to anon key bearer.
    headers.Authorization = authorization || (anonKey ? `Bearer ${anonKey}` : undefined);
    if (!headers.Authorization) {
      // Leave undefined rather than setting an invalid header.
      delete headers.Authorization;
    }

    if (apiKey) headers['X-API-Key'] = apiKey;
    if (projectScope) headers['X-Project-Scope'] = projectScope;
    if (requestId) headers['X-Request-ID'] = requestId;
    if (sessionId) headers['X-Session-ID'] = sessionId;

    return headers;
  }

  /**
   * Call a Supabase Edge Function.
   *
   * @param {string} functionName - Edge Function slug (e.g., "memory-create")
   * @param {object} payload - Request body (or query params for GET)
   * @param {object} [options] - { method, params, headers, authorization, apiKey, projectScope, requestId }
   */
  async call(functionName, payload = {}, options = {}) {
    let fn = functionName;
    let body = payload;
    let opts = options;

    // Support calling with default functionName: call(payload, options)
    if (typeof fn !== 'string') {
      opts = body || {};
      body = fn || {};
      fn = this.defaultFunctionName;
    }

    if (!fn) {
      throw new Error('Supabase functionName is required (no defaultFunctionName configured)');
    }

    const method = (opts.method || 'POST').toUpperCase();
    const headers = this.buildHeaders(opts);

    const requestOptions = { headers };

    // Allow explicit query params for both GET and POST.
    if (opts.params && typeof opts.params === 'object') {
      requestOptions.params = opts.params;
    }

    if (method === 'GET') {
      // For convenience, treat payload as query params when GET is used.
      if (!requestOptions.params && body && typeof body === 'object') {
        requestOptions.params = body;
      }
    } else {
      requestOptions.data = body;
    }

    return this.request({
      path: `/${fn}`,
      method
    }, requestOptions);
  }

  async healthCheck() {
    try {
      const data = await this.call('system-health', {}, { method: 'GET' });
      return { healthy: true, data };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = UniversalSupabaseClient;
