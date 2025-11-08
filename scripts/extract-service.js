#!/usr/bin/env node

/**
 * Service Extraction Script
 * Extracts complete service definitions from Postman JSON collections
 * Usage: node extract-service.js [json-file-path]
 */

const fs = require('fs');
const path = require('path');

class ServiceExtractor {
    constructor() {
        this.serviceConfig = {
            name: '',
            version: '1.0.0',
            baseUrl: '',
            authentication: {},
            endpoints: [],
            webhooks: [],
            dependencies: [],
            capabilities: [],
            metadata: {}
        };
    }

    extractFromPostmanCollection(filePath) {
        try {
            const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const collection = jsonData.collection || jsonData;
            
            // Extract basic info
            this.serviceConfig.name = this.sanitizeName(collection.info.name);
            this.serviceConfig.metadata = {
                description: collection.info.description || '',
                postmanId: collection.info._postman_id,
                schema: collection.info.schema,
                exporterId: collection.info._exporter_id
            };

            // Extract variables and base URL
            this.extractVariables(collection);
            
            // Extract authentication methods
            this.extractAuthentication(collection);
            
            // Extract all endpoints
            this.extractEndpoints(collection.item || []);
            
            // Determine capabilities
            this.determineCapabilities();
            
            // Extract dependencies
            this.extractDependencies();

            return this.serviceConfig;
        } catch (error) {
            console.error(`Error extracting service from ${filePath}:`, error.message);
            throw error;
        }
    }

    sanitizeName(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    extractVariables(collection) {
        const variables = collection.variable || [];
        const baseUrlVar = variables.find(v => 
            v.key === 'baseUrl' || v.key === 'host' || v.key === 'url'
        );
        
        if (baseUrlVar) {
            this.serviceConfig.baseUrl = baseUrlVar.value;
        }

        // Store all variables for reference
        this.serviceConfig.metadata.variables = variables.reduce((acc, v) => {
            acc[v.key] = v.value;
            return acc;
        }, {});
    }

    extractAuthentication(collection) {
        // Check collection-level auth
        if (collection.auth) {
            this.serviceConfig.authentication = this.parseAuthConfig(collection.auth);
        }

        // Also check for common auth patterns in requests
        this.inferAuthFromRequests(collection.item || []);
    }

    parseAuthConfig(auth) {
        const authConfig = {
            type: auth.type,
            config: {}
        };

        switch (auth.type) {
            case 'bearer':
                authConfig.config.token = auth.bearer?.[0]?.value || '{{token}}';
                break;
            case 'apikey':
                const apikey = auth.apikey?.[0];
                authConfig.config.key = apikey?.key;
                authConfig.config.value = apikey?.value;
                authConfig.config.in = apikey?.in; // header or query
                break;
            case 'basic':
                authConfig.config.username = auth.basic?.find(b => b.key === 'username')?.value;
                authConfig.config.password = auth.basic?.find(b => b.key === 'password')?.value;
                break;
            case 'oauth2':
                authConfig.config = auth.oauth2 || {};
                break;
            default:
                authConfig.config = auth[auth.type] || {};
        }

        return authConfig;
    }

    inferAuthFromRequests(items) {
        const authMethods = new Set();
        
        this.traverseItems(items, (request) => {
            if (request.auth) {
                authMethods.add(request.auth.type);
            }
            
            // Check headers for auth patterns
            const headers = request.header || [];
            headers.forEach(header => {
                if (header.key.toLowerCase() === 'authorization') {
                    if (header.value.startsWith('Bearer')) {
                        authMethods.add('bearer');
                    } else if (header.value.startsWith('Basic')) {
                        authMethods.add('basic');
                    }
                } else if (header.key.toLowerCase().includes('api-key')) {
                    authMethods.add('apikey');
                }
            });
        });

        // If no auth found at collection level, use inferred
        if (!this.serviceConfig.authentication.type && authMethods.size > 0) {
            this.serviceConfig.authentication.type = Array.from(authMethods)[0];
            this.serviceConfig.authentication.config = { inferred: true };
        }
    }

    extractEndpoints(items) {
        this.traverseItems(items, (request, itemName) => {
            if (request.url) {
                const endpoint = this.parseEndpoint(request, itemName);
                this.serviceConfig.endpoints.push(endpoint);
            }
        });
    }

    traverseItems(items, callback, path = []) {
        items.forEach(item => {
            const currentPath = [...path, item.name];
            
            if (item.request) {
                callback(item.request, item.name, currentPath);
            }
            
            if (item.item) {
                this.traverseItems(item.item, callback, currentPath);
            }
        });
    }

    parseEndpoint(request, name) {
        const url = request.url;
        let path = '';
        let queryParams = [];

        if (typeof url === 'string') {
            path = url;
        } else if (url.raw) {
            path = url.raw;
            queryParams = url.query || [];
        } else if (url.path) {
            path = '/' + url.path.join('/');
            queryParams = url.query || [];
        }

        // Extract path parameters
        const pathParams = this.extractPathParameters(path);
        
        // Extract query parameters
        const queryParameters = queryParams.map(q => ({
            name: q.key,
            description: q.description || '',
            required: !q.disabled,
            type: this.inferParameterType(q.value),
            default: q.value
        }));

        // Extract headers
        const headers = (request.header || []).map(h => ({
            name: h.key,
            value: h.value,
            description: h.description || '',
            required: !h.disabled
        }));

        // Extract body schema
        const body = this.extractBodySchema(request.body);

        return {
            name: name,
            path: this.cleanPath(path),
            method: request.method || 'GET',
            description: request.description || '',
            parameters: {
                path: pathParams,
                query: queryParameters,
                headers: headers,
                body: body
            },
            responses: this.extractResponses(request),
            rateLimit: this.extractRateLimit(request),
            authentication: request.auth ? this.parseAuthConfig(request.auth) : null
        };
    }

    extractPathParameters(path) {
        const matches = path.match(/\{\{([^}]+)\}\}/g) || [];
        return matches.map(match => {
            const paramName = match.replace(/[{}]/g, '');
            return {
                name: paramName,
                required: true,
                type: 'string',
                description: `Path parameter: ${paramName}`
            };
        });
    }

