# Client Dashboard Specification
## Mega Meal & Other Clients - Limited Admin Interface

## Overview

The client dashboard provides controlled access to wallet management without exposing service provider admin capabilities. Each client (like Mega Meal) gets their own isolated dashboard with role-based permissions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   CLIENT DASHBOARD                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───▶│   Auth API   │───▶│   Client     │  │
│  │  (React/Vue) │    │   (JWT)      │    │   Context    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Dashboard   │───▶│ Service API  │───▶│  PostgreSQL  │  │
│  │     API      │    │   (RLS)      │    │    (RLS)     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## User Roles & Permissions

### 1. Client Admin
- **Full client-level access** (Mega Meal CEO/CTO)
- Permissions:
  - Approve high-value transactions
  - Manage batch operations
  - View all analytics
  - Configure wallet settings
  - Manage team members

### 2. Client Manager
- **Operational management** (Mega Meal Operations Manager)
- Permissions:
  - Approve medium-value transactions
  - Execute batch operations
  - View operational analytics
  - Manage customer wallets

### 3. Client Operator
- **Day-to-day operations** (Mega Meal Customer Support)
- Permissions:
  - View customer wallets
  - Process small transactions
  - Generate reports
  - Handle customer inquiries

### 4. Client Viewer
- **Read-only access** (Mega Meal Finance Team)
- Permissions:
  - View dashboards
  - Download reports
  - View transaction history

## Dashboard Modules

### 1. Overview Dashboard
```typescript
interface DashboardOverview {
  // Key Metrics Cards
  todayMetrics: {
    transactions: number;
    volume: number;
    revenue: number;
    activeWallets: number;
  };
  
  // Quick Actions
  pendingApprovals: Transaction[];
  recentActivity: Activity[];
  systemAlerts: Alert[];
  
  // Charts
  transactionTrends: ChartData;
  volumeBreakdown: ChartData;
}
```

**Features:**
- Real-time metrics
- Pending approval notifications
- Quick action buttons
- Performance charts

### 2. Wallet Management
```typescript
interface WalletManagement {
  // Wallet List
  wallets: {
    customerId: string;
    accountNumber: string;
    accountName: string;
    balance: number;
    status: 'active' | 'frozen' | 'suspended';
    lastActivity: Date;
    kycStatus: 'pending' | 'verified' | 'rejected';
  }[];
  
  // Filters & Search
  filters: {
    status: string[];
    walletType: string[];
    kycStatus: string[];
    dateRange: DateRange;
  };
}
```

**Features:**
- Paginated wallet list
- Advanced filtering
- Bulk operations
- Individual wallet details
- Freeze/unfreeze controls

### 3. Transaction Management
```typescript
interface TransactionManagement {
  // Pending Approvals
  pendingTransactions: {
    id: string;
    reference: string;
    type: 'credit' | 'debit' | 'transfer';
    amount: number;
    customerName: string;
    narration: string;
    createdAt: Date;
    requiresApproval: boolean;
    riskScore: number;
  }[];
  
  // Transaction History
  transactions: Transaction[];
  
  // Bulk Operations
  batchOperations: BatchOperation[];
}
```

**Features:**
- Approval workflow interface
- Transaction details modal
- Bulk approval/rejection
- Risk scoring display
- Audit trail view

### 4. Bank Transfer Management
```typescript
interface BankTransferManagement {
  // Transfer Requests
  transfers: {
    id: string;
    customerName: string;
    bankName: string;
    accountNumber: string;
    amount: number;
    status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed';
    approvalRequired: boolean;
    createdAt: Date;
  }[];
  
  // Bank Directory
  supportedBanks: Bank[];
  
  // Transfer Limits
  limits: {
    single: number;
    daily: number;
    monthly: number;
  };
}
```

**Features:**
- Transfer approval interface
- Bank account validation
- Transfer status tracking
- Limit monitoring

### 5. Batch Operations Center
```typescript
interface BatchOperationsCenter {
  // Batch Templates
  templates: {
    id: string;
    name: string;
    type: 'credit' | 'debit' | 'transfer';
    description: string;
    lastUsed: Date;
  }[];
  
  // Active Batches
  activeBatches: {
    id: string;
    reference: string;
    type: string;
    totalItems: number;
    processedItems: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
  }[];
  
  // Batch Builder
  batchBuilder: {
    items: BatchItem[];
    totalAmount: number;
    estimatedFees: number;
  };
}
```

**Features:**
- CSV upload interface
- Batch validation
- Progress tracking
- Template management
- Error handling display

### 6. Customer Management
```typescript
interface CustomerManagement {
  customers: {
    customerId: string;
    name: string;
    email: string;
    phone: string;
    kycStatus: 'pending' | 'verified' | 'rejected';
    walletStatus: 'active' | 'frozen';
    totalBalance: number;
    lastActivity: Date;
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  
  customerDetails: {
    profile: CustomerProfile;
    wallets: Wallet[];
    transactions: Transaction[];
    kycDocuments: Document[];
  };
}
```

**Features:**
- Customer search and filtering
- KYC status management
- Customer wallet overview
- Communication history
- Risk assessment display

### 7. Analytics & Reporting
```typescript
interface AnalyticsReporting {
  // Performance Metrics
  metrics: {
    transactionVolume: TimeSeriesData;
    revenueBreakdown: CategoryData;
    customerGrowth: TimeSeriesData;
    averageTransactionSize: number;
  };
  
  // Financial Reports
  reports: {
    dailySummary: DailySummary[];
    monthlyStatement: MonthlyStatement;
    reconciliationReport: ReconciliationData;
    feeAnalysis: FeeBreakdown;
  };
  
  // Custom Reports
  customReports: {
    name: string;
    filters: ReportFilters;
    schedule: 'daily' | 'weekly' | 'monthly';
    format: 'pdf' | 'excel' | 'csv';
  }[];
}
```

