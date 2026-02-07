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
});
