# Service Provider Integration Guide
## Complete Multi-Tenant Xpress Wallet Platform

## Overview

This guide details the complete service provider architecture that abstracts Xpress Wallet services from end clients while providing controlled access through isolated environments with proper Row-Level Security (RLS).

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE PROVIDER PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │   MEGA MEAL     │    │   FOOD CORP     │    │   CLIENT_N      │             │
│  │   Dashboard     │    │   Dashboard     │    │   Dashboard     │             │
│  │   (RLS: MGM)    │    │   (RLS: FOOD)   │    │   (RLS: CLI_N)  │             │
│  └─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘             │
│            │                      │                      │                     │
│            └──────────────────────┼──────────────────────┘                     │
│                                   │                                            │
│  ┌────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      SERVICE PROVIDER API                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │  │
│  │  │  Client Auth    │  │   RLS Engine    │  │   Approval Workflow     │  │  │
│  │  │  & Context      │  │   & Isolation   │  │   & Limits Engine       │  │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │  │
│  └────────────────────────────────┬─────────────────────────────────────────┘  │
│                                   │                                            │
│  ┌────────────────────────────────▼─────────────────────────────────────────┐  │
│  │                      XPRESS WALLET CORE SERVICE                          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │  │
│  │  │   Transaction   │  │   Wallet Mgmt   │  │   Banking Operations    │  │  │
│  │  │   Processing    │  │   & Sync        │  │   & Reconciliation      │  │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │  │
│  └────────────────────────────────┬─────────────────────────────────────────┘  │
│                                   │                                            │
│                    ┌──────────────▼───────────────┐                           │
│                    │       XPRESS WALLET API      │                           │
│                    │     (Single Integration)     │                           │
│                    └──────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

#### 1.1 Database Setup
```bash
# Run migrations in order
psql $DATABASE_URL < database/migrations/002_wallet_as_a_service_schema.sql
psql $DATABASE_URL < database/migrations/003_service_provider_architecture.sql
```

#### 1.2 Environment Configuration
```env
# Service Provider Configuration
SERVICE_PROVIDER_JWT_SECRET=your-super-secret-jwt-key
SERVICE_PROVIDER_ADMIN_EMAIL=admin@yourprovider.com

# Xpress Wallet Configuration (Your Super Admin Keys)
XPRESS_API_KEY=your-master-api-key
XPRESS_SECRET_KEY=your-master-secret-key
XPRESS_MERCHANT_ID=your-master-merchant-id
XPRESS_WEBHOOK_SECRET=your-webhook-secret

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Redis (for caching and session management)
REDIS_URL=redis://localhost:6379

# Email Service
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourprovider.com
```

