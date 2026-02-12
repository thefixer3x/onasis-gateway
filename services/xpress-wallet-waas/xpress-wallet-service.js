/**
 * Xpress Wallet Service Stub (JavaScript)
 * Minimal implementation to satisfy the adapter import requirement
 */

class XpressWalletService {
  constructor(config = {}, db = null) {
    this.config = {
      apiKey: config.apiKey || process.env.XPRESS_API_KEY,
      secretKey: config.secretKey || process.env.XPRESS_SECRET_KEY,
      merchantId: config.merchantId || process.env.XPRESS_MERCHANT_ID,
      baseUrl: config.baseUrl || process.env.XPRESS_BASE_URL || 'https://api.xpress-wallet.com',
      webhookSecret: config.webhookSecret || process.env.XPRESS_WEBHOOK_SECRET,
      environment: config.environment || process.env.XPRESS_ENVIRONMENT || 'sandbox',
      ...config
    };
    this.db = db;
  }

  // Placeholder methods that would be implemented in a full service
  async createWallet(params) {
    // This would make an actual API call to Xpress Wallet
    return {
      success: true,
      wallet: {
        id: 'test-wallet-id',
        account_number: '1234567890',
        account_name: params.customerName,
        balance: 0,
        status: 'active'
      }
    };
  }

  async getWalletBalance(walletId, forceSync = false) {
    return {
      balance: 0,
      availableBalance: 0,
      ledgerBalance: 0,
      lastSynced: new Date().toISOString()
    };
  }

  // Backwards-compat alias: older adapter code calls this name.
  async getXpressWalletBalance(walletId, forceSync = false) {
    return this.getWalletBalance(walletId, forceSync);
  }

  async creditWallet(params) {
    return {
      success: true,
      transaction: {
        id: 'test-transaction-id',
        type: 'credit',
        amount: params.amount,
        status: 'completed',
        reference: params.reference || 'test-ref-' + Date.now()
      }
    };
  }

  async debitWallet(params) {
    return {
      success: true,
      transaction: {
        id: 'test-transaction-id',
        type: 'debit',
        amount: params.amount,
        status: 'completed',
        reference: params.reference || 'test-ref-' + Date.now()
      }
    };
  }

  async validateBankAccount(bankCode, accountNumber) {
    return {
      valid: true,
      account_name: 'Test Account Name',
      account_number: accountNumber,
      bank_code: bankCode
    };
  }

  async bankTransfer(params) {
    return {
      success: true,
      transfer: {
        id: 'test-transfer-id',
        status: 'initiated',
        amount: params.amount,
        destination: {
          account_number: params.accountNumber,
          bank_code: params.bankCode,
          account_name: params.accountName
        },
        reference: params.reference || 'test-transfer-' + Date.now()
      }
    };
  }

  async listBanks(country = 'NG') {
    return {
      banks: [
        { code: '044', name: 'Access Bank' },
        { code: '023', name: 'Citibank Nigeria Limited' },
        { code: '050', name: 'Ecobank Nigeria Plc' },
        { code: '070', name: 'Fidelity Bank Plc' },
        { code: '011', name: 'First Bank of Nigeria Ltd' },
        { code: '214', name: 'First City Monument Bank Ltd' },
        { code: '058', name: 'Guaranty Trust Bank Plc' },
        { code: '030', name: 'Heritage Banking Company Ltd' },
        { code: '301', name: 'Jaiz Bank Plc' },
        { code: '082', name: 'Keystone Bank Ltd' },
        { code: '014', name: 'MainStreet Bank' },
        { code: '100', name: 'Parallex Bank Ltd' },
        { code: '076', name: 'Polaris Bank Ltd' },
        { code: '221', name: 'Stanbic IBTC Bank Ltd' },
        { code: '068', name: 'Standard Chartered Bank Nigeria Ltd' },
        { code: '232', name: 'Sterling Bank Plc' },
        { code: '103', name: 'Titan Trust Bank Ltd' },
        { code: '039', name: 'Union Bank of Nigeria Plc' },
        { code: '032', name: 'United Bank For Africa Plc' },
        { code: '033', name: 'Wema Bank Plc' },
        { code: '057', name: 'Zenith Bank Plc' }
      ]
    };
  }

  async getWalletTransactions(walletId, filters = {}) {
    return {
      transactions: [],
      pagination: {
        page: 1,
        limit: filters.limit || 20,
        total: 0,
        hasNext: false
      }
    };
  }

  async getTransactionDetails(transactionId) {
    return {
      id: transactionId,
      status: 'completed',
      amount: 0,
      type: 'credit',
      created_at: new Date().toISOString()
    };
  }

  async runDailyReconciliation(date) {
    return {
      reconciliation_date: date,
      status: 'completed',
      summary: {
        total_transactions: 0,
        successful_transactions: 0,
        failed_transactions: 0,
        total_credits: 0,
        total_debits: 0,
        total_fees: 0
      }
    };
  }

  async checkReconciliationDiscrepancies() {
    return {
      discrepancies: [],
      summary: {
        total_checked: 0,
        with_discrepancies: 0
      }
    };
  }

  async processWebhook(signature, payload) {
    return {
      success: true,
      processed: true,
      event_type: payload.event_type || 'unknown'
    };
  }
}

module.exports = XpressWalletService;
