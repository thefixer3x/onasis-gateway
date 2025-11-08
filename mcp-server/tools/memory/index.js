#!/usr/bin/env node

/**
 * Memory as a Service MCP Tools
 * Provides MCP tool definitions for Memory service integration
 */

const MemoryServiceClient = require('../../services/memory-as-a-service/client');

class MemoryMCPTools {
  constructor() {
    this.client = new MemoryServiceClient({
      baseUrl: process.env.MEMORY_API_URL || 'https://api.lanonasis.com',
      apiKey: process.env.MEMORY_API_KEY
    });
    
    this.toolPrefix = 'memory_';
  }

  /**
   * Get all Memory MCP tool definitions
   */
  getToolDefinitions() {
    return {
      // Memory management tools
      [`${this.toolPrefix}create_memory`]: {
        description: 'Create a new memory entry with title, content, and metadata',
        inputSchema: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: {
              type: 'string',
              description: 'Memory title (max 500 characters)',
              maxLength: 500
            },
            content: {
              type: 'string',
              description: 'Memory content (max 50,000 characters)',
              maxLength: 50000
            },
            memory_type: {
              type: 'string',
              enum: ['conversation', 'knowledge', 'project', 'context', 'reference'],
              default: 'context',
              description: 'Type of memory entry'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 20,
              description: 'Tags for organizing memories'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata for the memory'
            }
          }
        }
      },

