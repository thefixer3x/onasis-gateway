# 🚀 Onasis Gateway Integration Guide

## 📡 API Endpoints

Your deployed Onasis Gateway provides these endpoints:

### Base URL
```
https://onasis-gateway.netlify.app/.netlify/functions/mcp-server
```

### Available Endpoints

#### 1. Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-17T03:47:00.000Z",
  "adapters": 17,
  "environment": "netlify",
  "version": "1.0.0"
}
```

#### 2. List All Adapters
```http
GET /adapters
```
**Response:**
```json
{
  "adapters": [
    {
      "name": "stripe-api",
      "tools": 457,
      "description": "Stripe payment processing",
      "authType": "Bearer",
      "category": "payment",
      "status": "active"
    }
  ],
  "total": 17
}
```

#### 3. Get Specific Adapter
```http
GET /adapters/{adapter-name}
```
**Response:**
```json
{
  "adapter": "stripe-api",
  "tools": 457,
  "description": "Stripe payment processing",
  "status": "active",
  "authType": "Bearer",
  "endpoints": [...]
}
```

#### 4. Execute Tool
```http
POST /execute/{adapter-name}/{tool-name}
```
**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```
**Body:**
```json
{
  "parameters": {
    "amount": 1000,
    "currency": "usd"
  },
  "metadata": {
    "user_id": "user_123",
    "request_id": "req_456"
  }
}
```

## 🔐 Authentication Patterns

### 1. API Key Authentication
```javascript
// For your VortexCore platform
const response = await fetch('https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/execute/stripe-api/create-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ONASIS_API_KEY',
    'X-User-ID': user.id,
    'X-Project-ID': 'vortexcore'
  },
  body: JSON.stringify({
    parameters: {
      amount: 1000,
      currency: 'usd',
      customer: customerId
    }
  })
});
```

### 2. JWT Token Authentication
```javascript
// Using Supabase JWT from VortexCore
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch('https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/adapters', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'X-Gateway-Key': 'YOUR_GATEWAY_API_KEY'
  }
});
```

### 3. Service-to-Service Authentication
```javascript
// For backend integrations
const response = await fetch('https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/execute/bap-api/process-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': process.env.ONASIS_SERVICE_KEY,
    'X-HMAC-Signature': generateHMAC(payload, secret)
  },
  body: JSON.stringify(payload)
});
```

## 🏗️ Integration Examples

### VortexCore Platform Integration

#### 1. Payment Processing
```typescript
// In your VortexCore payment service
export class PaymentService {
  private onasisGateway = 'https://onasis-gateway.netlify.app/.netlify/functions/mcp-server';
  
  async processPayment(amount: number, currency: string, customerId: string) {
    const response = await fetch(`${this.onasisGateway}/execute/stripe-api/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ONASIS_API_KEY}`,
        'X-User-ID': customerId,
        'X-Service': 'vortexcore-payments'
      },
      body: JSON.stringify({
        parameters: { amount, currency, customer: customerId },
        metadata: { source: 'vortexcore', timestamp: Date.now() }
      })
    });
    
    return response.json();
  }
}
```

#### 2. Identity Verification
```typescript
// KYC integration
export class IdentityService {
  async verifyDocument(documentData: any, userId: string) {
    const response = await fetch(`${this.onasisGateway}/execute/identity-api/verify-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ONASIS_API_KEY}`,
        'X-User-ID': userId
      },
      body: JSON.stringify({
        parameters: documentData,
        metadata: { service: 'kyc-verification' }
      })
    });
    
    return response.json();
  }
}
```

## 🔄 Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "ADAPTER_NOT_FOUND",
    "message": "The requested adapter does not exist",
    "details": {
      "adapter": "unknown-api",
      "available_adapters": ["stripe-api", "bap-api", "..."]
    },
    "timestamp": "2025-07-17T03:47:00.000Z",
    "request_id": "req_123"
  }
}
```

### Error Codes
- `ADAPTER_NOT_FOUND` - Adapter doesn't exist
- `TOOL_NOT_FOUND` - Tool not available in adapter
- `AUTHENTICATION_FAILED` - Invalid API key or token
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VALIDATION_ERROR` - Invalid parameters
- `EXTERNAL_API_ERROR` - Third-party API error

## 📊 Rate Limiting

### Default Limits
- **Free Tier**: 100 requests/hour per API key
- **Pro Tier**: 1,000 requests/hour per API key
- **Enterprise**: Custom limits

### Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

## 🔍 Monitoring & Logging

### Request Logging
All requests are logged with:
- Request ID
- User ID
- Adapter/Tool used
- Response time
- Status code
- Error details (if any)

### Health Monitoring
```javascript
// Check gateway health
const health = await fetch('https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/health');
const status = await health.json();

if (status.status !== 'healthy') {
  // Handle gateway unavailability
  console.error('Gateway unhealthy:', status);
}
```

## 🚀 Quick Integration Checklist

### For VortexCore Platform:

1. **✅ Get API Key**
   - Contact admin for Onasis Gateway API key
   - Store securely in environment variables

2. **✅ Update Environment Variables**
   ```env
   ONASIS_GATEWAY_URL=https://onasis-gateway.netlify.app/.netlify/functions/mcp-server
   ONASIS_API_KEY=your_api_key_here
   ```

3. **✅ Create Service Wrapper**
   ```typescript
   // services/onasis-gateway.ts
   export class OnasisGateway {
     private baseUrl = process.env.ONASIS_GATEWAY_URL;
     private apiKey = process.env.ONASIS_API_KEY;
     
     async execute(adapter: string, tool: string, params: any) {
       // Implementation here
     }
   }
   ```

4. **✅ Test Integration**
   ```typescript
   // Test basic connectivity
   const gateway = new OnasisGateway();
   const health = await gateway.health();
   console.log('Gateway status:', health.status);
   ```

5. **✅ Implement Error Handling**
   - Add retry logic for failed requests
   - Handle rate limiting
   - Log errors for monitoring

6. **✅ Add to VortexCore Services**
   - Payment processing
   - Identity verification
   - Bank statement analysis
   - Document verification

## 📞 Support

- **Documentation**: This guide
- **API Status**: https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/health
- **Issues**: Contact development team
- **Updates**: Monitor deployment notifications
