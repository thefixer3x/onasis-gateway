# 🚀 Cursor Agent Task: Providus Virtual Account Service Implementation

## 📋 Task Overview
**Service**: Virtual Account Creation & Management
**Priority**: HIGH
**Estimated Time**: 6-8 hours
**Dependencies**: None (standalone service)

---

## 🎯 Objective
Implement Virtual Account service that allows platforms to create dedicated bank accounts for their users. Users get unique account numbers tied to their platform account, eliminating the need for traditional bank accounts.

**Use Case**: Platform integration - e-commerce sites, marketplaces, SaaS platforms can give each user a unique Providus Bank account number. Payments to these accounts automatically credit the user's platform balance.

**Example**:
- Lanonasis marketplace assigns user "john@example.com" account number 9012345678
- Customer sends money to 9012345678 (Providus Bank)
- Webhook notifies Lanonasis: "₦5,000 received for john@example.com"
- Lanonasis credits John's platform balance automatically

---

## 📁 File Structure to Create

```
services/providus-virtual-accounts/
├── config.json                 # Service configuration
├── client.ts                   # Virtual account client
├── mcp-adapter.ts              # MCP tools adapter
├── types.ts                    # TypeScript interfaces
├── webhooks.ts                 # Payment notification handlers
├── README.md                   # Service documentation
└── test.js                     # Integration tests
```

---

## 🔧 Implementation Specifications

### 1. Service Configuration (`config.json`)

```json
{
  "id": "providus-virtual-accounts",
  "name": "Providus Virtual Accounts",
  "version": "1.0.0",
  "description": "Create dedicated bank accounts for platform users - automated payment collection",
  "category": "collections",
  "provider": "Providus Bank",
  "status": "active",
  "authentication": {
    "type": "bearer",
    "tokenHeader": "X-Access-Token",
    "refreshHeader": "X-Refresh-Token"
  },
  "baseUrl": "${PROVIDUS_BASE_URL}",
  "endpoints": [
    {
      "id": "virtual_account_create",
      "name": "Create Virtual Account",
      "path": "/virtual-account/create",
      "method": "POST",
      "description": "Create dedicated account number for user/entity"
    },
    {
      "id": "virtual_account_get",
      "name": "Get Virtual Account",
      "path": "/virtual-account/{accountNumber}",
      "method": "GET",
      "description": "Get virtual account details"
    },
    {
      "id": "virtual_account_list",
      "name": "List Virtual Accounts",
      "path": "/virtual-account/list",
      "method": "GET",
      "description": "List all virtual accounts for merchant"
    },
    {
      "id": "virtual_account_update",
      "name": "Update Virtual Account",
      "path": "/virtual-account/update",
      "method": "PUT",
      "description": "Update account details (name, metadata)"
    },
    {
      "id": "virtual_account_freeze",
      "name": "Freeze Virtual Account",
      "path": "/virtual-account/freeze",
      "method": "POST",
      "description": "Temporarily freeze account (stop accepting payments)"
    },
    {
      "id": "virtual_account_unfreeze",
      "name": "Unfreeze Virtual Account",
      "path": "/virtual-account/unfreeze",
      "method": "POST",
      "description": "Reactivate frozen account"
    },
    {
      "id": "virtual_account_close",
      "name": "Close Virtual Account",
      "path": "/virtual-account/close",
      "method": "DELETE",
      "description": "Permanently close virtual account"
    },
    {
      "id": "virtual_account_transactions",
      "name": "Get Account Transactions",
      "path": "/virtual-account/transactions/{accountNumber}",
      "method": "GET",
      "description": "Get payment history for virtual account"
    },
    {
      "id": "virtual_account_balance",
      "name": "Get Account Balance",
      "path": "/virtual-account/balance/{accountNumber}",
      "method": "GET",
      "description": "Get current balance (if holding funds)"
    },
    {
      "id": "virtual_account_transfer_out",
      "name": "Transfer from Virtual Account",
      "path": "/virtual-account/transfer",
      "method": "POST",
      "description": "Transfer funds out of virtual account"
    },
    {
      "id": "virtual_account_bulk_create",
      "name": "Bulk Create Virtual Accounts",
      "path": "/virtual-account/bulk-create",
      "method": "POST",
      "description": "Create multiple virtual accounts in one request"
    }
  ],
  "environment": {
    "required": [
      "PROVIDUS_BASE_URL",
      "PROVIDUS_USERNAME",
      "PROVIDUS_PASSWORD",
      "PROVIDUS_MERCHANT_ID",
      "PROVIDUS_WEBHOOK_SECRET"
    ]
  },
  "webhooks": {
    "enabled": true,
    "critical": true,
    "events": [
      "virtual_account.created",
      "virtual_account.payment_received",
      "virtual_account.frozen",
      "virtual_account.closed"
    ],
    "notes": "Webhooks are CRITICAL for this service - all payments trigger webhooks"
  },
  "modes": {
    "sandbox": {
      "enabled": true,
      "baseUrl": "https://sandbox.providusbank.com/api/v1"
    },
    "production": {
      "enabled": false,
      "baseUrl": "https://api.providusbank.com/v1"
    }
  }
}
```

