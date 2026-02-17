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
    expect(url).toBe('https://auth.lanonasis.com/v1/auth/verify');
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
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['X-API-Key']).toBe('lano_test_api_key');
    expect(options.headers['x-api-key']).toBe('lano_test_api_key');
    expect(JSON.parse(options.body)).toMatchObject({ api_key: 'lano_test_api_key' });
  });
});
