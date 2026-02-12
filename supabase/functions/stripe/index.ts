/**
 * Stripe Edge Function - Standardized Action Dispatch
 *
 * Contract:
 * - Action via JSON body (not query string or nested {action, data} structure)
 * - snake_case action names
 * - All 10+ Stripe Issuing operations supported
 * - No JWT required (uses anon key for consistency with other payment adapters)
 */

import { successResponse, errorResponse, corsResponse } from '../_shared/response.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

interface StripeRequest {
  action: string;
  [key: string]: any;
}

/**
 * Make request to Stripe API
 */
async function callStripeAPI(
  endpoint: string,
  method: string = 'GET',
  params?: any
): Promise<any> {
  const url = `${STRIPE_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  // Stripe uses form-urlencoded for POST requests
  if (params && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const formData = new URLSearchParams();

    // Flatten nested objects for Stripe's API format
    const flattenParams = (obj: any, prefix = '') => {
      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}[${key}]` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flattenParams(value, newKey);
        } else {
          formData.append(newKey, String(value));
        }
      }
    };

    flattenParams(params);
    options.body = formData.toString();
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe API error');
  }

  return data;
}

/**
 * Action handlers
 */
const actions: Record<string, (params: any) => Promise<any>> = {
  /**
   * Get API key info (for testing connectivity)
   */
  get_api_key: async () => {
    // Return basic info about the API key without exposing it
    return {
      configured: !!STRIPE_SECRET_KEY,
      mode: STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'test' : 'live',
    };
  },

  /**
   * Create cardholder
   */
  create_cardholder: async (params) => {
    const { name, email, phone_number, billing, type = 'individual' } = params;

    if (!name || !email) {
      throw new Error('name and email are required');
    }

    const payload: any = {
      name,
      email,
      type,
    };

    if (phone_number) payload.phone_number = phone_number;
    if (billing) payload.billing = billing;

    return await callStripeAPI('/issuing/cardholders', 'POST', payload);
  },

  /**
   * Create card
   */
  create_card: async (params) => {
    const { cardholder, currency = 'usd', type = 'virtual', status = 'active' } = params;

    if (!cardholder) {
      throw new Error('cardholder is required');
    }

    return await callStripeAPI('/issuing/cards', 'POST', {
      cardholder,
      currency,
      type,
      status,
    });
  },

  /**
   * Get card details
   */
  get_card: async (params) => {
    const { card_id } = params;

    if (!card_id) {
      throw new Error('card_id is required');
    }

    // URL encode to prevent path injection
    const encodedId = encodeURIComponent(card_id);
    return await callStripeAPI(`/issuing/cards/${encodedId}`, 'GET');
  },

  /**
   * Update card
   */
  update_card: async (params) => {
    const { card_id, status, spending_controls, metadata } = params;

    if (!card_id) {
      throw new Error('card_id is required');
    }

    const payload: any = {};
    if (status) payload.status = status;
    if (spending_controls) payload.spending_controls = spending_controls;
    if (metadata) payload.metadata = metadata;

    // URL encode to prevent path injection
    const encodedId = encodeURIComponent(card_id);
    return await callStripeAPI(`/issuing/cards/${encodedId}`, 'POST', payload);
  },

  /**
   * Get card details (REMOVED FOR SECURITY)
   *
   * This action has been removed to prevent PCI compliance violations.
   * Exposing card PAN and CVC through an API endpoint creates unnecessary
   * security risks and broadens PCI scope.
   *
   * Use get_card instead for non-sensitive card metadata.
   */
  get_card_details: async () => {
    throw new Error(
      'get_card_details has been removed for security reasons. ' +
      'Exposing card PAN and CVC violates PCI compliance best practices. ' +
      'Use get_card for non-sensitive card information.'
    );
  },

  /**
   * Get transactions
   */
  get_transactions: async (params) => {
    const { card_id, limit = 10, starting_after, ending_before } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (card_id) queryParams.append('card', card_id);
    if (starting_after) queryParams.append('starting_after', starting_after);
    if (ending_before) queryParams.append('ending_before', ending_before);

    return await callStripeAPI(`/issuing/transactions?${queryParams.toString()}`, 'GET');
  },

  /**
   * List cardholders
   */
  list_cardholders: async (params) => {
    const { limit = 10, starting_after, ending_before } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (starting_after) queryParams.append('starting_after', starting_after);
    if (ending_before) queryParams.append('ending_before', ending_before);

    return await callStripeAPI(`/issuing/cardholders?${queryParams.toString()}`, 'GET');
  },

  /**
   * List cards
   */
  list_cards: async (params) => {
    const { cardholder, limit = 10, starting_after, ending_before, status } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (cardholder) queryParams.append('cardholder', cardholder);
    if (starting_after) queryParams.append('starting_after', starting_after);
    if (ending_before) queryParams.append('ending_before', ending_before);
    if (status) queryParams.append('status', status);

    return await callStripeAPI(`/issuing/cards?${queryParams.toString()}`, 'GET');
  },

  /**
   * Create authorization (for testing)
   */
  create_authorization: async (params) => {
    const { card, amount, currency = 'usd', merchant_data } = params;

    if (!card || !amount) {
      throw new Error('card and amount are required');
    }

    const payload: any = {
      card,
      amount,
      currency,
    };

    if (merchant_data) payload.merchant_data = merchant_data;

    return await callStripeAPI('/test_helpers/issuing/authorizations', 'POST', payload);
  },

  /**
   * Get balance
   */
  get_balance: async () => {
    return await callStripeAPI('/balance', 'GET');
  },

  /**
   * Create payment intent
   */
  create_payment_intent: async (params) => {
    const { amount, currency = 'usd', payment_method_types = ['card'], metadata } = params;

    if (!amount) {
      throw new Error('amount is required');
    }

    const payload: any = {
      amount,
      currency,
      payment_method_types,
    };

    if (metadata) payload.metadata = metadata;

    return await callStripeAPI('/payment_intents', 'POST', payload);
  },

  /**
   * Create customer
   */
  create_customer: async (params) => {
    const { email, name, description, metadata } = params;

    const payload: any = {};
    if (email) payload.email = email;
    if (name) payload.name = name;
    if (description) payload.description = description;
    if (metadata) payload.metadata = metadata;

    return await callStripeAPI('/customers', 'POST', payload);
  },

  /**
   * List customers
   */
  list_customers: async (params) => {
    const { limit = 10, starting_after, ending_before, email } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (starting_after) queryParams.append('starting_after', starting_after);
    if (ending_before) queryParams.append('ending_before', ending_before);
    if (email) queryParams.append('email', email);

    return await callStripeAPI(`/customers?${queryParams.toString()}`, 'GET');
  },

  /**
   * Health check
   */
  stripe_health_check: async () => {
    try {
      const balance = await callStripeAPI('/balance', 'GET');
      return {
        status: 'healthy',
        service: 'stripe',
        mode: STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'test' : 'live',
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
    if (!STRIPE_SECRET_KEY) {
      return errorResponse('Stripe API key not configured', 'MISSING_API_KEY', null, 500);
    }

    // Parse request body
    const body: StripeRequest = await req.json();
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
    console.error('[Stripe Error]', error);
    return errorResponse(
      error.message || 'Internal server error',
      error.code || 'INTERNAL_ERROR',
      error.details,
      error.status || 500
    );
  }
});
