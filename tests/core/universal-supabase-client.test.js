import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// CommonJS interop
import UniversalSupabaseClientImport from '../../core/universal-supabase-client.js';

const UniversalSupabaseClient = UniversalSupabaseClientImport?.default || UniversalSupabaseClientImport;

describe('UniversalSupabaseClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon_key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('adds apikey and uses passthrough Authorization when provided', async () => {
    const client = new UniversalSupabaseClient({ serviceName: 'test' });
    const spy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.call(
      'memory-create',
      { foo: 'bar' },
      {
        authorization: 'Bearer user_token',
        apiKey: 'uai_api_key',
        projectScope: 'lanonasis-maas',
        requestId: 'req_123'
      }
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const [endpoint, options] = spy.mock.calls[0];

    expect(endpoint).toEqual({ path: '/memory-create', method: 'POST' });
    expect(options.data).toEqual({ foo: 'bar' });
    expect(options.headers.apikey).toBe('anon_key');
    expect(options.headers.Authorization).toBe('Bearer user_token');
    expect(options.headers['X-API-Key']).toBe('uai_api_key');
    expect(options.headers['X-Project-Scope']).toBe('lanonasis-maas');
    expect(options.headers['X-Request-ID']).toBe('req_123');
  });

  it('falls back to Bearer SUPABASE_ANON_KEY when Authorization is not provided', async () => {
    const client = new UniversalSupabaseClient({ serviceName: 'test' });
    const spy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.call('system-health', {}, { method: 'GET' });

    const [, options] = spy.mock.calls[0];
    expect(options.headers.apikey).toBe('anon_key');
    expect(options.headers.Authorization).toBe('Bearer anon_key');
  });

  it('uses query params for GET calls (payload -> params)', async () => {
    const client = new UniversalSupabaseClient({ serviceName: 'test' });
    const spy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.call('memory-get', { id: 'abc' }, { method: 'GET' });

    const [endpoint, options] = spy.mock.calls[0];
    expect(endpoint).toEqual({ path: '/memory-get', method: 'GET' });
    expect(options.params).toEqual({ id: 'abc' });
    expect(options.data).toBeUndefined();
  });
});
