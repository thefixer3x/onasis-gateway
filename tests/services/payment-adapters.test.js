import { describe, it, expect, vi } from 'vitest';

// CommonJS interop
import PaystackAdapterImport from '../../services/paystack-payment-gateway/paystack-adapter.js';
import FlutterwaveAdapterImport from '../../services/flutterwave-payment-gateway/flutterwave-adapter.js';

const PaystackAdapter = PaystackAdapterImport?.default || PaystackAdapterImport;
const FlutterwaveAdapter = FlutterwaveAdapterImport?.default || FlutterwaveAdapterImport;

describe('Phase 1.5 Payment Adapters', () => {
  it('PaystackAdapter maps kebab-case toolName to snake_case action payload', async () => {
    const client = { call: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new PaystackAdapter({ client, functionName: 'paystack' });

    await adapter.initialize();
    expect(adapter.tools).toHaveLength(10);

    await adapter.callTool(
      'initialize-transaction',
      { amount: 100, email: 'user@example.com' },
      { authorization: 'Bearer token' }
    );

    expect(client.call).toHaveBeenCalledWith(
      { action: 'initialize_transaction', amount: 100, email: 'user@example.com' },
      { authorization: 'Bearer token' }
    );
  });

  it('FlutterwaveAdapter applies mobile money defaults (Kenya -> type mobile_money_mpesa)', async () => {
    const client = { call: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new FlutterwaveAdapter({ client, functionName: 'flutterwave' });

    await adapter.initialize();
    expect(adapter.tools).toHaveLength(10);

    await adapter.callTool(
      'mobile-money-kenya',
      { amount: 50, phone_number: '+254700000000' },
      { authorization: 'Bearer token' }
    );

    expect(client.call).toHaveBeenCalledWith(
      {
        action: 'mobile_money_kenya',
        type: 'mobile_money_mpesa',
        amount: 50,
        phone_number: '+254700000000'
      },
      { authorization: 'Bearer token' }
    );
  });
});

