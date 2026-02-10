/**
 * Paystack Adapter (Phase 1.5)
 *
 * Executes Paystack operations by routing through the deployed Supabase Edge
 * Function `paystack` using an action-dispatch payload:
 *   { action: "<snake_case_action>", ...params }
 *
 * Tool names are exposed in kebab-case; the adapter maps to snake_case actions.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

const toSnakeAction = (toolName) => (toolName || '').toString().trim().replace(/-/g, '_');

class PaystackAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const functionName = config.functionName || 'paystack';

    super({
      id: 'paystack',
      name: 'Paystack API',
      description: 'African payment processing via Supabase Edge Functions (paystack)',
      category: 'payments',
      capabilities: ['payments', 'customers', 'transfers', 'accounts'],
      client: new UniversalSupabaseClient({
        serviceName: 'paystack',
        functionName
      }),
      ...config
    });
  }

  async initialize() {
    // Core tools (10) for Phase 1.5 quick-win validation.
    this.tools = [
      {
        name: 'initialize-transaction',
        description: 'Initialize payment transaction with Paystack',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'integer', minimum: 1, description: 'Payment amount in kobo (NGN)' },
            email: { type: 'string', format: 'email', description: "Customer's email address" },
            currency: { type: 'string', enum: ['NGN', 'GHS', 'ZAR', 'KES'], default: 'NGN' },
            reference: { type: 'string', description: 'Unique transaction reference' },
            callback_url: { type: 'string', format: 'uri', description: 'Success callback URL' },
            plan: { type: 'string', description: 'Plan code for subscription payments' },
            invoice_limit: { type: 'integer', description: 'Number of invoices to generate' },
            channels: {
              type: 'array',
              items: { type: 'string', enum: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'] },
              description: 'Payment channels to activate'
            },
            split_code: { type: 'string', description: 'Split payment configuration' },
            subaccount: { type: 'string', description: 'Subaccount code for split payments' },
            transaction_charge: { type: 'integer', description: 'Transaction charge in kobo' },
            bearer: { type: 'string', enum: ['account', 'subaccount'], description: 'Who bears Paystack charges' }
          },
          required: ['amount', 'email']
        }
      },
      {
        name: 'verify-transaction',
        description: 'Verify payment transaction status',
        inputSchema: {
          type: 'object',
          properties: {
            reference: { type: 'string', description: 'Transaction reference to verify' }
          },
          required: ['reference']
        }
      },
      {
        name: 'charge-authorization',
        description: 'Charge returning customer with saved authorization',
        inputSchema: {
          type: 'object',
          properties: {
            authorization_code: { type: 'string', description: 'Authorization code from previous transaction' },
            email: { type: 'string', format: 'email' },
            amount: { type: 'integer', minimum: 1 },
            currency: { type: 'string', default: 'NGN' }
          },
          required: ['authorization_code', 'email', 'amount']
        }
      },
      {
        name: 'create-customer',
        description: 'Create customer profile in Paystack',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: 'string' },
            metadata: { type: 'object', description: 'Custom fields as key-value pairs' }
          },
          required: ['email']
        }
      },
      {
        name: 'list-customers',
        description: 'List customers with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            perPage: { type: 'integer', default: 50, maximum: 100 },
            page: { type: 'integer', default: 1 },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          }
        }
      },
      {
        name: 'fetch-customer',
        description: 'Fetch customer details by email or code',
        inputSchema: {
          type: 'object',
          properties: {
            email_or_code: { type: 'string', description: 'Customer email or code' }
          },
          required: ['email_or_code']
        }
      },
      {
        name: 'create-dedicated-account',
        description: 'Create dedicated virtual account for customer',
        inputSchema: {
          type: 'object',
          properties: {
            customer: { type: 'string', description: 'Customer ID or code' },
            preferred_bank: { type: 'string', enum: ['wema-bank', 'titan-paystack'], description: 'Preferred bank for virtual account' },
            subaccount: { type: 'string', description: 'Subaccount code for split settlement' },
            split_code: { type: 'string', description: 'Split code for transaction splitting' }
          },
          required: ['customer']
        }
      },
      {
        name: 'list-dedicated-accounts',
        description: 'List dedicated virtual accounts',
        inputSchema: {
          type: 'object',
          properties: {
            active: { type: 'boolean', description: 'Filter by active status' },
            currency: { type: 'string', default: 'NGN' },
            perPage: { type: 'integer', default: 50 },
            page: { type: 'integer', default: 1 }
          }
        }
      },
      {
        name: 'create-transfer-recipient',
        description: 'Create a transfer recipient',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['nuban', 'mobile_money', 'basa'], description: 'Recipient type' },
            name: { type: 'string', description: 'Recipient name' },
            account_number: { type: 'string', description: 'Account number' },
            bank_code: { type: 'string', description: 'Bank code' },
            currency: { type: 'string', default: 'NGN' },
            description: { type: 'string', description: 'Recipient description' },
            metadata: { type: 'object', description: 'Custom metadata' }
          },
          required: ['type', 'name', 'account_number', 'bank_code']
        }
      },
      {
        name: 'initiate-transfer',
        description: 'Initiate a money transfer',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: ['balance'], description: 'Transfer source' },
            amount: { type: 'integer', minimum: 1, description: 'Transfer amount in kobo' },
            recipient: { type: 'string', description: 'Recipient code' },
            reason: { type: 'string', description: 'Transfer reason' },
            currency: { type: 'string', default: 'NGN' },
            reference: { type: 'string', description: 'Unique transfer reference' }
          },
          required: ['source', 'amount', 'recipient']
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
      const payload = { action: toSnakeAction(toolName), ...params };
      return await this.client.call(payload, context);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = PaystackAdapter;

