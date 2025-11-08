import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Mock adapters data for initial deployment
const mockAdapters = [
  { name: 'stripe-api', tools: 457, description: 'Stripe payment processing', category: 'payment', authType: 'Bearer' },
  { name: 'ngrok-api', tools: 217, description: 'ngrok tunneling service', category: 'networking', authType: 'Bearer' },
  { name: 'shutterstock-api', tools: 109, description: 'Shutterstock media API', category: 'media', authType: 'Bearer' },
  { name: 'bap-api', tools: 92, description: 'BAP payment services', category: 'payment', authType: 'API_Key' },
  { name: 'hostinger-api', tools: 85, description: 'Hostinger VPS management', category: 'hosting', authType: 'Bearer' },
  { name: 'wise-mca-api', tools: 78, description: 'Wise multicurrency account', category: 'financial', authType: 'Bearer' },
  { name: 'google-analytics-api', tools: 88, description: 'Google Analytics reporting', category: 'analytics', authType: 'OAuth2' }
];

// Authentication interfaces
interface AuthContext {
  keyId?: string;
  userId?: string;
  projectId?: string;
  permissions?: any;
  rateLimit?: number;
  authType: 'api_key' | 'jwt' | 'none';
}

// Validate API key
async function validateApiKey(apiKey: string): Promise<AuthContext | null> {
  if (!apiKey.startsWith('onasis_')) return null;
  
  const keyId = apiKey.split('_')[1];
  
  try {
    const { data, error } = await supabase
      .rpc('validate_api_key', { key_input: apiKey })
      .single();
      
    if (error || !data) return null;
    
    return {
      keyId: data.key_id,
      userId: data.user_id,
      projectId: data.project_id,
      permissions: data.permissions,
      rateLimit: data.rate_limit_per_hour,
      authType: 'api_key'
    };
  } catch (error) {
    console.error('API key validation failed:', error);
    return null;
  }
}

// Generate request ID
function generateRequestId(): string {
  return 'req_' + crypto.randomBytes(16).toString('hex');
}

