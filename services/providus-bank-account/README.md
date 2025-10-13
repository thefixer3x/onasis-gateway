# Providus Bank Account Services

Corporate account management service for Providus Bank integration. This service handles balance inquiries, transaction history, account validation, and statement generation for corporate accounts.

## 🚀 Features

- **Account Balance Inquiry** - Get current balance for corporate accounts
- **Account Validation** - Validate beneficiary accounts before transfers
- **Transaction History** - Retrieve transaction history with pagination
- **Account Statements** - Generate statements in PDF, CSV, or JSON format
- **Transaction Status** - Check status of specific transactions
- **Bank Code Support** - Built-in support for Nigerian bank codes
- **Health Monitoring** - Service health checks and statistics

## 📋 Prerequisites

- Node.js 16+ or Bun runtime
- Providus Bank API credentials
- TypeScript support (for development)

## 🔧 Installation

```bash
# Install dependencies
npm install axios

# For TypeScript development
npm install -D typescript @types/node
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required environment variables
PROVIDUS_BASE_URL=https://sandbox.providusbank.com/api/v1
PROVIDUS_USERNAME=your_username
PROVIDUS_PASSWORD=your_password
PROVIDUS_ACCOUNT_NUMBER=your_account_number
```

### Client Configuration

```typescript
import { createAccountClient } from './client';

const client = createAccountClient({
  baseUrl: process.env.PROVIDUS_BASE_URL,
  username: process.env.PROVIDUS_USERNAME,
  password: process.env.PROVIDUS_PASSWORD,
  accountNumber: process.env.PROVIDUS_ACCOUNT_NUMBER,
  mode: 'sandbox', // or 'production'
  getAuthToken: async () => {
    // Get token from main Providus client
    return 'your_auth_token';
  }
});
```

## 📚 Usage Examples

### Account Balance

```typescript
// Get balance for default account
const balance = await client.getBalance();

// Get balance for specific account
const balance = await client.getBalance('1234567890');

console.log(balance);
// {
//   accountNumber: "1234567890",
//   accountName: "ACME Corp Ltd",
//   availableBalance: "1500000.00",
//   ledgerBalance: "1500000.00",
//   currency: "NGN",
//   status: "ACTIVE",
//   lastTransactionDate: "2024-01-15T10:30:00Z"
// }
```

### Account Validation

```typescript
const validation = await client.validateAccount({
  accountNumber: '0012345678',
  bankCode: '000013' // GTBank
});

console.log(validation);
// {
//   accountNumber: "0012345678",
//   accountName: "John Doe",
//   bankCode: "000013",
//   bankName: "GTBank",
//   isValid: true,
//   bvnLinked: true
// }
```

### Transaction History

```typescript
const history = await client.getTransactionHistory({
  accountNumber: '1234567890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  page: 1,
  limit: 50,
  type: 'ALL'
});

console.log(history);
// {
//   accountNumber: "1234567890",
//   transactions: [...],
//   pagination: {
//     page: 1,
//     limit: 50,
//     total: 150,
//     hasMore: true
//   }
// }
```

### Generate Statement

```typescript
const statement = await client.generateStatement({
  accountNumber: '1234567890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  format: 'PDF',
  email: 'accounting@company.com'
});

console.log(statement);
// {
//   statementId: "STMT_20240101_20240131_001",
//   accountNumber: "1234567890",
//   period: {
//     from: "2024-01-01",
//     to: "2024-01-31"
//   },
//   openingBalance: "1000000.00",
//   closingBalance: "1500000.00",
//   totalCredits: "2000000.00",
//   totalDebits: "1500000.00",
//   transactionCount: 45,
//   downloadUrl: "https://api.providusbank.com/statements/STMT_20240101_20240131_001.pdf"
// }
```

### Transaction Status

```typescript
const status = await client.getTransactionStatus('TXN_123456789');

console.log(status);
// {
//   reference: "TXN_123456789",
//   status: "COMPLETED",
//   amount: "50000.00",
//   narration: "Transfer to John Doe",
//   initiatedAt: "2024-01-15T10:30:00Z",
//   completedAt: "2024-01-15T10:31:00Z"
// }
```

## 🔌 MCP Integration

### MCP Tools Available

1. **pb_account_get_balance** - Get account balance
2. **pb_account_validate** - Validate account details
3. **pb_account_transaction_history** - Get transaction history
4. **pb_account_generate_statement** - Generate account statement
5. **pb_account_transaction_status** - Check transaction status
6. **pb_account_get_bank_codes** - Get supported bank codes
7. **pb_account_health_check** - Check service health

