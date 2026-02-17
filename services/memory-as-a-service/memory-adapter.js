/**
 * Memory Service Adapter
 * MCP adapter for memory storage and retrieval using Supabase Edge Functions
 * Based on the actual Supabase API specification from the monorepo
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

class MemoryAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    super({
      id: 'memory-service',
      name: 'Memory as a Service',
      description: 'Semantic memory storage with vector embeddings for AI applications',
      category: 'ai_infrastructure',
      capabilities: ['storage', 'retrieval', 'semantic_search', 'vector_embeddings', 'bulk_operations', 'statistics'],
      client: new UniversalSupabaseClient({
        serviceName: 'memory-service',
        functionName: 'memory-service', // This will be overridden per call
        timeout: 30000
      }),
      ...config
    });
  }

  async initialize() {
    // Define the tools for the memory service based on actual Supabase API
    this.tools = [
      {
        name: 'create-memory',
        description: 'Create a new memory with vector embedding',
        inputSchema: {
          type: 'object',
          properties: {
            title: { 
              type: 'string', 
              minLength: 1, 
              maxLength: 255, 
              description: 'Title of the memory' 
            },
            content: { 
              type: 'string', 
              minLength: 1, 
              description: 'Content of the memory' 
            },
            type: { 
              type: 'string', 
              enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'], 
              description: 'Memory type (MCP-compatible field name)' 
            },
            memory_type: { 
              type: 'string', 
              enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'], 
              description: 'Memory type (preferred REST API field name)' 
            },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of tags for organization and filtering' 
            },
            metadata: { 
              type: 'object', 
              additionalProperties: true,
              description: 'Additional key-value metadata' 
            },
            topic_id: { 
              type: 'string', 
              format: 'uuid',
              description: 'Optional topic ID for grouping related memories' 
            }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'get-memory',
        description: 'Get a specific memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'UUID of the memory to retrieve' }
          },
          required: ['id']
        }
      },
      {
        name: 'update-memory',
        description: 'Update an existing memory',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'UUID of the memory to update' },
            title: { 
              type: 'string', 
              minLength: 1, 
              maxLength: 255, 
              description: 'Updated title' 
            },
            content: { 
              type: 'string', 
              minLength: 1, 
              description: 'Updated content' 
            },
            type: { 
              type: 'string', 
              enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'], 
              description: 'Memory type (MCP-compatible field name)' 
            },
            memory_type: { 
              type: 'string', 
              enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'], 
              description: 'Memory type (preferred REST API field name)' 
            },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Updated tags (replaces existing)' 
            },
            metadata: { 
              type: 'object', 
              additionalProperties: true,
              description: 'Updated metadata (merged with existing)' 
            }
          },
          required: ['id']
        }
      },
      {
        name: 'delete-memory',
        description: 'Delete a memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'UUID of the memory to delete' }
          },
          required: ['id']
        }
      },
      {
        name: 'list-memories',
        description: 'List memories with pagination and filters',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 100, 
              default: 20,
              description: 'Number of items to return' 
            },
            offset: { 
              type: 'integer', 
              minimum: 0, 
              default: 0,
              description: 'Offset for pagination' 
            },
            type: { 
              type: 'string', 
              enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'],
              description: 'Filter by memory type' 
            },
            tags: { 
              type: 'string', 
              description: 'Comma-separated list of tags to filter by' 
            },
            sortBy: { 
              type: 'string', 
              enum: ['created_at', 'updated_at', 'title'], 
              default: 'updated_at',
              description: 'Field to sort by' 
            },
            sortOrder: { 
              type: 'string', 
              enum: ['asc', 'desc'], 
              default: 'desc',
              description: 'Sort order' 
            }
          }
        }
      },
      {
        name: 'search-memories',
        description: 'Search memories using semantic vector search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Search query text' 
            },
            type: { 
              type: 'string', 
              enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'],
              description: 'Filter by memory type' 
            },
            threshold: { 
              type: 'number', 
              minimum: 0, 
              maximum: 1, 
              default: 0.8,
              description: 'Similarity threshold' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 100, 
              default: 10,
              description: 'Maximum number of results to return' 
            },
            tags: { 
              type: 'string', 
              description: 'Comma-separated list of tags to filter by' 
            }
          },
          required: ['query']
        }
      },
      {
        name: 'memory-stats',
        description: 'Get comprehensive statistics about memory usage',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'bulk-delete-memories',
        description: 'Delete multiple memories at once. Maximum 100 memories per request.',
        inputSchema: {
          type: 'object',
          properties: {
            ids: { 
              type: 'array', 
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
              maxItems: 100,
              description: 'Array of memory UUIDs to delete' 
            }
          },
          required: ['ids']
        }
      },
      {
        name: 'search-documentation',
        description: 'Search Lanonasis documentation',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Search query' 
            },
            section: { 
              type: 'string', 
              enum: ['all', 'api', 'guides', 'sdks'], 
              default: 'all',
              description: 'Section to search in' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 50, 
              default: 10,
              description: 'Maximum number of results to return' 
            }
          },
          required: ['query']
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    
    try {
      // Map tool names to their dedicated Edge Functions based on actual API
      const functionMap = {
        'create-memory': 'memory-create',
        'get-memory': 'memory-get',
        'update-memory': 'memory-update',
        'delete-memory': 'memory-delete',
        'list-memories': 'memory-list',
        'search-memories': 'memory-search',
        'memory-stats': 'memory-stats',
        'bulk-delete-memories': 'memory-bulk-delete',
        'search-documentation': 'memory-search'
      };
      
      let functionName = functionMap[toolName];
      
      // Handle path parameters
      if (functionName && args.id) {
        functionName = functionName.replace('{id}', args.id);
      }
      
      // Determine the HTTP method based on the tool
      const methodMap = {
        'create-memory': 'POST',
        'get-memory': 'GET',
        'update-memory': 'PUT',
        'delete-memory': 'DELETE',
        'list-memories': 'GET',
        'search-memories': 'POST',
        'memory-stats': 'GET',
        'bulk-delete-memories': 'POST',
        'search-documentation': 'POST'
      };
      
      const method = methodMap[toolName] || 'POST';
      
      // Make the call to the appropriate Supabase Edge Function
      const result = await this.client.call(functionName, args, {
        ...context,
        method: method
      });
      
      return result;
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = MemoryAdapter;