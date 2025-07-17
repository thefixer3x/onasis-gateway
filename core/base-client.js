/**
 * Base API Client
 * Universal client for all API services with comprehensive error handling
 */

const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');

class BaseClient extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            name: config.name || 'unknown-service',
            baseUrl: config.baseUrl || '',
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            authentication: config.authentication || {},
            rateLimit: config.rateLimit || {},
            ...config
        };

        this.axios = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': `API-Warehouse/${this.config.name}`,
                'Content-Type': 'application/json'
            }
        });

        this.setupInterceptors();
        this.rateLimiter = new Map();
        this.circuitBreaker = {
            failures: 0,
            lastFailureTime: null,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };
    }

    setupInterceptors() {
        // Request interceptor
        this.axios.interceptors.request.use(
            (config) => {
                // Add authentication
                this.addAuthentication(config);
                
                // Add rate limiting
                this.checkRateLimit();
                
                // Log request
                this.logRequest(config);
                
                return config;
            },
            (error) => {
                this.logError('Request Error', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.axios.interceptors.response.use(
            (response) => {
                // Reset circuit breaker on success
                this.circuitBreaker.failures = 0;
                this.circuitBreaker.state = 'CLOSED';
                
                // Update rate limit info
                this.updateRateLimit(response.headers);
                
                // Log response
                this.logResponse(response);
                
                return response;
            },
            (error) => {
                // Handle circuit breaker
                this.handleCircuitBreaker(error);
                
                // Log error
                this.logError('Response Error', error);
                
                return Promise.reject(error);
            }
        );
    }

    addAuthentication(config) {
        const auth = this.config.authentication;
        
        switch (auth.type) {
            case 'bearer':
                config.headers.Authorization = `Bearer ${auth.config.token}`;
                break;
                
            case 'apikey':
                if (auth.config.in === 'header') {
                    config.headers[auth.config.key] = auth.config.value;
                } else if (auth.config.in === 'query') {
                    config.params = config.params || {};
                    config.params[auth.config.key] = auth.config.value;
                }
                break;
                
            case 'basic':
                const credentials = Buffer.from(
                    `${auth.config.username}:${auth.config.password}`
                ).toString('base64');
                config.headers.Authorization = `Basic ${credentials}`;
                break;
                
            case 'hmac':
                // HMAC signature generation (for BAP and similar services)
                const signature = this.generateHMACSignature(config, auth.config);
                config.headers.Authorization = `${auth.config.prefix || 'HMAC'} ${signature}`;
                config.headers['baxi-date'] = new Date().toUTCString();
                break;
                
            case 'oauth2':
                // OAuth 2.0 handling
                if (auth.config.accessToken) {
                    config.headers.Authorization = `Bearer ${auth.config.accessToken}`;
                }
                break;
        }
    }

    generateHMACSignature(config, authConfig) {
        const method = config.method.toUpperCase();
        const endpoint = config.url.replace(this.config.baseUrl, '');
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = config.data ? JSON.stringify(config.data) : '';
        
        // Create payload hash
        const payloadHash = crypto.createHash('sha256').update(payload).digest('base64');
        
        // Create secured string
        const securedString = `${method}${endpoint}${timestamp}${payloadHash}`;
        
        // Generate HMAC signature
        const signature = crypto
            .createHmac('sha1', authConfig.secret)
            .update(securedString, 'utf8')
            .digest('base64');
            
        return `${authConfig.username}:${signature}`;
    }

    checkRateLimit() {
        const now = Date.now();
        const rateLimitKey = this.config.name;
        const rateLimit = this.rateLimiter.get(rateLimitKey);
        
        if (rateLimit && rateLimit.resetTime > now) {
            if (rateLimit.remaining <= 0) {
                const waitTime = rateLimit.resetTime - now;
                throw new Error(`Rate limit exceeded. Wait ${waitTime}ms`);
            }
        }
    }

    updateRateLimit(headers) {
        const rateLimitKey = this.config.name;
        const remaining = parseInt(headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'] || '1000');
        const resetTime = parseInt(headers['x-ratelimit-reset'] || headers['x-rate-limit-reset'] || '0') * 1000;
        
        this.rateLimiter.set(rateLimitKey, {
            remaining,
            resetTime: resetTime || Date.now() + 3600000 // 1 hour default
        });
    }

    handleCircuitBreaker(error) {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();
        
        // Open circuit after 5 failures
        if (this.circuitBreaker.failures >= 5) {
            this.circuitBreaker.state = 'OPEN';
            this.emit('circuit-breaker-open', {
                service: this.config.name,
                failures: this.circuitBreaker.failures
            });
        }
    }

    isCircuitOpen() {
        if (this.circuitBreaker.state === 'OPEN') {
            const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
            
            // Try to half-open after 60 seconds
            if (timeSinceLastFailure > 60000) {
                this.circuitBreaker.state = 'HALF_OPEN';
                return false;
            }
            return true;
        }
        return false;
    }

    async request(endpoint, options = {}) {
        if (this.isCircuitOpen()) {
            throw new Error(`Circuit breaker is OPEN for ${this.config.name}`);
        }

        const config = {
            url: endpoint.path,
            method: endpoint.method || 'GET',
            ...options
        };

        return this.retryRequest(config);
    }

    async retryRequest(config, attempt = 1) {
        try {
            const response = await this.axios(config);
            return response.data;
        } catch (error) {
            if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
                const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await this.sleep(delay);
                return this.retryRequest(config, attempt + 1);
            }
            throw error;
        }
    }

    shouldRetry(error) {
        // Retry on network errors, timeouts, and 5xx errors
        return (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            (error.response && error.response.status >= 500)
        );
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    logRequest(config) {
        this.emit('request', {
            service: this.config.name,
            method: config.method,
            url: config.url,
            timestamp: new Date().toISOString()
        });
    }

    logResponse(response) {
        this.emit('response', {
            service: this.config.name,
            status: response.status,
            statusText: response.statusText,
            timestamp: new Date().toISOString()
        });
    }

    logError(type, error) {
        this.emit('error', {
            service: this.config.name,
            type,
            message: error.message,
            status: error.response?.status,
            timestamp: new Date().toISOString()
        });
    }

    // Health check method
    async healthCheck() {
        try {
            // Try to make a simple request to test connectivity
            const response = await this.axios.get('/health', { timeout: 5000 });
            return {
                service: this.config.name,
                status: 'healthy',
                responseTime: response.headers['x-response-time'] || 'unknown',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                service: this.config.name,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Generic method generators based on endpoints
    generateMethods(endpoints) {
        endpoints.forEach(endpoint => {
            const methodName = this.sanitizeMethodName(endpoint.name);
            
            this[methodName] = async (params = {}, options = {}) => {
                // Replace path parameters
                let path = endpoint.path;
                if (endpoint.parameters.path) {
                    endpoint.parameters.path.forEach(param => {
                        if (params[param.name]) {
                            path = path.replace(`{${param.name}}`, params[param.name]);
                        }
                    });
                }

                const config = {
                    url: path,
                    method: endpoint.method,
                    ...options
                };

                // Add query parameters
                if (endpoint.parameters.query && Object.keys(params).length > 0) {
                    config.params = {};
                    endpoint.parameters.query.forEach(param => {
                        if (params[param.name] !== undefined) {
                            config.params[param.name] = params[param.name];
                        }
                    });
                }

                // Add body data
                if (endpoint.parameters.body && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
                    config.data = params.body || params;
                }

                return this.retryRequest(config);
            };
        });
    }

    sanitizeMethodName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
}

module.exports = BaseClient;
