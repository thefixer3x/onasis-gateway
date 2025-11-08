// services/providus-bank/webhooks.js
const express = require('express');
const crypto = require('crypto');

class ProvidusBankWebhooks {
  constructor(config = {}) {
    this.config = {
      secret: config.secret || process.env.PROVIDUS_WEBHOOK_SECRET,
      endpoints: {
        transaction: '/webhooks/providus/transaction',
        wallet: '/webhooks/providus/wallet',
        general: '/webhooks/providus/general'
      },
      ...config
    };
  }

  // ================== Webhook Handlers ==================

  handleTransactionWebhook(req, res) {
    try {
      const payload = req.body;
      
      // Validate webhook signature if secret is configured
      if (this.config.secret && !this.validateSignature(req)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📡 Transaction webhook received:', {
        event: payload.event,
        transactionId: payload.data?.transactionId,
        amount: payload.data?.amount,
        status: payload.data?.status
      });

      // Process transaction webhook
      this.processTransactionEvent(payload);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Transaction webhook error:', error.message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  handleWalletWebhook(req, res) {
    try {
      const payload = req.body;
      
      if (this.config.secret && !this.validateSignature(req)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📡 Wallet webhook received:', {
        event: payload.event,
        walletId: payload.data?.walletId,
        balance: payload.data?.balance
      });

      // Process wallet webhook
      this.processWalletEvent(payload);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Wallet webhook error:', error.message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  handleGeneralWebhook(req, res) {
    try {
      const payload = req.body;
      
      if (this.config.secret && !this.validateSignature(req)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📡 General webhook received:', {
        event: payload.event,
        timestamp: payload.timestamp
      });

      // Process general webhook
      this.processGeneralEvent(payload);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ General webhook error:', error.message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // ================== Event Processors ==================

  processTransactionEvent(payload) {
    const { event, data } = payload;

    switch (event) {
      case 'transaction.created':
        console.log('💳 Transaction created:', data.transactionId);
        // Handle new transaction
        break;
        
      case 'transaction.completed':
        console.log('✅ Transaction completed:', data.transactionId);
        // Handle completed transaction
        break;
        
      case 'transaction.failed':
        console.log('❌ Transaction failed:', data.transactionId);
        // Handle failed transaction
        break;
        
      case 'transaction.reversed':
        console.log('🔄 Transaction reversed:', data.transactionId);
        // Handle transaction reversal
        break;
        
      default:
        console.log('🔔 Unknown transaction event:', event);
    }
  }

  processWalletEvent(payload) {
    const { event, data } = payload;

    switch (event) {
      case 'wallet.credit':
        console.log('💰 Wallet credited:', data.walletId);
        // Handle wallet credit
        break;
        
      case 'wallet.debit':
        console.log('💸 Wallet debited:', data.walletId);
        // Handle wallet debit
        break;
        
      case 'wallet.frozen':
        console.log('🧊 Wallet frozen:', data.walletId);
        // Handle wallet freeze
        break;
        
      case 'wallet.unfrozen':
        console.log('🔓 Wallet unfrozen:', data.walletId);
        // Handle wallet unfreeze
        break;
        
      default:
        console.log('🔔 Unknown wallet event:', event);
    }
  }

  processGeneralEvent(payload) {
    const { event, data } = payload;

    switch (event) {
      case 'merchant.verified':
        console.log('✅ Merchant verified:', data.merchantId);
        // Handle merchant verification
        break;
        
      case 'merchant.suspended':
        console.log('⚠️ Merchant suspended:', data.merchantId);
        // Handle merchant suspension
        break;
        
      case 'kyc.completed':
        console.log('📋 KYC completed:', data.customerId);
        // Handle KYC completion
        break;
        
      default:
        console.log('🔔 Unknown general event:', event);
    }
  }

  // ================== Security ==================

  validateSignature(req) {
    try {
      const signature = req.headers['x-providus-signature'];
      const payload = JSON.stringify(req.body);
      
      if (!signature || !this.config.secret) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.config.secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('❌ Signature validation error:', error.message);
      return false;
    }
  }

  // ================== Router Setup ==================

  getRouter() {
    const router = express.Router();

    // Middleware for parsing JSON
    router.use(express.json());

    // Transaction webhooks
    router.post(this.config.endpoints.transaction, (req, res) => {
      this.handleTransactionWebhook(req, res);
    });

    // Wallet webhooks
    router.post(this.config.endpoints.wallet, (req, res) => {
      this.handleWalletWebhook(req, res);
    });

    // General webhooks
    router.post(this.config.endpoints.general, (req, res) => {
      this.handleGeneralWebhook(req, res);
    });

    return router;
  }

  // ================== Utility Methods ==================

  getEndpoints() {
    return this.config.endpoints;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

module.exports = ProvidusBankWebhooks;