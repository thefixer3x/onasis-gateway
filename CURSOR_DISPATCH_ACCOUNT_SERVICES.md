# 🚀 Cursor Agent Task: Providus Bank Account Services Implementation

## 📋 Task Overview
**Service**: Account Services Module for Providus Bank Integration
**Priority**: HIGH
**Estimated Time**: 4-6 hours
**Dependencies**: Existing `services/providus-bank/client.ts`

---

## 🎯 Objective
Implement Account Services functionality for corporate account management via API. This service handles balance inquiries, transaction history, account validation, and statement generation.

**Use Case**: Corporate treasury management - checking balances, validating accounts before transfers, generating statements for reconciliation.

---

## 📁 File Structure to Create

```
services/providus-bank-account/
├── config.json                 # Service configuration
├── client.ts                   # Account service client
├── mcp-adapter.ts              # MCP tools adapter
├── types.ts                    # TypeScript interfaces
├── README.md                   # Service documentation
└── test.js                     # Integration tests
```

---

## 🔧 Implementation Specifications

### 1. Service Configuration (`config.json`)

```json
{
  "id": "providus-bank-account",
  "name": "Providus Bank Account Services",
  "version": "1.0.0",
  "description": "Corporate account management - balance inquiry, transaction history, account validation",
  "category": "banking",
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
      "id": "balance_inquiry",
      "name": "Account Balance Inquiry",
      "path": "/account/balance/{accountNumber}",
      "method": "GET",
      "description": "Get current balance for corporate account"
    },
    {
      "id": "validate_account",
      "name": "Account Validation",
      "path": "/account/validate",
      "method": "POST",
      "description": "Validate beneficiary account before transfer"
    },
    {
      "id": "transaction_history",
      "name": "Transaction History",
      "path": "/account/transactions",
      "method": "GET",
      "description": "Retrieve transaction history with pagination"
    },
    {
      "id": "account_statement",
      "name": "Account Statement",
      "path": "/account/statement",
      "method": "POST",
      "description": "Generate account statement for date range"
    },
    {
      "id": "transaction_status",
      "name": "Transaction Status",
      "path": "/transaction/status/{reference}",
      "method": "GET",
      "description": "Check status of specific transaction"
    }
  ],
  "environment": {
    "required": [
      "PROVIDUS_BASE_URL",
      "PROVIDUS_USERNAME",
      "PROVIDUS_PASSWORD",
      "PROVIDUS_ACCOUNT_NUMBER"
    ]
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
export interface AccountBalance {
  accountNumber: string;
  accountName: string;
  availableBalance: string;
  ledgerBalance: string;
  currency: 'NGN';
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN';
  lastTransactionDate: string;
}

export interface ValidateAccountRequest {
  accountNumber: string;
  bankCode: string;
}

export interface ValidateAccountResponse {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  isValid: boolean;
  bvnLinked: boolean;
}

export interface TransactionHistoryRequest {
  accountNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  page?: number;
  limit?: number;
  type?: 'CREDIT' | 'DEBIT' | 'ALL';
}

export interface Transaction {
  id: string;
  reference: string;
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  currency: 'NGN';
  narration: string;
  balanceAfter: string;
  transactionDate: string;
  valueDate: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  counterparty?: {
    accountNumber: string;
    accountName: string;
    bankCode?: string;
  };
}

export interface TransactionHistoryResponse {
  accountNumber: string;
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface StatementRequest {
  accountNumber: string;
  startDate: string;
  endDate: string;
  format: 'PDF' | 'CSV' | 'JSON';
  email?: string; // Optional: email statement
}

export interface StatementResponse {
  statementId: string;
  accountNumber: string;
  period: {
    from: string;
    to: string;
  };
  openingBalance: string;
  closingBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  downloadUrl?: string;
  data?: Transaction[]; // If format is JSON
}

export interface TransactionStatus {
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
  amount: string;
  narration: string;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface AccountClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  accountNumber: string;
  mode: 'sandbox' | 'production';
  getAuthToken: () => Promise<string>; // Get token from main Providus client
}
```

---

