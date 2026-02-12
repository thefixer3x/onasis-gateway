/**
 * BAP API Adapter
 * MCP adapter for Bank Switch of Nigeria (BAP) payment services
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

class BAPAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    super({
      id: 'bap',
      name: 'BAP API',
      description: 'Bank Switch of Nigeria payment services',
      category: 'payments',
      capabilities: ['payments', 'transfers', 'account_validation', 'balance_inquiry'],
      client: new BaseClient({
        name: 'bap',
        baseUrl: process.env.BAP_API_URL || 'https://api.bap.nibss-plc.com.ng',
        timeout: 30000,
        authentication: {
          type: 'bearer',
          config: {
            token: process.env.BAP_API_KEY || process.env.NIBSS_API_KEY || 'test-key'
          }
        }
      }),
      ...config
    });
  }

  async initialize() {
    this.tools = [
      {
        name: 'validate-account-number',
        description: 'Validate account number with bank code',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Account number to validate' },
            bankCode: { type: 'string', description: 'Bank code' }
          },
          required: ['accountNumber', 'bankCode']
        }
      },
      {
        name: 'get-account-name',
        description: 'Get account name from account number and bank code',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Account number' },
            bankCode: { type: 'string', description: 'Bank code' }
          },
          required: ['accountNumber', 'bankCode']
        }
      },
      {
        name: 'make-payment',
        description: 'Make payment via BAP',
        inputSchema: {
          type: 'object',
          properties: {
            sourceAccount: { type: 'string', description: 'Source account number' },
            destinationAccount: { type: 'string', description: 'Destination account number' },
            destinationBankCode: { type: 'string', description: 'Destination bank code' },
            amount: { type: 'number', description: 'Amount to transfer' },
            narration: { type: 'string', description: 'Payment narration' },
            reference: { type: 'string', description: 'Unique reference' }
          },
          required: ['sourceAccount', 'destinationAccount', 'destinationBankCode', 'amount', 'narration', 'reference']
        }
      },
      {
        name: 'get-bank-list',
        description: 'Get list of supported banks',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'check-balance',
        description: 'Check account balance',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Account number to check' },
            bankCode: { type: 'string', description: 'Bank code' }
          },
          required: ['accountNumber', 'bankCode']
        }
      },
      {
        name: 'get-transaction-status',
        description: 'Get status of a transaction',
        inputSchema: {
          type: 'object',
          properties: {
            reference: { type: 'string', description: 'Transaction reference' }
          },
          required: ['reference']
        }
      },
      {
        name: 'get-beneficiary-list',
        description: 'Get list of beneficiaries',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Account number' }
          },
          required: ['accountNumber']
        }
      },
      {
        name: 'add-beneficiary',
        description: 'Add a new beneficiary',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Beneficiary account number' },
            accountName: { type: 'string', description: 'Beneficiary account name' },
            bankCode: { type: 'string', description: 'Beneficiary bank code' },
            nickname: { type: 'string', description: 'Nickname for the beneficiary' }
          },
          required: ['accountNumber', 'accountName', 'bankCode', 'nickname']
        }
      },
      {
        name: 'remove-beneficiary',
        description: 'Remove a beneficiary',
        inputSchema: {
          type: 'object',
          properties: {
            beneficiaryId: { type: 'string', description: 'Beneficiary ID' }
          },
          required: ['beneficiaryId']
        }
      },
      {
        name: 'get-transaction-history',
        description: 'Get transaction history for an account',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Account number' },
            startDate: { type: 'string', format: 'date', description: 'Start date' },
            endDate: { type: 'string', format: 'date', description: 'End date' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          required: ['accountNumber', 'startDate', 'endDate']
        }
      },
      {
        name: 'initiate-intra-bank-transfer',
        description: 'Initiate transfer within the same bank',
        inputSchema: {
          type: 'object',
          properties: {
            sourceAccount: { type: 'string', description: 'Source account number' },
            destinationAccount: { type: 'string', description: 'Destination account number' },
            amount: { type: 'number', description: 'Amount to transfer' },
            narration: { type: 'string', description: 'Transfer narration' },
            reference: { type: 'string', description: 'Unique reference' }
          },
          required: ['sourceAccount', 'destinationAccount', 'amount', 'narration', 'reference']
        }
      },
      {
        name: 'initiate-inter-bank-transfer',
        description: 'Initiate transfer to another bank via BAP',
        inputSchema: {
          type: 'object',
          properties: {
            sourceAccount: { type: 'string', description: 'Source account number' },
            destinationAccount: { type: 'string', description: 'Destination account number' },
            destinationBankCode: { type: 'string', description: 'Destination bank code' },
            amount: { type: 'number', description: 'Amount to transfer' },
            narration: { type: 'string', description: 'Transfer narration' },
            reference: { type: 'string', description: 'Unique reference' }
          },
          required: ['sourceAccount', 'destinationAccount', 'destinationBankCode', 'amount', 'narration', 'reference']
        }
      },
      {
        name: 'verify-otp',
        description: 'Verify OTP for high-value transactions',
        inputSchema: {
          type: 'object',
          properties: {
            transactionReference: { type: 'string', description: 'Transaction reference' },
            otp: { type: 'string', description: 'OTP received' }
          },
          required: ['transactionReference', 'otp']
        }
      },
      {
        name: 'request-otp',
        description: 'Request OTP for transaction authorization',
        inputSchema: {
          type: 'object',
          properties: {
            transactionReference: { type: 'string', description: 'Transaction reference' }
          },
          required: ['transactionReference']
        }
      },
      {
        name: 'get-exchange-rate',
        description: 'Get foreign exchange rates',
        inputSchema: {
          type: 'object',
          properties: {
            fromCurrency: { type: 'string', description: 'Source currency' },
            toCurrency: { type: 'string', description: 'Target currency' }
          },
          required: ['fromCurrency', 'toCurrency']
        }
      },
      {
        name: 'foreign-exchange-transfer',
        description: 'Make foreign exchange transfer',
        inputSchema: {
          type: 'object',
          properties: {
            sourceAccount: { type: 'string', description: 'Source account number' },
            destinationAccount: { type: 'string', description: 'Destination account number' },
            sourceCurrency: { type: 'string', description: 'Source currency' },
            destinationCurrency: { type: 'string', description: 'Destination currency' },
            sourceAmount: { type: 'number', description: 'Amount in source currency' },
            narration: { type: 'string', description: 'Transfer narration' },
            reference: { type: 'string', description: 'Unique reference' }
          },
          required: ['sourceAccount', 'destinationAccount', 'sourceCurrency', 'destinationCurrency', 'sourceAmount', 'narration', 'reference']
        }
      },
      {
        name: 'get-supported-currencies',
        description: 'Get list of supported currencies',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get-minimum-transfer-amount',
        description: 'Get minimum transfer amount for a bank',
        inputSchema: {
          type: 'object',
          properties: {
            bankCode: { type: 'string', description: 'Bank code' }
          },
          required: ['bankCode']
        }
      },
      {
        name: 'get-daily-transfer-limits',
        description: 'Get daily transfer limits for an account',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: { type: 'string', description: 'Account number' }
          },
          required: ['accountNumber']
        }
      },
      {
        name: 'schedule-recurring-payment',
        description: 'Schedule a recurring payment',
        inputSchema: {
          type: 'object',
          properties: {
            sourceAccount: { type: 'string', description: 'Source account number' },
            destinationAccount: { type: 'string', description: 'Destination account number' },
            destinationBankCode: { type: 'string', description: 'Destination bank code' },
            amount: { type: 'number', description: 'Amount to transfer' },
            narration: { type: 'string', description: 'Payment narration' },
            frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'quarterly'], description: 'Payment frequency' },
            startDate: { type: 'string', format: 'date', description: 'Start date' },
            endDate: { type: 'string', format: 'date', description: 'End date' }
          },
          required: ['sourceAccount', 'destinationAccount', 'destinationBankCode', 'amount', 'narration', 'frequency', 'startDate']
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    
    try {
      // Map tool names to BAP API endpoints
      const endpointMap = {
        'validate-account-number': '/v1/accounts/validate',
        'get-account-name': '/v1/accounts/name-enquiry',
        'make-payment': '/v1/transfers/initiate',
        'get-bank-list': '/v1/banks',
        'check-balance': '/v1/accounts/balance',
        'get-transaction-status': '/v1/transfers/status',
        'get-beneficiary-list': '/v1/beneficiaries',
        'add-beneficiary': '/v1/beneficiaries',
        'remove-beneficiary': '/v1/beneficiaries/{id}',
        'get-transaction-history': '/v1/transfers/history',
        'initiate-intra-bank-transfer': '/v1/transfers/intra-bank',
        'initiate-inter-bank-transfer': '/v1/transfers/inter-bank',
        'verify-otp': '/v1/otp/verify',
        'request-otp': '/v1/otp/request',
        'get-exchange-rate': '/v1/fx/rate',
        'foreign-exchange-transfer': '/v1/fx/transfer',
        'get-supported-currencies': '/v1/fx/currencies',
        'get-minimum-transfer-amount': '/v1/transfers/min-amount',
        'get-daily-transfer-limits': '/v1/accounts/limits',
        'schedule-recurring-payment': '/v1/transfers/recurring'
      };

      const methodMap = {
        'validate-account-number': 'POST',
        'get-account-name': 'POST',
        'make-payment': 'POST',
        'get-bank-list': 'GET',
        'check-balance': 'POST',
        'get-transaction-status': 'GET',
        'get-beneficiary-list': 'GET',
        'add-beneficiary': 'POST',
        'remove-beneficiary': 'DELETE',
        'get-transaction-history': 'POST',
        'initiate-intra-bank-transfer': 'POST',
        'initiate-inter-bank-transfer': 'POST',
        'verify-otp': 'POST',
        'request-otp': 'POST',
        'get-exchange-rate': 'GET',
        'foreign-exchange-transfer': 'POST',
        'get-supported-currencies': 'GET',
        'get-minimum-transfer-amount': 'GET',
        'get-daily-transfer-limits': 'POST',
        'schedule-recurring-payment': 'POST'
      };

      const endpoint = endpointMap[toolName];
      const method = methodMap[toolName] || 'POST';
      
      if (!endpoint) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Handle path parameters
      let finalEndpoint = endpoint;
      if (args.id) {
        finalEndpoint = finalEndpoint.replace('{id}', args.id);
      }

      // Prepare request data
      const requestData = {
        method: method,
        data: args,
        headers: { ...context.headers }
      };

      // Make the API call to BAP
      const result = await this.client.request({
        path: finalEndpoint
      }, requestData);

      return result;
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = BAPAdapter;
