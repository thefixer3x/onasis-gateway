import { describe, it, expect, vi, beforeEach } from 'vitest';

import AIRouterAdapterImport from '../../services/ai-router/ai-router-adapter.js';

const AIRouterAdapter = AIRouterAdapterImport?.default || AIRouterAdapterImport;

const mockClient = () => ({ request: vi.fn().mockResolvedValue({ ok: true }) });
const mockSupabaseClient = () => ({ call: vi.fn().mockResolvedValue({ ok: true, source: 'edge' }) });

describe('AIRouterAdapter multi-provider routing', () => {
  let adapter;
  let ollamaClient;
  let supabaseClient;
  let legacyClient;

  beforeEach(async () => {
    ollamaClient = mockClient();
    supabaseClient = mockSupabaseClient();
    legacyClient = mockClient();

    adapter = new AIRouterAdapter({
      client: legacyClient,
      ollamaClient,
      supabaseClient,
      defaultProvider: 'auto',
      fallbackProvider: 'claude',
      allowProviderOverride: true,
      ollamaModel: 'qwen2.5-coder:3b'
    });
    await adapter.initialize();
  });

  it('routes chat to Ollama first in auto mode', async () => {
    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(ollamaClient.request).toHaveBeenCalledWith(
      { path: '/api/chat', method: 'POST' },
      expect.objectContaining({
        data: expect.objectContaining({
          model: 'qwen2.5-coder:3b',
          messages: [{ role: 'user', content: 'hello' }]
        })
      })
    );
  });

  it('falls back to edge function when Ollama fails in auto mode', async () => {
    ollamaClient.request.mockRejectedValueOnce(new Error('connection refused'));

    const result = await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(ollamaClient.request).toHaveBeenCalled();
    expect(supabaseClient.call).toHaveBeenCalledWith(
      'claude-ai',
      expect.objectContaining({ messages: [{ role: 'user', content: 'hello' }] }),
      expect.any(Object)
    );
    expect(result.ok).toBe(true);
  });

  it('routes explicit provider=claude to claude-ai edge function', async () => {
    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }],
      provider: 'claude'
    });

    expect(supabaseClient.call).toHaveBeenCalledWith(
      'claude-ai',
      expect.any(Object),
      expect.any(Object)
    );
    expect(ollamaClient.request).not.toHaveBeenCalled();
  });

  it('routes explicit provider=openai to openai-chat edge function', async () => {
    await adapter.callTool('chat', {
      messages: [{ role: 'user', content: 'hello' }],
      provider: 'openai'
    });

    expect(supabaseClient.call).toHaveBeenCalledWith(
      'openai-chat',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('routes explicit provider=gemini to gemini-ai edge function', async () => {
    await adapter.callTool('chat', {
      messages: [{ role: 'user', content: 'hello' }],
      provider: 'gemini'
    });

    expect(supabaseClient.call).toHaveBeenCalledWith(
      'gemini-ai',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('routes explicit provider=ollama directly to Ollama client', async () => {
    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }],
      provider: 'ollama'
    });

    expect(ollamaClient.request).toHaveBeenCalledWith(
      { path: '/api/chat', method: 'POST' },
      expect.any(Object)
    );
    expect(supabaseClient.call).not.toHaveBeenCalled();
  });

  it('uses configured fallbackProvider on primary failure', async () => {
    adapter.defaultProvider = 'ollama';
    adapter.fallbackProvider = 'openai';
    ollamaClient.request.mockRejectedValueOnce(new Error('timeout'));

    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(supabaseClient.call).toHaveBeenCalledWith(
      'openai-chat',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('throws when primary fails and no fallback configured', async () => {
    adapter.defaultProvider = 'ollama';
    adapter.fallbackProvider = '';
    ollamaClient.request.mockRejectedValueOnce(new Error('timeout'));

    await expect(
      adapter.callTool('ai-chat', {
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('timeout');
  });

  it('rejects unknown provider when override is enabled', async () => {
    await expect(
      adapter.callTool('ai-chat', {
        messages: [{ role: 'user', content: 'hello' }],
        provider: 'nixie-ai'
      })
    ).rejects.toThrow('not allowed');
  });
});

describe('AIRouterAdapter Onasis branding', () => {
  it('wraps every response with onasis_metadata', async () => {
    const ollamaClient = mockClient();
    ollamaClient.request.mockResolvedValue({ message: { content: 'hi' } });

    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient,
      supabaseClient: mockSupabaseClient(),
      defaultProvider: 'ollama'
    });
    await adapter.initialize();

    const result = await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(result.onasis_metadata).toBeDefined();
    expect(result.onasis_metadata.powered_by).toBe('Onasis-CORE');
    expect(result.onasis_metadata.provider).toBe('onasis-ai');
    expect(result.onasis_metadata.actual_provider).toBe('ollama');
    expect(typeof result.onasis_metadata.processing_time_ms).toBe('number');
    expect(result.onasis_metadata.timestamp).toBeDefined();
  });

  it('brands list-ai-services responses', async () => {
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient: mockClient(),
      supabaseClient: mockSupabaseClient(),
      defaultProvider: 'auto'
    });
    await adapter.initialize();

    const result = await adapter.callTool('list-ai-services', {});

    expect(result.onasis_metadata).toBeDefined();
    expect(result.services).toBeDefined();
    expect(result.services.length).toBeGreaterThan(0);
  });
});

describe('AIRouterAdapter system prompt injection', () => {
  it('prepends system prompt to Ollama messages when configured', async () => {
    const ollamaClient = mockClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient,
      supabaseClient: mockSupabaseClient(),
      defaultProvider: 'ollama',
      systemPrompt: 'You are L0.'
    });
    await adapter.initialize();

    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    const callData = ollamaClient.request.mock.calls[0][1].data;
    expect(callData.messages[0]).toEqual({ role: 'system', content: 'You are L0.' });
    expect(callData.messages[1]).toEqual({ role: 'user', content: 'hello' });
  });

  it('does not prepend system prompt when messages already contain one', async () => {
    const ollamaClient = mockClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient,
      supabaseClient: mockSupabaseClient(),
      defaultProvider: 'ollama',
      systemPrompt: 'You are L0.'
    });
    await adapter.initialize();

    await adapter.callTool('ai-chat', {
      messages: [
        { role: 'system', content: 'Custom system' },
        { role: 'user', content: 'hello' }
      ]
    });

    const callData = ollamaClient.request.mock.calls[0][1].data;
    expect(callData.messages[0]).toEqual({ role: 'system', content: 'Custom system' });
    expect(callData.messages.length).toBe(2);
  });
});

