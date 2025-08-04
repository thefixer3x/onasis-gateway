# Onasis Gateway MCP Server

The Model Context Protocol (MCP) server for the Onasis Gateway API Service Warehouse, providing unified access to all integrated services including Credit-as-a-Service (CaaS), payment processing, and infrastructure management tools.

## Overview

This MCP server exposes all Onasis Gateway services through a single, unified interface that can be consumed by MCP-compatible clients. It eliminates the need for multiple server connections and provides a consistent API experience across all services.

## Services Available

### Credit-as-a-Service (CaaS)
Complete credit platform with application processing, provider management, and transaction handling.

### Payment Services (Coming Soon)
- Stripe payment processing
- Wise multicurrency transfers
- BAP Nigerian payment aggregation
- Paystack integration

### Infrastructure Services (Coming Soon)
- Hostinger VPS management
- Domain and DNS management
- SSL certificate automation

## Installation

```bash
npm install api-warehouse-mcp-server
```

## Usage

### Starting the Server

```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

### TypeScript Support

The server includes comprehensive TypeScript definitions for all tools:

```typescript
import { CreditMCPTools, MCPToolResponse } from 'api-warehouse-mcp-server';

// Type-safe credit application submission
const response: MCPToolResponse<CreditApplication> = await mcpClient.call('credit_submit_application', {
  application_type: 'business',
  requested_amount: 500000,
  currency: 'NGN',
  user_id: 'user_123'
});
```

## Credit-as-a-Service Tools

### Application Management

#### `credit_submit_application`
Submit a new credit application.

```typescript
interface CreditApplicationRequest {
  application_type: 'personal' | 'business' | 'asset_finance';
  requested_amount: number; // Min: 1000, Max: 10,000,000
  currency?: 'NGN' | 'USD' | 'EUR'; // Default: 'NGN'
  loan_purpose?: string;
  applicant_income?: number;
  user_id: string;
}
```

#### `credit_get_applications`
Retrieve credit applications with filtering and pagination.

```typescript
interface CreditApplicationsQuery {
  status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'active' | 'completed' | 'defaulted';
  user_id?: string;
  page?: number; // Default: 1
  limit?: number; // Default: 20, Max: 100
}
```

#### `credit_get_application`
Get details of a specific credit application.

```typescript
const application = await mcpClient.call('credit_get_application', {
  applicationId: 'app_123456'
});
```

#### `credit_update_application_status`
Update the status of a credit application (admin tool).

```typescript
await mcpClient.call('credit_update_application_status', {
  applicationId: 'app_123456',
  status: 'approved',
  notes: 'Approved based on credit score and income verification'
});
```

### Provider Management

#### `credit_register_provider`
Register a new credit provider in the system.

```typescript
interface CreditProviderRequest {
  provider_code: string; // Pattern: ^[A-Z0-9_]{3,20}$
  company_name: string; // Max length: 200
  provider_type: 'bank' | 'fintech' | 'microfinance' | 'p2p_lending';
  api_endpoint?: string; // Must be valid URI
  min_loan_amount?: number; // Default: 50,000
  max_loan_amount?: number; // Default: 5,000,000
}
```

#### `credit_get_providers`
Get list of credit providers with filtering.

```typescript
const providers = await mcpClient.call('credit_get_providers', {
  status: 'active',
  provider_type: 'fintech',
  page: 1,
  limit: 10
});
```

#### `credit_submit_provider_bid`
Submit a provider bid for a credit application.

```typescript
await mcpClient.call('credit_submit_provider_bid', {
  application_id: 'app_123456',
  provider_id: 'provider_789',
  offered_amount: 450000,
  interest_rate: 15.5, // Percentage
  loan_term_months: 24,
  conditions: {
    collateral_required: false,
    processing_fee: 2500
  }
});
```

### Transaction Processing

#### `credit_process_transaction`
Process credit transactions (disbursements, repayments, fees).

```typescript
await mcpClient.call('credit_process_transaction', {
  application_id: 'app_123456',
  transaction_type: 'disbursement',
  amount: 450000,
  gateway_provider: 'stripe', // 'stripe' | 'wise' | 'bap' | 'paystack'
  currency: 'NGN'
});
```

### Credit Scoring

#### `credit_perform_credit_check`
Perform credit score check for a user.

```typescript
const creditCheck = await mcpClient.call('credit_perform_credit_check', {
  user_id: 'user_123',
  check_type: 'comprehensive' // 'basic' | 'enhanced' | 'comprehensive'
});
```

### Analytics and Reporting

#### `credit_get_analytics`
Get credit analytics and reports.

```typescript
const analytics = await mcpClient.call('credit_get_analytics', {
  metric_type: 'monthly',
  start_date: '2024-01-01',
  end_date: '2024-12-31'
});
```

#### `credit_provider_performance`
Get provider performance metrics.

```typescript
const performance = await mcpClient.call('credit_provider_performance', {
  provider_id: 'provider_789',
  period: 'last_90_days'
});
```

### Health Monitoring

#### `credit_health_check`
Check the health status of the credit service.

```typescript
const health = await mcpClient.call('credit_health_check', {});
```

## Error Handling

All tools return a consistent response format:

```typescript
interface MCPToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  tool?: string;
  timestamp?: string;
}
```

Example error response:
```json
{
  "success": false,
  "error": "Invalid application ID format",
  "tool": "credit_get_application",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration

The server uses environment variables from the parent Onasis Gateway. Key configurations:

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode
- Database credentials are inherited from the main gateway
- Payment gateway credentials are shared across services

## Development

### Running Tests
```bash
npm test
```

### Adding New Tools
1. Create the tool handler in the appropriate service directory
2. Register the tool in the MCP server
3. Add TypeScript definitions to the types directory
4. Update documentation

### TypeScript Development
```bash
# Type checking
npx tsc --noEmit

# Generate declaration files
npx tsc --declaration --emitDeclarationOnly
```

## Architecture

```
mcp-server/
├── index.js           # Main server entry point
├── server.js          # MCP server configuration
├── package.json       # Package configuration with types
├── tsconfig.json      # TypeScript configuration
├── types/             # TypeScript definitions
│   ├── index.d.ts     # Main types export
│   └── credit.d.ts    # Credit service types
└── tools/             # Tool implementations
    └── credit/        # Credit service tools
        └── index.js   # Credit tools registration
```

## Integration with Onasis Gateway

The MCP server is deeply integrated with the Onasis Gateway:

- **Shared Database**: Uses the same PostgreSQL instance with dedicated schemas
- **Unified Authentication**: Leverages gateway's JWT and API key system  
- **Service Discovery**: Automatically registers with the gateway's adapter system
- **Monitoring**: Integrated with gateway's health checking and metrics
- **Configuration**: Shares environment variables and configuration

## License

MIT License - see the main Onasis Gateway project for full license details.

## Support

For issues, feature requests, or questions:
1. Check the main Onasis Gateway documentation
2. Review the TypeScript definitions for tool signatures
3. Use the health check tools to verify service status
4. Contact the API Integration Team for enterprise support