### 3. Account Service Client (`client.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import type {
  AccountBalance,
  ValidateAccountRequest,
  ValidateAccountResponse,
  TransactionHistoryRequest,
  TransactionHistoryResponse,
  StatementRequest,
  StatementResponse,
  TransactionStatus,
  AccountClientConfig,
} from './types';

export class ProvidusBankAccountClient {
  private client: AxiosInstance;
  private config: AccountClientConfig;

  constructor(config: AccountClientConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to inject auth token
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

  // ================== Account Balance ==================

  async getBalance(accountNumber?: string): Promise<AccountBalance> {
    try {
      const account = accountNumber || this.config.accountNumber;
      const response = await this.client.get(`/account/balance/${account}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get account balance');
    }
  }

  // ================== Account Validation ==================

  async validateAccount(request: ValidateAccountRequest): Promise<ValidateAccountResponse> {
    try {
      const response = await this.client.post('/account/validate', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to validate account');
    }
  }

  // ================== Transaction History ==================

  async getTransactionHistory(request: TransactionHistoryRequest): Promise<TransactionHistoryResponse> {
    try {
      const params = {
        accountNumber: request.accountNumber,
        startDate: request.startDate,
        endDate: request.endDate,
        page: request.page || 1,
        limit: request.limit || 50,
        type: request.type || 'ALL',
      };

      const response = await this.client.get('/account/transactions', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction history');
    }
  }

  // ================== Account Statement ==================

  async generateStatement(request: StatementRequest): Promise<StatementResponse> {
    try {
      const response = await this.client.post('/account/statement', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to generate account statement');
    }
  }

  // ================== Transaction Status ==================

  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    try {
      const response = await this.client.get(`/transaction/status/${reference}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction status');
    }
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

// Factory function
export function createAccountClient(config: AccountClientConfig): ProvidusBankAccountClient {
  return new ProvidusBankAccountClient(config);
}

export type { AccountClientConfig };
```

---

### 4. MCP Adapter (`mcp-adapter.ts`)

```typescript
import { ProvidusBankAccountClient } from './client';
import type { AccountClientConfig } from './types';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class AccountServiceMCPAdapter {
  private client: ProvidusBankAccountClient;
  private tools: MCPTool[];

  constructor(config: AccountClientConfig) {
    this.client = new ProvidusBankAccountClient(config);
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'pb_account_get_balance',
        description: 'Get current balance for corporate account',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: {
              type: 'string',
              description: 'Account number (optional, uses default if not provided)',
            },
          },
        },
      },
      {
        name: 'pb_account_validate',
        description: 'Validate beneficiary account before transfer',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: {
              type: 'string',
              description: 'Account number to validate',
            },
            bankCode: {
              type: 'string',
              description: 'Bank code (e.g., 000013 for GTBank)',
            },
          },
          required: ['accountNumber', 'bankCode'],
        },
      },
      {
        name: 'pb_account_transaction_history',
        description: 'Get transaction history for account with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: {
              type: 'string',
              description: 'Account number',
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
            },
            limit: {
              type: 'number',
              description: 'Items per page (default: 50)',
            },
            type: {
              type: 'string',
              enum: ['CREDIT', 'DEBIT', 'ALL'],
              description: 'Transaction type filter',
            },
          },
          required: ['accountNumber', 'startDate', 'endDate'],
        },
      },
      {
        name: 'pb_account_generate_statement',
        description: 'Generate account statement for date range',
        inputSchema: {
          type: 'object',
          properties: {
            accountNumber: {
              type: 'string',
              description: 'Account number',
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)',
            },
            format: {
              type: 'string',
              enum: ['PDF', 'CSV', 'JSON'],
              description: 'Statement format',
            },
            email: {
              type: 'string',
              description: 'Email address to send statement (optional)',
            },
          },
          required: ['accountNumber', 'startDate', 'endDate', 'format'],
        },
      },
      {
        name: 'pb_account_transaction_status',
        description: 'Check status of specific transaction by reference',
        inputSchema: {
          type: 'object',
          properties: {
            reference: {
              type: 'string',
              description: 'Transaction reference number',
            },
          },
          required: ['reference'],
        },
      },
    ];
  }

  async callTool(toolName: string, args: any): Promise<MCPToolResult> {
    try {
      switch (toolName) {
        case 'pb_account_get_balance':
          return await this.getBalance(args);
        case 'pb_account_validate':
          return await this.validateAccount(args);
        case 'pb_account_transaction_history':
          return await this.getTransactionHistory(args);
        case 'pb_account_generate_statement':
          return await this.generateStatement(args);
        case 'pb_account_transaction_status':
          return await this.getTransactionStatus(args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async getBalance(args: any): Promise<MCPToolResult> {
    const result = await this.client.getBalance(args.accountNumber);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async validateAccount(args: any): Promise<MCPToolResult> {
    const result = await this.client.validateAccount({
      accountNumber: args.accountNumber,
      bankCode: args.bankCode,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async getTransactionHistory(args: any): Promise<MCPToolResult> {
    const result = await this.client.getTransactionHistory(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async generateStatement(args: any): Promise<MCPToolResult> {
    const result = await this.client.generateStatement(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  private async getTransactionStatus(args: any): Promise<MCPToolResult> {
    const result = await this.client.getTransactionStatus(args.reference);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  getClient(): ProvidusBankAccountClient {
    return this.client;
  }
}

export function createAccountMCPAdapter(config: AccountClientConfig): AccountServiceMCPAdapter {
  return new AccountServiceMCPAdapter(config);
}
```

---

## ✅ Acceptance Criteria

### Functional Requirements:
- [ ] All 5 endpoints implemented (balance, validate, history, statement, status)
- [ ] TypeScript compilation passes with no errors
- [ ] All MCP tools registered and callable
- [ ] Error handling for all edge cases
- [ ] Token injection from main Providus client

### Code Quality:
- [ ] Follows existing code patterns in `services/providus-bank/`
- [ ] Comprehensive JSDoc comments
- [ ] Type safety with TypeScript
- [ ] Consistent error handling

### Testing:
- [ ] Unit tests for all client methods
- [ ] Integration tests with sandbox environment
- [ ] MCP tool execution tests
- [ ] Error scenario tests

---

## 🧪 Testing Instructions

Create `test.js`:
```javascript
const { createAccountClient } = require('./client');

async function test() {
  const client = createAccountClient({
    baseUrl: process.env.PROVIDUS_BASE_URL,
    username: process.env.PROVIDUS_USERNAME,
    password: process.env.PROVIDUS_PASSWORD,
    accountNumber: process.env.PROVIDUS_ACCOUNT_NUMBER,
    mode: 'sandbox',
    getAuthToken: async () => 'test-token',
  });

  // Test balance inquiry
  const balance = await client.getBalance();
  console.log('Balance:', balance);

  // Test account validation
  const validation = await client.validateAccount({
    accountNumber: '0012345678',
    bankCode: '000013',
  });
  console.log('Validation:', validation);
}

test().catch(console.error);
```

---

## 📚 Reference Documentation

- Main Providus client: `/opt/lanonasis/onasis-gateway/services/providus-bank/client.ts`
- Existing MCP adapter: `/opt/lanonasis/onasis-gateway/services/providus-bank/mcp-adapter.ts`
- Type patterns: Follow existing code structure

---

## 🚨 Important Notes

1. **Token Management**: Use `getAuthToken` callback to get token from main Providus client (don't duplicate auth)
2. **Corporate Only**: This is for company account management via API, not end-user wallets
3. **Separation**: Keep completely separate from wallet service and virtual accounts
4. **Error Handling**: Follow same pattern as main client
5. **Sandbox First**: Test all endpoints in sandbox before production

---

## 📝 Deliverables

1. All files in `services/providus-bank-account/` directory
2. README.md with usage examples
3. Test suite with passing tests
4. Integration with API Gateway (registration code)
5. Pull request with descriptive commit message

---

**Estimated Complexity**: Medium
**Prerequisites**: Understanding of TypeScript, REST APIs, and MCP protocol
**Review Required**: Yes (will be reviewed before merge)

Good luck! 🚀
