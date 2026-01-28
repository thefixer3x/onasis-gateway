import type { IncomingMessage, ServerResponse } from 'http';

type VercelRequest = IncomingMessage & {
  method?: string;
  url?: string;
  body?: unknown;
};

type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => VercelResponse;
  setHeader: (name: string, value: string) => void;
};

// Mock adapters data for now (will connect to Neon later)
const mockAdapters = [
  { name: 'stripe-api', tools: 457, description: 'Stripe payment processing' },
  { name: 'ngrok-api', tools: 217, description: 'ngrok tunneling service' },
  { name: 'shutterstock-api', tools: 109, description: 'Shutterstock media API' },
  { name: 'bap-api', tools: 92, description: 'BAP payment services' },
  { name: 'hostinger-api', tools: 85, description: 'Hostinger VPS management' },
  { name: 'wise-mca-api', tools: 78, description: 'Wise multicurrency account' },
  { name: 'google-analytics-api', tools: 88, description: 'Google Analytics reporting' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { url } = req;
  
  try {
    // Health endpoint
    if (url === '/health' || url === '/api/health') {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        adapters: mockAdapters.length,
        environment: 'vercel',
        version: '1.0.0'
      });
    }
    
    // List adapters
    if (url === '/api/adapters') {
      return res.status(200).json({
        adapters: mockAdapters,
        total: mockAdapters.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get specific adapter
    if (url?.startsWith('/api/adapters/')) {
      const adapterName = url.split('/')[3];
      const adapter = mockAdapters.find(a => a.name === adapterName);
      
      if (!adapter) {
        return res.status(404).json({ error: 'Adapter not found' });
      }
      
      return res.status(200).json({
        adapter: adapter.name,
        tools: adapter.tools,
        description: adapter.description,
        status: 'active'
      });
    }
    
    // Execute tool (placeholder)
    if (url?.startsWith('/api/execute/') && req.method === 'POST') {
      const pathParts = url.split('/');
      const adapterName = pathParts[3];
      const toolName = pathParts[4];
      
      const adapter = mockAdapters.find(a => a.name === adapterName);
      if (!adapter) {
        return res.status(404).json({ error: 'Adapter not found' });
      }
      
      return res.status(200).json({
        adapter: adapterName,
        tool: toolName,
        input: req.body,
        output: { 
          message: 'Tool execution successful (placeholder)',
          timestamp: new Date().toISOString()
        },
        status: 'completed'
      });
    }
    
    // Root endpoint
    if (url === '/' || url === '/api') {
      return res.status(200).json({
        name: 'MCP Server API',
        version: '1.0.0',
        description: 'API Integration Baseline with 17 adapters and 1,596 tools',
        endpoints: {
          health: '/health',
          adapters: '/api/adapters',
          execute: '/api/execute/{adapter}/{tool}'
        },
        adapters: mockAdapters.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 404 for unknown routes
    return res.status(404).json({ 
      error: 'Not found',
      available_endpoints: ['/health', '/api/adapters', '/api/execute/{adapter}/{tool}']
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}
