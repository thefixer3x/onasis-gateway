# Xpress Wallet WaaS Integration Guide

## Overview

The enhanced Xpress Wallet integration provides a complete Wallet-as-a-Service (WaaS) solution with:
- Full banking operations (wallets, transfers, bank deposits)
- Transaction labeling for reconciliation
- Admin management features
- Real-time balance synchronization
- Comprehensive audit trails
- Revenue analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ONASIS GATEWAY                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  MCP Adapter │───▶│ Wallet Svc   │───▶│  PostgreSQL  │  │
│  │  (Enhanced)  │    │  (WaaS Core) │    │  (Mirror DB) │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘  │
│                              │                               │
│                              │ API Calls                     │
│                              ▼                               │
│                   ┌──────────────────┐                       │
│                   │  Xpress Wallet   │                       │
│                   │      API          │                       │
│                   └──────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Database Setup

Run the migration to create the wallet schema:

```bash
psql $DATABASE_URL < database/migrations/002_wallet_as_a_service_schema.sql
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Xpress Wallet Configuration
XPRESS_API_KEY=your_api_key
XPRESS_SECRET_KEY=your_secret_key
XPRESS_MERCHANT_ID=your_merchant_id
XPRESS_WEBHOOK_SECRET=your_webhook_secret
XPRESS_BASE_URL=https://api.xpress-wallet.com/v1

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 3. Register the Enhanced Adapter

Update `src/adapters/index.ts` to include the enhanced adapter:

```typescript
import XpressWalletWaaSAdapter from '../services/xpress-wallet-waas/xpress-wallet-mcp-adapter.js';

export const adapters = {
  // ... other adapters
  'xpress-wallet-waas': XpressWalletWaaSAdapter
};
```

## API Usage Examples

### Creating a Customer Wallet

```javascript
// Using MCP
const result = await mcpClient.callTool('xpress-wallet-waas', 'create-customer-wallet', {
  userId: 'user_123',
  customerName: 'John Doe',
  phoneNumber: '+2348012345678',
  email: 'john@example.com',
  walletType: 'personal',
  metadata: {
    source: 'mobile_app',
    referralCode: 'REF123'
  }
});

// Response
{
  success: true,
  wallet: {
    id: 'wallet_123',
    account_number: '1234567890',
    account_name: 'John Doe',
    balance: 0,
    status: 'active'
  }
}
```

### Processing Transactions with Labels

```javascript
// Credit wallet with full labeling
const credit = await mcpClient.callTool('xpress-wallet-waas', 'credit-wallet', {
  walletId: 'wallet_123',
  amount: 10000,
  narration: 'Wallet top-up via Paystack',
  category: 'TOP_UP',
  metadata: {
    payment_method: 'paystack',
    payment_reference: 'PSK_12345'
  }
});

// The transaction is automatically labeled:
// - business_unit: 'PAYMENTS'
// - revenue_type: 'TRANSACTION_FEE'
// - fees_charged: 200 (1.5% + ₦50)
// - net_amount: 9800
```

### Bank Transfers

```javascript
// Transfer to bank account
const transfer = await mcpClient.callTool('xpress-wallet-waas', 'bank-transfer', {
  walletId: 'wallet_123',
  bankCode: '058',
  accountNumber: '0123456789',
  amount: 5000,
  narration: 'Withdrawal to GTBank'
});

// Response includes:
// - transaction record
// - bank transfer details
// - settlement reference
```

### Batch Operations

```javascript
// Batch credit multiple wallets
const batchResult = await mcpClient.callTool('xpress-wallet-waas', 'batch-credit-wallets', {
  items: [
    {
      walletId: 'wallet_123',
      amount: 1000,
      narration: 'Referral bonus'
    },
    {
      walletId: 'wallet_456',
      amount: 2000,
      narration: 'Cashback reward'
    }
  ]
});