### MCP Adapter Usage

```typescript
import { createAccountMCPAdapter } from './mcp-adapter';

const adapter = createAccountMCPAdapter({
  baseUrl: process.env.PROVIDUS_BASE_URL,
  username: process.env.PROVIDUS_USERNAME,
  password: process.env.PROVIDUS_PASSWORD,
  accountNumber: process.env.PROVIDUS_ACCOUNT_NUMBER,
  mode: 'sandbox',
  getAuthToken: async () => 'your_token'
});

// Get available tools
const tools = adapter.getTools();

// Call a tool
const result = await adapter.callTool('pb_account_get_balance', {
  accountNumber: '1234567890'
});
```

## 🏦 Supported Bank Codes

The service includes built-in support for Nigerian bank codes:

| Code | Bank Name |
|------|-----------|
| 000013 | GTBank |
| 000014 | Access Bank |
| 000015 | First Bank |
| 000016 | UBA |
| 000017 | Zenith Bank |
| 000023 | Providus Bank |
| 000024 | Kuda Bank |
| 000025 | Opay |
| 000026 | PalmPay |

```typescript
// Get all supported bank codes
const bankCodes = client.getSupportedBankCodes();

// Check if bank code is valid
const isValid = client.isValidBankCode('000013');

// Get bank name by code
const bankName = client.getBankName('000013'); // "GTBank"
```

## 🏥 Health Monitoring

```typescript
// Check service health
const health = await client.healthCheck();
console.log(health);
// {
//   status: "healthy",
//   service: "providus-bank-account",
//   timestamp: "2024-01-15T10:30:00Z",
//   api_connectivity: true,
//   last_successful_request: "2024-01-15T10:30:00Z"
// }

// Get service statistics
const stats = client.getStats();
console.log(stats);
// {
//   requestCount: 150,
//   errorCount: 2,
//   totalResponseTime: 45000,
//   startTime: 1705312200000,
//   averageResponseTime: 300,
//   lastRequest: "2024-01-15T10:30:00Z"
// }
```

## 🚨 Error Handling

The service provides comprehensive error handling with specific error codes:

```typescript
try {
  const balance = await client.getBalance();
} catch (error) {
  if (error.code === 'INVALID_ACCOUNT') {
    console.log('Account not found');
  } else if (error.code === 'INVALID_BANK_CODE') {
    console.log('Bank code not supported');
  } else if (error.code === 'API_ERROR') {
    console.log('API error:', error.message);
  }
}
```

### Common Error Codes

- `INVALID_ACCOUNT` - Account not found
- `INVALID_BANK_CODE` - Unsupported bank code
- `INVALID_DATE_FORMAT` - Invalid date format
- `INVALID_DATE_RANGE` - Start date after end date
- `MISSING_REFERENCE` - Transaction reference required
- `API_ERROR` - General API error

## 🧪 Testing

```bash
# Run integration tests
node test.js

# Test specific functionality
node -e "
const { createAccountClient } = require('./client');
const client = createAccountClient({
  baseUrl: 'https://sandbox.providusbank.com/api/v1',
  username: 'test_user',
  password: 'test_pass',
  accountNumber: '1234567890',
  mode: 'sandbox',
  getAuthToken: async () => 'test_token'
});

client.healthCheck().then(console.log);
"
```

## 📝 API Reference

### AccountClientConfig

```typescript
interface AccountClientConfig {
  baseUrl: string;           // API base URL
  username: string;          // Providus username
  password: string;          // Providus password
  accountNumber: string;     // Default account number
  mode: 'sandbox' | 'production';
  getAuthToken: () => Promise<string>; // Token provider function
}
```

### AccountBalance

```typescript
interface AccountBalance {
  accountNumber: string;
  accountName: string;
  availableBalance: string;
  ledgerBalance: string;
  currency: 'NGN';
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN';
  lastTransactionDate: string;
}
```

### Transaction

```typescript
interface Transaction {
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
```

## 🔒 Security Considerations

1. **Token Management** - Use secure token storage and rotation
2. **Environment Variables** - Never commit credentials to version control
3. **HTTPS Only** - Always use HTTPS in production
4. **Rate Limiting** - Implement appropriate rate limiting
5. **Audit Logging** - Log all account access for compliance

## 📞 Support

For issues and questions:

1. Check the [API documentation](https://docs.providusbank.com)
2. Review error messages and codes
3. Check service health status
4. Contact Providus Bank support for API issues

## 📄 License

This service is part of the Onasis Gateway ecosystem. See the main project license for details.

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Compatibility**: Node.js 16+, Bun runtime