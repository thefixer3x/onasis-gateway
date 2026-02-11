/**
 * Stripe Adapter (Phase 1.5)
 *
 * Executes Stripe operations by routing through the deployed Supabase Edge
 * Function `stripe` using an action-dispatch payload:
 *   { action: "<snake_case_action>", ...params }
 *
 * Tool names are exposed in kebab-case; the adapter maps to snake_case actions.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

const toSnakeAction = (toolName) => (toolName || '').toString().trim().replace(/-/g, '_');

class StripeAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const functionName = config.functionName || 'stripe';
    const client = config.client || new UniversalSupabaseClient({
      serviceName: 'stripe',
      functionName
    });

    super({
      id: 'stripe-api-2024-04-10',
      name: 'Stripe API',
      description: 'Global payment processing via Supabase Edge Functions (stripe)',
      category: 'payments',
      capabilities: ['card_payments', 'subscriptions', 'invoices', 'transfers', 'connect'],
      client,
      ...config
    });
  }

  async initialize() {
    // Core tools (10) for Phase 1.5 quick-win validation.
    this.tools = [
      {
        name: 'create-checkout-session',
        description: 'Create a Stripe Checkout session',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['payment', 'subscription', 'setup'], default: 'payment' },
            success_url: { type: 'string', format: 'uri' },
            cancel_url: { type: 'string', format: 'uri' },
            line_items: { type: 'array', description: 'Checkout line items' },
            customer: { type: 'string', description: 'Existing Stripe customer ID' },
            customer_email: { type: 'string', format: 'email' }
          },
          required: ['mode', 'success_url', 'cancel_url', 'line_items']
        }
      },
      {
        name: 'create-portal-session',
        description: 'Create a Stripe billing portal session',
        inputSchema: {
          type: 'object',
          properties: {
            customer: { type: 'string', description: 'Stripe customer ID' },
            return_url: { type: 'string', format: 'uri' }
          },
          required: ['customer', 'return_url']
        }
      },
      {
        name: 'create-payment-intent',
        description: 'Create a payment intent',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'integer', minimum: 1, description: 'Amount in the smallest currency unit' },
            currency: { type: 'string', default: 'usd' },
            customer: { type: 'string' },
            payment_method: { type: 'string' },
            confirm: { type: 'boolean', default: false },
            metadata: { type: 'object' }
          },
          required: ['amount', 'currency']
        }
      },
      {
        name: 'confirm-payment-intent',
        description: 'Confirm an existing payment intent',
        inputSchema: {
          type: 'object',
          properties: {
            payment_intent_id: { type: 'string' },
            payment_method: { type: 'string' }
          },
          required: ['payment_intent_id']
        }
      },
      {
        name: 'retrieve-payment-intent',
        description: 'Retrieve payment intent details',
        inputSchema: {
          type: 'object',
          properties: {
            payment_intent_id: { type: 'string' }
          },
          required: ['payment_intent_id']
        }
      },
      {
        name: 'create-customer',
        description: 'Create a Stripe customer',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            phone: { type: 'string' },
            metadata: { type: 'object' }
          },
          required: ['email']
        }
      },
      {
        name: 'retrieve-customer',
        description: 'Retrieve a Stripe customer',
        inputSchema: {
          type: 'object',
          properties: {
            customer_id: { type: 'string' }
          },
          required: ['customer_id']
        }
      },
      {
        name: 'create-subscription',
        description: 'Create a customer subscription',
        inputSchema: {
          type: 'object',
          properties: {
            customer: { type: 'string' },
            items: { type: 'array', description: 'Subscription items (price IDs)' },
            trial_period_days: { type: 'integer', minimum: 0 }
          },
          required: ['customer', 'items']
        }
      },
      {
        name: 'cancel-subscription',
        description: 'Cancel an active subscription',
        inputSchema: {
          type: 'object',
          properties: {
            subscription_id: { type: 'string' },
            prorate: { type: 'boolean', default: true }
          },
          required: ['subscription_id']
        }
      },
      {
        name: 'create-transfer',
        description: 'Create a transfer to a connected account',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'integer', minimum: 1, description: 'Amount in the smallest currency unit' },
            currency: { type: 'string', default: 'usd' },
            destination: { type: 'string', description: 'Connected account ID' },
            transfer_group: { type: 'string' },
            metadata: { type: 'object' }
          },
          required: ['amount', 'currency', 'destination']
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

module.exports = StripeAdapter;
