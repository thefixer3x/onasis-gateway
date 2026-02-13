import { describe, it, expect, vi } from 'vitest';

import ProvidusAdapterImport from '../../services/providus-bank/providus-adapter.js';
import CreditAdapterImport from '../../services/credit-as-a-service/credit-adapter.js';

const ProvidusAdapter = ProvidusAdapterImport?.default || ProvidusAdapterImport;
const CreditAdapter = CreditAdapterImport?.default || CreditAdapterImport;

describe('Phase 4 Adapters', () => {
  it('ProvidusAdapter initializes and routes pb-nip-transfer', async () => {
    const client = {
      authenticate: vi.fn(),
      getUserProfile: vi.fn(),
      nipFundTransfer: vi.fn().mockResolvedValue({ status: true }),
      nipMultiDebitTransfer: vi.fn(),
      healthCheck: vi.fn(),
    };

    const adapter = new ProvidusAdapter({ client });
    await adapter.initialize();

    expect(adapter.tools).toHaveLength(5);

    await adapter.callTool('pb-nip-transfer', {
      beneficiaryAccountName: 'Jane Doe',
      beneficiaryAccountNumber: '0123456789',
      beneficiaryBank: '011',
      transactionAmount: '1000',
      narration: 'Phase4 test',
      sourceAccountName: 'Onasis Ltd',
    });

    expect(client.nipFundTransfer).toHaveBeenCalledTimes(1);
    const payload = client.nipFundTransfer.mock.calls[0][0];
    expect(payload.transactionReference).toBeTruthy();
    expect(payload.transactionReference.startsWith('PB')).toBe(true);
    expect(payload.transactionAmount).toBe('1000');
  });

  it('CreditAsAServiceAdapter maps kebab tools to client methods', async () => {
    const client = {
      submitCreditApplication: vi.fn().mockResolvedValue({ success: true }),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
    };

    const adapter = new CreditAdapter({ client });
    await adapter.initialize();

    expect(adapter.tools.find((t) => t.name === 'submit-credit-application')).toBeTruthy();
    expect(adapter.tools.find((t) => t.name === 'credit-health-check')).toBeTruthy();

    await adapter.callTool('submit-credit-application', {
      application_type: 'personal',
      requested_amount: 50000,
      user_id: 'test-user',
    });
    expect(client.submitCreditApplication).toHaveBeenCalledWith(
      { application_type: 'personal', requested_amount: 50000, user_id: 'test-user' },
      {}
    );

    await adapter.callTool('credit-health-check', {});
    expect(client.healthCheck).toHaveBeenCalled();
  });
});

