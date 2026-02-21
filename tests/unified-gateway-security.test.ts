import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

const UnifiedGateway = require('../unified_gateway');
const originalSetupErrorHandling = UnifiedGateway.prototype.setupErrorHandling;

const stubGatewayForTests = () => {
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

const buildGateway = ({ deferErrorHandling = false } = {}) => {
  if (deferErrorHandling) {
    UnifiedGateway.prototype.setupErrorHandling = function () {
      return;
    };
  } else {
    UnifiedGateway.prototype.setupErrorHandling = originalSetupErrorHandling;
  }

  const gateway = new UnifiedGateway();

  UnifiedGateway.prototype.setupErrorHandling = originalSetupErrorHandling;
  return gateway;
};

describe('UnifiedGateway security middleware', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGIN_SUFFIXES = 'lanonasis.com';
    process.env.ALLOWED_ORIGINS = '';
    process.env.CORS_ORIGIN = '';
    process.env.CORS_ALLOW_LOCALHOST = 'true';
    process.env.EXPOSE_ERROR_MESSAGES = 'false';
    process.env.AI_CHAT_REQUIRE_IDENTITY = '';
    process.env.AI_CHAT_TEMP_APIKEY_FALLBACK = '';
    stubGatewayForTests();
  });

  it('allows lanonasis subdomain origins', async () => {
    const gateway = buildGateway();
    const origin = 'https://gateway.lanonasis.com';

    const res = await request(gateway.app)
      .get('/health')
      .set('Origin', origin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('denies non-allowlisted origins', async () => {
    const gateway = buildGateway();
    const origin = 'https://evil.com';

    const res = await request(gateway.app)
      .get('/health')
      .set('Origin', origin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('blocks dotfile probing', async () => {
    const gateway = buildGateway();

    const res = await request(gateway.app)
      .get('/.env');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('does not expose error messages by default', async () => {
    const gateway = buildGateway({ deferErrorHandling: true });
    gateway.app.get('/__test/error', (req, res, next) => {
      next(new Error('boom'));
    });
    originalSetupErrorHandling.call(gateway);

    const res = await request(gateway.app)
      .get('/__test/error');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBeUndefined();
    expect(res.body.requestId).toBeDefined();
  });

  it('exposes error messages only when enabled', async () => {
    process.env.EXPOSE_ERROR_MESSAGES = 'true';
    const gateway = buildGateway({ deferErrorHandling: true });
    gateway.app.get('/__test/error', (req, res, next) => {
      next(new Error('boom'));
    });
    originalSetupErrorHandling.call(gateway);

    const res = await request(gateway.app)
      .get('/__test/error');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBe('boom');
    expect(res.body.requestId).toBeDefined();
  });

  it('exposes central route policy details', async () => {
    const gateway = buildGateway();
    const res = await request(gateway.app).get('/api/v1/gateway/route-policy');

    expect(res.status).toBe(200);
    expect(res.body.centralGatewayBaseUrl).toBeDefined();
    expect(Array.isArray(res.body.proxyRoutes)).toBe(true);
    expect(res.body.proxyRoutes).toContain('/functions/v1/:functionName');
    expect(res.body.proxyRoutes).toContain('/api/v1/functions/:functionName');
  });

  it('enforces identity on canonical and legacy AI chat routes', async () => {
    process.env.AI_CHAT_REQUIRE_IDENTITY = 'true';
    const gateway = buildGateway();

    const canonical = await request(gateway.app)
      .post('/api/v1/ai/chat')
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const legacy = await request(gateway.app)
      .post('/api/v1/ai-chat')
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    expect(canonical.status).toBe(401);
    expect(canonical.body.error).toBe('Authentication required');
    expect(legacy.status).toBe(401);
    expect(legacy.body.error).toBe('Authentication required');
  });

  it('uses temporary API-key fallback for AI chat when primary identity check returns invalid API key', async () => {
    process.env.AI_CHAT_REQUIRE_IDENTITY = 'true';
    process.env.AI_CHAT_TEMP_APIKEY_FALLBACK = 'true';
    const gateway = buildGateway();

    (gateway as any).verifyRequestIdentity = async () => ({
      ok: false,
      status: 401,
      error: 'Invalid API key'
    });

    (gateway as any).authBridge.validateAPIKey = async () => ({
      authenticated: true,
      user: { id: 'svc-user-1' },
      method: 'api_key'
    });

    const response = await request(gateway.app)
      .post('/api/v1/ai/chat')
      .set('X-API-Key', 'lano_test_api_key')
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    // In this test harness AI router isn't configured, so auth succeeds then route returns 502.
    expect(response.status).toBe(502);
    expect(response.headers['x-gateway-auth-fallback']).toBe('ai-chat-api-key');
    expect(response.body.error).toBe('AI router unavailable; identity-safe fallback disabled');
  });
});
