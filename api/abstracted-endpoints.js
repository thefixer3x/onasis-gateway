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
    if (!error) return 400;
    const s = error.status;
    if (typeof s === 'number' && s >= 100 && s <= 599) return s;
    return 400;
  }

  shouldExposeVendor() {
    return process.env.ABSTRACTION_EXPOSE_VENDOR === '1';
  }

  setupRoutes() {
    // Generic abstracted endpoint
    this.router.post('/api/v1/:category/:operation', this.handleAbstractedCall.bind(this));
    
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

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AbstractedAPIEndpoints;
