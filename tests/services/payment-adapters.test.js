import { describe, it, expect, vi } from 'vitest';

// CommonJS interop
import PaystackAdapterImport from '../../services/paystack-payment-gateway/paystack-adapter.js';
import FlutterwaveAdapterImport from '../../services/flutterwave-payment-gateway/flutterwave-adapter.js';
import StripeAdapterImport from '../../services/---stripe-api--2024-04-10--postman-collection/stripe-adapter.js';
import SayswitchAdapterImport from '../../services/sayswitch-api-integration-postman-collection/sayswitch-adapter.js';

const PaystackAdapter = PaystackAdapterImport?.default || PaystackAdapterImport;
const FlutterwaveAdapter = FlutterwaveAdapterImport?.default || FlutterwaveAdapterImport;
const StripeAdapter = StripeAdapterImport?.default || StripeAdapterImport;
const SayswitchAdapter = SayswitchAdapterImport?.default || SayswitchAdapterImport;

describe('Phase 1.5 Payment Adapters', () => {
  it('PaystackAdapter uses live query-action contract for initialize-transaction', async () => {
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
      'paystack',
      { amount: 100, email: 'user@example.com' },
      {
        authorization: 'Bearer token',
        method: 'POST',
        params: { action: 'initialize' }
      }
    );
  });

  it('FlutterwaveAdapter keeps action-dispatch payload for non-live mapped tools', async () => {
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
      'flutterwave',
      {
        action: 'mobile_money_kenya',
        type: 'mobile_money_mpesa',
        amount: 50,
        phone_number: '+254700000000'
      },
      { authorization: 'Bearer token' }
    );
  });

  it('FlutterwaveAdapter uses live path contract for initiate-payment', async () => {
    const client = { call: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new FlutterwaveAdapter({ client, functionName: 'flutterwave' });

    await adapter.initialize();
    await adapter.callTool(
      'initiate-payment',
      { amount: 5000, currency: 'NGN', tx_ref: 'fw_ref_1', customer: { email: 'user@example.com' } },
      { authorization: 'Bearer token' }
    );

    expect(client.call).toHaveBeenCalledWith(
      'flutterwave/createPayment',
      { amount: 5000, currency: 'NGN', tx_ref: 'fw_ref_1', customer: { email: 'user@example.com' } },
      { authorization: 'Bearer token' }
    );
  });

  it('StripeAdapter maps create-checkout-session to create_checkout_session action', async () => {
    const client = { call: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new StripeAdapter({ client, functionName: 'stripe' });

    await adapter.initialize();
    expect(adapter.tools).toHaveLength(10);

    await adapter.callTool(
      'create-checkout-session',
      {
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        line_items: [{ price: 'price_123', quantity: 1 }]
      },
      { authorization: 'Bearer token' }
    );

    expect(client.call).toHaveBeenCalledWith(
      {
        action: 'create_checkout_session',
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        line_items: [{ price: 'price_123', quantity: 1 }]
      },
      { authorization: 'Bearer token' }
    );
  });

  it('SayswitchAdapter maps verify-transaction to verify_transaction action', async () => {
    const client = { call: vi.fn().mockResolvedValue({ ok: true }) };
    const adapter = new SayswitchAdapter({ client, functionName: 'sayswitch' });

    await adapter.initialize();
    expect(adapter.tools).toHaveLength(10);

    await adapter.callTool(
      'verify-transaction',
      { reference: 'sw_ref_123' },
      { authorization: 'Bearer token' }
    );

    expect(client.call).toHaveBeenCalledWith(
      { action: 'verify_transaction', reference: 'sw_ref_123' },
      { authorization: 'Bearer token' }
    );
  });
});
