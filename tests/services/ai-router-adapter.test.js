import { describe, it, expect, vi } from 'vitest';

import AIRouterAdapterImport from '../../services/ai-router/ai-router-adapter.js';

const AIRouterAdapter = AIRouterAdapterImport?.default || AIRouterAdapterImport;

describe('AIRouterAdapter', () => {
  it('exposes only public AI router tools (no internal memory tools)', async () => {
    const adapter = new AIRouterAdapter({
      client: { request: vi.fn() }
    });

    await adapter.initialize();
    const toolNames = adapter.tools.map((t) => t.name);

    expect(toolNames).toContain('ai-chat');
    expect(toolNames).toContain('ollama');
    expect(toolNames).toContain('list-ai-services');
    expect(toolNames).toContain('ai-health');
    expect(toolNames).not.toContain('memory-search');
    expect(toolNames).not.toContain('memory-get');
    expect(toolNames).not.toContain('memory-write');
  });

  it('uses canonical /api/v1/ai/chat path for ai-chat', async () => {
    const client = { request: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new AIRouterAdapter({ client });
    await adapter.initialize();

    await adapter.callTool(
      'ai-chat',
      { messages: [{ role: 'user', content: 'hello' }] },
      { headers: { Authorization: 'Bearer user-jwt' } }
    );

    const [endpoint, options] = client.request.mock.calls[0];
    expect(endpoint).toEqual({ path: '/api/v1/ai/chat', method: 'POST' });
    expect(options.headers.Authorization).toBe('Bearer user-jwt');
  });

  it('falls back to legacy path only on 404/405', async () => {
    const notFoundError = new Error('not found');
    notFoundError.response = { status: 404 };

    const client = {
      request: vi
        .fn()
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({ ok: true, route: 'legacy' })
    };
    const adapter = new AIRouterAdapter({ client });
    await adapter.initialize();

    const result = await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(result.ok).toBe(true);
    expect(client.request).toHaveBeenNthCalledWith(
      1,
      { path: '/api/v1/ai/chat', method: 'POST' },
      expect.any(Object)
    );
    expect(client.request).toHaveBeenNthCalledWith(
      2,
      { path: '/api/v1/ai-chat', method: 'POST' },
      expect.any(Object)
    );
  });
});
