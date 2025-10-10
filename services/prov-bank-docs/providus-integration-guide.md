# Providus Bank API Integration Guide

## 📋 **Step-by-Step Integration Checklist**

### **Phase 1: Environment Setup**

#### ✅ Step 1: Add Environment Variables
**Where:** Root `.env` file  
**What to add:**

```bash
# Providus Bank API Configuration
PROVIDUS_MODE=sandbox # or production
PROVIDUS_BASE_URL=https://api.providusbank.com # Replace with actual sandbox URL
PROVIDUS_API_KEY=your_api_key_here
PROVIDUS_USERNAME=your_username
PROVIDUS_PASSWORD=your_password
PROVIDUS_EMAIL=merchant@example.com
```

#### ✅ Step 2: Create Service Directory
**Terminal command:**

```bash
cd /path/to/your/project
mkdir -p services/providus-bank
cd services/providus-bank
```

#### ✅ Step 3: Copy Service Files
**What to do:**
1. Copy `providus-bank-config.json` → `services/providus-bank/config.json`
2. Copy `providus-bank-client.ts` → `services/providus-bank/client.ts`
3. Copy `providus-bank-mcp-adapter.ts` → `services/providus-bank/mcp-adapter.ts`

**Terminal commands:**

```bash
# From your project root
cp /tmp/providus-bank-config.json services/providus-bank/config.json
cp /tmp/providus-bank-client.ts services/providus-bank/client.ts
cp /tmp/providus-bank-mcp-adapter.ts services/providus-bank/mcp-adapter.ts
```

---

### **Phase 2: Install Dependencies**

#### ✅ Step 4: Install Required Packages
**Terminal command:**

```bash
npm install axios
# or
pnpm add axios
```

---

### **Phase 3: Service Registration**

#### ✅ Step 5: Register Service in API Gateway
**Where:** Your existing API Gateway file (e.g., `src/gateway/api-gateway.ts`)  
**What to add:**

```typescript
import { createProvidusMCPAdapter } from './services/providus-bank/mcp-adapter';
import providusConfig from './services/providus-bank/config.json';

// In your API Gateway initialization
const providusAdapter = createProvidusMCPAdapter({
  baseUrl: process.env.PROVIDUS_BASE_URL || '',
  username: process.env.PROVIDUS_USERNAME || '',
  password: process.env.PROVIDUS_PASSWORD || '',
  email: process.env.PROVIDUS_EMAIL || '',
  mode: (process.env.PROVIDUS_MODE as 'sandbox' | 'production') || 'sandbox',
});

// Register tools
providusAdapter.getTools().forEach(tool => {
  this.registerTool(tool.name, tool);
});

// Store client reference
this.services.set('providus-bank', providusAdapter);
```

---

### **Phase 4: Testing**

#### ✅ Step 6: Create Health Check Script
**Where:** `services/providus-bank/health-check.ts`  
**What to create:**

```typescript
import { createProvidusClient } from './client';
import * as dotenv from 'dotenv';

dotenv.config();

async function healthCheck() {
  console.log('🔍 Running Providus Bank Health Check...\n');

  const client = createProvidusClient({
    baseUrl: process.env.PROVIDUS_BASE_URL || '',
    username: process.env.PROVIDUS_USERNAME || '',
    password: process.env.PROVIDUS_PASSWORD || '',
    email: process.env.PROVIDUS_EMAIL || '',
    mode: (process.env.PROVIDUS_MODE as 'sandbox' | 'production') || 'sandbox',
  });

  try {
    // Test 1: Authentication
    console.log('✓ Test 1: Authentication');
    const authResult = await client.authenticate();
    console.log(`  ✓ Authenticated as: ${authResult.data.firstName} ${authResult.data.lastName}`);
    console.log(`  ✓ Merchant: ${authResult.data.Merchant.businessName}`);
    console.log(`  ✓ Mode: ${authResult.data.Merchant.mode}`);
    console.log(`  ✓ Permissions: ${authResult.permissions.length} granted\n`);

    // Test 2: User Profile
    console.log('✓ Test 2: Get User Profile');
    const profile = await client.getUserProfile();
    console.log(`  ✓ Profile retrieved successfully`);
    console.log(`  ✓ Email: ${profile.data.email}\n`);

    // Test 3: Health Check
    console.log('✓ Test 3: Service Health Check');
    const isHealthy = await client.healthCheck();
    console.log(`  ✓ Service is ${isHealthy ? 'healthy' : 'unhealthy'}\n`);

    console.log('✅ All health checks passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Health check failed:');
    console.error(error);
    process.exit(1);
  }
}

healthCheck();
```

**Run the health check:**

```bash
npx ts-node services/providus-bank/health-check.ts
```

#### ✅ Step 7: Create Integration Test Suite
**Where:** `services/providus-bank/test-suite.ts`  
**What to create:**

