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

// Import our generated adapters (will be transpiled)
// For now, we'll create a mock registry until TypeScript is compiled
const MOCK_ADAPTERS = {
  'stripe-api-2024-04-10': { tools: 457, auth: 'bearer' },
  'ngrok-api': { tools: 217, auth: 'bearer' },
  'ngrok-api-for-use-with-flows': { tools: 217, auth: 'bearer' },
  'shutterstock-api': { tools: 109, auth: 'oauth2' },
  'bap': { tools: 92, auth: 'apikey' },
  'google-analytics-api-v3': { tools: 88, auth: 'apikey' },
  'hostinger-api': { tools: 85, auth: 'bearer' },
  'open-banking-api': { tools: 58, auth: 'apikey' },
  'business-api': { tools: 52, auth: 'bearer' },
  'merchant-api': { tools: 49, auth: 'apikey' },
  '7-wise-multicurrency-account-mca-platform-api-s': { tools: 47, auth: 'apikey' },
  'sayswitch-api-integration': { tools: 43, auth: 'bearer' },
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
    // Health check
    this.app.get('/health', (req, res) => {
      const uptime = Date.now() - this.startTime;
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
