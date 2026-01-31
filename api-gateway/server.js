const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Import core modules
const BaseClient = require('../core/base-client');
const VersionManager = require('../core/versioning/version-manager');
const ComplianceManager = require('../core/security/compliance-manager');
const MetricsCollector = require('../core/monitoring/metrics-collector');

/**
 * API Gateway Server
 * Central hub for all API service integrations
 */
class APIGateway {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.services = new Map();
    this.clients = new Map();
    
    // Initialize core components
    this.versionManager = new VersionManager();
    this.complianceManager = new ComplianceManager();
    this.metricsCollector = new MetricsCollector();
    
    this.setupMiddleware();
    this.loadServices();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
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
    this.app.use(express.urlencoded({ extended: true }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = crypto.randomUUID();
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Metrics middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.metricsCollector.recordRequest({
          service: req.service || 'gateway',
          endpoint: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          responseSize: res.get('content-length') || 0,
          version: req.version || 'v1'
        });
      });
      
      next();
    });
  }

  /**
   * Load all services from the services directory
   */
  loadServices() {
    const servicesDir = path.join(__dirname, '../services');
    
    if (!fs.existsSync(servicesDir)) {
      console.warn('Services directory not found:', servicesDir);
      return;
    }

    const serviceDirs = fs.readdirSync(servicesDir)
      .filter(dir => fs.statSync(path.join(servicesDir, dir)).isDirectory());

    for (const serviceDir of serviceDirs) {
      try {
        const servicePath = path.join(servicesDir, serviceDir);
        const configFiles = fs.readdirSync(servicePath)
          .filter(file => file.endsWith('.json') && file !== 'catalog.json');

        for (const configFile of configFiles) {
          const configPath = path.join(servicePath, configFile);
          const serviceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          // Register service with version manager
          this.versionManager.registerVersion(
            serviceConfig.name,
            serviceConfig.version || 'v1.0.0',
            serviceConfig
          );

          // Store service configuration
          this.services.set(serviceConfig.name, serviceConfig);

          // Create client instance
          const client = new BaseClient(serviceConfig);
          this.clients.set(serviceConfig.name, client);

          console.log(`✅ Loaded service: ${serviceConfig.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load service ${serviceDir}:`, error.message);
      }
    }

    console.log(`📦 Loaded ${this.services.size} services`);
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.services.size,
        uptime: process.uptime()
      });
    });

    // Readiness check
    this.app.get('/ready', (req, res) => {
      const ready = this.services.size > 0;
      res.status(ready ? 200 : 503).json({
        ready,
        services: this.services.size
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(await this.metricsCollector.getMetrics());
    });

    // Service catalog
    this.app.get('/api/services', (req, res) => {
      const services = Array.from(this.services.values()).map(service => ({
        name: service.name,
        version: service.version,
        baseUrl: service.baseUrl,
        endpoints: service.endpoints?.length || 0,
        capabilities: service.capabilities || [],
        authentication: service.authentication?.type || 'none'
      }));

      res.json({
        total: services.length,
        services
      });
    });

    // Service details
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

    // Service proxy endpoint
    this.app.all('/api/services/:serviceName/*', async (req, res) => {
      const { serviceName } = req.params;
      const endpoint = req.params[0];
      
      req.service = serviceName;
      req.endpoint = endpoint;

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
            error: 'Service client not available',
            service: serviceName
          });
        }

        // Validate compliance
        const complianceResult = await this.complianceManager.validateServiceCompliance(service);
        if (complianceResult.overall === 'NON_COMPLIANT') {
          return res.status(403).json({
            error: 'Service compliance violation',
            violations: complianceResult.violations
          });
        }

        // Apply data handling compliance
        let requestData = req.body;
        if (requestData) {
          requestData = this.complianceManager.enforceDataHandling(
            serviceName,
            requestData,
            'request'
          );
        }

        // Make the API call
        const response = await client.request({
          method: req.method,
          path: `/${endpoint}`,
          data: requestData,
          params: req.query,
          headers: this.extractHeaders(req)
        });

        // Apply compliance to response data
        let responseData = response.data;
        if (responseData) {
          responseData = this.complianceManager.enforceDataHandling(
            serviceName,
            responseData,
            'response'
          );
        }

        res.status(response.status || 200).json(responseData);

      } catch (error) {
        console.error(`API Gateway error for ${serviceName}/${endpoint}:`, error.message);
        
        this.metricsCollector.recordError({
          service: serviceName,
          endpoint,
          errorType: this.getErrorType(error),
          errorCode: error.response?.status || 500
        });

        res.status(error.response?.status || 500).json({
          error: 'Service request failed',
          message: error.message,
          service: serviceName,
          endpoint,
          requestId: req.id
        });
      }
    });

    // Service activation/deactivation
    this.app.post('/api/services/:serviceName/activate', (req, res) => {
      const { serviceName } = req.params;
      const service = this.services.get(serviceName);

      if (!service) {
        return res.status(404).json({
          error: 'Service not found',
          service: serviceName
        });
      }

      // Activate service (implementation depends on requirements)
      service.active = true;
      
      res.json({
        message: 'Service activated',
        service: serviceName,
        status: 'active'
      });
    });

    this.app.post('/api/services/:serviceName/deactivate', (req, res) => {
      const { serviceName } = req.params;
      const service = this.services.get(serviceName);

      if (!service) {
        return res.status(404).json({
          error: 'Service not found',
          service: serviceName
        });
      }

      // Deactivate service
      service.active = false;
      
      res.json({
        message: 'Service deactivated',
        service: serviceName,
        status: 'inactive'
      });
    });

    // Webhook endpoints
    this.app.post('/api/webhooks/:serviceName', async (req, res) => {
      const { serviceName } = req.params;
      
      try {
        // Process webhook
        const result = await this.processWebhook(serviceName, req.body, req.headers);
        
        res.json({
          message: 'Webhook processed',
          service: serviceName,
          result
        });
      } catch (error) {
        console.error(`Webhook error for ${serviceName}:`, error.message);
        res.status(500).json({
          error: 'Webhook processing failed',
          message: error.message
        });
      }
    });
  }

  /**
   * Extract relevant headers for API calls
   */
  extractHeaders(req) {
    const headers = {};
    const relevantHeaders = [
      'authorization',
      'content-type',
      'accept',
      'user-agent',
      'x-api-key',
      'x-auth-token'
    ];

    relevantHeaders.forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });

    return headers;
  }

  /**
   * Process webhook
   */
  async processWebhook(serviceName, payload, headers) {
    // Webhook processing logic
    console.log(`Processing webhook for ${serviceName}`);
    
    // Validate webhook signature if required
    // Process payload
    // Trigger any necessary actions
    
    return { processed: true, timestamp: new Date().toISOString() };
  }

  /**
   * Get error type for metrics
   */
  getErrorType(error) {
    if (error.response) {
      const status = error.response.status;
      if (status >= 400 && status < 500) return 'client_error';
      if (status >= 500) return 'server_error';
    }
    if (error.code === 'ECONNREFUSED') return 'connection_error';
    if (error.code === 'ETIMEDOUT') return 'timeout_error';
    return 'unknown_error';
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Global error handler:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        requestId: req.id
      });
    });
  }

  /**
   * Start the server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 API Gateway running on port ${this.port}`);
      console.log(`📊 Health check: http://localhost:${this.port}/health`);
      console.log(`📋 Services: http://localhost:${this.port}/api/services`);
      console.log(`📈 Metrics: http://localhost:${this.port}/metrics`);
    });
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const gateway = new APIGateway();
  gateway.start();
}

module.exports = APIGateway;