      [`${this.toolPrefix}search_memories`]: {
        description: 'Search memories using semantic search with customizable parameters',
        inputSchema: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              description: 'Search query for semantic search',
              maxLength: 1000
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum number of results to return'
            },
            threshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              default: 0.7,
              description: 'Similarity threshold for search results'
            },
            memory_types: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['conversation', 'knowledge', 'project', 'context', 'reference']
              },
              description: 'Filter by specific memory types'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by specific tags'
            }
          }
        }
      },

      [`${this.toolPrefix}get_memory`]: {
        description: 'Retrieve a specific memory by its ID',
        inputSchema: {
          type: 'object',
          required: ['memory_id'],
          properties: {
            memory_id: {
              type: 'string',
              description: 'Unique identifier of the memory to retrieve'
            }
          }
        }
      },

      [`${this.toolPrefix}update_memory`]: {
        description: 'Update an existing memory with new information',
        inputSchema: {
          type: 'object',
          required: ['memory_id'],
          properties: {
            memory_id: {
              type: 'string',
              description: 'Unique identifier of the memory to update'
            },
            title: {
              type: 'string',
              maxLength: 500,
              description: 'Updated memory title'
            },
            content: {
              type: 'string',
              maxLength: 50000,
              description: 'Updated memory content'
            },
            memory_type: {
              type: 'string',
              enum: ['conversation', 'knowledge', 'project', 'context', 'reference'],
              description: 'Updated memory type'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 20,
              description: 'Updated tags'
            },
            metadata: {
              type: 'object',
              description: 'Updated metadata'
            }
          }
        }
      },

      [`${this.toolPrefix}delete_memory`]: {
        description: 'Delete a memory entry permanently',
        inputSchema: {
          type: 'object',
          required: ['memory_id'],
          properties: {
            memory_id: {
              type: 'string',
              description: 'Unique identifier of the memory to delete'
            }
          }
        }
      },

      [`${this.toolPrefix}list_memories`]: {
        description: 'List memories with pagination and filtering options',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number for pagination'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Number of memories per page'
            },
            memory_type: {
              type: 'string',
              enum: ['conversation', 'knowledge', 'project', 'context', 'reference'],
              description: 'Filter by memory type'
            },
            tags: {
              type: 'string',
              description: 'Comma-separated tags to filter by'
            },
            sort: {
              type: 'string',
              enum: ['created_at', 'updated_at', 'title', 'access_count'],
              default: 'updated_at',
              description: 'Field to sort by'
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Sort order'
            }
          }
        }
      },

      // Topic management tools
      [`${this.toolPrefix}create_topic`]: {
        description: 'Create a new memory topic for organization',
        inputSchema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              maxLength: 100,
              description: 'Topic name'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Topic description'
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              description: 'Hex color code for the topic'
            },
            icon: {
              type: 'string',
              maxLength: 50,
              description: 'Icon identifier for the topic'
            },
            parent_topic_id: {
              type: 'string',
              description: 'Parent topic ID for hierarchical organization'
            }
          }
        }
      },

      [`${this.toolPrefix}get_topics`]: {
        description: 'Retrieve all memory topics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },

      // Analytics and statistics tools
      [`${this.toolPrefix}get_memory_stats`]: {
        description: 'Get comprehensive memory statistics and analytics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },

      // Bulk operations tools
      [`${this.toolPrefix}bulk_delete_memories`]: {
        description: 'Delete multiple memories at once (Pro/Enterprise feature)',
        inputSchema: {
          type: 'object',
          required: ['memory_ids'],
          properties: {
            memory_ids: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 100,
              description: 'Array of memory IDs to delete'
            }
          }
        }
      },

      // Health and connectivity tools
      [`${this.toolPrefix}health_check`]: {
        description: 'Check the health status of the Memory service',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },

      [`${this.toolPrefix}test_connection`]: {
        description: 'Test connection and authentication with Memory service',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    };
  }

  /**
   * Execute MCP tool calls
   */
  async executeTool(toolName, args) {
    const tool = toolName.replace(this.toolPrefix, '');
    
    try {
      switch (tool) {
        case 'create_memory':
          return await this.createMemory(args);
        
        case 'search_memories':
          return await this.searchMemories(args);
        
        case 'get_memory':
          return await this.getMemory(args);
        
        case 'update_memory':
          return await this.updateMemory(args);
        
        case 'delete_memory':
          return await this.deleteMemory(args);
        
        case 'list_memories':
          return await this.listMemories(args);
        
        case 'create_topic':
          return await this.createTopic(args);
        
        case 'get_topics':
          return await this.getTopics(args);
        
        case 'get_memory_stats':
          return await this.getMemoryStats(args);
        
        case 'bulk_delete_memories':
          return await this.bulkDeleteMemories(args);
        
        case 'health_check':
          return await this.healthCheck(args);
        
        case 'test_connection':
          return await this.testConnection(args);
        
        default:
          return {
            success: false,
            error: `Unknown Memory tool: ${toolName}`,
            tool: toolName
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: toolName,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Tool implementation methods
   */
  async createMemory(args) {
    const result = await this.client.createMemory(args);
    return {
      success: true,
      data: result,
      message: 'Memory created successfully',
      tool: 'memory_create_memory'
    };
  }

  async searchMemories(args) {
    const result = await this.client.searchMemories(args);
    return {
      success: true,
      data: result,
      message: `Found ${result.results?.length || 0} memories`,
      tool: 'memory_search_memories'
    };
  }

  async getMemory(args) {
    const result = await this.client.getMemory(args.memory_id);
    return {
      success: true,
      data: result,
      message: 'Memory retrieved successfully',
      tool: 'memory_get_memory'
    };
  }

  async updateMemory(args) {
    const { memory_id, ...updateData } = args;
    const result = await this.client.updateMemory(memory_id, updateData);
    return {
      success: true,
      data: result,
      message: 'Memory updated successfully',
      tool: 'memory_update_memory'
    };
  }

  async deleteMemory(args) {
    const result = await this.client.deleteMemory(args.memory_id);
    return {
      success: true,
      data: result,
      message: 'Memory deleted successfully',
      tool: 'memory_delete_memory'
    };
  }

  async listMemories(args) {
    const result = await this.client.listMemories(args);
    return {
      success: true,
      data: result,
      message: `Retrieved ${result.data?.length || 0} memories`,
      tool: 'memory_list_memories'
    };
  }

  async createTopic(args) {
    const result = await this.client.createTopic(args);
    return {
      success: true,
      data: result,
      message: 'Topic created successfully',
      tool: 'memory_create_topic'
    };
  }

  async getTopics(args) {
    const result = await this.client.getTopics();
    return {
      success: true,
      data: result,
      message: `Retrieved ${result?.length || 0} topics`,
      tool: 'memory_get_topics'
    };
  }

  async getMemoryStats(args) {
    const result = await this.client.getMemoryStats();
    return {
      success: true,
      data: result,
      message: 'Memory statistics retrieved successfully',
      tool: 'memory_get_memory_stats'
    };
  }

  async bulkDeleteMemories(args) {
    const result = await this.client.bulkDeleteMemories(args.memory_ids);
    return {
      success: true,
      data: result,
      message: `Bulk deleted ${result.deleted_count} memories`,
      tool: 'memory_bulk_delete_memories'
    };
  }

  async healthCheck(args) {
    const result = await this.client.healthCheck();
    return {
      success: true,
      data: result,
      message: `Memory service is ${result.status}`,
      tool: 'memory_health_check'
    };
  }

  async testConnection(args) {
    const result = await this.client.testConnection();
    return {
      success: result.success,
      data: result,
      message: result.message,
      tool: 'memory_test_connection'
    };
  }
}

module.exports = MemoryMCPTools;