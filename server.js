#!/usr/bin/env node

/**
 * MCP Server - API Integration Baseline
 * Loads and serves all generated MCP adapters
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const AbstractedAPIEndpoints = require('./api/abstracted-endpoints');

// Import our generated adapters (will be transpiled)
// For now, we'll create a mock registry until TypeScript is compiled
const MOCK_ADAPTERS = {
  'stripe-api-2024-04-10': { tools: 457, auth: 'bearer' },
  'ngrok-api': { tools: 217, auth: 'bearer' },
  'ngrok-examples': { tools: 19, auth: 'apikey' },
  'shutterstock-api': { tools: 109, auth: 'oauth2' },
  'bap': { tools: 92, auth: 'apikey' },
  'google-analytics-api-v3': { tools: 88, auth: 'apikey' },
  'hostinger-api': { tools: 85, auth: 'bearer' },
  'open-banking-api': { tools: 58, auth: 'apikey' },
  'business-api': { tools: 52, auth: 'bearer' },
  'merchant-api': { tools: 49, auth: 'apikey' },
  '7-wise-multicurrency-account-mca-platform-api-s': { tools: 47, auth: 'apikey' },
  'sayswitch-api-integration': { tools: 43, auth: 'bearer' },
  'paystack': { tools: 117, auth: 'bearer' },
  'flutterwave-v3': { tools: 108, auth: 'bearer' },
  'xpress-wallet-for-merchants': { tools: 40, auth: 'bearer' },
  'ngrok-examples': { tools: 19, auth: 'apikey' },
  'multi-currency-account': { tools: 9, auth: 'apikey' },
  'api-testing-basics': { tools: 8, auth: 'apikey' },
  'edoc-external-app-integration-for-clients': { tools: 6, auth: 'apikey' }
};

class MCPServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001; // Avoid conflict with logistics on 3000
    this.adapters = new Map();
    this.abstractedAPI = new AbstractedAPIEndpoints();
    this.setupMiddleware();
    this.setupRoutes();
    this.startTime = Date.now();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Performance
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Add abstracted API routes
    this.app.use('/', this.abstractedAPI.getRouter());
    
    // Health check
    this.app.get('/health', (req, res) => {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      res.json({
        status: 'healthy',
        uptime: uptime,
        timestamp: new Date().toISOString(),
        adapters: Object.keys(MOCK_ADAPTERS).length,
        totalTools: Object.values(MOCK_ADAPTERS).reduce((sum, adapter) => sum + adapter.tools, 0),
        version: '1.0.0'
      });
    });

    // API info
    this.app.get('/', (req, res) => {
      res.json({
        name: 'MCP Server - API Integration Baseline',
        version: '1.0.0',
        description: 'Centralized MCP server for comprehensive API integration',
        adapters: Object.keys(MOCK_ADAPTERS).length,
        totalTools: Object.values(MOCK_ADAPTERS).reduce((sum, adapter) => sum + adapter.tools, 0),
        endpoints: {
          health: '/health',
          adapters: '/api/adapters',
          tools: '/api/tools',
          execute: '/api/adapters/:adapter/tools/:tool'
        }
      });
    });

    // List all adapters
    this.app.get('/api/adapters', (req, res) => {
      const adapters = Object.entries(MOCK_ADAPTERS).map(([name, info]) => ({
        name,
        tools: info.tools,
        authType: info.auth,
        status: 'loaded'
      }));

      res.json({
        total: adapters.length,
        adapters: adapters
      });
    });

    // List all tools
    this.app.get('/api/tools', (req, res) => {
      const totalTools = Object.values(MOCK_ADAPTERS).reduce((sum, adapter) => sum + adapter.tools, 0);
      
      res.json({
        total: totalTools,
        adapters: Object.keys(MOCK_ADAPTERS).length,
        breakdown: MOCK_ADAPTERS
      });
    });

    // Get adapter details
    this.app.get('/api/adapters/:name', (req, res) => {
      const adapterName = req.params.name;
      const adapter = MOCK_ADAPTERS[adapterName];
      
      if (!adapter) {
        return res.status(404).json({ error: 'Adapter not found' });
      }

      res.json({
        name: adapterName,
        tools: adapter.tools,
        authType: adapter.auth,
        status: 'loaded',
        description: `MCP adapter for ${adapterName} API`
      });
    });

    // Execute tool (placeholder)
    this.app.post('/api/adapters/:adapter/tools/:tool', (req, res) => {
      const { adapter, tool } = req.params;
      const args = req.body;

      if (!MOCK_ADAPTERS[adapter]) {
        return res.status(404).json({ error: 'Adapter not found' });
      }

      // Placeholder response - will be replaced with actual tool execution
      res.json({
        success: true,
        adapter: adapter,
        tool: tool,
        args: args,
        result: {
          message: `Tool ${tool} executed successfully on ${adapter}`,
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
      });
    });

    // Server-Sent Events endpoint for real-time notifications
    this.app.get('/api/sse', this.authenticateSSE.bind(this), (req, res) => {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = req.user?.id || req.headers['x-user-id'];
      
      console.log(`🔗 SSE client connected: ${clientId} (user: ${userId})`);

      // Send initial connection event
      this.sendSSEEvent(res, 'connected', {
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to Onasis Gateway notifications'
      });

      // Store client connection
      if (!this.sseClients) this.sseClients = new Map();
      this.sseClients.set(clientId, { res, userId, connectedAt: Date.now() });

      // Setup heartbeat
      const heartbeat = setInterval(() => {
        this.sendSSEEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
      }, 30000);

      // Cleanup on client disconnect
      req.on('close', () => {
        console.log(`🔌 SSE client disconnected: ${clientId}`);
        clearInterval(heartbeat);
        if (this.sseClients) this.sseClients.delete(clientId);
      });

      // Keep connection alive
      res.on('error', (err) => {
        console.error(`SSE error for client ${clientId}:`, err);
        clearInterval(heartbeat);
        if (this.sseClients) this.sseClients.delete(clientId);
      });
    });

    // SSE authentication status endpoint
    this.app.post('/api/sse/auth', (req, res) => {
      const { apiKey, eventTypes } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'API key required' });
      }

      // Validate API key (simplified)
      const isValid = this.validateApiKey(apiKey);
      
      if (isValid) {
        // Broadcast auth success to user's SSE connections
        this.broadcastToUser(req.headers['x-user-id'], 'auth_success', {
          message: 'API key validated successfully',
          eventTypes: eventTypes || ['memory.*', 'system.*'],
          timestamp: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'API key validated' });
      } else {
        res.status(401).json({ error: 'Invalid API key' });
      }
    });

    // Memory service events webhook (for SSE relay)
    this.app.post('/api/webhooks/memory', (req, res) => {
      const { event_type, data, user_id } = req.body;
      
      console.log(`📨 Memory webhook received: ${event_type} for user ${user_id}`);
      
      // Relay to SSE clients
      this.broadcastToUser(user_id, event_type, {
        ...data,
        timestamp: new Date().toISOString(),
        source: 'memory_service'
      });
      
      res.json({ success: true, message: 'Webhook processed and relayed via SSE' });
    });

    // Error handling
    this.app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path
      });
    });
  }

  /**
   * SSE Authentication middleware
   */
  authenticateSSE(req, res, next) {
    // Simple authentication - check for API key or user ID
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const userId = req.headers['x-user-id'] || req.query.userId;
    
    if (apiKey && this.validateApiKey(apiKey)) {
      req.user = { id: userId || 'anonymous', authenticated: true };
      return next();
    }
    
    if (userId) {
      req.user = { id: userId, authenticated: false };
      return next();
    }
    
    // Allow anonymous connections for now
    req.user = { id: 'anonymous', authenticated: false };
    next();
  }

  /**
   * Validate API key format (simplified)
   */
  validateApiKey(apiKey) {
    if (!apiKey) return false;
    
    // Check for Onasis Gateway format: onasis_[base64]
    const onasisFormat = /^onasis_[A-Za-z0-9+/]+=*$/;
    if (onasisFormat.test(apiKey)) return true;

    // Check for legacy format
    const legacyFormat = /^[A-Za-z0-9_-]{32,}$/;
    return legacyFormat.test(apiKey);
  }

  /**
   * Send SSE event to a specific response
   */
  sendSSEEvent(res, event, data) {
    try {
      const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(eventData);
    } catch (error) {
      console.error('Failed to send SSE event:', error);
    }
  }

  /**
   * Broadcast event to all SSE clients for a specific user
   */
  broadcastToUser(userId, event, data) {
    if (!this.sseClients || !userId) return;
    
    let sentCount = 0;
    
    for (const [clientId, client] of this.sseClients.entries()) {
      if (client.userId === userId) {
        try {
          this.sendSSEEvent(client.res, event, data);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send to client ${clientId}:`, error);
          // Remove failed client
          this.sseClients.delete(clientId);
        }
      }
    }
    
    console.log(`📤 Broadcasted ${event} to ${sentCount} clients for user ${userId}`);
  }

  /**
   * Broadcast event to all connected SSE clients
   */
  broadcastToAll(event, data) {
    if (!this.sseClients) return;
    
    let sentCount = 0;
    
    for (const [clientId, client] of this.sseClients.entries()) {
      try {
        this.sendSSEEvent(client.res, event, data);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
        // Remove failed client
        this.sseClients.delete(clientId);
      }
    }
    
    console.log(`📤 Broadcasted ${event} to ${sentCount} clients`);
  }

  /**
   * Get SSE connection statistics
   */
  getSSEStats() {
    if (!this.sseClients) return { total: 0, users: {} };
    
    const stats = { total: this.sseClients.size, users: {} };
    
    for (const client of this.sseClients.values()) {
      const userId = client.userId || 'anonymous';
      stats.users[userId] = (stats.users[userId] || 0) + 1;
    }
    
    return stats;
  }

  async start() {
    try {
      console.log('🚀 Starting MCP Server...');
      console.log(`📦 Loading ${Object.keys(MOCK_ADAPTERS).length} adapters...`);
      
      // TODO: Load actual adapters when TypeScript is compiled
      // const { ADAPTER_REGISTRY } = require('./dist/src/adapters/index.js');
      
      this.app.listen(this.port, () => {
        console.log(`✅ MCP Server running on port ${this.port}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`📊 API docs: http://localhost:${this.port}/`);
        console.log(`🛠️  Adapters: ${Object.keys(MOCK_ADAPTERS).length}`);
        console.log(`⚡ Total tools: ${Object.values(MOCK_ADAPTERS).reduce((sum, adapter) => sum + adapter.tools, 0)}`);
      });
    } catch (error) {
      console.error('❌ Failed to start MCP Server:', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MCP Server...');
  process.exit(0);
});

// Start server
if (require.main === module) {
  const server = new MCPServer();
  server.start();
}

module.exports = MCPServer;
