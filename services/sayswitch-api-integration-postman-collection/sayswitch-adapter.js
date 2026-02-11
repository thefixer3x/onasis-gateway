/**
 * SaySwitch Adapter (Phase 1.5)
 *
 * Executes SaySwitch operations by routing through the deployed Supabase Edge
 * Function `sayswitch` using an action-dispatch payload:
 *   { action: "<snake_case_action>", ...params }
 *
 * Tool names are exposed in kebab-case; the adapter maps to snake_case actions.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

const toSnakeAction = (toolName) => (toolName || '').toString().trim().replace(/-/g, '_');

class SayswitchAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const functionName = config.functionName || 'sayswitch';
    const client = config.client || new UniversalSupabaseClient({
      serviceName: 'sayswitch',
      functionName
    });

    super({
      id: 'sayswitch-api-integration',
      name: 'SaySwitch API',
      description: 'Payment switching and routing via Supabase Edge Functions (sayswitch)',
      category: 'payments',
      capabilities: ['payments', 'transfers', 'customers', 'settlements'],
      client,
      ...config
    });
  }

  async initialize() {
    // Core tools (10) for Phase 1.5 quick-win validation.
    this.tools = [
      {
        name: 'initialize-transaction',
        description: 'Initialize a SaySwitch transaction',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', minimum: 1 },
            email: { type: 'string', format: 'email' },
            currency: { type: 'string', default: 'NGN' },
            reference: { type: 'string' },
            callback_url: { type: 'string', format: 'uri' }
          },
          required: ['amount', 'email']
        }
      },
      {
        name: 'verify-transaction',
        description: 'Verify transaction status by reference',
        inputSchema: {
          type: 'object',
          properties: {
            reference: { type: 'string' }
          },
          required: ['reference']
        }
      },
      {
        name: 'list-transactions',
        description: 'List transactions with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            per_page: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          }
        }
      },
      {
        name: 'transactions-query',
        description: 'Query transactions by filter parameters',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            channel: { type: 'string' },
            customer: { type: 'string' }
          }
        }
      },
      {
        name: 'fetch-transaction',
        description: 'Fetch a transaction by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'view-transaction-timeline',
        description: 'View transaction timeline by ID or reference',
        inputSchema: {
          type: 'object',
          properties: {
            id_or_reference: { type: 'string' }
          },
          required: ['id_or_reference']
        }
      },
      {
        name: 'transaction-totals',
        description: 'Get transaction totals and aggregates',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          }
        }
      },
      {
        name: 'create-customer',
        description: 'Create a customer profile',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: 'string' }
          },
          required: ['email']
        }
      },
      {
        name: 'list-customers',
        description: 'List customers',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            per_page: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
          }
        }
      },
      {
        name: 'fetch-customer',
        description: 'Fetch customer details',
        inputSchema: {
          type: 'object',
          properties: {
            customer_id: { type: 'string' },
            customer_code: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
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

module.exports = SayswitchAdapter;
