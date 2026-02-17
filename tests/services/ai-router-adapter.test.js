import { describe, it, expect, vi } from 'vitest';

import AIRouterAdapterImport from '../../services/ai-router/ai-router-adapter.js';

const AIRouterAdapter = AIRouterAdapterImport?.default || AIRouterAdapterImport;

const mockClient = () => ({ request: vi.fn().mockResolvedValue({ ok: true }) });
const mockSupabaseClient = () => ({ call: vi.fn().mockResolvedValue({ ok: true }) });

describe('AIRouterAdapter', () => {
  it('exposes only public AI router tools (no internal memory tools)', async () => {
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient: mockClient(),
      supabaseClient: mockSupabaseClient()
    });

    await adapter.initialize();
    const toolNames = adapter.tools.map((t) => t.name);

    expect(toolNames).toContain('ai-chat');
    expect(toolNames).toContain('ollama');
    expect(toolNames).toContain('embedding');
    expect(toolNames).toContain('list-ai-services');
    expect(toolNames).toContain('list-models');
    expect(toolNames).toContain('ai-health');
    expect(toolNames).not.toContain('memory-search');
    expect(toolNames).not.toContain('memory-get');
    expect(toolNames).not.toContain('memory-write');
  });

  it('uses canonical /api/v1/ai/chat path for ai-chat via Ollama', async () => {
    const ollamaClient = mockClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient,
      supabaseClient: mockSupabaseClient(),
      defaultProvider: 'ollama'
    });
    await adapter.initialize();

    await adapter.callTool(
      'ai-chat',
      { messages: [{ role: 'user', content: 'hello' }] },
      { headers: { Authorization: 'Bearer user-jwt' } }
    );

    const [endpoint, options] = ollamaClient.request.mock.calls[0];
    expect(endpoint).toEqual({ path: '/api/chat', method: 'POST' });
    expect(options.headers.Authorization).toBe('Bearer user-jwt');
  });

  it('falls back to edge function when Ollama returns error in auto mode', async () => {
    const ollamaClient = mockClient();
    ollamaClient.request.mockRejectedValueOnce(new Error('connection refused'));

    const supabaseClient = mockSupabaseClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient,
      supabaseClient,
      defaultProvider: 'auto',
      fallbackProvider: 'claude'
    });
    await adapter.initialize();

    const result = await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(result.ok).toBe(true);
    expect(ollamaClient.request).toHaveBeenCalled();
    expect(supabaseClient.call).toHaveBeenCalledWith(
      'claude-ai',
      expect.any(Object),
      expect.any(Object)
    );
  });
});
