import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

// isAllowedOrigin is a module-level closure in unified_gateway.js; we test it
// by instantiating the gateway and making OPTIONS/GET requests via supertest.
// Lighter approach: require the module and inspect the cors callback indirectly
// through the express app.

const loadGatewayClass = () => {
  vi.resetModules();
  const modulePath = require.resolve('../unified_gateway');
  delete require.cache[modulePath];
  return require('../unified_gateway');
};

const stubGatewayForTests = (UnifiedGateway: any) => {
  UnifiedGateway.prototype.loadMCPAdapters = async function () { return null; };
  UnifiedGateway.prototype.loadAPIServices = function () { return; };
  UnifiedGateway.prototype.loadServiceCatalog = function () {
    return { apiServices: [], mcpAdapters: [] };
  };
};

describe('UnifiedGateway CORS defaults', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.ALLOWED_ORIGIN_SUFFIXES;
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_ALLOW_LOCALHOST;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  const getAllowedOriginFn = () => {
    const mod = require('../unified_gateway');
    // The gateway exports the class as default; the CORS helper is module-level.
    // We probe it via a supertest-style request against the express app.
    return mod;
  };

  it('allows vortexshield.lanonasis.com by default (*.lanonasis.com suffix)', async () => {
    const { default: supertest } = await import('supertest');
    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const response = await supertest(gateway.app)
      .options('/api/v1/ai/chat')
      .set('Origin', 'https://vortexshield.lanonasis.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,X-API-Key');

    expect(response.headers['access-control-allow-origin']).toBe('https://vortexshield.lanonasis.com');
  });

  it('allows api.connectionpoint.tech by default (*.connectionpoint.tech suffix)', async () => {
    const { default: supertest } = await import('supertest');
    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const response = await supertest(gateway.app)
      .options('/api/v1/ai/chat')
      .set('Origin', 'https://api.connectionpoint.tech')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,X-API-Key');

    expect(response.headers['access-control-allow-origin']).toBe('https://api.connectionpoint.tech');
  });

  it('allows localhost by default', async () => {
    const { default: supertest } = await import('supertest');
    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const response = await supertest(gateway.app)
      .options('/api/v1/ai/chat')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('blocks unknown third-party origins', async () => {
    const { default: supertest } = await import('supertest');
    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const response = await supertest(gateway.app)
      .options('/api/v1/ai/chat')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');

    // cors package omits the header when origin is not allowed
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('respects ALLOWED_ORIGIN_SUFFIXES env override', async () => {
    process.env.ALLOWED_ORIGIN_SUFFIXES = 'custom.dev';
    const { default: supertest } = await import('supertest');
    const UnifiedGateway = loadGatewayClass();
    stubGatewayForTests(UnifiedGateway);
    const gateway = new UnifiedGateway();

    const allowedResponse = await supertest(gateway.app)
      .options('/api/v1/ai/chat')
      .set('Origin', 'https://app.custom.dev')
      .set('Access-Control-Request-Method', 'POST');

    const blockedResponse = await supertest(gateway.app)
      .options('/api/v1/ai/chat')
      .set('Origin', 'https://vortexshield.lanonasis.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowedResponse.headers['access-control-allow-origin']).toBe('https://app.custom.dev');
    expect(blockedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });
});
