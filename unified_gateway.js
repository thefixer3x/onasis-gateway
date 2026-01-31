#!/usr/bin/env node

/**
 * Unified Gateway - API Gateway + MCP Server
 * 
 * Runs both services on the same Express app with different route prefixes:
 * - /api/*        → API Gateway (REST API routing, service orchestration)
 * - /mcp          → MCP Server (1604 tools across 18 adapters)
 * - /health       → Health check for both services
 * - /             → Service discovery/documentation
 * 
 * This allows both services to coexist on the same port without conflicts.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Import components from both servers
const BaseClient = require('./core/base-client');
const VersionManager = require('./core/versioning/version-manager');
const ComplianceManager = require('./core/security/compliance-manager');
const MetricsCollector = require('./core/monitoring/metrics-collector');
const AbstractedAPIEndpoints = require('./api/abstracted-endpoints');
const OnasisAuthBridge = require('./middleware/onasis-auth-bridge');

/**
 * Unified Gateway - Combines API Gateway + MCP Server
 */
class UnifiedGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;

        // API Gateway components
        this.services = new Map();
        this.clients = new Map();
        this.versionManager = new VersionManager();
        this.complianceManager = new ComplianceManager();
        this.metricsCollector = new MetricsCollector();

        // MCP Server components
        this.adapters = new Map();
        this.abstractedAPI = new AbstractedAPIEndpoints();
        this.authBridge = new OnasisAuthBridge({
            authApiUrl: process.env.AUTH_GATEWAY_URL
                || process.env.ONASIS_AUTH_API_URL
                || 'http://127.0.0.1:4000/v1/auth',
            projectScope: process.env.ONASIS_PROJECT_SCOPE || 'lanonasis-maas'
        });

        this.startTime = Date.now();
        this.healthTargets = this.parseHealthTargets(process.env.HEALTH_TARGETS);

        console.log('🚀 Initializing Unified Gateway (API + MCP)...');
        this.setupMiddleware();
        this.loadAPIServices();
        this.loadMCPAdapters();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup middleware for both services
     */
    setupMiddleware() {
        // Security
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS?.split(',') || '*',
            credentials: true
        }));

        // Performance
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = crypto.randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Rate limiting - different limits for API vs MCP
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many API requests'
        });

        const mcpLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 1000,
            message: 'Too many MCP requests'
        });

        this.app.use('/api/', apiLimiter);
        this.app.use('/mcp', mcpLimiter);

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });

        // Metrics middleware
        this.app.use((req, res, next) => {
            const start = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - start;
                const serviceType = req.path.startsWith('/mcp') ? 'mcp' : 'api-gateway';

                this.metricsCollector.recordRequest({
                    service: serviceType,
                    endpoint: req.route?.path || req.path,
                    method: req.method,
                    statusCode: res.statusCode,
                    duration,
                    responseSize: res.get('content-length') || 0
                });
            });

            next();
        });
    }

    /**
     * Load API Gateway services
     */
    loadAPIServices() {
        const servicesDir = path.join(__dirname, 'services');

        if (!fs.existsSync(servicesDir)) {
            console.warn('⚠️  Services directory not found:', servicesDir);
            return;
        }

        const serviceDirs = fs.readdirSync(servicesDir)
            .filter(dir => fs.statSync(path.join(servicesDir, dir)).isDirectory());

        let loadedCount = 0;
        for (const serviceDir of serviceDirs) {
            try {
                const servicePath = path.join(servicesDir, serviceDir);
                const configFiles = fs.readdirSync(servicePath)
                    .filter(file => file.endsWith('.json') && file !== 'catalog.json');

                for (const configFile of configFiles) {
                    const config = JSON.parse(
                        fs.readFileSync(path.join(servicePath, configFile), 'utf-8')
                    );

                    // Support both OpenAPI format (info.name) and custom format (name)
                    const serviceName = config.info?.name || config.name || config.display_name;
                    const serviceVersion = config.info?.version || config.version || '1.0.0';
                    const baseURL = config.servers?.[0]?.url || config.base_url || config.baseURL || '';

                    if (serviceName) {
                        this.services.set(serviceName, config);

                        const client = new BaseClient({
                            baseURL: baseURL,
                            version: serviceVersion,
                            service: serviceName
                        });
                        this.clients.set(serviceName, client);

                        loadedCount++;
                        console.log(`✅ Loaded API service: ${serviceName}`);
                    }
                }
            } catch (error) {
                console.error(`❌ Failed to load service ${serviceDir}:`, error.message);
            }
        }

        console.log(`📦 Loaded ${loadedCount} API services`);
    }

    /**
     * Load MCP adapters (mock for now)
     */
    loadMCPAdapters() {
        const MOCK_ADAPTERS = {
            'stripe-api-2024-04-10': { tools: 457, auth: 'bearer' },
            'ngrok-api': { tools: 217, auth: 'bearer' },
            'shutterstock-api': { tools: 109, auth: 'oauth2' },
            'paystack': { tools: 117, auth: 'bearer' },
            'flutterwave-v3': { tools: 108, auth: 'bearer' },
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

        Object.entries(MOCK_ADAPTERS).forEach(([name, config]) => {
            this.adapters.set(name, config);
        });

        const totalTools = Object.values(MOCK_ADAPTERS).reduce((sum, a) => sum + a.tools, 0);
        console.log(`⚡ Loaded ${this.adapters.size} MCP adapters (${totalTools} tools)`);
    }

    /**
     * Setup routes for both API Gateway and MCP Server
     */
    setupRoutes() {
        // ==================== ROOT & DISCOVERY ====================
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Unified Gateway',
                version: '1.0.0',
                services: {
                    api: {
                        description: 'API Gateway - Service orchestration and routing',
                        services: this.services.size,
                        baseUrl: '/api'
                    },
                    mcp: {
                        description: 'MCP Server - Tool aggregation and execution',
                        adapters: this.adapters.size,
                        tools: Array.from(this.adapters.values()).reduce((sum, a) => sum + a.tools, 0),
                        baseUrl: '/mcp'
                    }
                },
                endpoints: {
                    health: '/health',
                    apiDocs: '/api/services',
                    mcpTools: '/mcp (POST with JSON-RPC 2.0)'
                }
            });
        });

        // ==================== HEALTH CHECKS ====================
        this.app.get('/health', (req, res) => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            res.json({
                status: 'healthy',
                uptime,
                timestamp: new Date().toISOString(),
                services: {
                    api: {
                        status: 'online',
                        services: this.services.size
                    },
                    mcp: {
                        status: 'online',
                        adapters: this.adapters.size,
                        tools: Array.from(this.adapters.values()).reduce((sum, a) => sum + a.tools, 0)
                    }
                },
                version: '1.0.0'
            });
        });

        // ==================== API GATEWAY ROUTES ====================

        // List all API services
        this.app.get('/api/services', (req, res) => {
            const services = Array.from(this.services.values()).map(service => ({
                name: service.info.name,
                version: service.info.version,
                description: service.info.description,
                baseUrl: service.servers?.[0]?.url
            }));
            res.json({ services, count: services.length });
        });

        // Get specific service details
        this.app.get('/api/services/:serviceName', (req, res) => {
            const { serviceName } = req.params;
            const service = this.services.get(serviceName);

            if (!service) {
                return res.status(404).json({
                    error: 'Service not found',
                    service: serviceName
                });
            }

            res.json(service);
        });

        // Proxy requests to services
        this.app.use('/api/services/:serviceName', async (req, res) => {
            const { serviceName } = req.params;
            const endpoint = req.path.substring(1); // Remove leading slash

            try {
                const service = this.services.get(serviceName);
                if (!service) {
                    return res.status(404).json({
                        error: 'Service not found',
                        service: serviceName
                    });
                }

                const client = this.clients.get(serviceName);
                if (!client) {
                    return res.status(503).json({
                        error: 'Service client not initialized',
                        service: serviceName
                    });
                }

                const requestData = req.method === 'GET' ? null : req.body;

                const response = await client.request({
                    method: req.method,
                    path: `/${endpoint}`,
                    data: requestData,
                    params: req.query
                });

                res.status(response.status || 200).json(response.data);

            } catch (error) {
                console.error(`API Gateway error for ${serviceName}/${endpoint}:`, error.message);

                res.status(error.response?.status || 500).json({
                    error: 'Service request failed',
                    message: error.message,
                    service: serviceName,
                    endpoint,
                    requestId: req.id
                });
            }
        });

        // ==================== MCP SERVER ROUTES ====================

        // Authentication bridge routes
        this.app.use('/api/auth', (req, res, next) => {
            this.authBridge.proxyAuthRequest(req, res).catch(err => {
                console.error('Auth proxy error:', err);
                next(err);
            });
        });

        // Add abstracted API routes (from existing MCP server)
        this.app.use('/', this.abstractedAPI.getRouter());

        // MCP health check
        this.app.get('/mcp/health', (req, res) => {
            res.json({
                status: 'healthy',
                server: 'unified-mcp',
                adapters: this.adapters.size,
                tools: Array.from(this.adapters.values()).reduce((sum, a) => sum + a.tools, 0),
                timestamp: new Date().toISOString()
            });
        });

        // MCP tools listing
        this.app.post('/mcp', (req, res) => {
            const { method, params } = req.body;

            if (method === 'tools/list') {
                const tools = [];
                this.adapters.forEach((adapter, name) => {
                    for (let i = 0; i < adapter.tools; i++) {
                        tools.push({
                            name: `${name}_tool_${i + 1}`,
                            description: `Tool ${i + 1} from ${name}`,
                            inputSchema: {
                                type: 'object',
                                properties: {},
                                required: []
                            }
                        });
                    }
                });

                return res.json({
                    jsonrpc: '2.0',
                    result: { tools },
                    id: req.body.id
                });
            }

            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32601,
                    message: 'Method not implemented'
                },
                id: req.body.id
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                path: req.path,
                requestId: req.id
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Global error:', err);

            res.status(err.status || 500).json({
                error: 'Internal Server Error',
                message: err.message,
                requestId: req.id
            });
        });
    }

    /**
     * Parse health check targets
     */
    parseHealthTargets(targetsStr) {
        if (!targetsStr) return [];
        return targetsStr.split(',').map(t => t.trim()).filter(Boolean);
    }

    /**
     * Start the unified server
     */
    start() {
        this.app.listen(this.port, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 Unified Gateway Started');
            console.log('='.repeat(60));
            console.log(`🔗 Port: ${this.port}`);
            console.log(`📊 API Services: ${this.services.size}`);
            console.log(`⚡ MCP Adapters: ${this.adapters.size}`);
            console.log(`🛠️  Total MCP Tools: ${Array.from(this.adapters.values()).reduce((sum, a) => sum + a.tools, 0)}`);
            console.log('\n📍 Endpoints:');
            console.log(`   - Health: http://localhost:${this.port}/health`);
            console.log(`   - API Gateway: http://localhost:${this.port}/api/services`);
            console.log(`   - MCP Server: http://localhost:${this.port}/mcp`);
            console.log(`   - Discovery: http://localhost:${this.port}/`);
            console.log('='.repeat(60) + '\n');
        });
    }
}

// Start the server
if (require.main === module) {
    const gateway = new UnifiedGateway();
    gateway.start();
}

module.exports = UnifiedGateway;