#### 1.3 Client Onboarding
```typescript
// Create Mega Meal as first client
const createClient = await db.query(`
  INSERT INTO service_provider.clients (
    client_code, business_name, contact_email,
    api_key_hash, service_tier, features_enabled,
    daily_transaction_limit, single_transaction_limit,
    approval_threshold, transaction_fee_rate
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING *`,
  [
    'MEGA_MEAL',
    'Mega Meal Limited',
    'admin@megamealworld.com',
    bcrypt.hashSync('mega_meal_api_key_12345', 10),
    'PREMIUM',
    JSON.stringify({
      batch_operations: true,
      bank_transfers: true,
      analytics: true,
      approval_workflow: true
    }),
    50000000, // 50M daily limit
    5000000,  // 5M single transaction limit
    500000,   // 500K approval threshold
    0.01      // 1% fee rate
  ]
);
```

### Phase 2: Core Services (Week 3-4)

#### 2.1 Service Provider API Deployment
```typescript
import ServiceProviderAPI from './services/xpress-wallet-waas/service-provider-api.js';
import { Pool } from 'pg';

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20
});

const serviceProviderAPI = new ServiceProviderAPI(dbPool);

// Start the service
serviceProviderAPI.start(process.env.PORT || 3000);
```

#### 2.2 Client API Integration Examples

**For Mega Meal's Backend:**
```typescript
// Mega Meal's service integration
class MegaMealWalletService {
  private apiKey = process.env.MEGA_MEAL_API_KEY;
  private baseUrl = 'https://your-service-provider-api.com/api/v1/client';

  async createCustomerWallet(customerId: string, customerData: any) {
    return await fetch(`${this.baseUrl}/wallets`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId,
        customerName: customerData.name,
        phoneNumber: customerData.phone,
        email: customerData.email,
        walletType: 'savings' // Mega Meal specific
      })
    });
  }

  async creditCustomerWallet(customerId: string, amount: number, reason: string) {
    return await fetch(`${this.baseUrl}/wallets/${customerId}/credit`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        narration: reason,
        metadata: {
          source: 'mega_meal_savings',
          category: 'interest_payment'
        }
      })
    });
  }

  async processBulkInterestPayments(customers: any[]) {
    return await fetch(`${this.baseUrl}/batch/credit`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: customers.map(customer => ({
          customerId: customer.id,
          amount: customer.interestAmount,
          narration: `Monthly interest payment - ${new Date().toLocaleDateString()}`
        }))
      })
    });
  }
}
```

### Phase 3: Client Dashboard (Week 5-6)

#### 3.1 Dashboard Deployment
```typescript
// Dashboard authentication service
class DashboardAuthService {
  async authenticateUser(email: string, password: string) {
    // Validate user credentials
    const user = await this.validateCredentials(email, password);
    
    if (user) {
      // Generate JWT with client context
      const token = jwt.sign({
        userId: user.id,
        clientId: user.client_id,
        clientCode: user.client_code,
        role: user.role,
        permissions: user.permissions
      }, process.env.SERVICE_PROVIDER_JWT_SECRET, {
        expiresIn: '8h'
      });
      
      return { token, user };
    }
    
    throw new Error('Invalid credentials');
  }
}
```

#### 3.2 Dashboard Features Implementation

**Mega Meal Dashboard Example:**
```typescript
// Mega Meal's dashboard overview
const MegaMealDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    // Load dashboard data with client isolation
    const loadData = async () => {
      const overviewResponse = await fetch('/api/v1/dashboard/overview', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-Client-Context': 'MEGA_MEAL'
        }
      });
      
      const approvalsResponse = await fetch('/api/v1/dashboard/transactions/pending', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'X-Client-Context': 'MEGA_MEAL'
        }
      });
      
      setOverview(await overviewResponse.json());
      setPendingApprovals(await approvalsResponse.json());
    };
    
    loadData();
  }, []);

  return (
    <DashboardLayout clientBranding="mega-meal">
      <MetricsCards data={overview?.summary} />
      <PendingApprovals 
        transactions={pendingApprovals}
        onApprove={handleApproveTransaction}
      />
      <RecentActivity />
    </DashboardLayout>
  );
};
```

### Phase 4: Consumer Integration (Week 7-8)

#### 4.1 Consumer-Facing SDK
```typescript
// Mega Meal's consumer wallet widget
class MegaMealWalletWidget {
  constructor(config: {
    containerId: string;
    userId: string;
    theme?: 'light' | 'dark';
  }) {
    this.init(config);
  }

  private async init(config: any) {
    // Widget communicates with Mega Meal's backend,
    // which then communicates with Service Provider API
    const walletData = await fetch('/api/mega-meal/wallet/balance', {
      headers: {
        'Authorization': `Bearer ${getUserToken()}`,
        'X-User-ID': config.userId
      }
    });

    this.render(config.containerId, await walletData.json());
  }

  private render(containerId: string, walletData: any) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
      <div class="mega-meal-wallet">
        <div class="balance">₦${walletData.balance.toLocaleString()}</div>
        <div class="actions">
          <button onclick="this.addMoney()">Add Money</button>
          <button onclick="this.withdraw()">Withdraw</button>
          <button onclick="this.transfer()">Transfer</button>
        </div>
      </div>
    `;
  }
}
```

#### 4.2 Mobile SDK Integration
```typescript
// React Native component for Mega Meal mobile app
const MegaMealWalletScreen = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  const fetchWalletData = async () => {
    // Calls Mega Meal's API, which calls Service Provider API
    const response = await MegaMealAPI.getWalletBalance();
    setBalance(response.balance);
    setTransactions(response.recentTransactions);
  };

  return (
    <View style={styles.container}>
      <WalletBalance balance={balance} />
      <QuickActions onAddMoney={handleAddMoney} />
      <TransactionHistory transactions={transactions} />
    </View>
  );
};
```

### Phase 5: Production Deployment (Week 9-10)

#### 5.1 Infrastructure Setup
```yaml
# docker-compose.yml for service provider platform
version: '3.8'
services:
  service-provider-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - XPRESS_API_KEY=${XPRESS_API_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: service_provider
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - service-provider-api
```

#### 5.2 Monitoring & Alerting
```typescript
// Health check endpoints
app.get('/health/detailed', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    xpressWallet: await checkXpressWalletAPI(),
    clients: await getActiveClientCount()
  };

  const isHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : check.status === 'ok'
  );

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  });
});