// Log request
async function logRequest(requestData: any) {
  try {
    await supabase
      .from('audit.request_logs')
      .insert(requestData);
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}

// Check rate limit
async function checkRateLimit(apiKeyId: string, adapterName?: string): Promise<boolean> {
  if (!apiKeyId) return true; // Skip for unauthenticated requests
  
  try {
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0); // Start of current hour
    
    const { data, error } = await supabase
      .from('audit.rate_limits')
      .select('request_count')
      .eq('api_key_id', apiKeyId)
      .eq('adapter_name', adapterName || 'general')
      .eq('window_start', windowStart.toISOString())
      .single();
      
    const currentCount = data?.request_count || 0;
    const limit = 100; // Default limit
    
    return currentCount < limit;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Allow on error
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Security headers
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://saas-vortexcore-app.netlify.app',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gateway-Key, X-User-ID, X-Signature',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'X-Request-ID': requestId
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  // Extract path from the event
  const path = event.path.replace('/.netlify/functions/mcp-server', '') || '/';
  const method = event.httpMethod;
  const userAgent = event.headers['user-agent'] || '';
  const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
  
  // Authentication
  let authContext: AuthContext = { authType: 'none' };
  const authHeader = event.headers.authorization;
  const gatewayKey = event.headers['x-gateway-key'];
  
  if (gatewayKey) {
    authContext = await validateApiKey(gatewayKey) || { authType: 'none' };
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('onasis_')) {
      authContext = await validateApiKey(token) || { authType: 'none' };
    }
  }
  
  try {
    // Health endpoint
    if (path === '/health' || path === '/') {
      const responseTime = Date.now() - startTime;
      
      // Log health check
      await logRequest({
        request_id: requestId,
        user_id: authContext.userId,
        api_key_id: authContext.keyId,
        project_id: authContext.projectId,
        adapter_name: 'system',
        tool_name: 'health',
        method,
        endpoint: path,
        request_headers: event.headers,
        request_body: event.body ? JSON.parse(event.body) : null,
        response_status: 200,
        response_headers: headers,
        response_body: { status: 'healthy' },
        response_time_ms: responseTime,
        ip_address: ipAddress,
        user_agent: userAgent
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          adapters: mockAdapters.length,
          environment: 'netlify',
          version: '1.0.0',
          deployment: 'windsurf-ide',
          requestId,
          authenticated: authContext.authType !== 'none',
          projectId: authContext.projectId
        })
      };
    }
    
    // List adapters
    if (path === '/adapters') {
      // Check rate limit
      if (authContext.keyId && !(await checkRateLimit(authContext.keyId))) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded',
              requestId
            }
          })
        };
      }
      
      const responseTime = Date.now() - startTime;
      const responseBody = {
        adapters: mockAdapters,
        total: mockAdapters.length,
        timestamp: new Date().toISOString(),
        requestId,
        authenticated: authContext.authType !== 'none'
      };
      
      // Log request
      await logRequest({
        request_id: requestId,
        user_id: authContext.userId,
        api_key_id: authContext.keyId,
        project_id: authContext.projectId,
        adapter_name: 'system',
        tool_name: 'list-adapters',
        method,
        endpoint: path,
        request_headers: event.headers,
        request_body: event.body ? JSON.parse(event.body) : null,
        response_status: 200,
        response_headers: headers,
        response_body: responseBody,
        response_time_ms: responseTime,
        ip_address: ipAddress,
        user_agent: userAgent
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseBody)
      };
    }
    
    // Get specific adapter
    if (path.startsWith('/adapters/')) {
      const adapterName = path.split('/')[2];
      const adapter = mockAdapters.find(a => a.name === adapterName);
      
      if (!adapter) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Adapter not found' })
        };
      }
      
      const responseTime = Date.now() - startTime;
      const responseBody = {
        adapter: adapter.name,
        tools: adapter.tools,
        description: adapter.description,
        category: adapter.category,
        authType: adapter.authType,
        status: 'active',
        requestId
      };
      
      // Log request
      await logRequest({
        request_id: requestId,
        user_id: authContext.userId,
        api_key_id: authContext.keyId,
        project_id: authContext.projectId,
        adapter_name: adapterName,
        tool_name: 'get-adapter',
        method,
        endpoint: path,
        request_headers: event.headers,
        request_body: event.body ? JSON.parse(event.body) : null,
        response_status: 200,
        response_headers: headers,
        response_body: responseBody,
        response_time_ms: responseTime,
        ip_address: ipAddress,
        user_agent: userAgent
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseBody)
      };
    }
    
    // Execute tool
    if (path.startsWith('/execute/') && method === 'POST') {
      // Require authentication for tool execution
      if (authContext.authType === 'none') {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for tool execution',
              requestId
            }
          })
        };
      }
      
      const pathParts = path.split('/');
      const adapterName = pathParts[2];
      const toolName = pathParts[3];
      
      const adapter = mockAdapters.find(a => a.name === adapterName);
      if (!adapter) {
        const responseTime = Date.now() - startTime;
        
        await logRequest({
          request_id: requestId,
          user_id: authContext.userId,
          api_key_id: authContext.keyId,
          project_id: authContext.projectId,
          adapter_name: adapterName,
          tool_name: toolName,
          method,
          endpoint: path,
          request_headers: event.headers,
          request_body: event.body ? JSON.parse(event.body) : null,
          response_status: 404,
          response_headers: headers,
          response_body: { error: 'Adapter not found' },
          response_time_ms: responseTime,
          ip_address: ipAddress,
          user_agent: userAgent,
          error_message: 'Adapter not found',
          error_code: 'ADAPTER_NOT_FOUND'
        });
        
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: {
              code: 'ADAPTER_NOT_FOUND',
              message: 'Adapter not found',
              adapter: adapterName,
              available_adapters: mockAdapters.map(a => a.name),
              requestId
            }
          })
        };
      }
      
      // Check rate limit
      if (authContext.keyId && !(await checkRateLimit(authContext.keyId, adapterName))) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded for this adapter',
              adapter: adapterName,
              requestId
            }
          })
        };
      }
      
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const responseTime = Date.now() - startTime;
      
      // Mock tool execution (replace with actual implementation)
      const mockOutput = {
        message: `Tool '${toolName}' executed successfully on '${adapterName}' adapter`,
        timestamp: new Date().toISOString(),
        adapter: adapterName,
        tool: toolName,
        parameters: requestBody.parameters || {},
        metadata: requestBody.metadata || {},
        execution_time_ms: responseTime,
        status: 'success'
      };
      
      const responseBody = {
        requestId,
        adapter: adapterName,
        tool: toolName,
        input: requestBody,
        output: mockOutput,
        status: 'completed',
        timestamp: new Date().toISOString()
      };
      
      // Log successful execution
      await logRequest({
        request_id: requestId,
        user_id: authContext.userId,
        api_key_id: authContext.keyId,
        project_id: authContext.projectId,
        adapter_name: adapterName,
        tool_name: toolName,
        method,
        endpoint: path,
        request_headers: event.headers,
        request_body: requestBody,
        response_status: 200,
        response_headers: headers,
        response_body: responseBody,
        response_time_ms: responseTime,
        ip_address: ipAddress,
        user_agent: userAgent
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseBody)
      };
    }
    
    // API root
    if (path === '/api' || path === '/api/') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          name: 'MCP Server API',
          version: '1.0.0',
          description: 'API Integration Baseline with 17 adapters and 1,596 tools',
          deployment: 'netlify-windsurf',
          endpoints: {
            health: '/health',
            adapters: '/api/adapters',
            execute: '/api/execute/{adapter}/{tool}'
          },
          adapters: mockAdapters.length,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 404 for unknown routes
    const responseTime = Date.now() - startTime;
    
    await logRequest({
      request_id: requestId,
      user_id: authContext.userId,
      api_key_id: authContext.keyId,
      project_id: authContext.projectId,
      adapter_name: 'system',
      tool_name: 'unknown-endpoint',
      method,
      endpoint: path,
      request_headers: event.headers,
      request_body: event.body ? JSON.parse(event.body) : null,
      response_status: 404,
      response_headers: headers,
      response_body: { error: 'Not found' },
      response_time_ms: responseTime,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: 'Endpoint not found',
      error_code: 'ENDPOINT_NOT_FOUND'
    });
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: 'Endpoint not found',
          path: path,
          requestId,
          available_endpoints: [
            'GET /health',
            'GET /adapters',
            'GET /adapters/{name}',
            'POST /execute/{adapter}/{tool}'
          ]
        }
      })
    };
    
  } catch (error) {
    console.error('API Error:', error);
    const responseTime = Date.now() - startTime;
    
    // Log error
    try {
      await logRequest({
        request_id: requestId,
        user_id: authContext?.userId,
        api_key_id: authContext?.keyId,
        project_id: authContext?.projectId,
        adapter_name: 'system',
        tool_name: 'error',
        method,
        endpoint: path,
        request_headers: event.headers,
        request_body: event.body ? JSON.parse(event.body) : null,
        response_status: 500,
        response_headers: headers,
        response_body: { error: 'Internal server error' },
        response_time_ms: responseTime,
        ip_address: ipAddress,
        user_agent: userAgent,
        error_message: error.message,
        error_code: 'INTERNAL_SERVER_ERROR'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          requestId,
          timestamp: new Date().toISOString()
        }
      })
    };
  }
};
