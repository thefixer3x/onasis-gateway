#!/usr/bin/env node

/**
 * MCP Server - API Integration Baseline
 * Loads and serves all generated MCP adapters
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fetch = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then((mod) => (mod.default || mod)(...args));
const AbstractedAPIEndpoints = require('./api/abstracted-endpoints');
const OnasisAuthBridge = require('./middleware/onasis-auth-bridge');

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
    
    // Initialize authentication bridge
    this.authBridge = new OnasisAuthBridge({
      authApiUrl: process.env.AUTH_GATEWAY_URL
        || process.env.ONASIS_AUTH_API_URL
        || 'http://127.0.0.1:4000/v1/auth',
      projectScope: process.env.ONASIS_PROJECT_SCOPE || 'lanonasis-maas'
    });

    console.log('✅ Authentication bridge initialized');
    
    this.setupMiddleware();
    this.startTime = Date.now();
    this.healthTargets = this.parseHealthTargets(process.env.HEALTH_TARGETS);
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
    // Authentication routes - proxy to onasis-core auth API
    this.app.use('/api/auth/*', (req, res, next) => {
      this.authBridge.proxyAuthRequest(req, res).catch(err => {
        console.error('Auth proxy error:', err);
        next(err);
      });
    });
    // Add abstracted API routes
    this.app.use('/', this.abstractedAPI.getRouter());
    
    // Authentication routes - proxy to onasis-core auth API
    this.app.use('/api/auth/*', (req, res) => {
      this.authBridge.proxyAuthRequest(req, res);
    });
    
    // Authentication health check
    this.app.get('/api/auth-health', async (req, res) => {
      const healthStatus = await this.authBridge.healthCheck();
      res.json(healthStatus);
    });
    
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

    // Full health check (aggregate)
    this.app.get('/health/full', async (req, res) => {
      const startedAt = Date.now();
      const services = await this.checkHealthTargets();
      const ok = services.every((service) => service.ok);

      res.status(ok ? 200 : 503).json({
        status: ok ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        services
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

    // List all adapters (with optional authentication for user context)
    this.app.get('/api/adapters', this.authBridge.authenticate({ required: false, allowAnonymous: true }), (req, res) => {
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

    // List all tools (with optional authentication for user context)
    this.app.get('/api/tools', this.authBridge.authenticate({ required: false, allowAnonymous: true }), (req, res) => {
      const totalTools = Object.values(MOCK_ADAPTERS).reduce((sum, adapter) => sum + adapter.tools, 0);
      
      res.json({
        total: totalTools,
        adapters: Object.keys(MOCK_ADAPTERS).length,
        breakdown: MOCK_ADAPTERS
      });
    });

    // Get adapter details (with optional authentication for user context)
    this.app.get('/api/adapters/:name', this.authBridge.authenticate({ required: false, allowAnonymous: true }), (req, res) => {
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

    // Execute tool (requires authentication)
    this.app.post('/api/adapters/:adapter/tools/:tool', 
      this.authBridge.authenticate({ required: true }),
      this.authBridge.injectUserContext(),
      (req, res) => {
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
        user: req.adapterContext ? {
          userId: req.adapterContext.userId,
          projectScope: req.adapterContext.projectScope,
          authMethod: req.adapterContext.authMethod
        } : null,
        result: {
          message: `Tool ${tool} executed successfully on ${adapter} for user ${req.user?.id || 'unknown'}`,
          timestamp: new Date().toISOString(),
          status: 'completed',
          authenticated: req.auth?.authenticated || false
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
   * Parse HEALTH_TARGETS env var or use defaults.
   * Format: JSON array of { name, url }
   */
  getDefaultHealthTargets() {
    return [
      {
        name: 'auth-gateway',
        url: process.env.HEALTH_AUTH_URL || 'http://127.0.0.1:4000/health'
      },
      {
        name: 'mcp-core',
        url: process.env.HEALTH_MCP_CORE_URL || 'http://127.0.0.1:3001/health'
      },
      {
        name: 'enterprise-mcp',
        url: process.env.HEALTH_ENTERPRISE_MCP_URL || 'http://127.0.0.1:3001/health'
      }
    ];
  }

  parseHealthTargets(rawTargets) {
    if (!rawTargets) {
      return this.getDefaultHealthTargets();
    }

    try {
      const parsed = JSON.parse(rawTargets);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry) => entry && entry.name && entry.url);
      }
    } catch (error) {
      console.warn('Invalid HEALTH_TARGETS JSON, falling back to defaults:', error.message);
    }

    return this.getDefaultHealthTargets();
  }

  /**
   * Check all configured health targets.
   */
  async checkHealthTargets() {
    const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS || 4000);
    const targets = this.healthTargets || [];

    const checks = targets.map(async (target) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = Date.now();

      try {
        const response = await fetch(target.url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        return {
          name: target.name,
          url: target.url,
          ok: response.ok,
          status: response.status,
          latency_ms: Date.now() - startedAt
        };
      } catch (error) {
        clearTimeout(timeout);
        return {
          name: target.name,
          url: target.url,
          ok: false,
          status: 0,
          latency_ms: Date.now() - startedAt,
          error: error.message
        };
      }
    });

    return Promise.all(checks);
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
