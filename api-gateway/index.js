/**
 * API Gateway for Service Warehouse
 * Provides REST endpoints for selective service activation and management
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const BaseClient = require('../core/base-client');

class APIGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.servicesDir = path.join(__dirname, '../services');
        this.catalogPath = path.join(this.servicesDir, 'catalog.json');
        
        this.services = new Map();
        this.activeClients = new Map();
        
        this.setupMiddleware();
        this.loadServices();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.'
        });
        this.app.use('/api/', limiter);

        // Logging
        this.app.use(morgan('combined'));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = require('uuid').v4();
            res.setHeader('X-Request-ID', req.id);
            next();
        });
    }

    loadServices() {
        try {
            if (fs.existsSync(this.catalogPath)) {
                const catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
                
                catalog.services.forEach(serviceInfo => {
                    const configPath = path.join(this.servicesDir, serviceInfo.directory, serviceInfo.configFile);
                    
                    if (fs.existsSync(configPath)) {
                        const serviceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        this.services.set(serviceInfo.name, serviceConfig);
                    }
                });
            }

            console.log(`✅ Loaded ${this.services.size} services`);
        } catch (error) {
            console.error('❌ Error loading services:', error.message);
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: this.services.size,
                activeClients: this.activeClients.size
            });
        });

        // Service discovery endpoints
        this.app.get('/api/services', this.getServices.bind(this));
        this.app.get('/api/services/:serviceName', this.getService.bind(this));
        this.app.get('/api/services/:serviceName/config', this.getServiceConfig.bind(this));
        
        // Service activation endpoints
        this.app.post('/api/services/:serviceName/activate', this.activateService.bind(this));
        this.app.delete('/api/services/:serviceName/deactivate', this.deactivateService.bind(this));
        this.app.get('/api/services/:serviceName/status', this.getServiceStatus.bind(this));

        // Service proxy endpoints
        this.app.all('/api/proxy/:serviceName/*', this.proxyRequest.bind(this));

        // Batch operations
        this.app.post('/api/batch/activate', this.batchActivate.bind(this));
        this.app.post('/api/batch/deactivate', this.batchDeactivate.bind(this));
        this.app.get('/api/batch/status', this.batchStatus.bind(this));

        // Analytics and monitoring
        this.app.get('/api/analytics/usage', this.getUsageAnalytics.bind(this));
        this.app.get('/api/analytics/performance', this.getPerformanceMetrics.bind(this));

        // Integration templates
        this.app.post('/api/templates/generate', this.generateTemplate.bind(this));
        this.app.get('/api/templates/examples', this.getTemplateExamples.bind(this));

        // Webhook management
        this.app.post('/api/webhooks/:serviceName/register', this.registerWebhook.bind(this));
        this.app.delete('/api/webhooks/:serviceName/unregister', this.unregisterWebhook.bind(this));
        this.app.post('/api/webhooks/:serviceName/receive', this.receiveWebhook.bind(this));

        // Documentation
        this.app.get('/api/docs', this.getDocumentation.bind(this));
        this.app.get('/api/docs/:serviceName', this.getServiceDocumentation.bind(this));
    }

    async getServices(req, res) {
        try {
            const { capability, domain, search } = req.query;
            let services = Array.from(this.services.values());

            // Filter by capability
            if (capability) {
                services = services.filter(s => s.capabilities.includes(capability));
            }

            // Filter by domain
            if (domain) {
                services = services.filter(s => this.determineDomain(s) === domain);
            }

            // Search filter
            if (search) {
                const searchLower = search.toLowerCase();
                services = services.filter(s => 
                    s.name.toLowerCase().includes(searchLower) ||
                    s.metadata?.description?.toLowerCase().includes(searchLower) ||
                    s.capabilities.some(cap => cap.toLowerCase().includes(searchLower))
                );
            }

            const response = {
                total: services.length,
                services: services.map(s => ({
                    name: s.name,
                    capabilities: s.capabilities,
                    endpoints: s.endpoints.length,
                    authentication: s.authentication?.type || 'none',
                    baseUrl: s.baseUrl,
                    description: s.metadata?.description || '',
                    domain: this.determineDomain(s),
                    active: this.activeClients.has(s.name)
                }))
            };

            res.json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getService(req, res) {
        try {
            const { serviceName } = req.params;
            const service = this.services.get(serviceName);

            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            const response = {
                ...service,
                domain: this.determineDomain(service),
                active: this.activeClients.has(serviceName),
                lastActivated: this.activeClients.get(serviceName)?.activatedAt
            };

            res.json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getServiceConfig(req, res) {
        try {
            const { serviceName } = req.params;
            const service = this.services.get(serviceName);

            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            // Return sanitized config (remove sensitive data)
            const config = {
                name: service.name,
                baseUrl: service.baseUrl,
                endpoints: service.endpoints.map(e => ({
                    name: e.name,
                    path: e.path,
                    method: e.method,
                    description: e.description,
                    parameters: e.parameters
                })),
                capabilities: service.capabilities,
                authentication: {
                    type: service.authentication?.type || 'none',
                    // Don't expose actual credentials
                    config: service.authentication?.type ? { configured: true } : {}
                }
            };

            res.json(config);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async activateService(req, res) {
        try {
            const { serviceName } = req.params;
            const { config } = req.body;

            const service = this.services.get(serviceName);
            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            // Create client instance
            const clientConfig = {
                ...service,
                ...config // Allow runtime config override
            };

            const client = new BaseClient(clientConfig);
            
            // Set up event listeners
            client.on('error', (error) => {
                console.error(`Service ${serviceName} error:`, error);
            });

            client.on('request', (info) => {
                console.log(`Service ${serviceName} request:`, info);
            });

            // Generate methods based on endpoints
            client.generateMethods(service.endpoints);

            // Store active client
            this.activeClients.set(serviceName, {
                client,
                activatedAt: new Date().toISOString(),
                config: clientConfig
            });

            res.json({
                message: `Service ${serviceName} activated successfully`,
                endpoints: service.endpoints.length,
                methods: service.endpoints.map(e => e.name)
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deactivateService(req, res) {
        try {
            const { serviceName } = req.params;

            if (!this.activeClients.has(serviceName)) {
                return res.status(404).json({ error: 'Service not active' });
            }

            this.activeClients.delete(serviceName);

            res.json({
                message: `Service ${serviceName} deactivated successfully`
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getServiceStatus(req, res) {
        try {
            const { serviceName } = req.params;
            const activeClient = this.activeClients.get(serviceName);

            if (!activeClient) {
                return res.json({
                    service: serviceName,
                    active: false,
                    status: 'inactive'
                });
            }

            // Perform health check
            const healthCheck = await activeClient.client.healthCheck();

            res.json({
                service: serviceName,
                active: true,
                activatedAt: activeClient.activatedAt,
                health: healthCheck,
                status: healthCheck.status
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async proxyRequest(req, res) {
        try {
            const { serviceName } = req.params;
            const endpoint = req.params[0]; // Everything after serviceName/

            const activeClient = this.activeClients.get(serviceName);
            if (!activeClient) {
                return res.status(404).json({ error: 'Service not active' });
            }

            // Find matching endpoint
            const service = this.services.get(serviceName);
            const endpointConfig = service.endpoints.find(e => 
                e.path.replace(/^\//, '') === endpoint || 
                e.name.toLowerCase().replace(/[^a-z0-9]/g, '_') === endpoint
            );

            if (!endpointConfig) {
                return res.status(404).json({ error: 'Endpoint not found' });
            }

            // Prepare request
            const options = {
                method: req.method,
                url: endpointConfig.path,
                params: req.query,
                data: req.body,
                headers: { ...req.headers }
            };

            // Remove hop-by-hop headers
            delete options.headers.host;
            delete options.headers.connection;
            delete options.headers['content-length'];

            // Make request through client
            const response = await activeClient.client.retryRequest(options);
            
            res.json(response);

        } catch (error) {
            if (error.response) {
                res.status(error.response.status).json(error.response.data);
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    }

    async batchActivate(req, res) {
        try {
            const { services, config } = req.body;
            const results = [];

            for (const serviceName of services) {
                try {
                    const service = this.services.get(serviceName);
                    if (!service) {
                        results.push({
                            service: serviceName,
                            success: false,
                            error: 'Service not found'
                        });
                        continue;
                    }

                    const clientConfig = { ...service, ...config };
                    const client = new BaseClient(clientConfig);
                    client.generateMethods(service.endpoints);

                    this.activeClients.set(serviceName, {
                        client,
                        activatedAt: new Date().toISOString(),
                        config: clientConfig
                    });

                    results.push({
                        service: serviceName,
                        success: true,
                        endpoints: service.endpoints.length
                    });

                } catch (error) {
                    results.push({
                        service: serviceName,
                        success: false,
                        error: error.message
                    });
                }
            }

            res.json({
                message: 'Batch activation completed',
                results,
                summary: {
                    total: services.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length
                }
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async batchDeactivate(req, res) {
        try {
            const { services } = req.body;
            const results = [];

            for (const serviceName of services) {
                if (this.activeClients.has(serviceName)) {
                    this.activeClients.delete(serviceName);
                    results.push({
                        service: serviceName,
                        success: true
                    });
                } else {
                    results.push({
                        service: serviceName,
                        success: false,
                        error: 'Service not active'
                    });
                }
            }

            res.json({
                message: 'Batch deactivation completed',
                results
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async batchStatus(req, res) {
        try {
            const statuses = [];

            for (const [serviceName, activeClient] of this.activeClients) {
                try {
                    const healthCheck = await activeClient.client.healthCheck();
                    statuses.push({
                        service: serviceName,
                        active: true,
                        activatedAt: activeClient.activatedAt,
                        health: healthCheck
                    });
                } catch (error) {
                    statuses.push({
                        service: serviceName,
                        active: true,
                        activatedAt: activeClient.activatedAt,
                        health: { status: 'error', error: error.message }
                    });
                }
            }

            res.json({
                timestamp: new Date().toISOString(),
                activeServices: this.activeClients.size,
                statuses
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getUsageAnalytics(req, res) {
        // Placeholder for usage analytics
        res.json({
            message: 'Usage analytics not implemented yet',
            totalServices: this.services.size,
            activeServices: this.activeClients.size
        });
    }

    async getPerformanceMetrics(req, res) {
        // Placeholder for performance metrics
        res.json({
            message: 'Performance metrics not implemented yet',
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    }

    async generateTemplate(req, res) {
        try {
            const { services, projectType = 'express' } = req.body;
            
            // Validate services
            const validServices = [];
            for (const serviceName of services) {
                const service = this.services.get(serviceName);
                if (service) {
                    validServices.push(service);
                }
            }

            const template = this.createIntegrationTemplate(validServices, projectType);
            res.json(template);

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getTemplateExamples(req, res) {
        const examples = {
            payment: ['stripe', 'bap-postman-collection'],
            analytics: ['google-analytics-api-v3-postman-collection'],
            media: ['shutterstock-api-postman-collection'],
            infrastructure: ['hostinger-api-postman-collection', 'ngrok-api-postman-collection']
        };

        res.json(examples);
    }

    async registerWebhook(req, res) {
        // Placeholder for webhook registration
        res.json({ message: 'Webhook registration not implemented yet' });
    }

    async unregisterWebhook(req, res) {
        // Placeholder for webhook unregistration
        res.json({ message: 'Webhook unregistration not implemented yet' });
    }

    async receiveWebhook(req, res) {
        // Placeholder for webhook reception
        res.json({ message: 'Webhook received', timestamp: new Date().toISOString() });
    }

    async getDocumentation(req, res) {
        const docs = {
            title: 'API Service Warehouse Gateway',
            version: '1.0.0',
            description: 'REST API for managing and accessing API services',
            endpoints: {
                services: '/api/services',
                activation: '/api/services/:serviceName/activate',
                proxy: '/api/proxy/:serviceName/*',
                batch: '/api/batch/*',
                templates: '/api/templates/*'
            }
        };

        res.json(docs);
    }

    async getServiceDocumentation(req, res) {
        try {
            const { serviceName } = req.params;
            const service = this.services.get(serviceName);

            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            const docs = {
                name: service.name,
                description: service.metadata?.description || '',
                baseUrl: service.baseUrl,
                authentication: service.authentication,
                endpoints: service.endpoints.map(e => ({
                    name: e.name,
                    path: e.path,
                    method: e.method,
                    description: e.description,
                    parameters: e.parameters,
                    responses: e.responses
                })),
                capabilities: service.capabilities
            };

            res.json(docs);

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    determineDomain(service) {
        const name = service.name.toLowerCase();
        const capabilities = service.capabilities;

        if (capabilities.includes('payment') || name.includes('payment') || 
            name.includes('stripe') || name.includes('wallet')) {
            return 'fintech';
        }
        
        if (capabilities.includes('analytics') || name.includes('analytics')) {
            return 'analytics';
        }
        
        if (capabilities.includes('media') || name.includes('media') || name.includes('shutterstock')) {
            return 'media';
        }
        
        if (capabilities.includes('infrastructure') || name.includes('hosting') || 
            name.includes('ngrok')) {
            return 'infrastructure';
        }
        
        if (capabilities.includes('banking') || name.includes('banking') || name.includes('wise')) {
            return 'banking';
        }

        return 'other';
    }

    createIntegrationTemplate(services, projectType) {
        const template = {
            projectType,
            services: services.map(s => s.name),
            setup: {
                dependencies: ['axios', 'dotenv'],
                envVariables: [],
                configuration: {}
            },
            integration: {
                clients: {},
                routes: {},
                middleware: []
            }
        };

        services.forEach(service => {
            // Add environment variables
            if (service.authentication?.type === 'bearer') {
                template.setup.envVariables.push(`${service.name.toUpperCase()}_TOKEN`);
            } else if (service.authentication?.type === 'apikey') {
                template.setup.envVariables.push(`${service.name.toUpperCase()}_API_KEY`);
            }

            // Add client configuration
            template.integration.clients[service.name] = {
                baseUrl: service.baseUrl,
                authentication: service.authentication,
                endpoints: service.endpoints.length
            };

            // Add sample routes
            template.integration.routes[`/${service.name}`] = {
                methods: ['GET', 'POST'],
                description: `Routes for ${service.name} integration`
            };
        });

        return template;
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.path} not found`
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Global error:', err);
            
            res.status(err.status || 500).json({
                error: err.message || 'Internal Server Error',
                requestId: req.id,
                timestamp: new Date().toISOString()
            });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 API Gateway running on port ${this.port}`);
            console.log(`📊 Loaded ${this.services.size} services`);
            console.log(`🔗 API Documentation: http://localhost:${this.port}/api/docs`);
        });
    }
}

// Start the gateway
if (require.main === module) {
    const gateway = new APIGateway();
    gateway.start();
}

module.exports = APIGateway;
