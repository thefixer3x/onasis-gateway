/**
 * Abstracted API Endpoints
 * Client-facing API that completely abstracts vendor implementations
 */

const express = require('express');
const VendorAbstractionLayer = require('../core/abstraction/vendor-abstraction');

class AbstractedAPIEndpoints {
  constructor() {
    this.router = express.Router();
    this.abstraction = new VendorAbstractionLayer();
    this.setupRoutes();
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

      const result = await this.abstraction.executeAbstractedCall(
        category,
        operation,
        input,
        vendor
      );

      res.json({
        success: true,
        category,
        operation,
        data: result.data,
        metadata: {
          ...result.metadata,
          requestId: req.headers['x-request-id'] || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
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
      
      const result = await this.abstraction.executeAbstractedCall(
        'payment',
        'initializeTransaction',
        paymentData,
        vendor
      );

      res.json({
        success: true,
        transaction: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handlePaymentVerify(req, res) {
    try {
      const { vendor, reference } = req.body;
      
      const result = await this.abstraction.executeAbstractedCall(
        'payment',
        'verifyTransaction',
        { reference },
        vendor
      );

      res.json({
        success: true,
        verification: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleCreateCustomer(req, res) {
    try {
      const { vendor, ...customerData } = req.body;
      
      const result = await this.abstraction.executeAbstractedCall(
        'payment',
        'createCustomer',
        customerData,
        vendor
      );

      res.json({
        success: true,
        customer: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleGetBalance(req, res) {
    try {
      const { vendor, accountId } = req.body;
      
      const result = await this.abstraction.executeAbstractedCall(
        'banking',
        'getAccountBalance',
        { accountId },
        vendor
      );

      res.json({
        success: true,
        balance: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleTransfer(req, res) {
    try {
      const { vendor, ...transferData } = req.body;
      
      const result = await this.abstraction.executeAbstractedCall(
        'banking',
        'transferFunds',
        transferData,
        vendor
      );

      res.json({
        success: true,
        transfer: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleVerifyAccount(req, res) {
    try {
      const { vendor, accountNumber, bankCode } = req.body;
      
      const result = await this.abstraction.executeAbstractedCall(
        'banking',
        'verifyAccount',
        { accountNumber, bankCode },
        vendor
      );

      res.json({
        success: true,
        verification: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleCreateTunnel(req, res) {
    try {
      const { vendor, ...tunnelData } = req.body;
      
      const result = await this.abstraction.executeAbstractedCall(
        'infrastructure',
        'createTunnel',
        tunnelData,
        vendor
      );

      res.json({
        success: true,
        tunnel: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    }
  }

  async handleListTunnels(req, res) {
    try {
      const vendor = req.query.vendor;
      
      const result = await this.abstraction.executeAbstractedCall(
        'infrastructure',
        'listTunnels',
        {},
        vendor
      );

      res.json({
        success: true,
        tunnels: result.data,
        vendor: result.metadata.vendor,
        requestId: req.headers['x-request-id'] || this.generateRequestId()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
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
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AbstractedAPIEndpoints;
