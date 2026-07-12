import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import request from 'supertest';

const require = createRequire(import.meta.url);
const ORIGINAL_ENV = { ...process.env };

const loadGateway = (fetchImpl) => {
  vi.stubGlobal('fetch', fetchImpl);
  const modulePath = require.resolve('../../unified_gateway.js');
  delete require.cache[modulePath];
  const UnifiedGateway = require('../../unified_gateway.js');

  UnifiedGateway.prototype.loadServiceCatalog = function loadServiceCatalogForTest() {
    return { version: 'test', apiServices: [], mcpAdapters: [] };
  };
  UnifiedGateway.prototype.loadAPIServices = function loadAPIServicesForTest() {};
  UnifiedGateway.prototype.loadMCPAdapters = async function loadMCPAdaptersForTest() {
    this.adapters.set('supabase-edge-functions', {
      config: { supabaseUrl: process.env.SUPABASE_URL }
    });
  };

  return new UnifiedGateway();
};

const jsonResponse = (status, body) => ({
  status,
  headers: new Headers({ 'content-type': 'application/json' }),
  text: vi.fn().mockResolvedValue(JSON.stringify(body))
});

describe('UnifiedGateway MaaS parity routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      SUPABASE_URL: 'https://maas.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key-for-tests',
      GATEWAY_ENFORCE_IDENTITY_VERIFICATION: 'false'
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('proxies public memory health to the system-health edge function', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    const gateway = loadGateway(fetchImpl);

    const res = await request(gateway.app).get('/api/v1/memory/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://maas.supabase.co/functions/v1/system-health');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        apikey: 'anon-key-for-tests',
        Authorization: 'Bearer anon-key-for-tests'
      })
    });
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('proxies public auth status without requiring caller credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { authenticated: false }));
    const gateway = loadGateway(fetchImpl);

    const res = await request(gateway.app).get('/api/v1/auth/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://maas.supabase.co/functions/v1/auth-status');
  });

  it('routes intelligence health to the configured intelligence Supabase project and preserves upstream status', async () => {
    process.env.SUPABASE_INTEL_EDGE_URL = 'https://intel.supabase.co';
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { success: false, error: 'Unauthorized' }));
    const gateway = loadGateway(fetchImpl);

    const res = await request(gateway.app).get('/api/v1/intelligence/health-check');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://intel.supabase.co/functions/v1/intelligence-health-check');
  });
});
