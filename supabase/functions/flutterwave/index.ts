/**
 * Flutterwave Edge Function - Standardized Action Dispatch
 *
 * Contract:
 * - Action via JSON body (not URL path segment)
 * - snake_case action names
 * - All 10+ Flutterwave operations supported
 */

import { successResponse, errorResponse, corsResponse } from '../_shared/response.ts';

// Prefer production credentials; fall back to test only if production isn't configured.
const FLW_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY') || Deno.env.get('FLW_SECRET_KEY_TEST');
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

interface FlutterwaveRequest {
  action: string;
  [key: string]: any;
}

/**
 * Make request to Flutterwave API
 */
async function callFlutterwaveAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${FLW_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${FLW_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutMs = 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Flutterwave request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  let data: any = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = { rawBody };
  }

  if (!response.ok || data?.status === 'error') {
    const msg = typeof data?.message === 'string'
      ? data.message
      : `Flutterwave API error (status ${response.status})`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Generate transaction reference
 */
function generateTxRef(): string {
  return `flw_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Action handlers
 */
const actions: Record<string, (params: any) => Promise<any>> = {
  /**
   * Initiate payment
   */
  initiate_payment: async (params) => {
    const {
      amount,
      currency = 'NGN',
      email,
      phone_number,
      name,
      tx_ref,
      redirect_url,
      payment_options = 'card,banktransfer,ussd',
      customer,
      customizations,
    } = params;

    if (!amount || !email) {
      throw new Error('amount and email are required');
    }

    if (!redirect_url) {
      throw new Error('redirect_url is required for security. Do not use default redirect URLs.');
    }

    const payload: any = {
      tx_ref: tx_ref || generateTxRef(),
      amount,
      currency,
      redirect_url,
      payment_options,
      customer: customer || {
        email,
        phonenumber: phone_number,
        name: name || email,
      },
    };

    if (customizations) {
      payload.customizations = customizations;
    }

    return await callFlutterwaveAPI('/payments', 'POST', payload);
  },

  /**
   * Verify transaction
   */
  verify_transaction: async (params) => {
    const { transaction_id, tx_ref } = params;

    if (!transaction_id && !tx_ref) {
      throw new Error('transaction_id or tx_ref is required');
    }

    // URL encode to prevent path injection
    const identifier = encodeURIComponent(transaction_id || tx_ref);
    return await callFlutterwaveAPI(`/transactions/${identifier}/verify`, 'GET');
  },

  /**
   * Create payment link
   */
	  create_payment_link: async (params) => {
	    const { amount, currency = 'NGN', description, redirect_url } = params;

	    if (!amount || !description) {
	      throw new Error('amount and description are required');
	    }

	    if (!redirect_url) {
	      throw new Error('redirect_url is required for security. Do not use default redirect URLs.');
	    }

	    return await callFlutterwaveAPI('/payment-links', 'POST', {
	      amount,
	      currency,
	      description,
	      redirect_url,
	    });
	  },

  /**
   * Get transaction
   */
  get_transaction: async (params) => {
    const { transaction_id } = params;

    if (!transaction_id) {
      throw new Error('transaction_id is required');
    }

    // URL encode to prevent path injection
    const encodedId = encodeURIComponent(transaction_id);
    return await callFlutterwaveAPI(`/transactions/${encodedId}`, 'GET');
  },

  /**
   * List transactions
   */
  list_transactions: async (params) => {
    const { from, to, page = 1, per_page = 20 } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(per_page),
    });

    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);

    return await callFlutterwaveAPI(`/transactions?${queryParams.toString()}`, 'GET');
  },

  /**
   * Charge card
   */
	  charge_card: async (params) => {
    const {
      card_number,
      cvv,
      expiry_month,
      expiry_year,
      amount,
      currency = 'NGN',
      email,
      fullname,
      tx_ref,
      authorization,
	    } = params;

	    // Prefer tokenized charges to avoid handling raw PAN/CVV.
	    if (authorization?.token) {
	      if (!amount || !email) {
	        throw new Error('amount and email are required');
	      }
	      const payload = {
	        token: authorization.token,
	        currency,
	        amount,
	        email,
	        tx_ref: tx_ref || generateTxRef(),
	      };
	      return await callFlutterwaveAPI('/tokenized-charges', 'POST', payload);
	    }

	    // Raw card charges are deprecated/guarded behind a strict feature flag.
	    const allowRawCard = Deno.env.get('FLW_ALLOW_RAW_CARD') === 'true';
	    if (!allowRawCard) {
	      throw new Error('Raw card charges are disabled. Provide authorization.token for tokenized charges.');
	    }

	    // Otherwise (feature-flagged), charge with card details
	    if (!card_number || !cvv || !expiry_month || !expiry_year || !amount || !email) {
	      throw new Error('card details, amount, and email are required');
	    }

    return await callFlutterwaveAPI('/charges?type=card', 'POST', {
      card_number,
      cvv,
      expiry_month,
      expiry_year,
      amount,
      currency,
      email,
      fullname,
      tx_ref: tx_ref || generateTxRef(),
    });
  },

  /**
   * Create virtual card
   */
  create_virtual_card: async (params) => {
    const {
      currency = 'NGN',
      amount,
      billing_name,
      billing_address,
      billing_city,
      billing_state,
      billing_postal_code,
      billing_country,
    } = params;

    if (!amount || !billing_name) {
      throw new Error('amount and billing_name are required');
    }

    return await callFlutterwaveAPI('/virtual-cards', 'POST', {
      currency,
      amount,
      billing_name,
      billing_address,
      billing_city,
      billing_state,
      billing_postal_code,
      billing_country,
    });
  },

  /**
   * Get virtual card
   */
  get_virtual_card: async (params) => {
    const { card_id } = params;

    if (!card_id) {
      throw new Error('card_id is required');
    }

    // URL encode to prevent path injection
    const encodedId = encodeURIComponent(card_id);
    return await callFlutterwaveAPI(`/virtual-cards/${encodedId}`, 'GET');
  },

  /**
   * List virtual cards
   */
  list_virtual_cards: async (params) => {
    const { page = 1, per_page = 20 } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(per_page),
    });

    return await callFlutterwaveAPI(`/virtual-cards?${queryParams.toString()}`, 'GET');
  },

  /**
   * Transfer funds
   */
  initiate_transfer: async (params) => {
    const {
      account_bank,
      account_number,
      amount,
      currency = 'NGN',
      narration,
      reference,
      beneficiary_name,
    } = params;

    if (!account_bank || !account_number || !amount) {
      throw new Error('account_bank, account_number, and amount are required');
    }

    return await callFlutterwaveAPI('/transfers', 'POST', {
      account_bank,
      account_number,
      amount,
      currency,
      narration: narration || 'Payment',
      reference: reference || generateTxRef(),
      beneficiary_name,
    });
  },

  /**
   * Get transfer
   */
  get_transfer: async (params) => {
    const { transfer_id } = params;

    if (!transfer_id) {
      throw new Error('transfer_id is required');
    }

    // URL encode to prevent path injection
    const encodedId = encodeURIComponent(transfer_id);
    return await callFlutterwaveAPI(`/transfers/${encodedId}`, 'GET');
  },

  /**
   * List banks
   */
  list_banks: async (params) => {
    const { country = 'NG' } = params;

    // URL encode to prevent path injection
    const encodedCountry = encodeURIComponent(country);
    return await callFlutterwaveAPI(`/banks/${encodedCountry}`, 'GET');
  },

  /**
   * Verify account
   */
  verify_account: async (params) => {
    const { account_number, account_bank } = params;

    if (!account_number || !account_bank) {
      throw new Error('account_number and account_bank are required');
    }

    return await callFlutterwaveAPI('/accounts/resolve', 'POST', {
      account_number,
      account_bank,
    });
  },

  /**
   * Get balance
   */
  get_balance: async (params) => {
    const { currency = 'NGN' } = params;

    // URL encode to prevent path injection
    const encodedCurrency = encodeURIComponent(currency);
    return await callFlutterwaveAPI(`/balances/${encodedCurrency}`, 'GET');
  },

  /**
   * Health check
   */
  flutterwave_health_check: async () => {
    try {
      // Try to get balance as health check
      const result = await callFlutterwaveAPI('/balances/NGN', 'GET');
      return {
        status: 'healthy',
        service: 'flutterwave',
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
  const requestOrigin = req.headers.get('origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsResponse(requestOrigin);
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', null, 405, requestOrigin);
    }

    // Verify API key
    if (!FLW_SECRET_KEY) {
      return errorResponse('Flutterwave API key not configured', 'MISSING_API_KEY', null, 500, requestOrigin);
    }

    // Parse request body
    let body: FlutterwaveRequest;
    try {
      body = await req.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse('Invalid JSON body', 'INVALID_JSON', { message: msg }, 400, requestOrigin);
    }
    const { action, ...params } = body;

    if (!action) {
      return errorResponse('action is required in request body', 'MISSING_ACTION', null, 400, requestOrigin);
    }

    // Find and execute action handler
    const handler = actions[action];
    if (!handler) {
      const availableActions = Object.keys(actions).join(', ');
      return errorResponse(
        `Unknown action: ${action}`,
        'UNKNOWN_ACTION',
        { available_actions: availableActions },
        400,
        requestOrigin
      );
    }

    // Execute the action
    const result = await handler(params);

    return successResponse(result, 200, requestOrigin);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const rec = (typeof error === 'object' && error) ? (error as Record<string, unknown>) : {};
    const status = typeof rec.status === 'number' ? rec.status : 500;
    const code = typeof rec.code === 'string' ? rec.code : 'INTERNAL_ERROR';

    // Avoid logging sensitive payloads or arbitrary objects.
    console.error('[Flutterwave Error]', { message: err.message, name: err.name });

    return errorResponse(err.message || 'Internal server error', code, undefined, status, requestOrigin);
  }
});
