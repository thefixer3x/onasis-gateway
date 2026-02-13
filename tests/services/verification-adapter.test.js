import { describe, it, expect, vi } from 'vitest';

import VerificationAdapterImport from '../../services/verification-service/verification-adapter.js';

const VerificationAdapter = VerificationAdapterImport?.default || VerificationAdapterImport;

describe('VerificationServiceAdapter', () => {
  it('initializes with full verification tool surface by default', async () => {
    const adapter = new VerificationAdapter();
    await adapter.initialize();

    const toolNames = adapter.tools.map((t) => t.name);
    expect(toolNames.length).toBe(22);
    expect(toolNames).toContain('verify-identity-document');
    expect(toolNames).toContain('verify-nin');
    expect(toolNames).toContain('get-verification-providers');
  });

  it('supports explicit enabledTools filtering when provided', async () => {
    const adapter = new VerificationAdapter({
      enabledTools: ['verify-identity-document', 'liveness-detection']
    });
    await adapter.initialize();

    const toolNames = adapter.tools.map((t) => t.name);
    expect(toolNames).toEqual(['verify-identity-document', 'liveness-detection']);

    const disabled = await adapter.callTool('verify-nin', { nin: '12345678901' });
    expect(disabled.success).toBe(false);
    expect(disabled.error.code).toBe('TOOL_DISABLED');
  });

  it('routes POST tools using BaseClient.request(endpoint, options) with context headers', async () => {
    const client = { request: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new VerificationAdapter({
      client,
      enabledTools: ['verify-identity-document']
    });

    await adapter.initialize();

    const result = await adapter.callTool(
      'verify-identity-document',
      {
        document_type: 'passport',
        document_number: 'A1234567',
        customer_id: 'cust-1'
      },
      {
        headers: {
          Authorization: 'Bearer test-token'
        }
      }
    );

    expect(result.success).toBe(true);
    expect(client.request).toHaveBeenCalledTimes(1);

    const [endpoint, options] = client.request.mock.calls[0];
    expect(endpoint).toEqual({ path: '/api/v1/identity/verify', method: 'POST' });
    expect(options.data).toEqual({
      document_type: 'passport',
      document_number: 'A1234567',
      customer_id: 'cust-1'
    });
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(options.data.provider).toBeUndefined();
  });

  it('builds status GET path correctly when verification_id is provided', async () => {
    const client = { request: vi.fn().mockResolvedValue({ status: 'ok' }) };
    const adapter = new VerificationAdapter({
      client,
      enabledTools: ['get-verification-status']
    });

    await adapter.initialize();

    await adapter.callTool('get-verification-status', {
      verification_id: 'ver-123',
      reference: 'ref-99'
    });

    const [endpoint, options] = client.request.mock.calls[0];
    expect(endpoint).toEqual({ path: '/api/v1/verification/status/ver-123', method: 'GET' });
    expect(options.params).toEqual({ reference: 'ref-99' });
  });
});
