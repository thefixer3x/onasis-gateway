import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Mock adapters data for initial deployment
const mockAdapters = [
  { name: 'stripe-api', tools: 457, description: 'Stripe payment processing' },
  { name: 'ngrok-api', tools: 217, description: 'ngrok tunneling service' },
  { name: 'shutterstock-api', tools: 109, description: 'Shutterstock media API' },
  { name: 'bap-api', tools: 92, description: 'BAP payment services' },
  { name: 'hostinger-api', tools: 85, description: 'Hostinger VPS management' },
  { name: 'wise-mca-api', tools: 78, description: 'Wise multicurrency account' },
  { name: 'google-analytics-api', tools: 88, description: 'Google Analytics reporting' }
];

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  // Extract path from the event
  const path = event.path.replace('/.netlify/functions/mcp-server', '') || '/';
  
  try {
    // Health endpoint
    if (path === '/health' || path === '/') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          adapters: mockAdapters.length,
          environment: 'netlify',
          version: '1.0.0',
          deployment: 'windsurf-ide'
        })
      };
    }
    
    // List adapters
    if (path === '/adapters') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          adapters: mockAdapters,
          total: mockAdapters.length,
          timestamp: new Date().toISOString()
        })
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
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          adapter: adapter.name,
          tools: adapter.tools,
          description: adapter.description,
          status: 'active'
        })
      };
    }
    
    // Execute tool
    if (path.startsWith('/execute/') && event.httpMethod === 'POST') {
      const pathParts = path.split('/');
      const adapterName = pathParts[2];
      const toolName = pathParts[3];
      
      const adapter = mockAdapters.find(a => a.name === adapterName);
      if (!adapter) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Adapter not found' })
        };
      }
      
      const requestBody = event.body ? JSON.parse(event.body) : {};
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          adapter: adapterName,
          tool: toolName,
          input: requestBody,
          output: { 
            message: 'Tool execution successful (placeholder)',
            timestamp: new Date().toISOString()
          },
          status: 'completed'
        })
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
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        error: 'Not found',
        path: path,
        available_endpoints: ['/health', '/api/adapters', '/api/execute/{adapter}/{tool}']
      })
    };
    
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
};
