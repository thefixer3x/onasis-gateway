/**
 * Abstracted API Endpoints
 * Client-facing API that completely abstracts vendor implementations
 */

const express = require('express');
const VendorAbstractionLayer = require('../core/abstraction/vendor-abstraction');

class AbstractedAPIEndpoints {
  constructor(options = {}) {
    this.router = express.Router();
    this.abstraction = new VendorAbstractionLayer({
      adapterRegistry: options.adapterRegistry,
      getAdapterRegistry: options.getAdapterRegistry
    });
    this.setupRoutes();
  }

  buildContext(req) {
    const headers = req && req.headers ? req.headers : {};
    return {
      headers,
      authorization: headers.authorization || headers.Authorization,
      apiKey: headers['x-api-key'] || headers['X-API-Key'],
      projectScope: headers['x-project-scope'] || headers['X-Project-Scope'],
      requestId: headers['x-request-id'] || headers['X-Request-ID'],
      sessionId: headers['x-session-id'] || headers['X-Session-ID']
    };
  }

  getStatusCode(error) {
    if (!error) return 500;
    const s = error.status;
    if (typeof s === 'number' && s >= 100 && s <= 599) return s;
    return 500;
  }

  shouldExposeVendor() {
    return process.env.ABSTRACTION_EXPOSE_VENDOR === '1';
  }

  setupRoutes() {
    // Specific payment endpoints (for convenience)
    this.router.post('/api/v1/payments/initialize', this.handlePaymentInitialize.bind(this));
    this.router.post('/api/v1/payments/verify', this.handlePaymentVerify.bind(this));
    this.router.post('/api/v1/payments/customer', this.handleCreateCustomer.bind(this));
    
    // Banking endpoints
    this.router.post('/api/v1/banking/balance', this.handleGetBalance.bind(this));
    this.router.post('/api/v1/banking/transfer', this.handleTransfer.bind(this));
    this.router.post('/api/v1/banking/verify-account', this.handleVerifyAccount.bind(this));
    
    // Infrastructure endpoints
    this.router.post('/api/v1/infrastructure/tunnel', this.handleCreateTunnel.bind(this));
    this.router.get('/api/v1/infrastructure/tunnels', this.handleListTunnels.bind(this));
    
    // Discovery endpoints
    this.router.get('/api/v1/categories', this.handleGetCategories.bind(this));
    this.router.get('/api/v1/categories/:category', this.handleGetCategoryInfo.bind(this));
    this.router.get('/api/v1/categories/:category/schema/:operation', this.handleGetSchema.bind(this));

    // Internal service endpoints
    this.router.post('/api/v1/auth/:operation', this.handleAuthOperation.bind(this));
    this.router.post('/api/v1/ai/:operation', this.handleAIOperation.bind(this));
    this.router.post('/api/v1/memory/:operation', this.handleMemoryOperation.bind(this));
    this.router.post('/api/v1/intelligence/:operation', this.handleIntelligenceOperation.bind(this));
    this.router.post('/api/v1/security/:operation', this.handleSecurityOperation.bind(this));
    this.router.post('/api/v1/verification/:operation', this.handleVerificationOperation.bind(this));

    // Generic abstracted endpoint (catch-all): keep last so it doesn't shadow internal/specific routes
    this.router.post('/api/v1/:category/:operation', this.handleAbstractedCall.bind(this));
  }