```typescript
import { createProvidusMCPAdapter } from './mcp-adapter';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTests() {
  console.log('🧪 Running Providus Bank Integration Tests...\n');

  const adapter = createProvidusMCPAdapter({
    baseUrl: process.env.PROVIDUS_BASE_URL || '',
    username: process.env.PROVIDUS_USERNAME || '',
    password: process.env.PROVIDUS_PASSWORD || '',
    email: process.env.PROVIDUS_EMAIL || '',
    mode: 'sandbox',
  });

  const tests = [
    {
      name: 'Authentication',
      tool: 'pb_authenticate',
      args: {
        email: process.env.PROVIDUS_EMAIL,
        password: process.env.PROVIDUS_PASSWORD,
      },
    },
    {
      name: 'Get User Profile',
      tool: 'pb_get_user_profile',
      args: {},
    },
    {
      name: 'Health Check',
      tool: 'pb_health_check',
      args: {},
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`▶ Running: ${test.name}`);
      const result = await adapter.executeTool(test.tool, test.args);
      
      if (result.isError) {
        console.log(`  ❌ FAILED: ${result.content[0].text}\n`);
        failed++;
      } else {
        console.log(`  ✅ PASSED\n`);
        passed++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

**Run the test suite:**

```bash
npx ts-node services/providus-bank/test-suite.ts
```

---

### **Phase 5: Usage Examples**

#### Example 1: Authenticate & Get Profile

```typescript
import { createProvidusClient } from './services/providus-bank/client';

const client = createProvidusClient({
  baseUrl: process.env.PROVIDUS_BASE_URL,
  username: process.env.PROVIDUS_USERNAME,
  password: process.env.PROVIDUS_PASSWORD,
  email: process.env.PROVIDUS_EMAIL,
  mode: 'sandbox',
});

// Authenticate
const authResult = await client.authenticate();
console.log('Authenticated:', authResult.data.email);

// Get profile
const profile = await client.getUserProfile();
console.log('Permissions:', profile.permissions);
```

#### Example 2: Execute NIP Transfer

```typescript
// Using the client directly
const transferResult = await client.nipFundTransfer({
  beneficiaryAccountName: 'John Doe',
  beneficiaryAccountNumber: '0012345678',
  beneficiaryBank: '000013', // GTBank
  sourceAccountName: 'My Business',
  transactionAmount: '5000.00',
  narration: 'Payment for invoice #12345',
  transactionReference: `INV-${Date.now()}`,
});

console.log('Transfer completed:', transferResult);
```

#### Example 3: Using MCP Tools

```typescript
import { createProvidusMCPAdapter } from './services/providus-bank/mcp-adapter';

const adapter = createProvidusMCPAdapter(config);

// Execute transfer via MCP tool
const result = await adapter.executeTool('pb_nip_transfer', {
  beneficiaryAccountName: 'Jane Smith',
  beneficiaryAccountNumber: '0098765432',
  beneficiaryBank: '000016', // Zenith Bank
  sourceAccountName: 'My Company Ltd',
  transactionAmount: '10000.00',
  narration: 'Supplier payment',
});

console.log(JSON.parse(result.content[0].text));
```

---

### **Phase 6: Error Handling & Monitoring**

#### Automatic Token Refresh
The client automatically:
- Refreshes tokens when they expire
- Retries failed requests with new tokens
- Re-authenticates if refresh fails

#### Error Handling Best Practices

```typescript
try {
  const result = await client.nipFundTransfer({
    // ... transfer params
  });
  
  // Handle success
  console.log('Transfer successful:', result);
} catch (error) {
  if (error.message.includes('401')) {
    // Authentication issue - tokens may have expired
    console.error('Authentication failed. Please re-authenticate.');
  } else if (error.message.includes('timeout')) {
    // Network/timeout issue
    console.error('Request timed out. Please try again.');
  } else {
    // Other errors
    console.error('Transfer failed:', error.message);
  }
}
```

---

### **Phase 7: Production Deployment**

#### ✅ Before Going Live:

1. **Update Environment Variables:**
   ```bash
   PROVIDUS_MODE=production
   PROVIDUS_BASE_URL=https://api.providusbank.com/v1
   # Use production credentials
   ```

2. **Enable Production Mode in Config:**
   ```json
   {
     "modes": {
       "production": {
         "enabled": true
       }
     }
   }
   ```

3. **Test All Endpoints in Sandbox First**
4. **Set up Monitoring & Logging**
5. **Configure Rate Limiting**
6. **Enable Error Alerts**

---

## 🎯 **Integration Success Metrics**

- ✅ Health check passes
- ✅ Authentication successful
- ✅ User profile retrieval works
- ✅ All MCP tools registered
- ✅ Test transfers complete in sandbox
- ✅ Token refresh works automatically
- ✅ Error handling tested

---

## 🚨 **Common Issues & Solutions**

### Issue 1: "Authentication failed but tokens not received"
**Solution:** Check if your API credentials are correct and the base URL is accessible.

### Issue 2: "Token refresh failed"
**Solution:** Ensure X-Refresh-Token header is being sent correctly. The client handles this automatically.

### Issue 3: "NIP transfer failed with 400"
**Solution:** Verify all required fields are provided and transaction reference is unique.

### Issue 4: "Timeout errors"
**Solution:** Check network connectivity and increase timeout in client config.

---

## 📚 **API Documentation Reference**

- Main API Docs: https://developer.providusbank.com
- Xpress Wallet API: https://developer.providusbank.com/xpress-wallet-api
- Transfer Services: https://developer.providusbank.com/transfer-services
- Authentication: https://developer.providusbank.com/reference/api-reference/authentication

---

## ✨ **Next Steps After Integration**

1. Add webhook handlers for transaction notifications
2. Implement transaction history tracking
3. Add balance inquiry endpoints
4. Set up automated reconciliation
5. Create admin dashboard for monitoring
6. Add audit logging for all transactions
