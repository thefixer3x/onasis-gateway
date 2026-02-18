import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const loadGatewayClass = () => {
  vi.resetModules();
  const modulePath = require.resolve('../unified_gateway');
  delete require.cache[modulePath];
  return require('../unified_gateway');
};

const stubGatewayForTests = (UnifiedGateway: any) => {
  UnifiedGateway.prototype.loadMCPAdapters = async function () {
    return null;
  };
  UnifiedGateway.prototype.loadAPIServices = function () {
    return;
  };
  UnifiedGateway.prototype.loadServiceCatalog = function () {
    return { apiServices: [], mcpAdapters: [] };
  };
};

describe('UnifiedGateway auth wiring', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.AUTH_GATEWAY_TIMEOUT_MS = '1500';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults authGatewayUrl to https://auth.lanonasis.com when no env var is set', () => {
    delete process.env.AUTH_GATEWAY_URL;
    delete process.env.ONASIS_AUTH_GATEWAY_URL;
    delete process.env.ONASIS_AUTH_API_URL;

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    expect(gateway.buildAuthVerifyUrl()).toBe('https://auth.lanonasis.com/v1/auth/verify');
  });

  it('uses ONASIS_AUTH_API_URL as fallback when AUTH_GATEWAY_URL is not set', () => {
    delete process.env.AUTH_GATEWAY_URL;
    delete process.env.ONASIS_AUTH_GATEWAY_URL;
    process.env.ONASIS_AUTH_API_URL = 'https://auth.lanonasis.com/v1/auth';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    }));

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    expect(gateway.buildAuthVerifyUrl()).toBe('https://auth.lanonasis.com/v1/auth/verify');
  });

  it('sends bearer token in both header and verification payload body', async () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com';
    process.env.GATEWAY_ENFORCE_IDENTITY_VERIFICATION = 'true';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'user_1' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const result = await gateway.verifyRequestIdentity({
      id: 'req-auth-1',
      headers: {
        authorization: 'Bearer test.jwt.token',
        'x-project-scope': 'lanonasis-maas'
      }
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.lanonasis.com/v1/auth/verify-token');
    expect(options.headers.Authorization).toBe('Bearer test.jwt.token');
    expect(JSON.parse(options.body)).toMatchObject({ token: 'test.jwt.token' });
  });

  it('sends API key in headers and verification payload body', async () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com';
    process.env.GATEWAY_ENFORCE_IDENTITY_VERIFICATION = 'true';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'service_user' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const result = await gateway.verifyRequestIdentity({
      id: 'req-auth-2',
      headers: {
        'x-api-key': 'lano_test_api_key',
        'x-project-scope': 'lanonasis-maas'
      }
    });

    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.lanonasis.com/v1/auth/verify-api-key');
    expect(options.headers['X-API-Key']).toBe('lano_test_api_key');
    expect(JSON.parse(options.body)).toMatchObject({ api_key: 'lano_test_api_key' });
  });

  it('treats lano_ bearer tokens as api keys when x-api-key header is absent', async () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com';
    process.env.GATEWAY_ENFORCE_IDENTITY_VERIFICATION = 'true';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'service_user' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const result = await gateway.verifyRequestIdentity({
      id: 'req-auth-3',
      headers: {
        authorization: 'Bearer lano_sample_key',
        'x-project-scope': 'lanonasis-maas'
      }
    });

    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.lanonasis.com/v1/auth/verify-api-key');
    expect(options.headers.Authorization).toBe('Bearer lano_sample_key');
    expect(options.headers['X-API-Key']).toBe('lano_sample_key');
    expect(JSON.parse(options.body)).toMatchObject({ api_key: 'lano_sample_key' });
  });

  it('falls back to Supabase JWT verification when auth-gateway rejects unknown JWT', async () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com';
    process.env.GATEWAY_ENFORCE_IDENTITY_VERIFICATION = 'true';
    process.env.SUPABASE_URL = 'https://mxtsdgkwzjzlttpotole.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';

    // Supabase JWT (eyJ header) — auth-gateway doesn't know it
    const supabaseJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig';

    const fetchMock = vi.fn()
      // auth-gateway verify-token returns 401 (non-retryable → early exit, Supabase fallback fires immediately)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'token not found' }) })
      // Supabase /auth/v1/user returns 200
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'supabase-user-1', email: 'user@example.com' }) });

    vi.stubGlobal('fetch', fetchMock);

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const result = await gateway.verifyRequestIdentity({
      id: 'req-supabase-jwt',
      headers: {
        authorization: `Bearer ${supabaseJwt}`,
        'x-project-scope': 'v-secure'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.method).toBe('supabase_jwt');

    // Last call must be to Supabase /auth/v1/user
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(lastCall[0]).toBe('https://mxtsdgkwzjzlttpotole.supabase.co/auth/v1/user');
    expect(lastCall[1].headers.Authorization).toBe(`Bearer ${supabaseJwt}`);
    expect(lastCall[1].headers.apikey).toBe('supabase-anon-key');
  });

  it('does NOT fall back to Supabase for lano_ API key failures', async () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com';
    process.env.GATEWAY_ENFORCE_IDENTITY_VERIFICATION = 'true';
    process.env.SUPABASE_URL = 'https://mxtsdgkwzjzlttpotole.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';

    const fetchMock = vi.fn()
      // auth-gateway returns 401 for unknown lano_ key (non-retryable)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'api key not found' }) });

    vi.stubGlobal('fetch', fetchMock);

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const result = await gateway.verifyRequestIdentity({
      id: 'req-bad-lano-key',
      headers: {
        'x-api-key': 'lano_unknown_key',
        'x-project-scope': 'v-secure'
      }
    });

    // Should fail — Supabase fallback not triggered for lano_ keys
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    // Supabase /auth/v1/user should NOT have been called
    const supabaseCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
      url.includes('supabase') && url.includes('/auth/v1/user')
    );
    expect(supabaseCalls).toHaveLength(0);
  });

  it('does NOT try Supabase fallback when GATEWAY_ALLOW_SUPABASE_JWT_FALLBACK=false', async () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com';
    process.env.GATEWAY_ENFORCE_IDENTITY_VERIFICATION = 'true';
    process.env.GATEWAY_ALLOW_SUPABASE_JWT_FALLBACK = 'false';
    process.env.SUPABASE_URL = 'https://mxtsdgkwzjzlttpotole.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';

    const supabaseJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'token not found' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'token not found' }) });

    vi.stubGlobal('fetch', fetchMock);

    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const result = await gateway.verifyRequestIdentity({
      id: 'req-no-supabase',
      headers: { authorization: `Bearer ${supabaseJwt}` }
    });

    expect(result.ok).toBe(false);
    // Supabase /auth/v1/user must not be called
    const supabaseCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
      url.includes('/auth/v1/user')
    );
    expect(supabaseCalls).toHaveLength(0);
  });
});