---

### 2. TypeScript Types (`types.ts`)

```typescript
export interface VirtualAccountCreateRequest {
  accountName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerBVN?: string;
  metadata?: {
    userId?: string;
    platformId?: string;
    purpose?: string;
    [key: string]: any;
  };
  accountType?: 'DYNAMIC' | 'STATIC';
  expiryDate?: string; // For DYNAMIC accounts
  callbackUrl?: string; // Override default webhook URL
}

export interface VirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: 'Providus Bank';
  bankCode: '101';
  accountType: 'DYNAMIC' | 'STATIC';
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  balance: string;
  currency: 'NGN';
  merchantId: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  expiryDate?: string;
  lastPaymentAt?: string;
}

export interface VirtualAccountUpdateRequest {
  accountNumber: string;
  accountName?: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
}

export interface VirtualAccountListRequest {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'ALL';
  startDate?: string;
  endDate?: string;
}

export interface VirtualAccountListResponse {
  accounts: VirtualAccount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface VirtualAccountTransaction {
  transactionId: string;
  accountNumber: string;
  amount: string;
  senderAccountNumber: string;
  senderAccountName: string;
  senderBankName: string;
  senderBankCode: string;
  sessionId: string;
  narration: string;
  transactionDate: string;
  settledDate?: string;
  status: 'PENDING' | 'SETTLED' | 'FAILED';
  currency: 'NGN';
}

export interface VirtualAccountTransactionsRequest {
  accountNumber: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface VirtualAccountTransferRequest {
  sourceAccountNumber: string;
  beneficiaryAccountNumber: string;
  beneficiaryAccountName: string;
  beneficiaryBankCode: string;
  amount: string;
  narration: string;
  reference?: string;
}

export interface BulkCreateRequest {
  accounts: Array<{
    accountName: string;
    customerEmail?: string;
    metadata?: Record<string, any>;
  }>;
  accountType?: 'DYNAMIC' | 'STATIC';
}

export interface BulkCreateResponse {
  successful: VirtualAccount[];
  failed: Array<{
    accountName: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface VirtualAccountConfig {
  baseUrl: string;
  username: string;
  password: string;
  merchantId: string;
  webhookSecret: string;
  mode: 'sandbox' | 'production';
  getAuthToken: () => Promise<string>;
}

// Webhook payload types
export interface PaymentReceivedWebhook {
  event: 'virtual_account.payment_received';
  timestamp: string;
  data: {
    accountNumber: string;
    accountName: string;
    amount: string;
    senderAccountNumber: string;
    senderAccountName: string;
    senderBankName: string;
    senderBankCode: string;
    sessionId: string;
    narration: string;
    transactionDate: string;
    metadata?: Record<string, any>;
  };
  signature: string;
}
```

---

