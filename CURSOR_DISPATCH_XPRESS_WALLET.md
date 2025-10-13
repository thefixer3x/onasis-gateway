# 🚀 Cursor Agent Task: Providus Xpress Wallet Service Implementation

## 📋 Task Overview
**Service**: Xpress Wallet - Full Consumer Wallet Platform
**Priority**: HIGH
**Estimated Time**: 8-10 hours
**Dependencies**: None (standalone service)

---

## 🎯 Objective
Implement complete Xpress Wallet service for end-user wallet operations. This is a full-featured digital wallet platform embedded within Providus Bank, allowing users to create wallets, send/receive money, buy airtime, manage prepaid cards, and more.

**Use Case**: Consumer-facing wallet application - users can have digital wallets without traditional bank accounts, perform peer-to-peer transfers, pay bills, and manage their finances.

---

## 📁 File Structure to Create

```
services/providus-xpress-wallet/
├── config.json                 # Service configuration
├── client.ts                   # Xpress Wallet client
├── mcp-adapter.ts              # MCP tools adapter
├── types.ts                    # TypeScript interfaces
├── webhooks.ts                 # Webhook handlers for wallet events
├── README.md                   # Service documentation
└── test.js                     # Integration tests
```

---

## 🔧 Implementation Specifications

### 1. Service Configuration (`config.json`)

```json
{
  "id": "providus-xpress-wallet",
  "name": "Providus Xpress Wallet",
  "version": "1.0.0",
  "description": "Full-featured digital wallet platform - consumer wallet management, P2P transfers, airtime, bill payments",
  "category": "wallet",
  "provider": "Providus Bank",
  "status": "active",
  "authentication": {
    "type": "bearer",
    "tokenHeader": "X-Access-Token",
    "refreshHeader": "X-Refresh-Token"
  },
  "baseUrl": "${PROVIDUS_XPRESS_BASE_URL}",
  "endpoints": [
    {
      "id": "wallet_create",
      "name": "Create Wallet",
      "path": "/wallet/create",
      "method": "POST",
      "description": "Create new digital wallet for user"
    },
    {
      "id": "wallet_balance",
      "name": "Get Wallet Balance",
      "path": "/wallet/balance/{walletId}",
      "method": "GET",
      "description": "Get current wallet balance"
    },
    {
      "id": "wallet_credit",
      "name": "Credit Wallet",
      "path": "/wallet/credit",
      "method": "POST",
      "description": "Add funds to wallet"
    },
    {
      "id": "wallet_debit",
      "name": "Debit Wallet",
      "path": "/wallet/debit",
      "method": "POST",
      "description": "Deduct funds from wallet"
    },
    {
      "id": "wallet_transfer",
      "name": "Wallet to Wallet Transfer",
      "path": "/wallet/transfer",
      "method": "POST",
      "description": "Transfer between wallets (P2P)"
    },
    {
      "id": "wallet_to_bank",
      "name": "Wallet to Bank Transfer",
      "path": "/wallet/transfer-to-bank",
      "method": "POST",
      "description": "Transfer from wallet to bank account"
    },
    {
      "id": "customer_create",
      "name": "Create Customer",
      "path": "/customer/create",
      "method": "POST",
      "description": "Register new customer/wallet user"
    },
    {
      "id": "customer_profile",
      "name": "Get Customer Profile",
      "path": "/customer/{customerId}",
      "method": "GET",
      "description": "Get customer details and wallets"
    },
    {
      "id": "customer_kyc",
      "name": "Update KYC",
      "path": "/customer/kyc",
      "method": "PUT",
      "description": "Update customer KYC information"
    },
    {
      "id": "airtime_purchase",
      "name": "Buy Airtime",
      "path": "/wallet/airtime",
      "method": "POST",
      "description": "Purchase mobile airtime from wallet"
    },
    {
      "id": "data_purchase",
      "name": "Buy Data Bundle",
      "path": "/wallet/data",
      "method": "POST",
      "description": "Purchase mobile data bundle"
    },
    {
      "id": "prepaid_card_create",
      "name": "Create Prepaid Card",
      "path": "/prepaid-card/create",
      "method": "POST",
      "description": "Create virtual prepaid card linked to wallet"
    },
    {
      "id": "prepaid_card_fund",
      "name": "Fund Prepaid Card",
      "path": "/prepaid-card/fund",
      "method": "POST",
      "description": "Fund prepaid card from wallet"
    },
    {
      "id": "transaction_history",
      "name": "Wallet Transaction History",
      "path": "/wallet/transactions/{walletId}",
      "method": "GET",
      "description": "Get wallet transaction history"
    },
    {
      "id": "team_create",
      "name": "Create Team/Sub-account",
      "path": "/team/create",
      "method": "POST",
      "description": "Create team or sub-account for organization"
    },
    {
      "id": "team_permissions",
      "name": "Set Team Permissions",
      "path": "/team/permissions",
      "method": "PUT",
      "description": "Configure role-based access for team members"
    }
  ],
  "environment": {
    "required": [
      "PROVIDUS_XPRESS_BASE_URL",
      "PROVIDUS_XPRESS_API_KEY",
      "PROVIDUS_XPRESS_MERCHANT_ID",
      "PROVIDUS_XPRESS_WEBHOOK_SECRET"
    ]
  },
  "webhooks": {
    "enabled": true,
    "events": [
      "wallet.created",
      "wallet.credited",
      "wallet.debited",
      "transfer.completed",
      "transfer.failed",
      "airtime.purchased",
      "card.created",
      "card.funded",
      "kyc.updated"
    ]
  },
  "modes": {
    "sandbox": {
      "enabled": true,
      "baseUrl": "https://sandbox-xpress.providusbank.com/api/v1"
    },
    "production": {
      "enabled": false,
      "baseUrl": "https://xpress.providusbank.com/api/v1"
    }
  }
}
```