**Features:**
- Interactive charts
- Report builder
- Scheduled reports
- Export functionality
- Comparative analysis

### 8. Settings & Configuration
```typescript
interface SettingsConfiguration {
  // Client Profile
  clientProfile: {
    businessName: string;
    contactEmail: string;
    contactPhone: string;
    businessAddress: string;
    timezone: string;
  };
  
  // Wallet Configuration
  walletSettings: {
    walletPrefix: string;
    defaultWalletType: string;
    kycRequired: boolean;
    bvnVerificationRequired: boolean;
    approvalThreshold: number;
  };
  
  // Notification Settings
  notifications: {
    email: NotificationSettings;
    webhook: WebhookSettings;
    dashboard: DashboardNotificationSettings;
  };
  
  // Team Management
  teamMembers: {
    email: string;
    role: 'admin' | 'manager' | 'operator' | 'viewer';
    permissions: Permission[];
    lastLogin: Date;
    status: 'active' | 'suspended';
  }[];
}
```

**Features:**
- Profile management
- Wallet configuration
- Notification preferences
- Team member management
- Permission matrix

## API Endpoints for Dashboard

### Authentication
```typescript
POST /api/v1/dashboard/auth/login
POST /api/v1/dashboard/auth/refresh
POST /api/v1/dashboard/auth/logout
```

### Dashboard Data
```typescript
GET  /api/v1/dashboard/overview
GET  /api/v1/dashboard/analytics?period=30d&groupBy=day
GET  /api/v1/dashboard/metrics/real-time
```

### Wallet Operations
```typescript
GET    /api/v1/dashboard/wallets?page=1&limit=50&status=active
GET    /api/v1/dashboard/wallets/:walletId
POST   /api/v1/dashboard/wallets/:walletId/freeze
POST   /api/v1/dashboard/wallets/:walletId/unfreeze
POST   /api/v1/dashboard/wallets/bulk-action
```

### Transaction Management
```typescript
GET    /api/v1/dashboard/transactions/pending
POST   /api/v1/dashboard/transactions/:id/approve
POST   /api/v1/dashboard/transactions/:id/reject
POST   /api/v1/dashboard/transactions/bulk-approve
GET    /api/v1/dashboard/transactions/history
```

### Batch Operations
```typescript
GET    /api/v1/dashboard/batch-operations
POST   /api/v1/dashboard/batch-operations
GET    /api/v1/dashboard/batch-operations/:id/status
POST   /api/v1/dashboard/batch-operations/:id/approve
```

### Reports
```typescript
GET    /api/v1/dashboard/reports/daily-summary?date=2025-01-27
GET    /api/v1/dashboard/reports/transaction-export?format=csv
POST   /api/v1/dashboard/reports/custom
GET    /api/v1/dashboard/reports/reconciliation
```

### Settings
```typescript
GET    /api/v1/dashboard/settings
PUT    /api/v1/dashboard/settings/profile
PUT    /api/v1/dashboard/settings/wallets
PUT    /api/v1/dashboard/settings/notifications
```

## Security Implementation

### 1. Authentication
- JWT-based authentication
- Multi-factor authentication (MFA)
- Session management
- Password policies

### 2. Authorization
- Role-based access control (RBAC)
- Permission matrix
- Resource-level permissions
- Action-level restrictions

### 3. Data Protection
- Row-level security (RLS)
- Client data isolation
- Encrypted sensitive data
- Audit logging

### 4. API Security
- Rate limiting per client
- Request validation
- CORS configuration
- Security headers

## Frontend Implementation Guide

### Technology Stack
- **Framework**: React with TypeScript
- **State Management**: Redux Toolkit or Zustand
- **UI Library**: Material-UI or Ant Design
- **Charts**: Chart.js or D3.js
- **Authentication**: Auth0 or custom JWT

### Key Components
```typescript
// Dashboard Layout
<DashboardLayout>
  <Sidebar />
  <Header />
  <MainContent>
    <Route path="/overview" component={Overview} />
    <Route path="/wallets" component={WalletManagement} />
    <Route path="/transactions" component={TransactionManagement} />
    <Route path="/batch" component={BatchOperations} />
    <Route path="/analytics" component={Analytics} />
    <Route path="/settings" component={Settings} />
  </MainContent>
</DashboardLayout>

// Wallet Management Component
<WalletManagement>
  <WalletFilters />
  <WalletTable>
    <WalletRow onAction={handleWalletAction} />
  </WalletTable>
  <WalletPagination />
</WalletManagement>

// Approval Interface
<ApprovalInterface>
  <PendingTransactionsList />
  <TransactionDetails />
  <ApprovalActions />
</ApprovalInterface>
```

### State Management
```typescript
interface DashboardState {
  auth: AuthState;
  client: ClientState;
  wallets: WalletState;
  transactions: TransactionState;
  batches: BatchState;
  analytics: AnalyticsState;
  settings: SettingsState;
}
```

## Deployment Strategy

### 1. Development Environment
- Local development with mock data
- API mocking for frontend development
- Database seeding for testing

### 2. Staging Environment
- Full stack deployment
- Integration testing
- User acceptance testing
- Performance testing

### 3. Production Environment
- Multi-environment deployment
- Load balancing
- CDN for static assets
- Monitoring and alerting

This client dashboard provides Mega Meal and other clients with comprehensive wallet management capabilities while maintaining proper isolation and security boundaries.