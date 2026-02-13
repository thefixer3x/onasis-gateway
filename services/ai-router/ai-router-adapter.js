/**
 * AI Router Adapter
 * MCP adapter for AI services and model routing
 * Based on the actual AI Service Router implementation from the monorepo
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

class AIRouterAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const aiRouterUrl = process.env.AI_ROUTER_URL || 'http://127.0.0.1:3001';
    
    super({
      id: 'ai-router',
      name: 'AI Router',
      description: 'AI model routing and orchestration service with memory integration',
      category: 'ai',
      capabilities: ['chat_completion', 'memory_integration', 'tool_execution', 'model_selection', 'usage_tracking'],
      client: new BaseClient({
        name: 'ai-router',
        baseUrl: aiRouterUrl,
        timeout: 60000, // AI requests can take longer
        authentication: {
          type: 'bearer',
          config: {
            token: process.env.AI_ROUTER_API_KEY || process.env.OPENAI_API_KEY
          }
        }
      }),
      ...config
    });
  }

  async initialize() {
    // Define the tools for the AI router based on actual implementation
    this.tools = [
      {
        name: 'ai-chat',
        description: 'Generate chat completions using AI models with memory integration',
        inputSchema: {
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
        }
      },
      {
        name: 'chat',
        description: 'Ollama AI chat with memory tools',
        inputSchema: {
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
            model: {
              type: 'string',
              default: 'qwen2:1.5b',
              description: 'Ollama model to use'
            }
          },
          required: ['messages']
        }
      },
      {
        name: 'ollama',
        description: 'Direct Ollama chat',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'Ollama model to use'
            },
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
        name: 'memory-search',
        description: 'Search memories using semantic vector search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query text' },
            topK: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 50,
              default: 8,
              description: 'Number of results to return' 
            },
            memory_type: { 
              type: 'string', 
              description: 'Filter by memory type' 
            },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Filter by tags' 
            }
          },
          required: ['query']
        }
      },
      {
        name: 'memory-get',
        description: 'Fetch one or more memories by id',
        inputSchema: {
          type: 'object',
          properties: {
            ids: { 
              type: 'array', 
              items: { type: 'string' },
              minItems: 1,
              description: 'Memory IDs to fetch' 
            }
          },
          required: ['ids']
        }
      },
      {
        name: 'memory-write',
        description: 'Create a memory entry',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Memory title' },
            content: { type: 'string', description: 'Memory content' },
            memory_type: { type: 'string', description: 'Memory type' },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Memory tags' 
            },
            metadata: { 
              type: 'object', 
              description: 'Additional metadata' 
            }
          },
          required: ['content']
        }
      },
      {
        name: 'list-ai-services',
        description: 'List available AI services',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'ai-health',
        description: 'Check health of AI services',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    
    try {
      // Map tool names to their corresponding endpoints based on actual implementation
      const endpointMap = {
        'ai-chat': '/api/ai-chat',
        'chat': '/api/chat',
        'ollama': '/api/ollama',
        'memory-search': '/api/memory/search', // This would be handled internally by the AI router
        'memory-get': '/api/memory/get',       // This would be handled internally by the AI router
        'memory-write': '/api/memory/write',   // This would be handled internally by the AI router
        'list-ai-services': '/ai-services',
        'ai-health': '/ai-health'
      };

      const methodMap = {
        'ai-chat': 'POST',
        'chat': 'POST',
        'ollama': 'POST',
        'memory-search': 'POST',
        'memory-get': 'POST',
        'memory-write': 'POST',
        'list-ai-services': 'GET',
        'ai-health': 'GET'
      };

      // Special handling for memory tools - these are actually called internally by the AI router
      // when the AI decides to use them as tools, not directly via API
      if (['memory-search', 'memory-get', 'memory-write'].includes(toolName)) {
        // These tools are meant to be used as AI tools, not direct API calls
        // The AI router handles these internally when the AI model decides to call them
        throw new Error(`Tool '${toolName}' is an internal AI tool and cannot be called directly. Use 'ai-chat' instead.`);
      }

      const endpoint = endpointMap[toolName];
      const method = methodMap[toolName] || 'POST';
      
      if (!endpoint) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Prepare the request data
      const requestData = {
        data: args,
        method: method
      };

      // Add auth context if available
      if (context.headers) {
        requestData.headers = { ...context.headers };
      }

      // Make the API call to the AI router
      const result = await this.client.request({
        path: endpoint,
        method: method
      }, requestData);

      return result;
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = AIRouterAdapter;