// Metrics collection
app.get('/metrics', async (req, res) => {
  const metrics = {
    totalClients: await getClientCount(),
    activeWallets: await getActiveWalletCount(),
    dailyTransactionVolume: await getDailyTransactionVolume(),
    systemUptime: process.uptime()
  };

  res.json(metrics);
});
```

## Security Implementation

### 1. Multi-Level Authentication
```typescript
// Service Provider Level (Your Control)
const serviceProviderAuth = {
  superAdmin: 'Full platform access',
  clientManager: 'Client onboarding and management',
  support: 'Read-only access for support'
};

// Client Level (Mega Meal Control)
const clientAuth = {
  admin: 'Full client access within their scope',
  manager: 'Operational management',
  operator: 'Transaction processing',
  viewer: 'Read-only dashboard access'
};

// Consumer Level (End User)
const consumerAuth = {
  customer: 'Own wallet access only'
};
```

### 2. Row-Level Security Implementation
```sql
-- Example RLS policy for client isolation
CREATE POLICY "client_isolation_policy" ON wallet.client_customer_wallets
FOR ALL TO authenticated
USING (
  client_id IN (
    SELECT client_id 
    FROM service_provider.client_users 
    WHERE user_id = auth.uid()
  )
  OR 
  auth.jwt() ->> 'role' = 'service_provider_admin'
);
```

### 3. API Rate Limiting
```typescript
// Client-specific rate limiting
const clientRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: ServiceProviderRequest) => {
    const tier = req.client?.serviceTier;
    return tier === 'PREMIUM' ? 10000 : 
           tier === 'STANDARD' ? 5000 : 1000;
  },
  keyGenerator: (req) => req.client?.clientId || req.ip
});
```

## Revenue Model

### 1. Transaction-Based Fees
```typescript
interface RevenueModel {
  // Per-transaction fees
  transactionFees: {
    basic: 0.02,      // 2% for basic clients
    standard: 0.015,  // 1.5% for standard clients  
    premium: 0.01,    // 1% for premium clients
    enterprise: 0.005 // 0.5% for enterprise clients
  };
  
  // Fixed monthly fees
  monthlyFees: {
    basic: 50000,      // ₦50K/month
    standard: 150000,  // ₦150K/month
    premium: 500000,   // ₦500K/month
    enterprise: 1500000 // ₦1.5M/month
  };
  
  // Feature-based fees
  featureFees: {
    batchOperations: 100000,    // ₦100K/month
    advancedAnalytics: 200000,  // ₦200K/month
    whiteLabeling: 500000,      // ₦500K/month
    customIntegration: 1000000  // ₦1M one-time
  };
}
```

### 2. Billing Implementation
```typescript
// Automated billing system
class BillingService {
  async generateMonthlyBill(clientId: string, month: string) {
    const client = await this.getClient(clientId);
    const transactions = await this.getMonthlyTransactions(clientId, month);
    
    const transactionFees = this.calculateTransactionFees(transactions, client.tier);
    const monthlyFee = this.getMonthlyFee(client.tier);
    const featureFees = this.calculateFeatureFees(client.featuresEnabled);
    
    return {
      clientId,
      month,
      breakdown: {
        monthlyFee,
        transactionFees,
        featureFees,
        total: monthlyFee + transactionFees + featureFees
      }
    };
  }
}
```

## Deployment Checklist

### Pre-Deployment
- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Client onboarding completed
- [ ] API keys generated and distributed

### Security Checklist
- [ ] RLS policies enabled and tested
- [ ] API authentication working
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Data encryption verified

### Testing Checklist
- [ ] Load testing completed
- [ ] Security penetration testing
- [ ] Client isolation verified
- [ ] Approval workflows tested
- [ ] Billing calculations verified

### Monitoring Checklist
- [ ] Health checks configured
- [ ] Error alerting setup
- [ ] Performance monitoring enabled
- [ ] Log aggregation working
- [ ] Backup procedures verified

This comprehensive service provider architecture ensures you maintain complete control while providing clients like Mega Meal with the wallet management capabilities they need, all while abstracting the complexity of direct Xpress Wallet integration.