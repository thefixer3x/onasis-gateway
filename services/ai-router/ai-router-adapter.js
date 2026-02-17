/**
 * AI Router Adapter
 * MCP adapter for AI service routing with backward-compatible endpoint fallbacks.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

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
        ? {
            type: 'bearer',
            config: {
              token: serviceToken
            }
          }
        : {}
    });

    super({
      id: 'ai-router',
      name: 'AI Router',
      description: 'AI model routing and orchestration service with provider interoperability',
      category: 'ai',
      capabilities: [
        'chat_completion',
        'provider_routing',
        'model_selection',
        'usage_tracking'
      ],
      callToolVersion: 'v2',
      client,
      ...config
    });
  }

  async initialize() {
    // Keep a compact public tool surface. Internal memory tools are intentionally not exposed.
    this.tools = [
      {
        name: 'ai-chat',
        description: 'Generate AI chat completions via the configured provider router',
        inputSchema: CHAT_SCHEMA
      },
      {
        // Backward-compatible alias for older direct tool callers.
        name: 'chat',
        description: 'Alias for ai-chat',
        inputSchema: CHAT_SCHEMA
      },
      {
        name: 'ollama',
        description: 'Direct Ollama chat',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'Ollama model to use' },
            messages: CHAT_SCHEMA.properties.messages,
            stream: {
              type: 'boolean',
              default: false,
              description: 'Whether to stream the response'
            }
          },
          required: ['model', 'messages']
        }
      },
      {
        name: 'list-ai-services',
        description: 'List available AI routing backends/providers',
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

  getEndpointConfig(toolName) {
    const configs = {
      'ai-chat': {
        method: 'POST',
        paths: ['/api/v1/ai/chat', '/api/v1/ai-chat', '/api/ai-chat']
      },
      chat: {
        method: 'POST',
        paths: ['/api/v1/ai/chat', '/api/v1/ai-chat', '/api/chat']
      },
      ollama: {
        method: 'POST',
        paths: ['/api/v1/ai/ollama', '/api/ollama']
      },
      'list-ai-services': {
        method: 'GET',
        paths: ['/api/v1/ai/services', '/ai-services']
      },
      'ai-health': {
        method: 'GET',
        paths: ['/api/v1/ai/health', '/ai-health']
      }
    };

    return configs[toolName] || null;
  }

  async callTool(toolName, args = {}, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      const endpointConfig = this.getEndpointConfig(toolName);
      if (!endpointConfig) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const requestData = {
        data: args,
        method: endpointConfig.method
      };

      if (context.headers && typeof context.headers === 'object') {
        requestData.headers = { ...context.headers };
      }

      let lastError = null;
      for (let i = 0; i < endpointConfig.paths.length; i++) {
        const path = endpointConfig.paths[i];
        try {
          return await this.client.request(
            { path, method: endpointConfig.method },
            requestData
          );
        } catch (error) {
          const status = error && error.response && error.response.status;
          const canTryLegacyFallback =
            i < endpointConfig.paths.length - 1 &&
            (status === 404 || status === 405);

          if (!canTryLegacyFallback) {
            throw error;
          }
          lastError = error;
        }
      }

      throw lastError || new Error(`Failed to execute tool '${toolName}'`);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = AIRouterAdapter;
