/**
 * Auth Gateway Adapter
 * MCP adapter for the centralized authentication service at auth.lanonasis.com
 * Based on the actual implementation in the monorepo
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

class AuthGatewayAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const authGatewayUrlRaw = process.env.AUTH_GATEWAY_URL 
      || process.env.ONASIS_AUTH_API_URL 
      || 'https://auth.lanonasis.com';
    const authGatewayUrl = authGatewayUrlRaw
      .replace(/\/+$/, '')
      .replace(/\/v1\/auth$/i, '')
      .replace(/\/v1$/i, '');
    
    super({
      id: 'auth-gateway',
      name: 'Auth Gateway',
      description: 'Centralized authentication and authorization service',
      category: 'auth',
      capabilities: ['authentication', 'authorization', 'api_key_management', 'session_management', 'oauth', 'magic_link'],
      client: new BaseClient({
        name: 'auth-gateway',
        baseUrl: authGatewayUrl,
        timeout: 10000,
        authentication: {
          type: 'bearer',
          config: {
            token: process.env.AUTH_GATEWAY_API_KEY || process.env.AUTH_API_KEY
          }
        }
      }),
      ...config
    });
  }

  async initialize() {
    // Define the tools for the auth gateway based on actual endpoints
    this.tools = [
      {
        name: 'login',
        description: 'Password-based login',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', description: 'User email' },
            password: { type: 'string', description: 'User password' },
            project_scope: { type: 'string', description: 'Project scope for the session' },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web', description: 'Platform requesting authentication' },
            return_to: { type: 'string', description: 'URL to redirect to after login' }
          },
          required: ['email', 'password']
        }
      },
      {
        name: 'exchange-supabase-token',
        description: 'Exchange Supabase JWT for auth-gateway tokens',
        inputSchema: {
          type: 'object',
          properties: {
            project_scope: { type: 'string', description: 'Project scope for the session' },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web', description: 'Platform requesting authentication' }
          }
        }
      },
      {
        name: 'logout',
        description: 'Revoke current session',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get-session',
        description: 'Get current session info',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'verify-token',
        description: 'Verify a token and return payload',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Token to verify (optional, can be in header)' }
          }
        }
      },
      {
        name: 'list-sessions',
        description: 'Get all active sessions for current user',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'initiate-oauth',
        description: 'Initiate OAuth provider login',
        inputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: ['google', 'github', 'linkedin_oidc', 'discord', 'apple'], description: 'OAuth provider' },
            redirect_uri: { type: 'string', format: 'uri', description: 'URI to redirect after authentication' },
            project_scope: { type: 'string', description: 'Project scope for the session' },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web', description: 'Platform requesting authentication' }
          },
          required: ['provider', 'redirect_uri']
        }
      },
      {
        name: 'request-magic-link',
        description: 'Send a magic link email for passwordless sign-in',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', description: 'User email' },
            redirect_uri: { type: 'string', format: 'uri', description: 'URI to redirect after authentication' },
            project_scope: { type: 'string', description: 'Project scope for the session' },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web', description: 'Platform requesting authentication' },
            create_user: { type: 'boolean', default: false, description: 'Whether to create user if doesn\'t exist' }
          },
          required: ['email']
        }
      },
      {
        name: 'get-me',
        description: 'Get current user profile from auth gateway (works for JWT, API key, and OAuth PKCE sessions)',
        inputSchema: {
          type: 'object',
          properties: {}
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
        name: 'delete-api-key',
        description: 'Delete an API key (hard delete)',
        inputSchema: {
          type: 'object',
          properties: {
            key_id: { type: 'string', format: 'uuid', description: 'ID of the API key to delete' }
          },
          required: ['key_id']
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
        'login': '/v1/auth/login',
        'exchange-supabase-token': '/v1/auth/token/exchange',
        'logout': '/v1/auth/logout',
        'get-me': '/v1/auth/me',
        'get-session': '/v1/auth/session',
        'verify-token': '/v1/auth/verify-token', // CLI-friendly endpoint
        'list-sessions': '/v1/auth/sessions',
        'initiate-oauth': '/v1/auth/oauth',
        'request-magic-link': '/v1/auth/magic-link',
        'verify-api-key': '/v1/auth/verify-api-key',
        'create-api-key': '/v1/auth/api-keys',
        'list-api-keys': '/v1/auth/api-keys',
        'get-api-key': (args.key_id) ? `/v1/auth/api-keys/${args.key_id}` : '/v1/auth/api-keys',
        'rotate-api-key': (args.key_id) ? `/v1/auth/api-keys/${args.key_id}/rotate` : '/v1/auth/api-keys/rotate',
        'revoke-api-key': (args.key_id) ? `/v1/auth/api-keys/${args.key_id}/revoke` : '/v1/auth/api-keys/revoke',
        'delete-api-key': (args.key_id) ? `/v1/auth/api-keys/${args.key_id}` : '/v1/auth/api-keys'
      };

      const methodMap = {
        'login': 'POST',
        'exchange-supabase-token': 'POST',
        'logout': 'POST',
        'get-me': 'GET',
        'get-session': 'GET',
        'verify-token': 'POST',
        'list-sessions': 'GET',
        'initiate-oauth': 'GET',
        'request-magic-link': 'POST',
        'verify-api-key': 'POST',
        'create-api-key': 'POST',
        'list-api-keys': 'GET',
        'get-api-key': 'GET',
        'rotate-api-key': 'POST',
        'revoke-api-key': 'POST',
        'delete-api-key': 'DELETE'
      };

      const endpoint = endpointMap[toolName];
      const method = methodMap[toolName] || 'POST';
      
      if (!endpoint) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Prepare the request data based on the tool
      let requestData = { method: method };
      
      if (method === 'GET') {
        // For GET requests, use query parameters
        requestData.params = args;
      } else {
        // For POST/PUT/DELETE requests, use request body
        requestData.data = args;
        
        // Special handling for verify-token which expects token in body
        if (toolName === 'verify-token' && args.token) {
          requestData.data = { token: args.token };
        }
      }

      // Add auth context if available
      if (context.headers) {
        requestData.headers = { ...context.headers };
      }

      // Make the API call to the auth gateway
      const result = await this.client.request({
        path: endpoint
      }, requestData);

      return result;
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = AuthGatewayAdapter;
