/**
 * Flutterwave Adapter (Phase 1.5)
 *
 * Executes Flutterwave operations by routing through the deployed Supabase Edge
 * Function `flutterwave` using an action-dispatch payload:
 *   { action: "<snake_case_action>", ...params }
 *
 * Tool names are exposed in kebab-case; the adapter maps to snake_case actions.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

const toSnakeAction = (toolName) => (toolName || '').toString().trim().replace(/-/g, '_');

const applyFlutterwaveDefaults = (action, params) => {
  const payload = { ...params };

  // Flutterwave "charges" mobile money calls often require a specific `type`.
  if (action === 'mobile_money_ghana' && !payload.type) payload.type = 'mobile_money_ghana';
  if (action === 'mobile_money_uganda' && !payload.type) payload.type = 'mobile_money_uganda';
  if (action === 'mobile_money_kenya' && !payload.type) payload.type = 'mobile_money_mpesa';

  return payload;
};

class FlutterwaveAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const functionName = config.functionName || 'flutterwave';

    super({
      id: 'flutterwave-v3',
      name: 'Flutterwave v3 API',
      description: 'Pan-African payments via Supabase Edge Functions (flutterwave)',
      category: 'payments',
      capabilities: ['payments', 'wallets', 'mobile_money', 'virtual_cards'],
      client: new UniversalSupabaseClient({
        serviceName: 'flutterwave',
        functionName
      }),
      ...config
    });
  }

  async initialize() {
    // Core tools (10) for Phase 1.5 quick-win validation.
    this.tools = [
      {
        name: 'initiate-payment',
        description: 'Initialize payment transaction',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', minimum: 1, description: 'Payment amount' },
            currency: {
              type: 'string',
              enum: ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'ZAR'],
              default: 'NGN',
              description: 'Payment currency'
            },
            payment_type: {
              type: 'string',
              enum: ['card', 'mobile_money', 'bank_transfer', 'ussd', 'bank_account'],
              description: 'Payment method type'
            },
            customer: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                phone_number: { type: 'string' },
                name: { type: 'string' }
              },
              required: ['email']
            },
            tx_ref: { type: 'string', description: 'Unique transaction reference' },
            redirect_url: { type: 'string', format: 'uri', description: 'Success redirect URL' }
          },
          required: ['amount', 'currency', 'customer', 'tx_ref']
        }
      },
      {
        name: 'verify-payment',
        description: 'Verify payment transaction',
        inputSchema: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string', description: 'Transaction ID to verify' }
          },
          required: ['transaction_id']
        }
      },
      {
        name: 'get-payment-methods',
        description: 'Get available payment methods for country',
        inputSchema: {
          type: 'object',
          properties: {
            country: { type: 'string', enum: ['NG', 'KE', 'UG', 'ZA', 'GH', 'RW', 'TZ'], description: 'Country code' }
          },
          required: ['country']
        }
      },
      {
        name: 'create-virtual-account',
        description: 'Create virtual account for customer',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            phone: { type: 'string' },
            narration: { type: 'string' },
            bvn: { type: 'string', pattern: '^[0-9]{11}$' }
          },
          required: ['email', 'name']
        }
      },
      {
        name: 'get-wallet-balance',
        description: 'Get wallet balances',
        inputSchema: {
          type: 'object',
          properties: {
            currency: { type: 'string', enum: ['NGN', 'USD', 'EUR', 'GBP'], description: 'Currency to check balance for' }
          }
        }
      },
      {
        name: 'wallet-transfer',
        description: 'Transfer funds from wallet',
        inputSchema: {
          type: 'object',
          properties: {
            account_bank: { type: 'string' },
            account_number: { type: 'string' },
            amount: { type: 'number', minimum: 1 },
            currency: { type: 'string', default: 'NGN' },
            narration: { type: 'string' },
            reference: { type: 'string' }
          },
          required: ['account_bank', 'account_number', 'amount', 'reference']
        }
      },
      {
        name: 'mobile-money-ghana',
        description: 'Process Ghana mobile money payment',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['mobile_money_ghana'] },
            amount: { type: 'number' },
            currency: { type: 'string', default: 'GHS' },
            phone_number: { type: 'string' },
            network: { type: 'string', enum: ['MTN', 'VODAFONE', 'TIGO', 'AIRTEL'] }
          },
          required: ['amount', 'phone_number', 'network']
        }
      },
      {
        name: 'mobile-money-kenya',
        description: 'Process Kenya mobile money (M-Pesa) payment',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['mobile_money_mpesa'] },
            amount: { type: 'number' },
            currency: { type: 'string', default: 'KES' },
            phone_number: { type: 'string' }
          },
          required: ['amount', 'phone_number']
        }
      },
      {
        name: 'mobile-money-uganda',
        description: 'Process Uganda mobile money payment',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['mobile_money_uganda'] },
            amount: { type: 'number' },
            currency: { type: 'string', default: 'UGX' },
            phone_number: { type: 'string' },
            network: { type: 'string', enum: ['MTN', 'AIRTEL'] }
          },
          required: ['amount', 'phone_number', 'network']
        }
      },
      {
        name: 'create-virtual-card',
        description: 'Create a virtual card',
        inputSchema: {
          type: 'object',
          properties: {
            currency: { type: 'string', enum: ['NGN', 'USD'] },
            amount: { type: 'number', minimum: 1 },
            debit_currencies: { type: 'array', items: { type: 'string' } },
            card_type: { type: 'string', enum: ['mastercard', 'visa'] }
          },
          required: ['currency', 'amount']
        }
      }
    ];

    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    const tool = (this.tools || []).find((t) => t && t.name === toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in adapter '${this.id}'`);
    }

    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      const params = (args && typeof args === 'object') ? args : {};
      const action = toSnakeAction(toolName);
      const payload = { action, ...applyFlutterwaveDefaults(action, params) };
      return await this.client.call(payload, context);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = FlutterwaveAdapter;

