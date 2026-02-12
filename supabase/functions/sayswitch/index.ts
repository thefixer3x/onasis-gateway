/**
 * SaySwitch Edge Function - Standardized Action Dispatch
 *
 * Contract:
 * - Action via JSON body (not query string)
 * - snake_case action names
 * - All 10+ SaySwitch operations supported
 * - Note: Env var is SAYSWITCH_API_KEY (not SWS_API_KEY)
 */

import { successResponse, errorResponse, corsResponse } from '../_shared/response.ts';

const SAYSWITCH_API_KEY = Deno.env.get('SAYSWITCH_API_KEY') || Deno.env.get('SWS_API_KEY');
const SAYSWITCH_BASE_URL = 'https://api.sayswitch.com/v1';

interface SaySwitchRequest {
  action: string;
  [key: string]: any;
}

/**
 * Make request to SaySwitch API
 */
async function callSaySwitchAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${SAYSWITCH_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${SAYSWITCH_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutMs = 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`SaySwitch request timed out after ${timeoutMs}ms`);
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

  if (!response.ok) {
    const bodyMsg = typeof data?.message === 'string'
      ? data.message
      : (rawBody ? rawBody.slice(0, 500) : 'No response body');
    throw new Error(`SaySwitch API error (status ${response.status}): ${bodyMsg}`);
  }

  return data;
}

/**
 * Action handlers
 */
const actions: Record<string, (params: any) => Promise<any>> = {
  /**
   * Purchase airtime
   */
  purchase_airtime: async (params) => {
    const { phone_number, amount, network, reference } = params;

    if (!phone_number || !amount) {
      throw new Error('phone_number and amount are required');
    }

    const payload: any = {
      phone_number,
      amount,
    };

    if (network) payload.network = network;
    if (reference) payload.reference = reference;

    return await callSaySwitchAPI('/airtime', 'POST', payload);
  },

  /**
   * Get transaction status
   */
  get_transaction: async (params) => {
    const { transaction_id, reference } = params;

    if (!transaction_id && !reference) {
      throw new Error('transaction_id or reference is required');
    }

    // URL encode to prevent path injection
    const identifier = encodeURIComponent(transaction_id || reference);
    return await callSaySwitchAPI(`/transactions/${identifier}`, 'GET');
  },

  /**
   * Pay bill
   */
  pay_bill: async (params) => {
    const { biller_code, customer_id, amount, reference } = params;

    if (!biller_code || !customer_id || !amount) {
      throw new Error('biller_code, customer_id, and amount are required');
    }

    return await callSaySwitchAPI('/bills/pay', 'POST', {
      biller_code,
      customer_id,
      amount,
      reference,
    });
  },

  /**
   * Validate customer
   */
  validate_customer: async (params) => {
    const { biller_code, customer_id } = params;

    if (!biller_code || !customer_id) {
      throw new Error('biller_code and customer_id are required');
    }

    return await callSaySwitchAPI('/bills/validate', 'POST', {
      biller_code,
      customer_id,
    });
  },

  /**
   * List billers
   */
  list_billers: async (params) => {
    const { category, page = 1, per_page = 20 } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(per_page),
    });

    if (category) queryParams.append('category', category);

    return await callSaySwitchAPI(`/billers?${queryParams.toString()}`, 'GET');
  },

  /**
   * Purchase data
   */
  purchase_data: async (params) => {
    const { phone_number, data_code, amount, network, reference } = params;

    if (!phone_number || !data_code) {
      throw new Error('phone_number and data_code are required');
    }

    return await callSaySwitchAPI('/data', 'POST', {
      phone_number,
      data_code,
      amount,
      network,
      reference,
    });
  },

  /**
   * Get data plans
   */
  get_data_plans: async (params) => {
    const { network } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams();
    if (network) queryParams.append('network', network);

    const query = queryParams.toString();
    return await callSaySwitchAPI(`/data/plans${query ? '?' + query : ''}`, 'GET');
  },

  /**
   * Transfer funds
   */
  transfer_funds: async (params) => {
    const { account_number, bank_code, amount, narration, reference } = params;

    if (!account_number || !bank_code || !amount) {
      throw new Error('account_number, bank_code, and amount are required');
    }

    return await callSaySwitchAPI('/transfers', 'POST', {
      account_number,
      bank_code,
      amount,
      narration: narration || 'Payment',
      reference,
    });
  },

  /**
   * List banks
   */
  list_banks: async () => {
    return await callSaySwitchAPI('/banks', 'GET');
  },

  /**
   * Verify account
   */
  verify_account: async (params) => {
    const { account_number, bank_code } = params;

    if (!account_number || !bank_code) {
      throw new Error('account_number and bank_code are required');
    }

    return await callSaySwitchAPI('/accounts/verify', 'POST', {
      account_number,
      bank_code,
    });
  },

  /**
   * Get balance
   */
  get_balance: async () => {
    return await callSaySwitchAPI('/balance', 'GET');
  },

  /**
   * List transactions
   */
  list_transactions: async (params) => {
    const { from, to, type, page = 1, per_page = 20 } = params;

    // Use URLSearchParams to safely construct query string
    const queryParams = new URLSearchParams({
      page: String(page),
      per_page: String(per_page),
    });

    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);
    if (type) queryParams.append('type', type);

    return await callSaySwitchAPI(`/transactions?${queryParams.toString()}`, 'GET');
  },

  /**
   * Purchase cable TV
   */
  purchase_cable: async (params) => {
    const { biller_code, customer_id, amount, bouquet_code, reference } = params;

    if (!biller_code || !customer_id || !bouquet_code) {
      throw new Error('biller_code, customer_id, and bouquet_code are required');
    }

    return await callSaySwitchAPI('/cable', 'POST', {
      biller_code,
      customer_id,
      amount,
      bouquet_code,
      reference,
    });
  },

  /**
   * Purchase electricity
   */
  purchase_electricity: async (params) => {
    const { disco_code, meter_number, amount, meter_type, reference } = params;

    if (!disco_code || !meter_number || !amount) {
      throw new Error('disco_code, meter_number, and amount are required');
    }

    return await callSaySwitchAPI('/electricity', 'POST', {
      disco_code,
      meter_number,
      amount,
      meter_type: meter_type || 'prepaid',
      reference,
    });
  },

  /**
   * Validate meter
   */
  validate_meter: async (params) => {
    const { disco_code, meter_number, meter_type } = params;

    if (!disco_code || !meter_number) {
      throw new Error('disco_code and meter_number are required');
    }

    return await callSaySwitchAPI('/electricity/validate', 'POST', {
      disco_code,
      meter_number,
      meter_type: meter_type || 'prepaid',
    });
  },

  /**
   * Health check
   */
  sayswitch_health_check: async () => {
    try {
      const balance = await callSaySwitchAPI('/balance', 'GET');
      return {
        status: 'healthy',
        service: 'sayswitch',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Health check failed: ${msg}`);
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
    if (!SAYSWITCH_API_KEY) {
      return errorResponse('SaySwitch API key not configured', 'MISSING_API_KEY', null, 500, requestOrigin);
    }

    // Parse request body
    let body: SaySwitchRequest;
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
    const details = typeof rec.details === 'string' ? rec.details : undefined;

    console.error('[SaySwitch Error]', { message: err.message, name: err.name });
    return errorResponse(err.message || 'Internal server error', code, details, status, requestOrigin);
  }
});
