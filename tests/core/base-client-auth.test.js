import { describe, it, expect } from 'vitest';

import BaseClientImport from '../../core/base-client.js';

const BaseClient = BaseClientImport?.default || BaseClientImport;

describe('BaseClient bearer authentication precedence', () => {
  it('preserves forwarded Authorization header when present', () => {
    const client = new BaseClient({
      name: 'ai-router',
      baseUrl: 'http://127.0.0.1:3001',
      authentication: {
        type: 'bearer',
        config: { token: 'service-token' }
      }
    });

    const config = {
      headers: {
        Authorization: 'Bearer user-jwt'
      }
    };

    client.addAuthentication(config);
    expect(config.headers.Authorization).toBe('Bearer user-jwt');
  });

  it('does not inject bearer token when service token is missing', () => {
    const client = new BaseClient({
      name: 'ai-router',
      baseUrl: 'http://127.0.0.1:3001',
      authentication: {
        type: 'bearer',
        config: {}
      }
    });

    const config = { headers: {} };
    client.addAuthentication(config);

    expect(config.headers.Authorization).toBeUndefined();
  });
});
