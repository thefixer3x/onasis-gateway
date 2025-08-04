# 🔐 Authentication Implementation Guide

## Overview

The Onasis Gateway uses a multi-layered authentication system designed to integrate seamlessly with your VortexCore platform while maintaining security and flexibility.

## 🏗️ Authentication Architecture

### 1. API Key Authentication (Primary)
- **Format**: `onasis_[base64_encoded_key]`
- **Usage**: Service-to-service communication
- **Scope**: Project-based permissions
- **Rate Limiting**: Per-key limits

### 2. JWT Token Authentication (Secondary)
- **Source**: Supabase Auth from VortexCore
- **Usage**: User-authenticated requests
- **Validation**: JWT signature verification
- **Claims**: User ID, project scope, permissions

### 3. HMAC Signature Authentication (High Security)
- **Usage**: Critical financial operations
- **Method**: SHA-256 HMAC with timestamp
- **Protection**: Request tampering prevention

## 🔑 Implementation Details

### API Key System

#### 1. Key Generation
```sql
-- Generate new API key
SELECT generate_api_key() as new_key;
-- Returns: onasis_[32_random_bytes_base64]
```

#### 2. Key Storage
```sql
-- Store API key (hashed)
INSERT INTO core.api_keys (
    key_id, 
    key_hash, 
    name, 
    user_id, 
    project_id, 
    permissions,
    rate_limit_per_hour
) VALUES (
    'extracted_key_id',
    crypt('full_api_key', gen_salt('bf')),
    'VortexCore Production',
    auth.uid(),
    'vortexcore',
    '{"adapters": ["stripe-api", "bap-api"], "scopes": ["payment", "identity"]}',
    1000
);
```

#### 3. Key Validation
```typescript
// Netlify function validation
export async function validateApiKey(apiKey: string): Promise<AuthContext | null> {
  const keyId = apiKey.split('_')[1];
  
  const { data, error } = await supabase
    .rpc('validate_api_key', { key_input: apiKey })
    .single();
    
  if (error || !data) return null;
  
  return {
    keyId: data.key_id,
    userId: data.user_id,
    projectId: data.project_id,
    permissions: data.permissions,
    rateLimit: data.rate_limit_per_hour
  };
}
```

### JWT Token Integration

#### 1. VortexCore Token Forwarding
```typescript
// In your VortexCore platform
const callOnasisGateway = async (endpoint: string, data: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`https://onasis-gateway.netlify.app/.netlify/functions/mcp-server${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`, // Supabase JWT
      'X-Gateway-Key': process.env.ONASIS_API_KEY, // Gateway API key
      'X-User-Context': JSON.stringify({
        userId: session.user.id,
        email: session.user.email,
        projectId: 'vortexcore'
      })
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
};
```

#### 2. Gateway JWT Validation
```typescript
// In Netlify function
import jwt from 'jsonwebtoken';

export async function validateJWT(token: string): Promise<JWTPayload | null> {
  try {
    // Get Supabase JWT secret from environment
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    
    const payload = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // Validate claims
    if (payload.aud !== 'authenticated') return null;
    if (payload.exp < Date.now() / 1000) return null;
    
    return payload;
  } catch (error) {
    console.error('JWT validation failed:', error);
    return null;
  }
}
```

### HMAC Signature Authentication

#### 1. Request Signing (Client Side)
```typescript
// For high-security operations
import crypto from 'crypto';

export function signRequest(payload: any, secret: string): string {
  const timestamp = Date.now().toString();
  const message = JSON.stringify(payload) + timestamp;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
    
  return `${timestamp}.${signature}`;
}

// Usage in VortexCore
const payload = { amount: 10000, currency: 'USD' };
const signature = signRequest(payload, process.env.ONASIS_HMAC_SECRET);

const response = await fetch('https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/execute/stripe-api/create-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': signature,
    'X-Gateway-Key': process.env.ONASIS_API_KEY
  },
  body: JSON.stringify(payload)
});
```

#### 2. Signature Verification (Gateway Side)
```typescript
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const [timestamp, expectedSignature] = signature.split('.');
  
  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (now - requestTime > 300000) return false; // 5 minutes max
  
  // Verify signature
  const message = payload + timestamp;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
    
  return computedSignature === expectedSignature;
}
```

## 🛡️ Security Implementation

### 1. Rate Limiting
```typescript
// Rate limiting check
export async function checkRateLimit(apiKeyId: string, adapterName: string): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0); // Start of current hour
  
  const { data, error } = await supabase
    .from('audit.rate_limits')
    .select('request_count, limit_exceeded')
    .eq('api_key_id', apiKeyId)
    .eq('adapter_name', adapterName)
    .eq('window_start', windowStart.toISOString())
    .single();
    
  if (error && error.code !== 'PGRST116') {
    throw new Error('Rate limit check failed');
  }
  
  // Get API key rate limit
  const { data: keyData } = await supabase
    .from('core.api_keys')
    .select('rate_limit_per_hour')
    .eq('id', apiKeyId)
    .single();
    
  const currentCount = data?.request_count || 0;
  const limit = keyData?.rate_limit_per_hour || 100;
  
  return currentCount < limit;
}
```

### 2. Request Logging
```typescript
// Log all requests for audit
export async function logRequest(requestData: {
  requestId: string;
  userId?: string;
  apiKeyId?: string;
  projectId?: string;
  adapterName: string;
  toolName: string;
  method: string;
  endpoint: string;
  requestHeaders: any;
  requestBody: any;
  responseStatus: number;
  responseHeaders: any;
  responseBody: any;
  responseTimeMs: number;
  ipAddress: string;
  userAgent: string;
  errorMessage?: string;
  errorCode?: string;
}) {
  await supabase
    .from('audit.request_logs')
    .insert(requestData);
}
```

### 3. Permission Validation
```typescript
// Check if API key has permission for specific adapter/tool
export function hasPermission(
  permissions: any, 
  adapterName: string, 
  toolName: string
): boolean {
  // Check adapter permission
  if (permissions.adapters && !permissions.adapters.includes(adapterName)) {
    return false;
  }
  
  // Check tool-specific permissions
  if (permissions.tools && permissions.tools[adapterName]) {
    return permissions.tools[adapterName].includes(toolName);
  }
  
  // Check scope permissions
  if (permissions.scopes) {
    // Get adapter category and check scope
    // Implementation depends on adapter metadata
  }
  
  return true; // Default allow if no restrictions
}
```

## 🔧 Environment Configuration

### Required Environment Variables

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Gateway Configuration
ONASIS_GATEWAY_SECRET=your_gateway_secret
ONASIS_HMAC_SECRET=your_hmac_secret

# CORS Configuration
ALLOWED_ORIGINS=https://saas-vortexcore-app.netlify.app,http://localhost:3000

# Rate Limiting
DEFAULT_RATE_LIMIT=100
MAX_REQUEST_SIZE=10485760
REQUEST_TIMEOUT=30000
```

