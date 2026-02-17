import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const loadBridge = async () => {
  vi.resetModules();
  const mod = await import('../../middleware/onasis-auth-bridge.js');
  return mod.default || mod;
};

describe('OnasisAuthBridge wiring', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes authApiUrl to include /v1/auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    }));

    const OnasisAuthBridge = await loadBridge();
    const bridge = new OnasisAuthBridge({
      authApiUrl: 'https://auth.lanonasis.com'
    });

    expect(bridge.config.authApiUrl).toBe('https://auth.lanonasis.com/v1/auth');
  });

  it('proxies /api/auth requests without duplicating /v1/auth and preserves query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    const OnasisAuthBridge = await loadBridge();
    const bridge = new OnasisAuthBridge({
      authApiUrl: 'https://auth.lanonasis.com'
    });

    const req = {
      path: '/v1/auth/oauth',
      method: 'GET',
      body: undefined,
      headers: {
        authorization: 'Bearer test-token',
        host: 'gateway.example.com'
      },
      query: {
        provider: 'google',
        redirect_uri: 'https://app.example.com/callback'
      }
    };

    const res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await bridge.proxyAuthRequest(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('https://auth.lanonasis.com/v1/auth/oauth?');
    expect(url).toContain('provider=google');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
    expect(options.method).toBe('GET');
    expect(options.headers.host).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes an AbortController signal to fetch for timeout control', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    const OnasisAuthBridge = await loadBridge();
    const bridge = new OnasisAuthBridge({
      authApiUrl: 'https://auth.lanonasis.com',
      timeout: 50
    });

    await bridge.makeAuthRequest('/verify', { method: 'POST' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeDefined();
  });
});

