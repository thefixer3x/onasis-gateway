/**
 * AI Router Adapter
 *
 * Multi-provider AI routing with Onasis branding. Routes chat requests to
 * Ollama (local) or Supabase Edge Functions (Claude, OpenAI, Gemini, etc.)
 * using backend-managed provider controls.
 *
 * Provider precedence:
 *   1. AI_MANAGED_PROVIDER env/config (hard override)
 *   2. Per-request `provider` only when AI_ALLOW_PROVIDER_OVERRIDE=true
 *   3. AI_DEFAULT_PROVIDER (default: 'auto')
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

let UniversalSupabaseClient;
try {
  UniversalSupabaseClient = require('../../core/universal-supabase-client');
} catch {
  UniversalSupabaseClient = null;
}

const PROVIDER_EDGE_FUNCTION_MAP = {
  claude: 'claude-ai',
  openai: 'openai-chat',
  gemini: 'gemini-ai',
  'ai-chat': 'ai-chat',
  chat: 'ai-chat'
};

const DEFAULT_ALLOWED_PROVIDERS = ['auto', 'ollama', 'claude', 'openai', 'gemini'];

const normalizeProvider = (value) => (value || '').toString().trim().toLowerCase();

const parseAllowedProviders = (value) => {
  if (!value) return new Set(DEFAULT_ALLOWED_PROVIDERS);
  if (Array.isArray(value)) return new Set(value.map(normalizeProvider).filter(Boolean));
  return new Set(
    value
      .toString()
      .split(',')
      .map((item) => normalizeProvider(item))
      .filter(Boolean)
  );
};

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['system', 'user', 'assistant'] },
          content: { type: 'string' }
        },
        required: ['role', 'content']
      },
      description: 'Conversation messages'
    },
    provider: {
      type: 'string',
      description: 'Optional provider override (ollama, claude, openai, gemini, auto)'
    },
    temperature: {
      type: 'number',
      minimum: 0,
      maximum: 2,
      default: 0.7,
      description: 'Sampling temperature'
    },
    max_tokens: {
      type: 'integer',
      minimum: 1,
      description: 'Maximum tokens to generate'
    },
    system_prompt: {
      type: 'string',
      description: 'Optional system prompt override'
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['function'] },
          function: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tool name' },
              description: { type: 'string', description: 'Tool description' },
              parameters: { type: 'object', description: 'Tool parameters' }
            },
            required: ['name', 'description', 'parameters']
          }
        }
      },
      description: 'Available tools for the AI to use'
    }
  },
  required: ['messages']
};

const EMBEDDING_SCHEMA = {
  type: 'object',
  properties: {
    input: { type: 'string', description: 'Text to generate embeddings for' },
    model: { type: 'string', description: 'Embedding model to use' }
  },
  required: ['input']
};

class AIRouterAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const aiRouterUrl = config.aiRouterUrl || process.env.AI_ROUTER_URL || 'http://127.0.0.1:3001';
    const serviceToken = config.serviceBearerToken || process.env.AI_ROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
    const serviceAuthEnabled =
      config.serviceAuth === true ||
      process.env.AI_ROUTER_SERVICE_AUTH === 'true';

    const client = config.client || new BaseClient({
      name: 'ai-router',
      baseUrl: aiRouterUrl,
      timeout: 60000,
      authentication: serviceAuthEnabled && serviceToken
        ? { type: 'bearer', config: { token: serviceToken } }
        : {}
    });

    super({
      id: 'ai-router',
      name: 'AI Router',
      description: 'Multi-provider AI routing with Onasis branding',
      category: 'ai',
      capabilities: [
        'chat_completion',
        'provider_routing',
        'model_selection',
        'embeddings',
        'usage_tracking'
      ],
      callToolVersion: 'v2',
      client,
      ...config
    });

    // Provider configuration
    this.defaultProvider = normalizeProvider(config.defaultProvider || process.env.AI_DEFAULT_PROVIDER || 'auto') || 'auto';
    this.fallbackProvider = normalizeProvider(config.fallbackProvider || process.env.AI_FALLBACK_PROVIDER || '');
    this.managedProvider = normalizeProvider(config.managedProvider || process.env.AI_MANAGED_PROVIDER || '');
    this.allowProviderOverride =
      config.allowProviderOverride === true ||
      process.env.AI_ALLOW_PROVIDER_OVERRIDE === 'true';
    this.allowedProviders = parseAllowedProviders(config.allowedProviders || process.env.AI_ALLOWED_PROVIDERS);
    // Keep known defaults always available unless explicitly disallowed by policy in code.
    for (const provider of DEFAULT_ALLOWED_PROVIDERS) {
      if (!this.allowedProviders.has(provider)) {
        this.allowedProviders.add(provider);
      }
    }
    this.systemPrompt = config.systemPrompt || process.env.OLLAMA_SYSTEM_PROMPT || '';

    // Ollama client (local AI)
    const ollamaUrl = config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.ollamaModel = config.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
    this.ollamaClient = config.ollamaClient || new BaseClient({
      name: 'ollama',
      baseUrl: ollamaUrl,
      timeout: 120000,
      authentication: {}
    });

    // Supabase client for edge function calls (Claude, OpenAI, Gemini, etc.)
    this.supabaseClient = config.supabaseClient || null;
    this._supabaseInitAttempted = false;
  }

  _initSupabaseClient() {
    if (this._supabaseInitAttempted) return;
    this._supabaseInitAttempted = true;

    if (this.supabaseClient) return;
    if (!UniversalSupabaseClient) return;

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return;

    try {
      this.supabaseClient = new UniversalSupabaseClient({
        serviceName: 'ai-router',
        timeout: 60000
      });
    } catch {
      // Supabase not configured — edge function routing unavailable
    }
  }

  async initialize() {
    this._initSupabaseClient();

    this.tools = [
      {
        name: 'ai-chat',
        description: 'AI chat completions via the configured provider router',
        inputSchema: CHAT_SCHEMA
      },
      {
        name: 'chat',
        description: 'Alias for ai-chat',
        inputSchema: CHAT_SCHEMA
      },
      {
        name: 'ollama',
        description: 'Direct Ollama chat (shorthand for provider: ollama)',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'Ollama model to use' },
            messages: CHAT_SCHEMA.properties.messages,
            stream: { type: 'boolean', default: false, description: 'Whether to stream the response' }
          },
          required: ['model', 'messages']
        }
      },
      {
        name: 'embedding',
        description: 'Generate text embeddings',
        inputSchema: EMBEDDING_SCHEMA
      },
      {
        name: 'list-ai-services',
        description: 'List available AI routing backends/providers',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'list-models',
        description: 'List available AI models across all providers',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'ai-health',
        description: 'Check health of AI router and providers',
        inputSchema: { type: 'object', properties: {} }
      }
    ];
    this._initialized = true;
  }

  // ---------------------------------------------------------------------------
  // callTool — main dispatch with branding
  // ---------------------------------------------------------------------------

  async callTool(toolName, args = {}, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    const start = Date.now();

    try {
      let result;
      let actualProvider = 'router';

      switch (toolName) {
        case 'ai-chat':
        case 'chat': {
          const selectedProvider = this.resolveChatProvider(args, context);
          const payload = this.prepareChatPayload(args, selectedProvider);
          const routed = await this.routeChat(selectedProvider, payload, context);
          result = routed.result;
          actualProvider = routed.providerUsed;
          break;
        }
        case 'ollama':
          result = await this.callOllama(args, context);
          actualProvider = 'ollama';
          break;
        case 'embedding': {
          const embedding = await this.callEmbedding(args, context);
          result = embedding.result;
          actualProvider = embedding.providerUsed;
          break;
        }
        case 'list-ai-services':
          result = this.listServices();
          actualProvider = 'router';
          break;
        case 'list-models':
          result = await this.listModels(context);
          actualProvider = 'router';
          break;
        case 'ai-health':
          result = await this.checkHealth(context);
          actualProvider = 'router';
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return this.brandResponse(result, actualProvider, Date.now() - start);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Provider routing
  // ---------------------------------------------------------------------------

  resolveChatProvider(args = {}, context = {}) {
    if (this.managedProvider) {
      this.assertAllowedProvider(this.managedProvider);
      return this.managedProvider;
    }

    const requestProvider = normalizeProvider(
      args.provider ||
      context.provider ||
      (context.headers && (context.headers['X-AI-Provider'] || context.headers['x-ai-provider']))
    );

    if (requestProvider && this.allowProviderOverride) {
      this.assertAllowedProvider(requestProvider);
      return requestProvider;
    }

    this.assertAllowedProvider(this.defaultProvider);
    return this.defaultProvider;
  }

  assertAllowedProvider(provider) {
    const normalized = normalizeProvider(provider);
    if (!normalized) {
      throw new Error('Provider is required for AI routing');
    }
    if (!this.allowedProviders.has(normalized)) {
      throw new Error(`Provider '${normalized}' is not allowed by gateway policy`);
    }
  }

  prepareChatPayload(args = {}, selectedProvider) {
    const payload = { ...(args || {}) };
    delete payload.provider;
    payload.provider = selectedProvider;
    return payload;
  }

  prepareEdgePayload(args = {}, providerUsed) {
    const payload = { ...(args || {}) };
    delete payload.provider;
    if (providerUsed && providerUsed !== 'auto') {
      payload.provider = providerUsed;
    }
    return payload;
  }

  async routeChat(provider, args, context) {
    try {
      return await this.callProvider(provider, args, context);
    } catch (primaryError) {
      if (this.fallbackProvider && this.fallbackProvider !== provider) {
        return await this.callProvider(this.fallbackProvider, args, context);
      }
      throw primaryError;
    }
  }

  async callProvider(provider, args, context) {
    const normalizedProvider = normalizeProvider(provider);
    this.assertAllowedProvider(normalizedProvider);

    switch (normalizedProvider) {
      case 'ollama':
        return {
          result: await this.callOllama(args, context),
          providerUsed: 'ollama'
        };
      case 'claude':
      case 'openai':
      case 'gemini':
        return this.callEdgeFunction(
          PROVIDER_EDGE_FUNCTION_MAP[normalizedProvider],
          args,
          context,
          normalizedProvider
        );
      case 'auto':
        return this.callAutoRoute(args, context);
      default:
        throw new Error(`Unsupported provider '${normalizedProvider}'`);
    }
  }

  async callAutoRoute(args, context) {
    try {
      return {
        result: await this.callOllama(args, context),
        providerUsed: 'ollama'
      };
    } catch (ollamaError) {
      const fallback = normalizeProvider(this.fallbackProvider || 'claude');
      const fallbackProvider = fallback === 'auto' ? 'claude' : fallback;
      this.assertAllowedProvider(fallbackProvider);
      const edgeFn = PROVIDER_EDGE_FUNCTION_MAP[fallbackProvider];
      if (!edgeFn) {
        throw new Error(`Unsupported fallback provider '${fallbackProvider}'`);
      }
      return this.callEdgeFunction(edgeFn, args, context, fallbackProvider);
    }
  }

  // ---------------------------------------------------------------------------
  // Ollama (local)
  // ---------------------------------------------------------------------------

  async callOllama(args, context) {
    const messages = [...(args.messages || [])];
    const sysPrompt = args.system_prompt || this.systemPrompt;
    if (sysPrompt && !messages.find((m) => m.role === 'system')) {
      messages.unshift({ role: 'system', content: sysPrompt });
    }

    return this.ollamaClient.request(
      { path: '/api/chat', method: 'POST' },
      {
        data: {
          model: args.model || this.ollamaModel,
          messages,
          stream: args.stream || false,
          options: { temperature: args.temperature ?? 0.7 }
        },
        headers: context.headers && typeof context.headers === 'object'
          ? { ...context.headers }
          : {}
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Supabase Edge Function (remote providers)
  // ---------------------------------------------------------------------------

  async callEdgeFunction(functionName, args, context, providerUsed = 'edge-functions') {
    this._initSupabaseClient();

    const headers = context.headers && typeof context.headers === 'object'
      ? { ...context.headers }
      : {};

    const payload = this.prepareEdgePayload(args, providerUsed);

    if (this.supabaseClient) {
      return {
        result: await this.supabaseClient.call(functionName, payload, { headers }),
        providerUsed
      };
    }

    // Fallback: proxy through the legacy BaseClient endpoint path
    return {
      result: await this._legacyRequest('POST', '/api/v1/ai/chat', payload, headers),
      providerUsed
    };
  }

  // ---------------------------------------------------------------------------
  // Embedding
  // ---------------------------------------------------------------------------

  async callEmbedding(args, context) {
    this._initSupabaseClient();

    const headers = context.headers && typeof context.headers === 'object'
      ? { ...context.headers }
      : {};

    if (this.supabaseClient) {
      return {
        result: await this.supabaseClient.call('generate-embedding', args, { headers }),
        providerUsed: 'edge-functions'
      };
    }

    return {
      result: await this._legacyRequest('POST', '/api/v1/ai/embedding', args, headers),
      providerUsed: 'ai-router'
    };
  }

  // ---------------------------------------------------------------------------
  // Service & model listing, health
  // ---------------------------------------------------------------------------

  listServices() {
    const services = [
      { id: 'ollama', name: 'Ollama (Local)', type: 'local', model: this.ollamaModel },
      { id: 'claude', name: 'Claude (Anthropic)', type: 'edge-function', edgeFunction: 'claude-ai' },
      { id: 'openai', name: 'OpenAI', type: 'edge-function', edgeFunction: 'openai-chat' },
      { id: 'gemini', name: 'Gemini (Google)', type: 'edge-function', edgeFunction: 'gemini-ai' }
    ];
    return {
      services,
      defaultProvider: this.defaultProvider,
      fallbackProvider: this.fallbackProvider || null
    };
  }

  async listModels(context) {
    const models = [];

    // Try to fetch Ollama models
    try {
      const ollamaModels = await this.ollamaClient.request(
        { path: '/api/tags', method: 'GET' },
        { headers: {} }
      );
      if (ollamaModels && ollamaModels.models) {
        for (const m of ollamaModels.models) {
          models.push({ provider: 'ollama', name: m.name, size: m.size });
        }
      }
    } catch {
      // Ollama unreachable — skip
    }

    // Add known edge function models (static config)
    models.push(
      { provider: 'claude', name: 'claude-sonnet-4-5-20250929', type: 'edge-function' },
      { provider: 'openai', name: 'gpt-4o', type: 'edge-function' },
      { provider: 'gemini', name: 'gemini-2.0-flash', type: 'edge-function' }
    );

    return { models, defaultModel: this.ollamaModel };
  }

  async checkHealth(context) {
    const results = {};

    // Ollama health
    try {
      await this.ollamaClient.request({ path: '/', method: 'GET' }, { headers: {} });
      results.ollama = { healthy: true };
    } catch (err) {
      results.ollama = { healthy: false, error: err.message };
    }

    // Supabase edge function health
    this._initSupabaseClient();
    if (this.supabaseClient) {
      try {
        const data = await this.supabaseClient.call('ai-health', {}, { method: 'GET' });
        results.edgeFunctions = { healthy: true, data };
      } catch (err) {
        results.edgeFunctions = { healthy: false, error: err.message };
      }
    } else {
      results.edgeFunctions = { healthy: false, error: 'Supabase client not configured' };
    }

    const anyHealthy = Object.values(results).some((r) => r.healthy);
    return { healthy: anyHealthy, providers: results };
  }

  // ---------------------------------------------------------------------------
  // Branding
  // ---------------------------------------------------------------------------

  brandResponse(result, provider, processingTimeMs) {
    if (!result || typeof result !== 'object') return result;
    return {
      ...result,
      onasis_metadata: {
        powered_by: 'Onasis-CORE',
        provider: 'onasis-ai',
        actual_provider: provider,
        processing_time_ms: processingTimeMs,
        timestamp: new Date().toISOString()
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Legacy fallback (single BaseClient path with endpoint fallback)
  // ---------------------------------------------------------------------------

  async _legacyRequest(method, primaryPath, data, headers) {
    const legacyPaths = {
      '/api/v1/ai/chat': ['/api/v1/ai/chat', '/api/v1/ai-chat'],
      '/api/v1/ai/embedding': ['/api/v1/ai/embedding']
    };

    const paths = legacyPaths[primaryPath] || [primaryPath];
    let lastError = null;

    for (let i = 0; i < paths.length; i++) {
      try {
        return await this.client.request(
          { path: paths[i], method },
          { data, headers }
        );
      } catch (error) {
        const status = error && error.response && error.response.status;
        if (i < paths.length - 1 && (status === 404 || status === 405)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Legacy request failed');
  }
}

module.exports = AIRouterAdapter;