    cleanPath(path) {
        // Remove base URL if present
        if (this.serviceConfig.baseUrl && path.startsWith(this.serviceConfig.baseUrl)) {
            path = path.substring(this.serviceConfig.baseUrl.length);
        }
        
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        return path;
    }

    extractBodySchema(body) {
        if (!body) return null;

        const schema = {
            type: body.mode || 'raw',
            description: body.description || ''
        };

        switch (body.mode) {
            case 'raw':
                schema.content = body.raw;
                schema.contentType = this.inferContentType(body.raw);
                if (schema.contentType === 'application/json') {
                    try {
                        schema.schema = JSON.parse(body.raw);
                    } catch (e) {
                        // Invalid JSON, keep as string
                    }
                }
                break;
            case 'formdata':
                schema.fields = (body.formdata || []).map(field => ({
                    name: field.key,
                    type: field.type || 'text',
                    value: field.value,
                    description: field.description || ''
                }));
                break;
            case 'urlencoded':
                schema.fields = (body.urlencoded || []).map(field => ({
                    name: field.key,
                    value: field.value,
                    description: field.description || ''
                }));
                break;
        }

        return schema;
    }

    inferContentType(content) {
        if (!content) return 'text/plain';
        
        try {
            JSON.parse(content);
            return 'application/json';
        } catch (e) {
            if (content.includes('<?xml')) return 'application/xml';
            if (content.includes('=') && content.includes('&')) return 'application/x-www-form-urlencoded';
            return 'text/plain';
        }
    }

    extractResponses(request) {
        // Postman collections may have example responses
        const responses = [];
        
        if (request.response) {
            request.response.forEach(response => {
                responses.push({
                    name: response.name,
                    status: response.code,
                    statusText: response.status,
                    headers: response.header || [],
                    body: response.body,
                    contentType: this.getResponseContentType(response.header)
                });
            });
        }

        return responses;
    }

    getResponseContentType(headers) {
        const contentTypeHeader = headers?.find(h => 
            h.key.toLowerCase() === 'content-type'
        );
        return contentTypeHeader?.value || 'application/json';
    }

