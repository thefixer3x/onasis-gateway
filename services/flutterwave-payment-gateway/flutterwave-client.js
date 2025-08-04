/**
 * Flutterwave Payment Gateway Client
 * Comprehensive client for all Flutterwave payment and wallet services
 */

const axios = require('axios');
const crypto = require('crypto');

class FlutterwaveClient {
  constructor(config = {}) {
    this.secretKey = config.secretKey || process.env.FLUTTERWAVE_SECRET_KEY;
    this.publicKey = config.publicKey || process.env.FLUTTERWAVE_PUBLIC_KEY;
    this.baseURL = config.baseURL || 'https://api.flutterwave.com/v3';
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
  async initiatePayment(paymentData) {
    try {
      const payload = {
        tx_ref: paymentData.tx_ref || this.generateTxRef(),
        amount: paymentData.amount,
        currency: paymentData.currency || 'NGN',
        redirect_url: paymentData.redirect_url,
        customer: {
          email: paymentData.customer.email,
          phonenumber: paymentData.customer.phone_number,
          name: paymentData.customer.name
        },
        customizations: {
          title: paymentData.title || 'Payment',
          description: paymentData.description || 'Payment for services',
          logo: this.serviceProvider.clientBranding.logo
        },
        meta: {
          client_id: this.serviceProvider.clientId,
          ...paymentData.metadata
        }
      };

      const response = await this.client.post('/payments', payload);
      
      return this.formatResponse('payment_initiated', response.data);
    } catch (error) {
      throw this.handleError('initiate_payment', error);
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(transactionId) {
    try {
      const response = await this.client.get(`/transactions/${transactionId}/verify`);
      return this.formatResponse('payment_verified', response.data);
    } catch (error) {
      throw this.handleError('verify_payment', error);
    }
  }

  /**
   * Get available payment methods for country
   */
  async getPaymentMethods(country = 'NG') {
    try {
      // This would typically be a cached lookup or API call
      const paymentMethods = {
        'NG': ['card', 'bank_transfer', 'ussd', 'mobile_money', 'bank_account'],
        'KE': ['card', 'mobile_money_mpesa', 'bank_transfer'],
        'UG': ['card', 'mobile_money_uganda', 'bank_transfer'],
        'GH': ['card', 'mobile_money_ghana', 'bank_transfer'],
        'ZA': ['card', 'bank_transfer']
      };

      return this.formatResponse('payment_methods', {
        country,
        methods: paymentMethods[country] || paymentMethods['NG']
      });
    } catch (error) {
      throw this.handleError('get_payment_methods', error);
    }
  }

  // ============================================================================
  // WALLET SERVICES
  // ============================================================================

  /**
   * Create virtual account for customer
   */
  async createVirtualAccount(customerData) {
    try {
      const payload = {
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        narration: customerData.narration || 'Virtual Account',
        bvn: customerData.bvn,
        is_permanent: customerData.is_permanent || true
      };

      const response = await this.client.post('/virtual-account-numbers', payload);
      return this.formatResponse('virtual_account_created', response.data);
    } catch (error) {
      throw this.handleError('create_virtual_account', error);
    }
  }

  /**
   * Get wallet balances
   */
  async getWalletBalance(currency = null) {
    try {
      const endpoint = currency ? `/balances/${currency}` : '/balances';
      const response = await this.client.get(endpoint);
      return this.formatResponse('wallet_balance', response.data);
    } catch (error) {
      throw this.handleError('get_wallet_balance', error);
    }
  }

  /**
   * Transfer funds from wallet
   */
  async walletTransfer(transferData) {
    try {
      const payload = {
        account_bank: transferData.account_bank,
        account_number: transferData.account_number,
        amount: transferData.amount,
        currency: transferData.currency || 'NGN',
        narration: transferData.narration,
        reference: transferData.reference || this.generateReference('TXF'),
        callback_url: transferData.callback_url,
        debit_currency: transferData.debit_currency
      };

      const response = await this.client.post('/transfers', payload);
      return this.formatResponse('wallet_transfer', response.data);
    } catch (error) {
      throw this.handleError('wallet_transfer', error);
    }
  }

  // ============================================================================
  // MOBILE MONEY SERVICES
  // ============================================================================

  /**
   * Process mobile money payment
   */
  async processMobileMoney(countryCode, paymentData) {
    try {
      const typeMapping = {
        'GH': 'mobile_money_ghana',
        'KE': 'mobile_money_mpesa', 
        'UG': 'mobile_money_uganda',
        'RW': 'mobile_money_rwanda',
        'TZ': 'mobile_money_tanzania',
        'ZM': 'mobile_money_zambia'
      };

      const payload = {
        tx_ref: paymentData.tx_ref || this.generateTxRef(),
        amount: paymentData.amount,
        currency: this.getCurrencyForCountry(countryCode),
        type: typeMapping[countryCode],
        phone_number: paymentData.phone_number,
        network: paymentData.network,
        customer: paymentData.customer,
        customizations: {
          title: paymentData.title || 'Mobile Money Payment',
          description: paymentData.description
        }
      };

      const response = await this.client.post('/charges', payload);
      return this.formatResponse('mobile_money_payment', response.data);
    } catch (error) {
      throw this.handleError('mobile_money_payment', error);
    }
  }

  // ============================================================================
  // VIRTUAL CARDS SERVICES
  // ============================================================================

  /**
   * Create virtual card
   */
  async createVirtualCard(cardData) {
    try {
      const payload = {
        currency: cardData.currency,
        amount: cardData.amount,
        debit_currencies: cardData.debit_currencies || [cardData.currency],
        first_name: cardData.first_name,
        last_name: cardData.last_name,
        date_of_birth: cardData.date_of_birth,
        email: cardData.email,
        phone: cardData.phone,
        title: cardData.title || 'Mr',
        gender: cardData.gender || 'M'
      };

      const response = await this.client.post('/virtual-cards', payload);
      return this.formatResponse('virtual_card_created', response.data);
    } catch (error) {
      throw this.handleError('create_virtual_card', error);
    }
  }

  /**
   * Fund virtual card
   */
  async fundVirtualCard(cardId, amount, debitCurrency) {
    try {
      const payload = {
        amount,
        debit_currency: debitCurrency
      };

      const response = await this.client.post(`/virtual-cards/${cardId}/fund`, payload);
      return this.formatResponse('virtual_card_funded', response.data);
    } catch (error) {
      throw this.handleError('fund_virtual_card', error);
    }
  }

  /**
   * Get virtual card transactions
   */
  async getVirtualCardTransactions(cardId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.from) params.append('from', options.from);
      if (options.to) params.append('to', options.to);
      if (options.page) params.append('page', options.page);
      if (options.size) params.append('size', options.size);

      const queryString = params.toString();
      const endpoint = `/virtual-cards/${cardId}/transactions${queryString ? '?' + queryString : ''}`;
      
      const response = await this.client.get(endpoint);
      return this.formatResponse('virtual_card_transactions', response.data);
    } catch (error) {
      throw this.handleError('get_virtual_card_transactions', error);
    }
  }

  // ============================================================================
  // BILL PAYMENTS SERVICES
  // ============================================================================

  /**
   * Get bill categories
   */
  async getBillCategories(country = 'NG') {
    try {
      const response = await this.client.get(`/bill-categories?country=${country}`);
      return this.formatResponse('bill_categories', response.data);
    } catch (error) {
      throw this.handleError('get_bill_categories', error);
    }
  }

  /**
   * Validate bill service customer
   */
  async validateBillService(itemCode, billerCode, customer) {
    try {
      const params = new URLSearchParams({
        item_code: itemCode,
        biller_code: billerCode,
        customer: customer
      });

      const response = await this.client.get(`/bill-items/validate?${params.toString()}`);
      return this.formatResponse('bill_validation', response.data);
    } catch (error) {
      throw this.handleError('validate_bill_service', error);
    }
  }

  /**
   * Pay bill
   */
  async payBill(billData) {
    try {
      const payload = {
        country: billData.country || 'NG',
        customer: billData.customer,
        amount: billData.amount,
        type: billData.type,
        reference: billData.reference || this.generateReference('BILL'),
        biller_name: billData.biller_name
      };

      const response = await this.client.post(`/bills/${billData.biller_code}/items/${billData.item_code}`, payload);
      return this.formatResponse('bill_payment', response.data);
    } catch (error) {
      throw this.handleError('pay_bill', error);
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Process bulk bank transfers
   */
  async bulkBankTransfer(transfersData) {
    try {
      const payload = {
        title: transfersData.title,
        bulk_data: transfersData.bulk_data.map(transfer => ({
          ...transfer,
          reference: transfer.reference || this.generateReference('BULK')
        }))
      };

      const response = await this.client.post('/bulk-transfers', payload);
      return this.formatResponse('bulk_transfer', response.data);
    } catch (error) {
      throw this.handleError('bulk_bank_transfer', error);
    }
  }

  /**
   * Process bulk bill payments
   */
  async bulkBillPayment(billsData) {
    try {
      const payload = {
        bulk_reference: billsData.bulk_reference || this.generateReference('BULK_BILL'),
        callback_url: billsData.callback_url,
        bulk_data: billsData.bulk_data
      };

      const response = await this.client.post('/bulk-bills', payload);
      return this.formatResponse('bulk_bills', response.data);
    } catch (error) {
      throw this.handleError('bulk_bill_payment', error);
    }
  }

  // ============================================================================
  // WEBHOOK MANAGEMENT
  // ============================================================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, secret = null) {
    const webhookSecret = secret || process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    const hash = crypto.createHmac('sha256', webhookSecret).update(payload, 'utf8').digest('hex');
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

  generateTxRef() {
    return `FLW_TX_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  generateReference(prefix = 'FLW') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`.toUpperCase();
  }

  getCurrencyForCountry(countryCode) {
    const currencyMap = {
      'NG': 'NGN',
      'KE': 'KES', 
      'UG': 'UGX',
      'GH': 'GHS',
      'ZA': 'ZAR',
      'RW': 'RWF',
      'TZ': 'TZS',
      'ZM': 'ZMW'
    };
    return currencyMap[countryCode] || 'NGN';
  }

  formatResponse(operation, data) {
    return {
      success: true,
      operation,
      data,
      timestamp: new Date().toISOString(),
      service_provider: this.serviceProvider.enabled ? {
        client_id: this.serviceProvider.clientId
      } : undefined
    };
  }

  handleError(operation, error) {
    console.error(`[Flutterwave] ${operation} error:`, error.message);
    
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
        
        console.log(`[Flutterwave] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(`[Flutterwave] Request failed:`, error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  getWebhookHandler(eventType) {
    const handlers = {
      'charge.completed': (data) => this.handleChargeCompleted(data),
      'charge.failed': (data) => this.handleChargeFailed(data),
      'transfer.completed': (data) => this.handleTransferCompleted(data),
      'transfer.failed': (data) => this.handleTransferFailed(data)
    };

    return handlers[eventType];
  }

  async handleChargeCompleted(data) {
    // Custom logic for charge completion
    return { event: 'charge.completed', processed: true, data };
  }

  async handleChargeFailed(data) {
    // Custom logic for charge failure
    return { event: 'charge.failed', processed: true, data };
  }

  async handleTransferCompleted(data) {
    // Custom logic for transfer completion
    return { event: 'transfer.completed', processed: true, data };
  }

  async handleTransferFailed(data) {
    // Custom logic for transfer failure
    return { event: 'transfer.failed', processed: true, data };
  }

  // ============================================================================
  // HEALTH CHECK & MONITORING
  // ============================================================================

  async healthCheck() {
    try {
      // Test API connectivity
      const response = await this.client.get('/balances');
      
      return {
        status: 'healthy',
        service: 'flutterwave-payment-gateway',
        timestamp: new Date().toISOString(),
        api_connectivity: response.status === 200,
        service_provider_mode: this.serviceProvider.enabled
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'flutterwave-payment-gateway', 
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = FlutterwaveClient;