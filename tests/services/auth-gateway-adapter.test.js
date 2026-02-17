import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const loadAdapter = () => {
  const modulePath = require.resolve('../../services/auth-gateway/auth-gateway-adapter.js');
  delete require.cache[modulePath];
  return require('../../services/auth-gateway/auth-gateway-adapter.js');
};

describe('AuthGatewayAdapter URL normalization', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('strips /v1/auth suffix from AUTH_GATEWAY_URL', () => {
    process.env.AUTH_GATEWAY_URL = 'https://auth.lanonasis.com/v1/auth';
    const AuthGatewayAdapter = loadAdapter();
    const adapter = new AuthGatewayAdapter();

    expect(adapter.client.config.baseUrl).toBe('https://auth.lanonasis.com');
  });

  it('strips /v1 suffix from ONASIS_AUTH_API_URL', () => {
    delete process.env.AUTH_GATEWAY_URL;
    process.env.ONASIS_AUTH_API_URL = 'https://auth.lanonasis.com/v1';
    const AuthGatewayAdapter = loadAdapter();
    const adapter = new AuthGatewayAdapter();

    expect(adapter.client.config.baseUrl).toBe('https://auth.lanonasis.com');
  });
});