    extractRateLimit(request) {
        // Look for rate limit information in headers or description
        const headers = request.header || [];
        const rateLimitHeaders = headers.filter(h => 
            h.key.toLowerCase().includes('rate-limit') ||
            h.key.toLowerCase().includes('x-ratelimit')
        );

        if (rateLimitHeaders.length > 0) {
            return {
                headers: rateLimitHeaders.map(h => ({
                    name: h.key,
                    value: h.value
                }))
            };
        }

        return null;
    }

    inferParameterType(value) {
        if (!value) return 'string';
        if (value === 'true' || value === 'false') return 'boolean';
        if (!isNaN(value)) return 'number';
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
        return 'string';
    }

    determineCapabilities() {
        const capabilities = new Set();
        const serviceName = this.serviceConfig.name.toLowerCase();
        
        // Determine capabilities based on service name and endpoints
        if (serviceName.includes('payment') || serviceName.includes('stripe') || 
            serviceName.includes('bap') || serviceName.includes('wallet')) {
            capabilities.add('payment');
        }
        
        if (serviceName.includes('analytics') || serviceName.includes('tracking')) {
            capabilities.add('analytics');
        }
        
        if (serviceName.includes('media') || serviceName.includes('shutterstock')) {
            capabilities.add('media');
        }
        
        if (serviceName.includes('banking') || serviceName.includes('wise')) {
            capabilities.add('banking');
        }
        
        if (serviceName.includes('hosting') || serviceName.includes('hostinger') || 
            serviceName.includes('ngrok')) {
            capabilities.add('infrastructure');
        }

        // Analyze endpoints for additional capabilities
        this.serviceConfig.endpoints.forEach(endpoint => {
            const path = endpoint.path.toLowerCase();
            const name = endpoint.name.toLowerCase();
            
            if (path.includes('webhook') || name.includes('webhook')) {
                capabilities.add('webhooks');
            }
            
            if (path.includes('auth') || name.includes('auth')) {
                capabilities.add('authentication');
            }
            
            if (endpoint.method === 'POST' && (path.includes('upload') || name.includes('upload'))) {
                capabilities.add('file-upload');
            }
        });

        this.serviceConfig.capabilities = Array.from(capabilities);
    }

    extractDependencies() {
        // Analyze service for dependencies on other services
        const dependencies = new Set();
        
        // Check for references to other services in URLs or descriptions
        this.serviceConfig.endpoints.forEach(endpoint => {
            const content = JSON.stringify(endpoint).toLowerCase();
            
            // Common service dependencies
            if (content.includes('stripe')) dependencies.add('stripe');
            if (content.includes('paypal')) dependencies.add('paypal');
            if (content.includes('twilio')) dependencies.add('twilio');
            if (content.includes('sendgrid')) dependencies.add('sendgrid');
        });

        this.serviceConfig.dependencies = Array.from(dependencies);
    }

    saveServiceConfig(outputPath) {
        const configPath = path.join(outputPath, `${this.serviceConfig.name}.json`);
        fs.writeFileSync(configPath, JSON.stringify(this.serviceConfig, null, 2));
        console.log(`✅ Service config saved: ${configPath}`);
        return configPath;
    }
}

// CLI Usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: node extract-service.js [json-file-path] [output-directory]');
        process.exit(1);
    }

    const jsonFilePath = args[0];
    const outputDir = args[1] || './services';

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        const extractor = new ServiceExtractor();
        const serviceConfig = extractor.extractFromPostmanCollection(jsonFilePath);
        const configPath = extractor.saveServiceConfig(outputDir);
        
        console.log(`\n📊 Service Extraction Summary:`);
        console.log(`   Name: ${serviceConfig.name}`);
        console.log(`   Endpoints: ${serviceConfig.endpoints.length}`);
        console.log(`   Capabilities: ${serviceConfig.capabilities.join(', ')}`);
        console.log(`   Authentication: ${serviceConfig.authentication.type || 'None'}`);
        console.log(`   Dependencies: ${serviceConfig.dependencies.join(', ') || 'None'}`);
        
    } catch (error) {
        console.error('❌ Extraction failed:', error.message);
        process.exit(1);
    }
}

module.exports = ServiceExtractor;