describe('AIRouterAdapter embedding', () => {
  it('routes embedding to generate-embedding edge function', async () => {
    const supabaseClient = mockSupabaseClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient: mockClient(),
      supabaseClient
    });
    await adapter.initialize();

    await adapter.callTool('embedding', { input: 'test text' });

    expect(supabaseClient.call).toHaveBeenCalledWith(
      'generate-embedding',
      { input: 'test text' },
      expect.any(Object)
    );
  });
});

describe('AIRouterAdapter context header forwarding', () => {
  it('forwards Authorization header to provider', async () => {
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

    const requestHeaders = ollamaClient.request.mock.calls[0][1].headers;
    expect(requestHeaders.Authorization).toBe('Bearer user-jwt');
  });

  it('forwards Authorization header to edge function', async () => {
    const supabaseClient = mockSupabaseClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient: mockClient(),
      supabaseClient,
      defaultProvider: 'claude'
    });
    await adapter.initialize();

    await adapter.callTool(
      'ai-chat',
      { messages: [{ role: 'user', content: 'hello' }] },
      { headers: { Authorization: 'Bearer user-jwt' } }
    );

    const callOptions = supabaseClient.call.mock.calls[0][2];
    expect(callOptions.headers.Authorization).toBe('Bearer user-jwt');
  });
});

describe('AIRouterAdapter provider hardening', () => {
  it('ignores request provider when override is disabled', async () => {
    const supabaseClient = mockSupabaseClient();
    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient: mockClient(),
      supabaseClient,
      defaultProvider: 'claude',
      allowProviderOverride: false
    });
    await adapter.initialize();

    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }],
      provider: 'openai'
    });

    expect(supabaseClient.call).toHaveBeenCalledWith(
      'claude-ai',
      expect.objectContaining({
        provider: 'claude'
      }),
      expect.any(Object)
    );
  });

  it('preserves fallback provider in legacy request payload when supabase client is unavailable', async () => {
    const legacyClient = mockClient();
    const ollamaClient = mockClient();
    ollamaClient.request.mockRejectedValueOnce(new Error('ollama down'));

    const adapter = new AIRouterAdapter({
      client: legacyClient,
      ollamaClient,
      supabaseClient: null,
      defaultProvider: 'auto',
      fallbackProvider: 'openai',
      allowProviderOverride: false
    });
    await adapter.initialize();

    await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    const [, options] = legacyClient.request.mock.calls[0];
    expect(options.data.provider).toBe('openai');
  });

  it('reports the actual fallback provider in onasis metadata', async () => {
    const ollamaClient = mockClient();
    ollamaClient.request.mockRejectedValueOnce(new Error('ollama timeout'));
    const supabaseClient = mockSupabaseClient();

    const adapter = new AIRouterAdapter({
      client: mockClient(),
      ollamaClient,
      supabaseClient,
      defaultProvider: 'auto',
      fallbackProvider: 'openai',
      allowProviderOverride: false
    });
    await adapter.initialize();

    const result = await adapter.callTool('ai-chat', {
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(result.onasis_metadata.actual_provider).toBe('openai');
  });
});
