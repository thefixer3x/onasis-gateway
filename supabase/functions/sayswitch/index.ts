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

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'SaySwitch API error');
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

    const identifier = transaction_id || reference;
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

    let query = `?page=${page}&per_page=${per_page}`;
    if (category) query += `&category=${category}`;

    return await callSaySwitchAPI(`/billers${query}`, 'GET');
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

    let query = '';
    if (network) query = `?network=${network}`;

    return await callSaySwitchAPI(`/data/plans${query}`, 'GET');
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

    let query = `?page=${page}&per_page=${per_page}`;
    if (from) query += `&from=${from}`;
    if (to) query += `&to=${to}`;
    if (type) query += `&type=${type}`;

    return await callSaySwitchAPI(`/transactions${query}`, 'GET');
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
    if (!SAYSWITCH_API_KEY) {
      return errorResponse('SaySwitch API key not configured', 'MISSING_API_KEY', null, 500);
    }

    // Parse request body
    const body: SaySwitchRequest = await req.json();
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
    console.error('[SaySwitch Error]', error);
    return errorResponse(
      error.message || 'Internal server error',
      error.code || 'INTERNAL_ERROR',
      error.details,
      error.status || 500
    );
  }
});
