import { describe, it, expect, beforeEach } from 'vitest';

// CommonJS interop
import AdapterRegistryImport from '../../src/mcp/adapter-registry.js';

const AdapterRegistry = AdapterRegistryImport?.default || AdapterRegistryImport;

describe('AdapterRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('register() initializes and indexes tools with snake_case -> kebab-case aliases', async () => {
    let initCalls = 0;
    let captured = null;

    const adapter = {
      id: 'paystack',
      tools: [{ name: 'initialize_transaction', description: 'init' }],
      initialize: async function () { initCalls += 1; },
      callTool: async function (toolName, args, context) {
        captured = { toolName, args, context };
        return { ok: true };
      }
    };

    await registry.register(adapter);

    expect(initCalls).toBe(1);

    const resolved = registry.resolveTool('paystack:initialize_transaction');
    expect(resolved).not.toBeNull();
    expect(resolved.canonicalId).toBe('paystack:initialize-transaction');
    expect(resolved.adapterId).toBe('paystack');
    expect(resolved.tool.name).toBe('initialize_transaction');

    const data = await registry.callTool(
      'paystack:initialize_transaction',
      { amount: 100 },
      {
        authorization: 'Bearer user',
        apiKey: 'uai_key',
        projectScope: 'scope',
        requestId: 'req_1',
        sessionId: 'sess_1'
      }
    );

    expect(data).toEqual({ ok: true });
    expect(captured).not.toBeNull();
    expect(captured.toolName).toBe('initialize_transaction');
    expect(captured.args).toEqual({ amount: 100 });
    expect(captured.context.headers).toEqual({
      Authorization: 'Bearer user',
      'X-API-Key': 'uai_key',
      'X-Project-Scope': 'scope',
      'X-Request-ID': 'req_1',
      'X-Session-ID': 'sess_1'
    });
  });

  it('callTool() wraps legacy adapters with { data, headers } when callTool.length < 3', async () => {
    let captured = null;

    const legacy = {
      id: 'supabase-edge-functions',
      tools: [{ name: 'system-health', description: 'health' }],
      initialize: async function () { /* no-op */ },
      callTool: async function (toolName, payload) {
        captured = { toolName, payload };
        return payload;
      }
    };

    await registry.register(legacy);

    const result = await registry.callTool(
      'supabase-edge-functions:system-health',
      { ok: true },
      { authorization: 'Bearer user' }
    );

    expect(result).toEqual({
      data: { ok: true },
      headers: { Authorization: 'Bearer user' }
    });
    expect(captured).toEqual({
      toolName: 'system-health',
      payload: {
        data: { ok: true },
        headers: { Authorization: 'Bearer user' }
      }
    });
  });

  it('registerMock() stores numeric tools so OperationRegistry can generate placeholder operations', async () => {
    registry.registerMock({
      id: 'mocky',
      name: 'Mocky',
      toolCount: 3,
      authType: 'bearer',
      category: 'payments'
    });

    const adapter = registry.toAdaptersMap().get('mocky');
    expect(adapter).toBeTruthy();
    expect(adapter.is_mock).toBe(true);
    expect(adapter.tools).toBe(3);
    expect(adapter.toolCount).toBe(3);
  });
});

