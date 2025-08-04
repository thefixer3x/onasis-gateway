/**
 * PayStack Payment Gateway Client
 * Comprehensive client matching Flutterwave's implementation approach
 */

const axios = require('axios');
const crypto = require('crypto');

class PayStackClient {
  constructor(config = {}) {
    this.secretKey = config.secretKey || process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = config.publicKey || process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = config.baseURL || 'https://api.paystack.co';
    this.environment = config.environment || 'live'; // 'live' or 'test'
    
    // Service provider configuration for third-party clients
    this.serviceProvider = {
      enabled: config.serviceProvider?.enabled || false,
      clientId: config.serviceProvider?.clientId,
      clientBranding: config.serviceProvider?.branding || {}
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  // ============================================================================
  // PAYMENT PROCESSING SERVICES
  // ============================================================================

  /**
   * Initialize payment transaction
   */
  async initializeTransaction(paymentData) {
    try {
      const payload = {
        reference: paymentData.reference || this.generateReference('PSK'),
        amount: this.convertToKobo(paymentData.amount),
        currency: paymentData.currency || 'NGN',
        email: paymentData.email,
        callback_url: paymentData.callback_url,
        plan: paymentData.plan,
        invoice_limit: paymentData.invoice_limit,
        channels: paymentData.channels || ['card', 'bank', 'ussd', 'qr'],
        split_code: paymentData.split_code,
        subaccount: paymentData.subaccount,
        transaction_charge: paymentData.transaction_charge,
        bearer: paymentData.bearer || 'account',
        metadata: {
          client_id: this.serviceProvider.clientId,
          ...paymentData.metadata
        }
      };

      const response = await this.client.post('/transaction/initialize', payload);
      
      return this.formatResponse('transaction_initialized', response.data);
    } catch (error) {
      throw this.handleError('initialize_transaction', error);
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyTransaction(reference) {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);
      return this.formatResponse('transaction_verified', response.data);
    } catch (error) {
      throw this.handleError('verify_transaction', error);
    }
  }

  /**
   * Charge authorization (returning customer)
   */
  async chargeAuthorization(chargeData) {
    try {
      const payload = {
        authorization_code: chargeData.authorization_code,
        email: chargeData.email,
        amount: this.convertToKobo(chargeData.amount),
        currency: chargeData.currency || 'NGN',
        reference: chargeData.reference || this.generateReference('PSK_AUTH'),
        metadata: {
          client_id: this.serviceProvider.clientId,
          ...chargeData.metadata
        }
      };

      const response = await this.client.post('/transaction/charge_authorization', payload);
      return this.formatResponse('authorization_charged', response.data);
    } catch (error) {
      throw this.handleError('charge_authorization', error);
    }
  }

  /**
   * List transactions with filters
   */
  async listTransactions(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.perPage) params.append('perPage', options.perPage);
      if (options.page) params.append('page', options.page);
      if (options.from) params.append('from', options.from);
      if (options.to) params.append('to', options.to);
      if (options.status) params.append('status', options.status);
      if (options.customer) params.append('customer', options.customer);

      const queryString = params.toString();
      const endpoint = `/transaction${queryString ? '?' + queryString : ''}`;
      
      const response = await this.client.get(endpoint);
      return this.formatResponse('transactions_listed', response.data);
    } catch (error) {
      throw this.handleError('list_transactions', error);
    }
  }

  // ============================================================================
  // CUSTOMER MANAGEMENT
  // ============================================================================

  /**
   * Create customer profile
   */
  async createCustomer(customerData) {
    try {
      const payload = {
        email: customerData.email,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        phone: customerData.phone,
        metadata: {
          client_id: this.serviceProvider.clientId,
          ...customerData.metadata
        }
      };

      const response = await this.client.post('/customer', payload);
      return this.formatResponse('customer_created', response.data);
    } catch (error) {
      throw this.handleError('create_customer', error);
    }
  }

  /**
   * Fetch customer details
   */
  async fetchCustomer(emailOrCode) {
    try {
      const response = await this.client.get(`/customer/${emailOrCode}`);
      return this.formatResponse('customer_fetched', response.data);
    } catch (error) {
      throw this.handleError('fetch_customer', error);
    }
  }

  /**
   * List customers with pagination
   */
  async listCustomers(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.perPage) params.append('perPage', options.perPage);
      if (options.page) params.append('page', options.page);
      if (options.from) params.append('from', options.from);
      if (options.to) params.append('to', options.to);

      const queryString = params.toString();
      const endpoint = `/customer${queryString ? '?' + queryString : ''}`;
      