  async handleAbstractedCall(req, res) {
    try {
      const { category, operation } = req.params;
      const { vendor, ...input } = req.body;
      const context = this.buildContext(req);

      const result = await this.abstraction.executeAbstractedCall(
        category,
        operation,
        input,
        vendor,
        context
      );

      const response = {
        success: true,
        category,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      };

      // Do not expose vendor selection to clients by default.
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.metadata.vendor = result.metadata.vendor;
      }

      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        category: req.params.category,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  // Convenience payment endpoints
  async handlePaymentInitialize(req, res) {
    try {
      const { vendor, ...paymentData } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'payment',
        'initializeTransaction',
        paymentData,
        vendor,
        context
      );

      const response = {
        success: true,
        transaction: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handlePaymentVerify(req, res) {
    try {
      const { vendor, reference } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'payment',
        'verifyTransaction',
        { reference },
        vendor,
        context
      );

      const response = {
        success: true,
        verification: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleCreateCustomer(req, res) {
    try {
      const { vendor, ...customerData } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'payment',
        'createCustomer',
        customerData,
        vendor,
        context
      );

      const response = {
        success: true,
        customer: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleGetBalance(req, res) {
    try {
      const { vendor, accountId } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'banking',
        'getAccountBalance',
        { accountId },
        vendor,
        context
      );

      const response = {
        success: true,
        balance: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleTransfer(req, res) {
    try {
      const { vendor, ...transferData } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'banking',
        'transferFunds',
        transferData,
        vendor,
        context
      );

      const response = {
        success: true,
        transfer: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleVerifyAccount(req, res) {
    try {
      const { vendor, accountNumber, bankCode } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'banking',
        'verifyAccount',
        { accountNumber, bankCode },
        vendor,
        context
      );

      const response = {
        success: true,
        verification: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleCreateTunnel(req, res) {
    try {
      const { vendor, ...tunnelData } = req.body;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'infrastructure',
        'createTunnel',
        tunnelData,
        vendor,
        context
      );

      const response = {
        success: true,
        tunnel: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleListTunnels(req, res) {
    try {
      const vendor = req.query.vendor;
      const context = this.buildContext(req);
      
      const result = await this.abstraction.executeAbstractedCall(
        'infrastructure',
        'listTunnels',
        {},
        vendor,
        context
      );

      const response = {
        success: true,
        tunnels: result.data,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      };
      if (this.shouldExposeVendor() && result && result.metadata && result.metadata.vendor) {
        response.vendor = result.metadata.vendor;
      }
      res.json(response);
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  // Discovery endpoints
  async handleGetCategories(req, res) {
    try {
      const categories = this.abstraction.getAvailableCategories();
      
      res.json({
        success: true,
        categories: categories.map(category => ({
          name: category,
          operations: this.abstraction.getCategoryOperations(category),
          vendors: this.abstraction.getCategoryVendors(category)
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async handleGetCategoryInfo(req, res) {
    try {
      const { category } = req.params;
      const operations = this.abstraction.getCategoryOperations(category);
      const vendors = this.abstraction.getCategoryVendors(category);
      
      res.json({
        success: true,
        category,
        operations,
        vendors,
        schemas: operations.reduce((acc, op) => {
          acc[op] = this.abstraction.getClientSchema(category, op);
          return acc;
        }, {})
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async handleGetSchema(req, res) {
    try {
      const { category, operation } = req.params;
      const schema = this.abstraction.getClientSchema(category, operation);

      if (!schema) {
        return res.status(404).json({
          success: false,
          error: `Schema not found for ${category}/${operation}`
        });
      }

      res.json({
        success: true,
        category,
        operation,
        schema
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Internal service handlers
  async handleAuthOperation(req, res) {
    try {
      const { operation } = req.params;
      const { ...input } = req.body;
      const context = this.buildContext(req);

      // Map kebab-case URL params to camelCase operation names (vendor-abstraction.js client keys)
      const operationMap = {
        'login': 'login',
        'exchange-supabase-token': 'exchangeSupabaseToken',
        'logout': 'logout',
        'get-session': 'getSession',
        'verify-token': 'verifyToken',
        'list-sessions': 'listSessions',
        'initiate-oauth': 'initiateOAuth',
        'request-magic-link': 'requestMagicLink',
        'verify-api-key': 'verifyAPIKey',
        'create-api-key': 'createAPIKey',
        'list-api-keys': 'listAPIKeys',
        'get-api-key': 'getAPIKey',
        'rotate-api-key': 'rotateAPIKey',
        'revoke-api-key': 'revokeAPIKey',
        'delete-api-key': 'deleteAPIKey'
      };

      const toolName = operationMap[operation] || operation;
      const result = await this.abstraction.executeAbstractedCall(
        'auth',
        toolName,
        input,
        null, // No vendor for internal services
        context
      );

      res.json({
        success: true,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleAIOperation(req, res) {
    try {
      const { operation } = req.params;
      const { ...input } = req.body;
      const context = this.buildContext(req);

      // Map kebab-case URL params to camelCase operation names (vendor-abstraction.js client keys)
      const operationMap = {
        'chat': 'chat',
        'ollama': 'ollama',
        'list-services': 'listServices',
        'health': 'health'
      };

      const toolName = operationMap[operation] || operation;
      const result = await this.abstraction.executeAbstractedCall(
        'ai',
        toolName,
        input,
        null, // No vendor for internal services
        context
      );

      res.json({
        success: true,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleMemoryOperation(req, res) {
    try {
      const { operation } = req.params;
      const { ...input } = req.body;
      const context = this.buildContext(req);

      // Map kebab-case URL params to camelCase operation names (vendor-abstraction.js client keys)
      const operationMap = {
        'create': 'create',
        'get': 'get',
        'update': 'update',
        'delete': 'delete',
        'list': 'list',
        'search': 'search',
        'stats': 'stats',
        'bulk-delete': 'bulkDelete',
        'search-documentation': 'searchDocumentation'
      };

      const toolName = operationMap[operation] || operation;
      const result = await this.abstraction.executeAbstractedCall(
        'memory',
        toolName,
        input,
        null, // No vendor for internal services
        context
      );

      res.json({
        success: true,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleIntelligenceOperation(req, res) {
    try {
      const { operation } = req.params;
      const { ...input } = req.body;
      const context = this.buildContext(req);

      // Map kebab-case URL params to camelCase operation names (vendor-abstraction.js client keys)
      const operationMap = {
        'analyze-patterns': 'analyzePatterns',
        'suggest-tags': 'suggestTags',
        'find-related': 'findRelated',
        'detect-duplicates': 'detectDuplicates',
        'extract-insights': 'extractInsights',
        'health-check': 'healthCheck',
        'behavior-record': 'behaviorRecord',
        'behavior-recall': 'behaviorRecall',
        'behavior-suggest': 'behaviorSuggest'
      };

      const toolName = operationMap[operation] || operation;
      const result = await this.abstraction.executeAbstractedCall(
        'intelligence',
        toolName,
        input,
        null, // No vendor for internal services
        context
      );

      res.json({
        success: true,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleSecurityOperation(req, res) {
    try {
      const { operation } = req.params;
      const { ...input } = req.body;
      const context = this.buildContext(req);

      // Map kebab-case URL params to camelCase operation names (vendor-abstraction.js client keys)
      const operationMap = {
        'create-api-key': 'createAPIKey',
        'delete-api-key': 'deleteAPIKey',
        'rotate-api-key': 'rotateAPIKey',
        'revoke-api-key': 'revokeAPIKey',
        'list-api-keys': 'listAPIKeys',
        'get-api-key': 'getAPIKey',
        'verify-api-key': 'verifyAPIKey',
        'verify-token': 'verifyToken'
      };

      const toolName = operationMap[operation] || operation;
      const result = await this.abstraction.executeAbstractedCall(
        'security',
        toolName,
        input,
        null, // No vendor for internal services
        context
      );

      res.json({
        success: true,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleVerificationOperation(req, res) {
    try {
      const { operation } = req.params;
      const { ...input } = req.body;
      const context = this.buildContext(req);

      // Map kebab-case URL params to camelCase operation names (vendor-abstraction.js client keys)
      const operationMap = {
        'verify-nin': 'verifyNIN',
        'verify-bvn': 'verifyBVN',
        'verify-passport': 'verifyPassport',
        'verify-document': 'verifyDocument',
        'get-history': 'getHistory'
      };

      const toolName = operationMap[operation] || operation;
      const result = await this.abstraction.executeAbstractedCall(
        'verification',
        toolName,
        input,
        null, // No vendor for internal services
        context
      );

      res.json({
        success: true,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(this.getStatusCode(error)).json({
        success: false,
        error: error.message,
        code: error.code,
        operation: req.params.operation,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AbstractedAPIEndpoints;
