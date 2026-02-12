#!/usr/bin/env node

/**
 * API Service Warehouse MCP Server
 * Provides service discovery, recommendation, and management capabilities
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');
const path = require('path');

class APIWarehouseMCPServer {
    constructor() {
        this.server = new Server({
            name: 'api-warehouse',
            version: '1.0.0'
        }, {
            capabilities: {
                resources: {},
                tools: {}
            }
        });

        this.servicesDir = path.join(__dirname, '../services');
        this.catalogPath = path.join(this.servicesDir, 'catalog.json');
        this.services = new Map();
        
        this.setupHandlers();
        this.loadServices();
    }

    setupHandlers() {
        // List available resources
        this.server.setRequestHandler('resources/list', async () => {
            const resources = [];
            
            // Add service catalog
            resources.push({
                uri: 'catalog://services',
                name: 'Service Catalog',
                description: 'Complete catalog of all available API services',
                mimeType: 'application/json'
            });

            // Add individual services
            for (const [serviceName, serviceConfig] of this.services) {
                resources.push({
                    uri: `service://${serviceName}`,
                    name: serviceConfig.name,
                    description: serviceConfig.metadata?.description || `${serviceName} API service`,
                    mimeType: 'application/json'
                });
            }

            return { resources };
        });

        // Read resource content
        this.server.setRequestHandler('resources/read', async (request) => {
            const { uri } = request.params;

            if (uri === 'catalog://services') {
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(this.getCatalogSummary(), null, 2)
                    }]
                };
            }

            if (uri.startsWith('service://')) {
                const serviceName = uri.replace('service://', '');
                const service = this.services.get(serviceName);
                
                if (!service) {
                    throw new Error(`Service not found: ${serviceName}`);
                }

                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(service, null, 2)
                    }]
                };
            }

            throw new Error(`Unknown resource: ${uri}`);
        });

        // List available tools
        this.server.setRequestHandler('tools/list', async () => {
            return {
                tools: [
                    {
                        name: 'discover_services',
                        description: 'Discover services by capability, domain, or keyword',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                capability: {
                                    type: 'string',
                                    description: 'Service capability (payment, analytics, media, etc.)'
                                },
                                domain: {
                                    type: 'string',
                                    description: 'Service domain (fintech, infrastructure, etc.)'
                                },
                                keyword: {
                                    type: 'string',
                                    description: 'Search keyword'
                                }
                            }
                        }
                    },
                    {
                        name: 'recommend_services',
                        description: 'Get service recommendations for a specific use case',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                useCase: {
                                    type: 'string',
                                    description: 'Describe what you want to accomplish'
                                },
                                requirements: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific requirements or constraints'
                                }
                            },
                            required: ['useCase']
                        }
                    },
                    {
                        name: 'get_service_config',
                        description: 'Get complete configuration for a specific service',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                serviceName: {
                                    type: 'string',
                                    description: 'Name of the service'
                                }
                            },
                            required: ['serviceName']
                        }
                    },
                    {
                        name: 'generate_integration_template',
                        description: 'Generate integration template for selected services',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                services: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'List of service names to integrate'
                                },
                                projectType: {
                                    type: 'string',
                                    enum: ['express', 'nextjs', 'fastify', 'koa'],
                                    description: 'Type of project framework'
                                }
                            },
                            required: ['services']
                        }
                    },
                    {
                        name: 'health_check',
                        description: 'Check health status of services',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                services: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'List of service names to check (optional, checks all if not provided)'
                                }
                            }
                        }
                    }
                ]
            };
        });

        // Handle tool calls
        this.server.setRequestHandler('tools/call', async (request) => {
            const { name, arguments: args } = request.params;

            switch (name) {
                case 'discover_services':
                    return this.discoverServices(args);
                case 'recommend_services':
                    return this.recommendServices(args);
                case 'get_service_config':
                    return this.getServiceConfig(args);
                case 'generate_integration_template':
                    return this.generateIntegrationTemplate(args);
                case 'health_check':
                    return this.healthCheck(args);
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        });
    }

    loadServices() {
        try {
            // Load catalog
            if (fs.existsSync(this.catalogPath)) {
                const catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
                
                // Load each service configuration
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

    getCatalogSummary() {
        const summary = {
            totalServices: this.services.size,
            capabilities: {},
            domains: {},
            authMethods: {},
            services: []
        };

        for (const [name, config] of this.services) {
            // Count capabilities
            config.capabilities.forEach(cap => {
                summary.capabilities[cap] = (summary.capabilities[cap] || 0) + 1;
            });

            // Count auth methods
            const authType = config.authentication?.type || 'none';
            summary.authMethods[authType] = (summary.authMethods[authType] || 0) + 1;

            // Determine domain
            const domain = this.determineDomain(config);
            summary.domains[domain] = (summary.domains[domain] || 0) + 1;

            summary.services.push({
                name,
                capabilities: config.capabilities,
                endpoints: config.endpoints.length,
                authentication: authType,
                domain
            });
        }

        return summary;
    }

    determineDomain(config) {
        const name = config.name.toLowerCase();
        const capabilities = config.capabilities;

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

    async discoverServices(args) {
        const { capability, domain, keyword } = args;
        const results = [];

        for (const [name, config] of this.services) {
            let matches = true;

            if (capability && !config.capabilities.includes(capability)) {
                matches = false;
            }

            if (domain && this.determineDomain(config) !== domain) {
                matches = false;
            }

            if (keyword) {
                const searchText = JSON.stringify(config).toLowerCase();
                if (!searchText.includes(keyword.toLowerCase())) {
                    matches = false;
                }
            }

            if (matches) {
                results.push({
                    name,
                    capabilities: config.capabilities,
                    endpoints: config.endpoints.length,
                    authentication: config.authentication?.type || 'none',
                    baseUrl: config.baseUrl,
                    description: config.metadata?.description || ''
                });
            }
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    query: args,
                    results,
                    totalFound: results.length
                }, null, 2)
            }]
        };
    }

    async recommendServices(args) {
        const { useCase, requirements = [] } = args;
        const recommendations = [];

        // Simple recommendation logic based on use case keywords
        const useCaseLower = useCase.toLowerCase();
        
        for (const [name, config] of this.services) {
            let score = 0;
            
            // Score based on capabilities matching use case
            if (useCaseLower.includes('payment') && config.capabilities.includes('payment')) {
                score += 10;
            }
            
            if (useCaseLower.includes('analytics') && config.capabilities.includes('analytics')) {
                score += 10;
            }
            
            if (useCaseLower.includes('media') && config.capabilities.includes('media')) {
                score += 10;
            }
            
            if (useCaseLower.includes('webhook') && config.capabilities.includes('webhooks')) {
                score += 8;
            }
            
            // Score based on name matching
            if (useCaseLower.includes(name.toLowerCase())) {
                score += 5;
            }
            
            // Score based on requirements
            requirements.forEach(req => {
                const reqLower = req.toLowerCase();
                if (config.capabilities.some(cap => reqLower.includes(cap))) {
                    score += 3;
                }
            });

            if (score > 0) {
                recommendations.push({
                    name,
                    score,
                    capabilities: config.capabilities,
                    endpoints: config.endpoints.length,
                    authentication: config.authentication?.type || 'none',
                    reason: this.generateRecommendationReason(config, useCaseLower, requirements)
                });
            }
        }

        // Sort by score
        recommendations.sort((a, b) => b.score - a.score);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    useCase,
                    requirements,
                    recommendations: recommendations.slice(0, 5), // Top 5
                    totalFound: recommendations.length
                }, null, 2)
            }]
        };
    }

    generateRecommendationReason(config, useCase, requirements) {
        const reasons = [];
        
        if (config.capabilities.some(cap => useCase.includes(cap))) {
            reasons.push(`Matches ${config.capabilities.join(', ')} capabilities`);
        }
        
        if (config.endpoints.length > 10) {
            reasons.push('Comprehensive API with many endpoints');
        }
        
        if (config.authentication?.type === 'oauth2') {
            reasons.push('Secure OAuth 2.0 authentication');
        }

        return reasons.join('; ') || 'General match';
    }

    async getServiceConfig(args) {
        const { serviceName } = args;
        const service = this.services.get(serviceName);

        if (!service) {
            throw new Error(`Service not found: ${serviceName}`);
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(service, null, 2)
            }]
        };
    }

    async generateIntegrationTemplate(args) {
        const { services, projectType = 'express' } = args;
        const selectedServices = [];

        // Validate services exist
        for (const serviceName of services) {
            const service = this.services.get(serviceName);
            if (!service) {
                throw new Error(`Service not found: ${serviceName}`);
            }
            selectedServices.push(service);
        }

        // Generate integration template
        const template = this.createIntegrationTemplate(selectedServices, projectType);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(template, null, 2)
            }]
        };
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

    async healthCheck(args) {
        const { services: serviceNames } = args;
        const results = [];

        const servicesToCheck = serviceNames || Array.from(this.services.keys());

        for (const serviceName of servicesToCheck) {
            const service = this.services.get(serviceName);
            if (!service) {
                results.push({
                    service: serviceName,
                    status: 'not_found',
                    timestamp: new Date().toISOString()
                });
                continue;
            }

            // Basic health check - verify service configuration
            const health = {
                service: serviceName,
                status: 'healthy',
                checks: {
                    configValid: !!service.name,
                    hasEndpoints: service.endpoints.length > 0,
                    hasAuth: !!service.authentication?.type,
                    hasBaseUrl: !!service.baseUrl
                },
                timestamp: new Date().toISOString()
            };

            // Determine overall status
            const allChecksPass = Object.values(health.checks).every(check => check);
            health.status = allChecksPass ? 'healthy' : 'degraded';

            results.push(health);
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    healthCheck: {
                        timestamp: new Date().toISOString(),
                        results,
                        summary: {
                            total: results.length,
                            healthy: results.filter(r => r.status === 'healthy').length,
                            degraded: results.filter(r => r.status === 'degraded').length,
                            notFound: results.filter(r => r.status === 'not_found').length
                        }
                    }
                }, null, 2)
            }]
        };
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('🚀 API Warehouse MCP Server started');
    }
}

// Start the server
if (require.main === module) {
    const server = new APIWarehouseMCPServer();
    server.start().catch(console.error);
}

module.exports = APIWarehouseMCPServer;