### 3. Virtual Account Client (`client.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import type {
  VirtualAccountCreateRequest,
  VirtualAccount,
  VirtualAccountUpdateRequest,
  VirtualAccountListRequest,
  VirtualAccountListResponse,
  VirtualAccountTransaction,
  VirtualAccountTransactionsRequest,
  VirtualAccountTransferRequest,
  BulkCreateRequest,
  BulkCreateResponse,
  VirtualAccountConfig,
} from './types';

export class VirtualAccountClient {
  private client: AxiosInstance;
  private config: VirtualAccountConfig;

  constructor(config: VirtualAccountConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Merchant-Id': config.merchantId,
      },
    });

    // Request interceptor for auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.config.getAuthToken();
        if (token) {
          config.headers['X-Access-Token'] = token;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  // ================== Account Creation ==================

  async createVirtualAccount(request: VirtualAccountCreateRequest): Promise<VirtualAccount> {
    try {
      const response = await this.client.post('/virtual-account/create', {
        ...request,
        merchantId: this.config.merchantId,
        accountType: request.accountType || 'STATIC',
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create virtual account');
    }
  }

  async bulkCreateVirtualAccounts(request: BulkCreateRequest): Promise<BulkCreateResponse> {
    try {
      const response = await this.client.post('/virtual-account/bulk-create', {
        ...request,
        merchantId: this.config.merchantId,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to bulk create virtual accounts');
    }
  }

  // ================== Account Management ==================

  async getVirtualAccount(accountNumber: string): Promise<VirtualAccount> {
    try {
      const response = await this.client.get(`/virtual-account/${accountNumber}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get virtual account');
    }
  }

  async listVirtualAccounts(request?: VirtualAccountListRequest): Promise<VirtualAccountListResponse> {
    try {
      const params = {
        page: request?.page || 1,
        limit: request?.limit || 50,
        status: request?.status || 'ALL',
        startDate: request?.startDate,
        endDate: request?.endDate,
      };

      const response = await this.client.get('/virtual-account/list', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to list virtual accounts');
    }
  }

  async updateVirtualAccount(request: VirtualAccountUpdateRequest): Promise<VirtualAccount> {
    try {
      const response = await this.client.put('/virtual-account/update', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update virtual account');
    }
  }

  // ================== Account Status ==================

  async freezeVirtualAccount(accountNumber: string, reason?: string): Promise<{ status: string }> {
    try {
      const response = await this.client.post('/virtual-account/freeze', {
        accountNumber,
        reason,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to freeze virtual account');
    }
  }

  async unfreezeVirtualAccount(accountNumber: string): Promise<{ status: string }> {
    try {
      const response = await this.client.post('/virtual-account/unfreeze', {
        accountNumber,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to unfreeze virtual account');
    }
  }

  async closeVirtualAccount(accountNumber: string, reason?: string): Promise<{ status: string }> {
    try {
      const response = await this.client.delete('/virtual-account/close', {
        data: { accountNumber, reason },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to close virtual account');
    }
  }

  // ================== Transactions ==================

  async getAccountBalance(accountNumber: string): Promise<{ balance: string; availableBalance: string }> {
    try {
      const response = await this.client.get(`/virtual-account/balance/${accountNumber}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get account balance');
    }
  }

  async getAccountTransactions(request: VirtualAccountTransactionsRequest): Promise<{ transactions: VirtualAccountTransaction[] }> {
    try {
      const params = {
        startDate: request.startDate,
        endDate: request.endDate,
        page: request.page || 1,
        limit: request.limit || 50,
      };

      const response = await this.client.get(
        `/virtual-account/transactions/${request.accountNumber}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get account transactions');
    }
  }

  async transferFromVirtualAccount(request: VirtualAccountTransferRequest): Promise<{ transactionId: string; status: string }> {
    try {
      if (!request.reference) {
        request.reference = `VA${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      }

      const response = await this.client.post('/virtual-account/transfer', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to transfer from virtual account');
    }
  }

  // ================== Webhook Verification ==================

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
    return signature === expectedSignature;
  }

  // ================== Error Handling ==================

  private handleError(error: unknown, context: string): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status;
      return new Error(`${context}: ${message} (Status: ${status || 'Unknown'})`);
    }

    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`);
    }

    return new Error(`${context}: Unknown error occurred`);
  }
}

export function createVirtualAccountClient(config: VirtualAccountConfig): VirtualAccountClient {
  return new VirtualAccountClient(config);
}

export type { VirtualAccountConfig };
```

---

### 4. Webhook Handlers (`webhooks.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { VirtualAccountClient } from './client';
import type { PaymentReceivedWebhook } from './types';

export class VirtualAccountWebhooks {
  private client: VirtualAccountClient;

  constructor(client: VirtualAccountClient) {
    this.client = client;
  }

  // Verify webhook signature middleware
  verifyWebhook = (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-webhook-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const isValid = this.client.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  };

  // Main webhook handler
  handleWebhook = async (req: Request, res: Response) => {
    const event = req.body;

    try {
      switch (event.event) {
        case 'virtual_account.created':
          await this.handleAccountCreated(event.data);
          break;
        case 'virtual_account.payment_received':
          await this.handlePaymentReceived(event as PaymentReceivedWebhook);
          break;
        case 'virtual_account.frozen':
          await this.handleAccountFrozen(event.data);
          break;
        case 'virtual_account.closed':
          await this.handleAccountClosed(event.data);
          break;
        default:
          console.log(`Unhandled webhook event: ${event.event}`);
      }

      // ALWAYS return 200 to Providus to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      // Still return 200 to prevent retries, but log error
      res.status(200).json({ received: true, error: 'Processing failed' });
    }
  };

  // ================== Event Handlers ==================

  private async handleAccountCreated(data: any) {
    console.log('Virtual account created:', data);
    // TODO: Store account details in your database
    // Example:
    // await db.virtualAccounts.create({
    //   accountNumber: data.accountNumber,
    //   userId: data.metadata.userId,
    //   status: 'ACTIVE',
    // });
  }

  private async handlePaymentReceived(webhook: PaymentReceivedWebhook) {
    const { data } = webhook;

    console.log('💰 Payment received:', {
      accountNumber: data.accountNumber,
      amount: data.amount,
      from: data.senderAccountName,
    });

    // CRITICAL: This is where you credit your user's balance
    // TODO: Implement your business logic here
    // Example:
    // const userId = data.metadata?.userId;
    // if (userId) {
    //   await creditUserBalance(userId, parseFloat(data.amount));
    //   await sendPaymentNotification(userId, data);
    // }

    // Log transaction for reconciliation
    // await db.transactions.create({
    //   type: 'PAYMENT_RECEIVED',
    //   accountNumber: data.accountNumber,
    //   amount: data.amount,
    //   sessionId: data.sessionId,
    //   senderName: data.senderAccountName,
    //   transactionDate: data.transactionDate,
    //   metadata: data.metadata,
    // });
  }

  private async handleAccountFrozen(data: any) {
    console.log('Virtual account frozen:', data);
    // TODO: Update account status in database
    // await db.virtualAccounts.update(
    //   { accountNumber: data.accountNumber },
    //   { status: 'FROZEN' }
    // );
  }

  private async handleAccountClosed(data: any) {
    console.log('Virtual account closed:', data);
    // TODO: Update account status and handle cleanup
    // await db.virtualAccounts.update(
    //   { accountNumber: data.accountNumber },
    //   { status: 'CLOSED', closedAt: new Date() }
    // );
  }
}

// Express router setup
export function createWebhookRouter(client: VirtualAccountClient) {
  const express = require('express');
  const router = express.Router();
  const webhooks = new VirtualAccountWebhooks(client);

  router.post('/webhooks/virtual-accounts',
    express.json(),
    webhooks.verifyWebhook,
    webhooks.handleWebhook
  );

  return router;
}
```

---

## ✅ Acceptance Criteria

### Functional Requirements:
- [ ] All 11 endpoints implemented
- [ ] 11 MCP tools created
- [ ] Webhook handler with signature verification
- [ ] Bulk account creation support
- [ ] Account lifecycle management (freeze, unfreeze, close)
- [ ] Payment notification handling

### Critical Features:
- [ ] **Webhook signature verification** (security critical)
- [ ] **Payment received handler** (business critical)
- [ ] **Idempotency handling** (prevent duplicate credits)
- [ ] **Error recovery** (retry logic for failed webhooks)

### Code Quality:
- [ ] TypeScript compilation passes
- [ ] Comprehensive error handling
- [ ] Database integration ready
- [ ] Logging for reconciliation

### Testing:
- [ ] Sandbox account creation tests
- [ ] Webhook signature verification tests
- [ ] Payment processing simulation
- [ ] Bulk creation tests

---

## 🧪 Testing Instructions

```javascript
const { createVirtualAccountClient } = require('./client');

async function test() {
  const client = createVirtualAccountClient({
    baseUrl: process.env.PROVIDUS_BASE_URL,
    username: process.env.PROVIDUS_USERNAME,
    password: process.env.PROVIDUS_PASSWORD,
    merchantId: process.env.PROVIDUS_MERCHANT_ID,
    webhookSecret: process.env.PROVIDUS_WEBHOOK_SECRET,
    mode: 'sandbox',
    getAuthToken: async () => 'test-token',
  });

  // Create virtual account
  const account = await client.createVirtualAccount({
    accountName: 'John Doe - Lanonasis',
    customerEmail: 'john@example.com',
    metadata: {
      userId: 'user_12345',
      platformId: 'lanonasis',
    },
  });

  console.log('Created account:', account);
  console.log('Tell user to send money to:', account.accountNumber);
  console.log('Watch for webhook notification...');
}

test().catch(console.error);
```

---

## 🚨 Critical Implementation Notes

### 1. Webhook Configuration
- **MUST** configure webhook URL in Providus dashboard: `https://yourdomain.com/webhooks/virtual-accounts`
- **MUST** verify signatures to prevent fraud
- **MUST** return 200 status immediately (process async if needed)
- **MUST** handle duplicate webhooks (idempotency)

### 2. Payment Processing
- When payment webhook arrives, extract `metadata.userId`
- Credit user's platform balance immediately
- Send notification to user
- Log for reconciliation

### 3. Account Lifecycle
- **STATIC accounts**: Permanent, reusable
- **DYNAMIC accounts**: Temporary, expire after first payment
- Always check `status` before showing account to user

### 4. Reconciliation
- Log ALL webhook events to database
- Store `sessionId` for bank reconciliation
- Daily reconciliation: compare bank statements vs. webhook logs

### 5. Error Handling
- Network failures: Providus will retry webhooks
- Processing errors: Log and alert, don't lose transaction
- Duplicate webhooks: Use `sessionId` or `transactionId` for deduplication

---

## 📚 Integration Example

```typescript
// In your platform's payment service
import { createVirtualAccountClient } from './services/providus-virtual-accounts/client';

// When user signs up
async function onUserSignup(user: User) {
  const account = await virtualAccountClient.createVirtualAccount({
    accountName: `${user.firstName} ${user.lastName}`,
    customerEmail: user.email,
    metadata: { userId: user.id },
  });

  // Save to database
  await db.users.update(
    { id: user.id },
    {
      virtualAccountNumber: account.accountNumber,
      virtualAccountBank: 'Providus Bank (101)',
    }
  );

  // Show to user
  return {
    message: 'Your dedicated account created!',
    accountNumber: account.accountNumber,
    bankName: 'Providus Bank',
    accountName: account.accountName,
  };
}

// When webhook arrives (payment received)
// Your webhook handler will automatically credit user balance
```

---

## 📝 Deliverables

1. Complete `services/providus-virtual-accounts/` directory
2. README.md with integration guide and webhook setup instructions
3. Webhook handler with Express router
4. Test suite with sandbox integration
5. Database schema recommendations
6. Pull request with implementation

---

**Estimated Complexity**: Medium-High
**Prerequisites**: Understanding of webhooks, async processing, financial reconciliation
**Review Required**: Yes (payment-critical service)
**Business Impact**: HIGH - core payment collection feature

This service is critical for automated payment collection! 🚀