// Response
{
  batchId: 'batch_789',
  batchReference: 'BATCH_CREDIT_20250127_ABC123',
  totalItems: 2,
  successCount: 2,
  failedCount: 0,
  results: [...]
}
```

## Admin Features

### Daily Reconciliation

```javascript
// Run daily reconciliation
const reconciliation = await mcpClient.callTool('xpress-wallet-waas', 'run-daily-reconciliation', {
  date: '2025-01-27'
});

// Response includes:
// - Total transactions
// - Success/failure counts
// - Revenue breakdown
// - Settlement totals
```

### Revenue Analytics

```javascript
// Get revenue analytics
const revenue = await mcpClient.callTool('xpress-wallet-waas', 'get-revenue-analytics', {
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  businessUnit: 'PAYMENTS'
});

// Returns:
// - Transaction fees collected
// - Interest revenue
// - Commission costs
// - Net revenue by category
```

### Balance Discrepancy Check

```javascript
// Check for balance mismatches
const discrepancies = await mcpClient.callTool('xpress-wallet-waas', 'check-balance-discrepancies', {
  walletIds: ['wallet_123', 'wallet_456'] // Optional: check specific wallets
});

// Returns list of wallets with balance differences
// Automatically logs issues for investigation
```

## Webhook Integration

### Setup Webhook Endpoint

Configure webhook URL in Xpress Wallet dashboard:
```
https://your-domain.com/webhooks/xpress-wallet
```

### Process Webhooks

```javascript
// In your webhook handler
app.post('/webhooks/xpress-wallet', async (req, res) => {
  const signature = req.headers['x-xpress-signature'];
  const payload = req.body;

  try {
    await mcpClient.callTool('xpress-wallet-waas', 'process-webhook', {
      signature,
      payload
    });
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(400).send('Failed');
  }
});
```

## Transaction Labeling System

All transactions are automatically labeled for reconciliation:

### Categories
- `TOP_UP` - Wallet funding
- `SAVINGS` - Savings contributions
- `WITHDRAWAL` - Cash out operations
- `TRANSFER` - Inter-wallet or bank transfers
- `REFUND` - Refunded transactions

### Business Units
- `SAVINGS` - Savings product operations
- `PAYMENTS` - Payment processing
- `REFERRALS` - Referral system
- `GROUPS` - Group savings

### Revenue Types
- `TRANSACTION_FEE` - Fees on transactions
- `INTEREST` - Interest revenue
- `SUBSCRIPTION` - Subscription fees
- `COMMISSION` - Referral commissions

## Monitoring & Alerts

### Health Check

```javascript
// Check adapter health
const status = await mcpClient.getAdapterStatus('xpress-wallet-waas');

// Returns:
{
  healthy: true,
  uptime: 3600000,
  requestCount: 1523,
  errorCount: 2,
  averageResponseTime: 245,
  metadata: {
    totalWallets: 1250,
    dailyTransactions: 523
  }
}
```

### Error Handling

The service includes comprehensive error handling:
- Automatic retries for transient failures
- Balance validation before debits
- Transaction rollback on failures
- Detailed error logging

## Best Practices

1. **Always Use References**: Generate unique references for every transaction
2. **Label Transactions**: Properly categorize transactions for accurate reconciliation
3. **Regular Sync**: Use the sync features to keep balances updated
4. **Monitor Webhooks**: Check webhook processing status regularly
5. **Daily Reconciliation**: Run reconciliation at the end of each business day

## Security Considerations

1. **API Keys**: Store securely in environment variables
2. **Webhook Validation**: Always verify webhook signatures
3. **Database Security**: Use row-level security policies
4. **Audit Trail**: All operations are logged with user context
5. **Rate Limiting**: Implement rate limiting on API endpoints

## Support

For issues or questions:
1. Check transaction logs in the database
2. Review webhook event history
3. Run balance discrepancy checks
4. Contact Xpress Wallet support for API issues