---

### 2. TypeScript Types (`types.ts`)

```typescript
export interface WalletCreateRequest {
  customerId: string;
  walletType: 'PERSONAL' | 'BUSINESS';
  currency: 'NGN';
  walletName?: string;
  metadata?: Record<string, any>;
}

export interface Wallet {
  walletId: string;
  customerId: string;
  walletNumber: string;
  walletName: string;
  walletType: 'PERSONAL' | 'BUSINESS';
  balance: string;
  availableBalance: string;
  currency: 'NGN';
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'SUSPENDED';
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  limits: {
    dailyTransactionLimit: string;
    singleTransactionLimit: string;
    monthlyTransactionLimit: string;
  };
  createdAt: string;
  lastActivityAt: string;
}

export interface CustomerCreateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
  };
  bvn?: string;
  idType?: 'NIN' | 'PASSPORT' | 'DRIVERS_LICENSE';
  idNumber?: string;
}

export interface Customer {
  customerId: string;
  merchantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  bvn?: string;
  kycStatus: 'UNVERIFIED' | 'TIER_1' | 'TIER_2' | 'TIER_3';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  wallets: Wallet[];
  createdAt: string;
  updatedAt: string;
}

export interface WalletCreditRequest {
  walletId: string;
  amount: string;
  currency: 'NGN';
  reference: string;
  narration: string;
  source: 'BANK_TRANSFER' | 'CARD' | 'CASH' | 'REVERSAL';
  metadata?: Record<string, any>;
}

export interface WalletDebitRequest {
  walletId: string;
  amount: string;
  currency: 'NGN';
  reference: string;
  narration: string;
  purpose: 'TRANSFER' | 'PAYMENT' | 'AIRTIME' | 'BILLS' | 'WITHDRAWAL';
  metadata?: Record<string, any>;
}

export interface WalletTransferRequest {
  sourceWalletId: string;
  destinationWalletId: string;
  amount: string;
  narration: string;
  reference?: string;
  pin?: string; // Wallet PIN for security
}

export interface WalletToBankRequest {
  sourceWalletId: string;
  beneficiaryAccountNumber: string;
  beneficiaryAccountName: string;
  beneficiaryBankCode: string;
  amount: string;
  narration: string;
  reference?: string;
  pin?: string;
}

export interface AirtimePurchaseRequest {
  walletId: string;
  phoneNumber: string;
  amount: string;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  reference?: string;
}

export interface DataPurchaseRequest {
  walletId: string;
  phoneNumber: string;
  dataPlan: string; // Plan code from provider
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  reference?: string;
}

export interface PrepaidCardCreateRequest {
  walletId: string;
  cardType: 'VIRTUAL' | 'PHYSICAL';
  cardBrand: 'VISA' | 'MASTERCARD';
  currency: 'NGN' | 'USD';
  cardName?: string;
}

export interface PrepaidCard {
  cardId: string;
  walletId: string;
  cardNumber: string; // Masked
  cardType: 'VIRTUAL' | 'PHYSICAL';
  cardBrand: 'VISA' | 'MASTERCARD';
  balance: string;
  currency: 'NGN' | 'USD';
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  expiryDate: string;
  cvv?: string; // Only shown once on creation
  createdAt: string;
}

export interface TransactionHistoryRequest {
  walletId: string;
  startDate?: string;
  endDate?: string;
  type?: 'CREDIT' | 'DEBIT' | 'ALL';
  page?: number;
  limit?: number;
}

export interface WalletTransaction {
  transactionId: string;
  walletId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  reference: string;
  narration: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
  category: 'TRANSFER' | 'PAYMENT' | 'AIRTIME' | 'BILLS' | 'WITHDRAWAL' | 'DEPOSIT';
  counterparty?: {
    type: 'WALLET' | 'BANK_ACCOUNT';
    identifier: string;
    name: string;
  };
  createdAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

export interface KYCUpdateRequest {
  customerId: string;
  bvn?: string;
  idType?: 'NIN' | 'PASSPORT' | 'DRIVERS_LICENSE';
  idNumber?: string;
  idImage?: string; // Base64 encoded
  addressProof?: string; // Base64 encoded
  selfieImage?: string; // Base64 encoded
}

export interface TeamCreateRequest {
  merchantId: string;
  teamName: string;
  teamEmail: string;
  parentWalletId: string;
  permissions: string[];
}

export interface XpressWalletConfig {
  baseUrl: string;
  apiKey: string;
  merchantId: string;
  webhookSecret: string;
  mode: 'sandbox' | 'production';
}

// Webhook event types
export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: any;
  signature: string;
}
```

