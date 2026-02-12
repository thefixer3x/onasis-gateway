/**
 * Wise Multi-Currency Account (MCA) Platform API Adapter
 * MCP adapter for Wise's multi-currency account and transfer services
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

class WiseAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    super({
      id: 'wise-mca-platform',
      name: 'Wise MCA Platform API',
      description: 'Multi-currency accounts and international transfers',
      category: 'payments',
      capabilities: ['multi_currency_accounts', 'international_transfers', 'fx_rates', 'payment_tracking'],
      client: new BaseClient({
        name: 'wise-mca',
        baseUrl: process.env.WISE_API_URL || 'https://api.wise.com',
        timeout: 30000,
        authentication: {
          type: 'bearer',
          config: {
            token: process.env.WISE_API_KEY || 'test-key'
          }
        }
      }),
      ...config
    });
  }

  async initialize() {
    this.tools = [
      {
        name: 'create-multi-currency-account',
        description: 'Create a new multi-currency account',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'Profile ID to associate with the account' },
            baseCurrency: { type: 'string', description: 'Base currency for the account (e.g., USD, EUR, GBP)' },
            accountHolderName: { type: 'string', description: 'Name of the account holder' }
          },
          required: ['profileId', 'baseCurrency']
        }
      },
      {
        name: 'get-available-currencies',
        description: 'Get list of available currencies for multi-currency accounts',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'Profile ID' }
          }
        }
      },
      {
        name: 'get-account-balance',
        description: 'Get balance for a specific currency in a multi-currency account',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'Account ID' },
            currency: { type: 'string', description: 'Currency code (e.g., USD, EUR, GBP)' }
          },
          required: ['accountId', 'currency']
        }
      },
      {
        name: 'get-all-account-balances',
        description: 'Get balances for all currencies in a multi-currency account',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'Account ID' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'create-quote',
        description: 'Create a quote for an international transfer',
        inputSchema: {
          type: 'object',
          properties: {
            sourceCurrency: { type: 'string', description: 'Source currency code' },
            targetCurrency: { type: 'string', description: 'Target currency code' },
            sourceAmount: { type: 'number', description: 'Amount to send (in source currency)' },
            targetAmount: { type: 'number', description: 'Amount to receive (in target currency)' }
          }
        }
      },
      {
        name: 'create-transfer',
        description: 'Create an international transfer',
        inputSchema: {
          type: 'object',
          properties: {
            quoteId: { type: 'string', description: 'Quote ID from create-quote' },
            recipientAccountId: { type: 'string', description: 'Recipient account ID' },
            reference: { type: 'string', description: 'Transfer reference' },
            details: {
              type: 'object',
              properties: {
                transferPurpose: { type: 'string', description: 'Purpose of the transfer' },
                sourceOfFunds: { type: 'string', description: 'Source of funds' }
              }
            }
          },
          required: ['quoteId', 'recipientAccountId']
        }
      },
      {
        name: 'get-transfer-status',
        description: 'Get status of a transfer',
        inputSchema: {
          type: 'object',
          properties: {
            transferId: { type: 'string', description: 'Transfer ID' }
          },
          required: ['transferId']
        }
      },
      {
        name: 'get-all-transfers',
        description: 'Get all transfers for an account',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'Profile ID' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 }
          },
          required: ['profileId']
        }
      },
      {
        name: 'get-exchange-rates',
        description: 'Get current exchange rates',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source currency' },
            target: { type: 'string', description: 'Target currency (optional, gets all if not specified)' }
          },
          required: ['source']
        }
      },
      {
        name: 'create-recipient',
        description: 'Create a recipient for transfers',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'Account ID to associate with recipient' },
            currency: { type: 'string', description: 'Recipient currency' },
            type: { type: 'string', description: 'Recipient type (iban, sort_code, etc.)' },
            details: { type: 'object', description: 'Recipient details based on type' }
          },
          required: ['accountId', 'currency', 'type', 'details']
        }
      },
      {
        name: 'get-all-recipients',
        description: 'Get all recipients for an account',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: { type: 'string', description: 'Account ID' }
          },
          required: ['accountId']
        }
      },
      {
        name: 'get-profile-details',
        description: 'Get profile details',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'Profile ID' }
          },
          required: ['profileId']
        }
      },
      {
        name: 'get-all-profiles',
        description: 'Get all profiles',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get-supported-bank-formats',
        description: 'Get supported bank details formats by country',
        inputSchema: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Country code (e.g., GB, US, NG)' }
          }
        }
      },
      {
        name: 'validate-bank-details',
        description: 'Validate bank details for a recipient',
        inputSchema: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Country code' },
            currency: { type: 'string', description: 'Currency code' },
            type: { type: 'string', description: 'Bank details type' },
            details: { type: 'object', description: 'Bank details to validate' }
          },
          required: ['country', 'currency', 'type', 'details']
        }
      },
      {
        name: 'get-estimated-delivery-time',
        description: 'Get estimated delivery time for a transfer',
        inputSchema: {
          type: 'object',
          properties: {
            sourceCurrency: { type: 'string', description: 'Source currency' },
            targetCurrency: { type: 'string', description: 'Target currency' },
            targetCountry: { type: 'string', description: 'Target country code' }
          },
          required: ['sourceCurrency', 'targetCurrency', 'targetCountry']
        }
      },
      {
        name: 'cancel-transfer',
        description: 'Cancel a pending transfer',
        inputSchema: {
          type: 'object',
          properties: {
            transferId: { type: 'string', description: 'Transfer ID to cancel' }
          },
          required: ['transferId']
        }
      },
      {
        name: 'fund-transfer',
        description: 'Fund a transfer from a balance',
        inputSchema: {
          type: 'object',
          properties: {
            transferId: { type: 'string', description: 'Transfer ID to fund' },
            sourceAccountId: { type: 'string', description: 'Source account ID' }
          },
          required: ['transferId', 'sourceAccountId']
        }
      },
      {
        name: 'get-transfer-requirements',
        description: 'Get requirements for creating a transfer to a specific target',
        inputSchema: {
          type: 'object',
          properties: {
            targetAccountId: { type: 'string', description: 'Target account ID' },
            sourceCurrency: { type: 'string', description: 'Source currency' },
            targetCurrency: { type: 'string', description: 'Target currency' }
          },
          required: ['targetAccountId', 'sourceCurrency', 'targetCurrency']
        }
      },
      {
        name: 'get-conversion-details',
        description: 'Get details about a currency conversion',
        inputSchema: {
          type: 'object',
          properties: {
            conversionId: { type: 'string', description: 'Conversion ID' }
          },
          required: ['conversionId']
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    
    try {
      // Map tool names to Wise API endpoints
      const endpointMap = {
        'create-multi-currency-account': '/v3/profiles/{profileId}/accounts',
        'get-available-currencies': '/v1/currencies',
        'get-account-balance': '/v3/accounts/{accountId}/balance',
        'get-all-account-balances': '/v3/accounts/{accountId}/balances',
        'create-quote': '/v2/quotes',
        'create-transfer': '/v1/transfers',
        'get-transfer-status': '/v1/transfers/{transferId}',
        'get-all-transfers': '/v1/transfers',
        'get-exchange-rates': '/v1/rates',
        'create-recipient': '/v1/accounts/{accountId}/recipients',
        'get-all-recipients': '/v1/accounts/{accountId}/recipients',
        'get-profile-details': '/v1/profiles/{profileId}',
        'get-all-profiles': '/v1/profiles',
        'get-supported-bank-formats': '/v1/borderless-accounts/bank-details-required',
        'validate-bank-details': '/v1/borderless-accounts/validation',
        'get-estimated-delivery-time': '/v1/transfers/delivery-estimate',
        'cancel-transfer': '/v1/transfers/{transferId}/cancel',
        'fund-transfer': '/v3/profiles/{profileId}/account-payments',
        'get-transfer-requirements': '/v1/transfers/requirements',
        'get-conversion-details': '/v1/conversions/{conversionId}'
      };

      const methodMap = {
        'create-multi-currency-account': 'POST',
        'get-available-currencies': 'GET',
        'get-account-balance': 'GET',
        'get-all-account-balances': 'GET',
        'create-quote': 'POST',
        'create-transfer': 'POST',
        'get-transfer-status': 'GET',
        'get-all-transfers': 'GET',
        'get-exchange-rates': 'GET',
        'create-recipient': 'POST',
        'get-all-recipients': 'GET',
        'get-profile-details': 'GET',
        'get-all-profiles': 'GET',
        'get-supported-bank-formats': 'GET',
        'validate-bank-details': 'POST',
        'get-estimated-delivery-time': 'GET',
        'cancel-transfer': 'PUT',
        'fund-transfer': 'POST',
        'get-transfer-requirements': 'POST',
        'get-conversion-details': 'GET'
      };

      let endpoint = endpointMap[toolName];
      const method = methodMap[toolName] || 'POST';
      
      if (!endpoint) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Handle path parameters
      if (args.profileId) {
        endpoint = endpoint.replace('{profileId}', args.profileId);
      }
      if (args.accountId) {
        endpoint = endpoint.replace('{accountId}', args.accountId);
      }
      if (args.transferId) {
        endpoint = endpoint.replace('{transferId}', args.transferId);
      }
      if (args.conversionId) {
        endpoint = endpoint.replace('{conversionId}', args.conversionId);
      }

      // Prepare request data
      const requestData = {
        method: method,
        data: args,
        headers: { ...context.headers }
      };

      // Remove path parameters from request body
      if (requestData.data) {
        const bodyData = { ...requestData.data };
        delete bodyData.profileId;
        delete bodyData.accountId;
        delete bodyData.transferId;
        delete bodyData.conversionId;
        requestData.data = bodyData;
      }

      // Make the API call to Wise
      const result = await this.client.request({
        path: endpoint
      }, requestData);

      return result;
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = WiseAdapter;
