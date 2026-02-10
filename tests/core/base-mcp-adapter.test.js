import { describe, it, expect, vi, afterEach } from 'vitest';

// CommonJS interop
import BaseMCPAdapterImport from '../../core/base-mcp-adapter.js';

const BaseMCPAdapter = BaseMCPAdapterImport?.default || BaseMCPAdapterImport;

class TestAdapter extends BaseMCPAdapter {
  async initialize() {
    this.tools = [
      {
        name: 'ping',
        description: 'Ping tool',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }
    ];
    this._initialized = true;
  }
}

describe('BaseMCPAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates callTool to client.call and updates stats', async () => {
    const client = {
      call: vi.fn().mockResolvedValue({ ok: true }),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true })
    };

    const adapter = new TestAdapter({
      id: 'test',
      name: 'Test Adapter',
      client,
      tools: [{ name: 'ping', description: 'Ping tool' }]
    });

    const result = await adapter.callTool('ping', { a: 1 }, { authorization: 'Bearer token' });

    expect(result).toEqual({ ok: true });
    expect(client.call).toHaveBeenCalledWith('ping', { a: 1 }, { authorization: 'Bearer token' });

    const stats = adapter.getStats();
    expect(stats.calls).toBe(1);
    expect(stats.errors).toBe(0);
    expect(stats.lastCall).toBeTypeOf('string');
  });

  it('throws when tool is not found', async () => {
    const client = { call: vi.fn() };
    const adapter = new TestAdapter({ id: 'test', client, tools: [{ name: 'ping' }] });

    await expect(adapter.callTool('missing-tool', {})).rejects.toThrow(
      "Tool 'missing-tool' not found in adapter 'test'"
    );
  });

  it('delegates healthCheck to client.healthCheck when available', async () => {
    const client = {
      call: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true, service: 'ok' })
    };

    const adapter = new TestAdapter({ id: 'test', client, tools: [{ name: 'ping' }] });
    const health = await adapter.healthCheck();

    expect(client.healthCheck).toHaveBeenCalledTimes(1);
    expect(health).toEqual({ healthy: true, service: 'ok' });
  });
});