---

### 3. Xpress Wallet Client (`client.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import type {
  WalletCreateRequest,
  Wallet,
  CustomerCreateRequest,
  Customer,
  WalletCreditRequest,
  WalletDebitRequest,
  WalletTransferRequest,
  WalletToBankRequest,
  AirtimePurchaseRequest,
  DataPurchaseRequest,
  PrepaidCardCreateRequest,
  PrepaidCard,
  TransactionHistoryRequest,
  WalletTransaction,
  KYCUpdateRequest,
  TeamCreateRequest,
  XpressWalletConfig,
} from './types';

export class XpressWalletClient {
  private client: AxiosInstance;
  private config: XpressWalletConfig;

  constructor(config: XpressWalletConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
        'X-Merchant-Id': config.merchantId,
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          const message = error.response?.data?.message || error.message;
          throw new Error(`Xpress Wallet API Error: ${message}`);
        }
        throw error;
      }
    );
  }

  // ================== Customer Management ==================

  async createCustomer(request: CustomerCreateRequest): Promise<Customer> {
    const response = await this.client.post('/customer/create', request);
    return response.data;
  }

  async getCustomer(customerId: string): Promise<Customer> {
    const response = await this.client.get(`/customer/${customerId}`);
    return response.data;
  }

  async updateKYC(request: KYCUpdateRequest): Promise<{ status: string; tier: string }> {
    const response = await this.client.put('/customer/kyc', request);
    return response.data;
  }

  // ================== Wallet Management ==================

  async createWallet(request: WalletCreateRequest): Promise<Wallet> {
    const response = await this.client.post('/wallet/create', request);
    return response.data;
  }

  async getWalletBalance(walletId: string): Promise<Wallet> {
    const response = await this.client.get(`/wallet/balance/${walletId}`);
    return response.data;
  }

  async creditWallet(request: WalletCreditRequest): Promise<{ transactionId: string; status: string }> {
    const response = await this.client.post('/wallet/credit', request);
    return response.data;
  }

  async debitWallet(request: WalletDebitRequest): Promise<{ transactionId: string; status: string }> {
    const response = await this.client.post('/wallet/debit', request);
    return response.data;
  }

  // ================== Transfers ==================

  async walletToWalletTransfer(request: WalletTransferRequest): Promise<{ transactionId: string; status: string }> {
    if (!request.reference) {
      request.reference = `WW${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    }
    const response = await this.client.post('/wallet/transfer', request);
    return response.data;
  }

  async walletToBankTransfer(request: WalletToBankRequest): Promise<{ transactionId: string; status: string; bankReference: string }> {
    if (!request.reference) {
      request.reference = `WB${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    }
    const response = await this.client.post('/wallet/transfer-to-bank', request);
    return response.data;
  }

  // ================== Value Added Services ==================

  async purchaseAirtime(request: AirtimePurchaseRequest): Promise<{ transactionId: string; status: string; token?: string }> {
    if (!request.reference) {
      request.reference = `AIR${Date.now()}`;
    }
    const response = await this.client.post('/wallet/airtime', request);
    return response.data;
  }

  async purchaseData(request: DataPurchaseRequest): Promise<{ transactionId: string; status: string; token?: string }> {
    if (!request.reference) {
      request.reference = `DATA${Date.now()}`;
    }
    const response = await this.client.post('/wallet/data', request);
    return response.data;
  }

  // ================== Prepaid Cards ==================

  async createPrepaidCard(request: PrepaidCardCreateRequest): Promise<PrepaidCard> {
    const response = await this.client.post('/prepaid-card/create', request);
    return response.data;
  }

  async fundPrepaidCard(cardId: string, walletId: string, amount: string): Promise<{ status: string }> {
    const response = await this.client.post('/prepaid-card/fund', {
      cardId,
      walletId,
      amount,
    });
    return response.data;
  }

  // ================== Transactions ==================

  async getTransactionHistory(request: TransactionHistoryRequest): Promise<{ transactions: WalletTransaction[]; pagination: any }> {
    const params = {
      startDate: request.startDate,
      endDate: request.endDate,
      type: request.type || 'ALL',
      page: request.page || 1,
      limit: request.limit || 50,
    };

    const response = await this.client.get(`/wallet/transactions/${request.walletId}`, { params });
    return response.data;
  }

  // ================== Team Management ==================

  async createTeam(request: TeamCreateRequest): Promise<{ teamId: string; teamWalletId: string }> {
    const response = await this.client.post('/team/create', request);
    return response.data;
  }

  async setTeamPermissions(teamId: string, permissions: string[]): Promise<{ status: string }> {
    const response = await this.client.put('/team/permissions', {
      teamId,
      permissions,
    });
    return response.data;
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
}

export function createXpressWalletClient(config: XpressWalletConfig): XpressWalletClient {
  return new XpressWalletClient(config);
}

export type { XpressWalletConfig };
```

---

### 4. MCP Adapter (`mcp-adapter.ts`)

**Note**: Create 16 MCP tools covering all major operations. Follow same pattern as Account Services adapter.

Tools to implement:
1. `xpress_wallet_create_customer`
2. `xpress_wallet_create_wallet`
3. `xpress_wallet_get_balance`
4. `xpress_wallet_credit`
5. `xpress_wallet_debit`
6. `xpress_wallet_transfer_p2p`
7. `xpress_wallet_transfer_to_bank`
8. `xpress_wallet_buy_airtime`
9. `xpress_wallet_buy_data`
10. `xpress_wallet_create_card`
11. `xpress_wallet_fund_card`
12. `xpress_wallet_transaction_history`
13. `xpress_wallet_update_kyc`
14. `xpress_wallet_create_team`
15. `xpress_wallet_get_customer`
16. `xpress_wallet_health_check`

---

### 5. Webhook Handlers (`webhooks.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { XpressWalletClient } from './client';
import type { WebhookEvent } from './types';

export class XpressWalletWebhooks {
  private client: XpressWalletClient;

  constructor(client: XpressWalletClient) {
    this.client = client;
  }

  // Middleware to verify webhook signatures
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

  // Webhook event router
  handleWebhook = async (req: Request, res: Response) => {
    const event: WebhookEvent = req.body;

    try {
      switch (event.event) {
        case 'wallet.created':
          await this.handleWalletCreated(event.data);
          break;
        case 'wallet.credited':
          await this.handleWalletCredited(event.data);
          break;
        case 'wallet.debited':
          await this.handleWalletDebited(event.data);
          break;
        case 'transfer.completed':
          await this.handleTransferCompleted(event.data);
          break;
        case 'transfer.failed':
          await this.handleTransferFailed(event.data);
          break;
        case 'airtime.purchased':
          await this.handleAirtimePurchased(event.data);
          break;
        case 'card.created':
          await this.handleCardCreated(event.data);
          break;
        case 'card.funded':
          await this.handleCardFunded(event.data);
          break;
        case 'kyc.updated':
          await this.handleKYCUpdated(event.data);
          break;
        default:
          console.log(`Unhandled webhook event: ${event.event}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  };

  // Event handlers (implement your business logic here)
  private async handleWalletCreated(data: any) {
    console.log('Wallet created:', data);
    // TODO: Store in database, send notification, etc.
  }

  private async handleWalletCredited(data: any) {
    console.log('Wallet credited:', data);
    // TODO: Update balance, send notification
  }

  private async handleWalletDebited(data: any) {
    console.log('Wallet debited:', data);
    // TODO: Update balance, log transaction
  }

  private async handleTransferCompleted(data: any) {
    console.log('Transfer completed:', data);
    // TODO: Update transaction status, notify user
  }

  private async handleTransferFailed(data: any) {
    console.log('Transfer failed:', data);
    // TODO: Reverse transaction, notify user
  }

  private async handleAirtimePurchased(data: any) {
    console.log('Airtime purchased:', data);
    // TODO: Log purchase, send receipt
  }

  private async handleCardCreated(data: any) {
    console.log('Card created:', data);
    // TODO: Store card details, send notification
  }

  private async handleCardFunded(data: any) {
    console.log('Card funded:', data);
    // TODO: Update card balance
  }

  private async handleKYCUpdated(data: any) {
    console.log('KYC updated:', data);
    // TODO: Update customer tier, notify user
  }
}

// Express router setup
export function createWebhookRouter(client: XpressWalletClient) {
  const express = require('express');
  const router = express.Router();
  const webhooks = new XpressWalletWebhooks(client);

  router.post('/webhooks/xpress-wallet',
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
- [ ] All 16 endpoints implemented (customer, wallet, transfers, VAS, cards, team)
- [ ] All 16 MCP tools registered and callable
- [ ] Webhook handler with signature verification
- [ ] KYC tier management
- [ ] Transaction reference auto-generation
- [ ] Comprehensive error handling

### Code Quality:
- [ ] TypeScript compilation passes
- [ ] Follows existing code patterns
- [ ] Complete JSDoc documentation
- [ ] Type-safe implementations

### Security:
- [ ] Webhook signature verification
- [ ] PIN validation for sensitive operations
- [ ] API key protection
- [ ] No sensitive data in logs

### Testing:
- [ ] Unit tests for all client methods
- [ ] Webhook signature verification tests
- [ ] Sandbox integration tests
- [ ] Error scenario coverage

---

## 🧪 Testing Instructions

```javascript
const { createXpressWalletClient } = require('./client');

async function test() {
  const client = createXpressWalletClient({
    baseUrl: process.env.PROVIDUS_XPRESS_BASE_URL,
    apiKey: process.env.PROVIDUS_XPRESS_API_KEY,
    merchantId: process.env.PROVIDUS_XPRESS_MERCHANT_ID,
    webhookSecret: process.env.PROVIDUS_XPRESS_WEBHOOK_SECRET,
    mode: 'sandbox',
  });

  // Test customer creation
  const customer = await client.createCustomer({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phoneNumber: '+2348012345678',
  });
  console.log('Customer:', customer);

  // Test wallet creation
  const wallet = await client.createWallet({
    customerId: customer.customerId,
    walletType: 'PERSONAL',
    currency: 'NGN',
  });
  console.log('Wallet:', wallet);

  // Test balance inquiry
  const balance = await client.getWalletBalance(wallet.walletId);
  console.log('Balance:', balance);
}

test().catch(console.error);
```

---

## 🚨 Important Notes

1. **Standalone Service**: Completely separate from corporate account services and virtual accounts
2. **Consumer-Facing**: This is for end-users, not corporate/B2B
3. **Full Feature Set**: Implement ALL wallet features - this is the complete embedded wallet platform
4. **KYC Tiers**: Implement tier-based transaction limits (TIER_1, TIER_2, TIER_3)
5. **Webhooks Required**: Real-time events critical for wallet operations
6. **PIN Security**: Wallet PIN required for sensitive operations (transfers, withdrawals)
7. **Sandbox First**: Extensive testing required before production

---

## 📚 Reference Files

- Providus Transfer client: `/opt/lanonasis/onasis-gateway/services/providus-bank/client.ts`
- Account Services guide: `/opt/lanonasis/onasis-gateway/CURSOR_DISPATCH_ACCOUNT_SERVICES.md`
- Existing webhook patterns: Check PayStack implementation if available

---

## 📝 Deliverables

1. Complete `services/providus-xpress-wallet/` directory with all files
2. README.md with comprehensive usage guide and examples
3. Test suite with 90%+ coverage
4. Webhook integration code with Express router
5. API Gateway registration code
6. Pull request with detailed description

---

**Estimated Complexity**: High
**Prerequisites**: Strong TypeScript, REST APIs, webhook handling, financial systems
**Review Required**: Yes (security-critical service)

This is the most feature-rich Providus service - take your time to implement it correctly! 🚀