      const response = await this.client.get(endpoint);
      return this.formatResponse('customers_listed', response.data);
    } catch (error) {
      throw this.handleError('list_customers', error);
    }
  }

  // ============================================================================
  // VIRTUAL ACCOUNTS (DEDICATED ACCOUNTS)
  // ============================================================================

  /**
   * Create dedicated virtual account
   */
  async createDedicatedAccount(accountData) {
    try {
      const payload = {
        customer: accountData.customer,
        preferred_bank: accountData.preferred_bank || 'wema-bank',
        subaccount: accountData.subaccount,
        split_code: accountData.split_code
      };

      const response = await this.client.post('/dedicated_account', payload);
      return this.formatResponse('dedicated_account_created', response.data);
    } catch (error) {
      throw this.handleError('create_dedicated_account', error);
    }
  }

  /**
   * List dedicated accounts
   */
  async listDedicatedAccounts(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.active !== undefined) params.append('active', options.active);
      if (options.currency) params.append('currency', options.currency);
      if (options.perPage) params.append('perPage', options.perPage);
      if (options.page) params.append('page', options.page);

      const queryString = params.toString();
      const endpoint = `/dedicated_account${queryString ? '?' + queryString : ''}`;
      
      const response = await this.client.get(endpoint);
      return this.formatResponse('dedicated_accounts_listed', response.data);
    } catch (error) {
      throw this.handleError('list_dedicated_accounts', error);
    }
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Create subscription plan
   */
  async createPlan(planData) {
    try {
      const payload = {
        name: planData.name,
        amount: this.convertToKobo(planData.amount),
        interval: planData.interval,
        description: planData.description,
        send_invoices: planData.send_invoices || false,
        send_sms: planData.send_sms || false,
        currency: planData.currency || 'NGN'
      };

      const response = await this.client.post('/plan', payload);
      return this.formatResponse('plan_created', response.data);
    } catch (error) {
      throw this.handleError('create_plan', error);
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(subscriptionData) {
    try {
      const payload = {
        customer: subscriptionData.customer,
        plan: subscriptionData.plan,
        authorization: subscriptionData.authorization,
        start_date: subscriptionData.start_date
      };

      const response = await this.client.post('/subscription', payload);
      return this.formatResponse('subscription_created', response.data);
    } catch (error) {
      throw this.handleError('create_subscription', error);
    }
  }

  // ============================================================================
  // SPLIT PAYMENTS
  // ============================================================================

  /**
   * Create split payment configuration
   */
  async createSplit(splitData) {
    try {
      const payload = {
        name: splitData.name,
        type: splitData.type,
        currency: splitData.currency || 'NGN',
        subaccounts: splitData.subaccounts,
        bearer_type: splitData.bearer_type,
        bearer_subaccount: splitData.bearer_subaccount
      };

      const response = await this.client.post('/split', payload);
      return this.formatResponse('split_created', response.data);
    } catch (error) {
      throw this.handleError('create_split', error);
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Process bulk charges
   */
  async bulkCharge(chargesData) {
    try {
      const payload = {
        charges: chargesData.charges.map(charge => ({
          ...charge,
          amount: this.convertToKobo(charge.amount),
          reference: charge.reference || this.generateReference('PSK_BULK')
        }))
      };

      const response = await this.client.post('/bulkcharge', payload);
      return this.formatResponse('bulk_charge_initiated', response.data);
    } catch (error) {
      throw this.handleError('bulk_charge', error);
    }
  }

  // ============================================================================
  // TRANSFER OPERATIONS
  // ============================================================================

  /**
   * Create transfer recipient
   */
  async createTransferRecipient(recipientData) {
    try {
      const payload = {
        type: recipientData.type,
        name: recipientData.name,
        account_number: recipientData.account_number,
        bank_code: recipientData.bank_code,
        currency: recipientData.currency || 'NGN',
        description: recipientData.description,
        metadata: {
          client_id: this.serviceProvider.clientId,
          ...recipientData.metadata
        }
      };

      const response = await this.client.post('/transferrecipient', payload);
      return this.formatResponse('transfer_recipient_created', response.data);
    } catch (error) {
      throw this.handleError('create_transfer_recipient', error);
    }
  }

  /**
   * Initiate transfer
   */
  async initiateTransfer(transferData) {
    try {
      const payload = {
        source: transferData.source || 'balance',
        amount: this.convertToKobo(transferData.amount),
        recipient: transferData.recipient,
        reason: transferData.reason,
        currency: transferData.currency || 'NGN',
        reference: transferData.reference || this.generateReference('PSK_TXF')
      };

      const response = await this.client.post('/transfer', payload);
      return this.formatResponse('transfer_initiated', response.data);
    } catch (error) {
      throw this.handleError('initiate_transfer', error);
    }
  }

  // ============================================================================
  // WEBHOOK MANAGEMENT
  // ============================================================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, secret = null) {
    const webhookSecret = secret || process.env.PAYSTACK_WEBHOOK_SECRET;
    const hash = crypto.createHmac('sha512', webhookSecret).update(payload, 'utf8').digest('hex');
    return hash === signature;
  }

  /**
   * Process webhook event
   */
  async processWebhook(eventData, signature) {
    try {
      // Verify signature
      if (!this.verifyWebhookSignature(JSON.stringify(eventData), signature)) {
        throw new Error('Invalid webhook signature');
      }

      // Process event based on type
      const eventType = eventData.event;
      const eventHandler = this.getWebhookHandler(eventType);
      
      if (eventHandler) {
        return await eventHandler(eventData.data);
      }

      return this.formatResponse('webhook_processed', {
        event: eventType,
        status: 'unhandled'
      });
    } catch (error) {
      throw this.handleError('process_webhook', error);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  convertToKobo(amount) {
    // Convert amount to kobo (multiply by 100)
    return Math.round(parseFloat(amount) * 100);
  }

  convertFromKobo(amount) {
    // Convert from kobo to naira (divide by 100)
    return parseFloat(amount) / 100;
  }

  generateReference(prefix = 'PSK') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`.toUpperCase();
  }

  formatResponse(operation, data) {
    return {
      success: true,
      operation,
      data: {
        ...data,
        // Convert amounts from kobo to naira for display
        ...(data.data && data.data.amount && {
          data: {
            ...data.data,
            amount_naira: this.convertFromKobo(data.data.amount)
          }
        })
      },
      timestamp: new Date().toISOString(),
      service_provider: this.serviceProvider.enabled ? {
        client_id: this.serviceProvider.clientId
      } : undefined
    };
  }

  handleError(operation, error) {
    console.error(`[PayStack] ${operation} error:`, error.message);
    
    return {
      success: false,
      operation,
      error: {
        message: error.response?.data?.message || error.message,
        code: error.response?.data?.code || 'UNKNOWN_ERROR',
        status: error.response?.status
      },
      timestamp: new Date().toISOString()
    };
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add service provider headers if enabled
        if (this.serviceProvider.enabled) {
          config.headers['X-Service-Provider-Client'] = this.serviceProvider.clientId;
        }
        
        console.log(`[PayStack] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(`[PayStack] Request failed:`, error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  getWebhookHandler(eventType) {
    const handlers = {
      'charge.success': (data) => this.handleChargeSuccess(data),
      'charge.failed': (data) => this.handleChargeFailed(data),
      'transfer.success': (data) => this.handleTransferSuccess(data),
      'transfer.failed': (data) => this.handleTransferFailed(data),
      'subscription.create': (data) => this.handleSubscriptionCreated(data),
      'invoice.create': (data) => this.handleInvoiceCreated(data),
      'dedicatedaccount.assign.success': (data) => this.handleDedicatedAccountAssigned(data)
    };

    return handlers[eventType];
  }

  async handleChargeSuccess(data) {
    // Custom logic for successful charge
    return { event: 'charge.success', processed: true, data };
  }

  async handleChargeFailed(data) {
    // Custom logic for failed charge
    return { event: 'charge.failed', processed: true, data };
  }

  async handleTransferSuccess(data) {
    // Custom logic for successful transfer
    return { event: 'transfer.success', processed: true, data };
  }

  async handleTransferFailed(data) {
    // Custom logic for failed transfer
    return { event: 'transfer.failed', processed: true, data };
  }

  async handleSubscriptionCreated(data) {
    // Custom logic for subscription creation
    return { event: 'subscription.create', processed: true, data };
  }

  async handleInvoiceCreated(data) {
    // Custom logic for invoice creation
    return { event: 'invoice.create', processed: true, data };
  }

  async handleDedicatedAccountAssigned(data) {
    // Custom logic for dedicated account assignment
    return { event: 'dedicatedaccount.assign.success', processed: true, data };
  }

  // ============================================================================
  // HEALTH CHECK & MONITORING
  // ============================================================================

  async healthCheck() {
    try {
      // Test API connectivity with a simple call
      const response = await this.client.get('/bank');
      
      return {
        status: 'healthy',
        service: 'paystack-payment-gateway',
        timestamp: new Date().toISOString(),
        api_connectivity: response.status === 200,
        service_provider_mode: this.serviceProvider.enabled
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'paystack-payment-gateway', 
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = PayStackClient;