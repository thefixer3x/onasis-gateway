/**
 * Paystack Edge Function - Standardized Action Dispatch
 *
 * Contract:
 * - Action via JSON body (not query string)
 * - snake_case action names
 * - All 10+ Paystack operations supported
 */

import { successResponse, errorResponse, corsResponse } from '../_shared/response.ts';

const PAYSTACK_SECRET_KEY = Deno.env.get('PSTACK_SECRET_KEY_TEST') || Deno.env.get('PAYSTACK_SECRET_KEY');
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface PaystackRequest {
  action: string;
  [key: string]: any;
}

/**
 * Make request to Paystack API
 */
async function callPaystackAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${PAYSTACK_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Paystack API error');
  }

  return data;
}

/**
 * Action handlers
 */
const actions: Record<string, (params: any) => Promise<any>> = {
  /**
   * Initialize payment transaction
   */
  initialize_transaction: async (params) => {
    const { email, amount, currency = 'NGN', reference, callback_url, channels } = params;

    if (!email || !amount) {
      throw new Error('email and amount are required');
    }

    const payload: any = {
      email,
      amount: Math.round(amount * 100), // Convert to kobo
      currency,
    };

    if (reference) payload.reference = reference;
    if (callback_url) payload.callback_url = callback_url;
    if (channels) payload.channels = channels;

    return await callPaystackAPI('/transaction/initialize', 'POST', payload);
  },

  /**
   * Verify transaction
   */
  verify_transaction: async (params) => {
    const { reference } = params;

    if (!reference) {
      throw new Error('reference is required');
    }

    // URL encode to prevent path injection
    const encodedRef = encodeURIComponent(reference);
    return await callPaystackAPI(`/transaction/verify/${encodedRef}`, 'GET');
  },

  /**
   * Charge authorization (recurring)
   */
  charge_authorization: async (params) => {
    const { authorization_code, email, amount, currency = 'NGN' } = params;

    if (!authorization_code || !email || !amount) {
      throw new Error('authorization_code, email, and amount are required');
    }

    return await callPaystackAPI('/transaction/charge_authorization', 'POST', {
      authorization_code,
      email,
      amount: Math.round(amount * 100),
      currency,
    });
  },

  /**
   * Create customer
   */
  create_customer: async (params) => {
    const { email, first_name, last_name, phone, metadata } = params;

    if (!email) {
      throw new Error('email is required');
    }

    const payload: any = { email };
    if (first_name) payload.first_name = first_name;
    if (last_name) payload.last_name = last_name;
    if (phone) payload.phone = phone;
    if (metadata) payload.metadata = metadata;

    return await callPaystackAPI('/customer', 'POST', payload);
  },

  /**
   * Fetch customer by email or code
   */
  fetch_customer: async (params) => {
    const { email_or_code } = params;

    if (!email_or_code) {
      throw new Error('email_or_code is required');
    }

    // URL encode to prevent path injection
    const encoded = encodeURIComponent(email_or_code);
    return await callPaystackAPI(`/customer/${encoded}`, 'GET');
  },

  /**
   * List customers
   */
  list_customers: async (params) => {
    const { perPage = 50, page = 1, from, to } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      perPage: String(perPage),
      page: String(page),
    });

    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);

    return await callPaystackAPI(`/customer?${queryParams.toString()}`, 'GET');
  },

  /**
   * Create transfer recipient
   */
  create_transfer_recipient: async (params) => {
    const { type, name, account_number, bank_code, currency = 'NGN', description } = params;

    if (!type || !name || !account_number || !bank_code) {
      throw new Error('type, name, account_number, and bank_code are required');
    }

    const payload: any = {
      type,
      name,
      account_number,
      bank_code,
      currency,
    };

    if (description) payload.description = description;

    return await callPaystackAPI('/transferrecipient', 'POST', payload);
  },

  /**
   * Initiate transfer
   */
  initiate_transfer: async (params) => {
    const { source = 'balance', amount, recipient, reason, currency = 'NGN' } = params;

    if (!amount || !recipient) {
      throw new Error('amount and recipient are required');
    }

    return await callPaystackAPI('/transfer', 'POST', {
      source,
      amount: Math.round(amount * 100),
      recipient,
      reason,
      currency,
    });
  },

  /**
   * List transactions
   */
  list_transactions: async (params) => {
    const { perPage = 50, page = 1, from, to, status, customer } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      perPage: String(perPage),
      page: String(page),
    });

    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);
    if (status) queryParams.append('status', status);
    if (customer) queryParams.append('customer', customer);

    return await callPaystackAPI(`/transaction?${queryParams.toString()}`, 'GET');
  },

  /**
   * List banks
   */
  list_banks: async (params) => {
    const { country = 'nigeria', perPage = 50, page = 1 } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      country,
      perPage: String(perPage),
      page: String(page),
    });

    return await callPaystackAPI(`/bank?${queryParams.toString()}`, 'GET');
  },

  /**
   * Verify account number
   */
  verify_account: async (params) => {
    const { account_number, bank_code } = params;

    if (!account_number || !bank_code) {
      throw new Error('account_number and bank_code are required');
    }

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      account_number,
      bank_code,
    });

    return await callPaystackAPI(
      `/bank/resolve?${queryParams.toString()}`,
      'GET'
    );
  },

  /**
   * Create dedicated virtual account
   */
  create_dedicated_account: async (params) => {
    const { customer, preferred_bank = 'wema-bank', subaccount } = params;

    if (!customer) {
      throw new Error('customer is required');
    }

    const payload: any = {
      customer,
      preferred_bank,
    };

    if (subaccount) payload.subaccount = subaccount;

    return await callPaystackAPI('/dedicated_account', 'POST', payload);
  },

  /**
   * List dedicated accounts
   */
  list_dedicated_accounts: async (params) => {
    const { active, currency = 'NGN', perPage = 50, page = 1 } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      perPage: String(perPage),
      page: String(page),
      currency,
    });

    if (active !== undefined) queryParams.append('active', String(active));

    return await callPaystackAPI(`/dedicated_account?${queryParams.toString()}`, 'GET');
  },

  /**
   * Create subscription plan
   */
  create_subscription_plan: async (params) => {
    const { name, amount, interval, description, currency = 'NGN' } = params;

    if (!name || !amount || !interval) {
      throw new Error('name, amount, and interval are required');
    }

    const payload: any = {
      name,
      amount: Math.round(amount * 100),
      interval,
      currency,
    };

    if (description) payload.description = description;

    return await callPaystackAPI('/plan', 'POST', payload);
  },

  /**
   * Create subscription
   */
  create_subscription: async (params) => {
    const { customer, plan, authorization, start_date } = params;

    if (!customer || !plan) {
      throw new Error('customer and plan are required');
    }

    const payload: any = {
      customer,
      plan,
    };

    if (authorization) payload.authorization = authorization;
    if (start_date) payload.start_date = start_date;

    return await callPaystackAPI('/subscription', 'POST', payload);
  },

  /**
   * Create split payment
   */
  create_split_payment: async (params) => {
    const { name, type, currency = 'NGN', subaccounts, bearer_type } = params;

    if (!name || !type || !subaccounts) {
      throw new Error('name, type, and subaccounts are required');
    }

    const payload: any = {
      name,
      type,
      currency,
      subaccounts,
    };

    if (bearer_type) payload.bearer_type = bearer_type;

    return await callPaystackAPI('/split', 'POST', payload);
  },

  /**
   * Bulk charge
   */
  bulk_charge: async (params) => {
    const { charges } = params;

    if (!charges || !Array.isArray(charges)) {
      throw new Error('charges array is required');
    }

    // Convert amounts to kobo
    const processedCharges = charges.map((charge: any) => ({
      ...charge,
      amount: Math.round(charge.amount * 100),
    }));

    return await callPaystackAPI('/bulkcharge', 'POST', processedCharges);
  },

  /**
   * Health check
   */
  paystack_health_check: async () => {
    // Simple health check - try to list banks
    try {
      await callPaystackAPI('/bank?country=nigeria&perPage=1', 'GET');
      return {
        status: 'healthy',
        service: 'paystack',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  },
};

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', null, 405);
    }

    // Verify API key
    if (!PAYSTACK_SECRET_KEY) {
      return errorResponse('Paystack API key not configured', 'MISSING_API_KEY', null, 500);
    }

    // Parse request body
    const body: PaystackRequest = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return errorResponse('action is required in request body', 'MISSING_ACTION');
    }

    // Find and execute action handler
    const handler = actions[action];
    if (!handler) {
      const availableActions = Object.keys(actions).join(', ');
      return errorResponse(
        `Unknown action: ${action}`,
        'UNKNOWN_ACTION',
        { available_actions: availableActions }
      );
    }

    // Execute the action
    const result = await handler(params);

    return successResponse(result);
  } catch (error) {
    console.error('[Paystack Error]', error);
    return errorResponse(
      error.message || 'Internal server error',
      error.code || 'INTERNAL_ERROR',
      error.details,
      error.status || 500
    );
  }
});