## 🚀 Integration Examples

### VortexCore Service Integration

#### 1. Payment Service
```typescript
// services/payment.service.ts
export class PaymentService {
  private onasisClient: OnasisGatewayClient;
  
  constructor() {
    this.onasisClient = new OnasisGatewayClient({
      baseUrl: process.env.ONASIS_GATEWAY_URL,
      apiKey: process.env.ONASIS_API_KEY,
      projectId: 'vortexcore'
    });
  }
  
  async createPaymentIntent(amount: number, currency: string, customerId: string) {
    // Get user session for JWT
    const { data: { session } } = await supabase.auth.getSession();
    
    return await this.onasisClient.execute('stripe-api', 'create-payment-intent', {
      amount,
      currency,
      customer: customerId
    }, {
      userToken: session?.access_token,
      userId: session?.user?.id
    });
  }
}
```

#### 2. Identity Verification Service
```typescript
// services/identity.service.ts
export class IdentityService {
  async verifyDocument(documentData: any, userId: string) {
    const payload = { document: documentData, user_id: userId };
    const signature = signRequest(payload, process.env.ONASIS_HMAC_SECRET);
    
    const response = await fetch('https://onasis-gateway.netlify.app/.netlify/functions/mcp-server/execute/identity-api/verify-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Key': process.env.ONASIS_API_KEY,
        'X-Signature': signature,
        'X-User-ID': userId
      },
      body: JSON.stringify(payload)
    });
    
    return response.json();
  }
}
```

## 🔍 Monitoring & Security

### 1. Security Headers
```typescript
// Add security headers to all responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

### 2. Audit Logging
```typescript
// Log security events
export async function logSecurityEvent(event: {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_SIGNATURE' | 'SUSPICIOUS_ACTIVITY';
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}) {
  await supabase
    .from('audit.security_events')
    .insert(event);
    
  // Alert on critical events
  if (['AUTH_FAILURE', 'SUSPICIOUS_ACTIVITY'].includes(event.type)) {
    // Send alert to monitoring system
    await sendSecurityAlert(event);
  }
}
```

### 3. Health Monitoring
```typescript
// Monitor authentication system health
export async function checkAuthHealth(): Promise<HealthStatus> {
  try {
    // Test database connectivity
    const { error: dbError } = await supabase
      .from('core.api_keys')
      .select('count')
      .limit(1);
      
    // Test JWT validation
    const testJWT = generateTestJWT();
    const jwtValid = await validateJWT(testJWT);
    
    return {
      status: 'healthy',
      database: !dbError,
      jwt_validation: !!jwtValid,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
```

## 📋 Security Checklist

### ✅ Implementation Checklist

- [ ] **API Key Generation**: Secure random key generation
- [ ] **Key Storage**: Bcrypt hashing for stored keys
- [ ] **JWT Validation**: Proper signature verification
- [ ] **HMAC Signing**: Request integrity protection
- [ ] **Rate Limiting**: Per-key and per-endpoint limits
- [ ] **Permission System**: Granular access control
- [ ] **Audit Logging**: Complete request/response logging
- [ ] **Error Handling**: No sensitive data in error messages
- [ ] **CORS Configuration**: Restricted to allowed origins
- [ ] **Security Headers**: All recommended headers
- [ ] **Input Validation**: Sanitize all inputs
- [ ] **Output Encoding**: Prevent XSS attacks

### 🚨 Security Monitoring

- [ ] **Failed Authentication Alerts**
- [ ] **Rate Limit Exceeded Notifications**
- [ ] **Suspicious Activity Detection**
- [ ] **Regular Security Audits**
- [ ] **Key Rotation Procedures**
- [ ] **Access Review Process**

This authentication system provides enterprise-grade security while maintaining ease of integration with your VortexCore platform.
