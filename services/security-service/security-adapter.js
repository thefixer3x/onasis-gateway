/**
 * Security Service Adapter
 * MCP adapter for security and compliance services
 * Based on the actual API key management endpoints from the monorepo
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

class SecurityAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    super({
      id: 'security-service',
      name: 'Security Service',
      description: 'API key management and security services',
      category: 'security',
      capabilities: ['api_key_management', 'token_validation', 'access_control', 'audit_logging'],
      client: new UniversalSupabaseClient({
        serviceName: 'security-service',
        functionName: 'security-service', // This will be overridden per call
        timeout: 30000
      }),
      ...config
    });
  }

  async initialize() {
    // Define the tools for the security service based on actual API endpoints
    this.tools = [
      {
        name: 'create-api-key',
        description: 'Create a new API key',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name for the API key' },
            description: { type: 'string', description: 'Description for the API key' },
            access_level: { type: 'string', enum: ['public', 'authenticated', 'team', 'admin', 'enterprise'], default: 'authenticated', description: 'Access level for the API key' },
            expires_in_days: { type: 'integer', default: 365, description: 'Days until expiration' },
            project_id: { type: 'string', format: 'uuid', description: 'Associated project ID' }
          },
          required: ['name']
        }
      },
      {
        name: 'delete-api-key',
        description: 'Delete an API key (hard delete)',
        inputSchema: {
          type: 'object',
          properties: {
            key_id: { type: 'string', format: 'uuid', description: 'ID of the API key to delete' }
          },
          required: ['key_id']
        }
      },
      {
        name: 'rotate-api-key',
        description: 'Rotate an API key (generate new key value)',
        inputSchema: {
          type: 'object',
          properties: {
            key_id: { type: 'string', format: 'uuid', description: 'ID of the API key to rotate' }
          },
          required: ['key_id']
        }
      },
      {
        name: 'revoke-api-key',
        description: 'Revoke an API key (soft delete)',
        inputSchema: {
          type: 'object',
          properties: {
            key_id: { type: 'string', format: 'uuid', description: 'ID of the API key to revoke' }
          },
          required: ['key_id']
        }
      },
      {
        name: 'list-api-keys',
        description: 'List all API keys for the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            active_only: { type: 'boolean', default: true, description: 'Only return active keys' },
            project_id: { type: 'string', format: 'uuid', description: 'Filter by project ID' }
          }
        }
      },
      {
        name: 'get-api-key',
        description: 'Get a specific API key',
        inputSchema: {
          type: 'object',
          properties: {
            key_id: { type: 'string', format: 'uuid', description: 'ID of the API key to retrieve' }
          },
          required: ['key_id']
        }
      },
      {
        name: 'verify-api-key',
        description: 'Verify an API key',
        inputSchema: {
          type: 'object',
          properties: {
            api_key: { type: 'string', description: 'API key to verify' }
          },
          required: ['api_key']
        }
      },
      {
        name: 'verify-token',
        description: 'Verify an authentication token',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Token to verify (optional, can be in header)' }
          }
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    
    try {
      // Map tool names to their dedicated Edge Functions based on actual API endpoints
      const functionMap = {
        'create-api-key': 'auth/api-keys',
        'delete-api-key': 'auth/api-keys/{key_id}',
        'rotate-api-key': 'auth/api-keys/{key_id}/rotate',
        'revoke-api-key': 'auth/api-keys/{key_id}/revoke',
        'list-api-keys': 'auth/api-keys',
        'get-api-key': 'auth/api-keys/{key_id}',
        'verify-api-key': 'auth/verify-api-key',
        'verify-token': 'auth/verify-token'
      };
      
      let functionName = functionMap[toolName];
      
      // Handle path parameters
      if (functionName && args.key_id) {
        functionName = functionName.replace('{key_id}', args.key_id);
      }
      
      // Determine the HTTP method based on the tool
      const methodMap = {
        'create-api-key': 'POST',
        'delete-api-key': 'DELETE',
        'rotate-api-key': 'POST',
        'revoke-api-key': 'POST',
        'list-api-keys': 'GET',
        'get-api-key': 'GET',
        'verify-api-key': 'POST',
        'verify-token': 'POST'
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

module.exports = SecurityAdapter;