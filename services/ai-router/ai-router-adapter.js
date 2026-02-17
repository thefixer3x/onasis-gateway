/**
 * AI Router Adapter
 *
 * Multi-provider AI routing with Onasis branding. Routes chat requests to
 * Ollama (local) or Supabase Edge Functions (Claude, OpenAI, Gemini, etc.)
 * based on env-configurable provider selection with automatic fallback.
 *
 * Provider precedence:
 *   1. Per-request `provider` field (explicit override)
 *   2. AI_DEFAULT_PROVIDER env var (default: 'auto')
 *   3. 'auto' mode: Ollama first, then AI_FALLBACK_PROVIDER edge function
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
    this.defaultProvider = config.defaultProvider || process.env.AI_DEFAULT_PROVIDER || 'auto';
    this.fallbackProvider = config.fallbackProvider || process.env.AI_FALLBACK_PROVIDER || '';
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

      switch (toolName) {
        case 'ai-chat':
        case 'chat': {
          const provider = args.provider || this.defaultProvider;
          result = await this.routeChat(provider, args, context);
          break;
        }
        case 'ollama':
          result = await this.callOllama(args, context);
          break;
        case 'embedding':
          result = await this.callEmbedding(args, context);
          break;
        case 'list-ai-services':
          result = this.listServices();
          break;
        case 'list-models':
          result = await this.listModels(context);
          break;
        case 'ai-health':
          result = await this.checkHealth(context);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return this.brandResponse(result, args.provider || this.defaultProvider, Date.now() - start);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Provider routing
  // ---------------------------------------------------------------------------

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
    switch (provider) {
      case 'ollama':
        return this.callOllama(args, context);
      case 'claude':
      case 'openai':
      case 'gemini':
        return this.callEdgeFunction(
          PROVIDER_EDGE_FUNCTION_MAP[provider],
          args,
          context
        );
      case 'auto':
        return this.callAutoRoute(args, context);
      default:
        // Treat unknown provider name as an edge function slug
        return this.callEdgeFunction(provider, args, context);
    }
  }

  async callAutoRoute(args, context) {
    try {
      return await this.callOllama(args, context);
    } catch (ollamaError) {
      const fallback = this.fallbackProvider || 'claude';
      const edgeFn = PROVIDER_EDGE_FUNCTION_MAP[fallback] || fallback;
      return this.callEdgeFunction(edgeFn, args, context);
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

  async callEdgeFunction(functionName, args, context) {
    this._initSupabaseClient();

    const headers = context.headers && typeof context.headers === 'object'
      ? { ...context.headers }
      : {};

    if (this.supabaseClient) {
      return this.supabaseClient.call(functionName, args, { headers });
    }

    // Fallback: proxy through the legacy BaseClient endpoint path
    return this._legacyRequest('POST', '/api/v1/ai/chat', args, headers);
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
      return this.supabaseClient.call('generate-embedding', args, { headers });
    }

    return this._legacyRequest('POST', '/api/v1/ai/embedding', args, headers);
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
