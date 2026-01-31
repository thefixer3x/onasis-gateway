# Supabase Edge Functions Adapter Integration Guide

## Overview
This adapter auto-discovers all deployed Supabase Edge Functions and registers them in the Onasis Gateway, eliminating the gap between your backend API and gateway service directory.

---

## Prerequisites

- [ ] Supabase project URL: `https://lanonasis.supabase.co`
- [ ] Supabase Service Role Key (from Supabase Dashboard > Settings > API)
- [ ] Gateway running with UAI authentication
- [ ] Node.js 18+ and npm/pnpm installed

---

## Installation Steps

### Step 1: Add Adapter Files to Gateway

**Location:** Your onasis-gateway project

```bash
# Navigate to your gateway project
cd ~/path/to/onasis-gateway

# Create adapter directory
mkdir -p adapters/supabase-edge-functions

# Copy the adapter files
cp ~/Downloads/supabase-adapter.ts adapters/supabase-edge-functions/adapter.ts
cp ~/Downloads/supabase-adapter-config.json adapters/supabase-edge-functions/config.json
```

**Verify structure:**
```
onasis-gateway/
├── adapters/
│   ├── supabase-edge-functions/     ← NEW
│   │   ├── adapter.ts               ← NEW
│   │   └── config.json              ← NEW
│   ├── verification-service/
│   ├── paystack-payment-gateway/
│   └── ...
└── ...
```

---

### Step 2: Configure Environment Variables

**File:** `.env` (in gateway root)

**Add these variables:**
```env
# Supabase Configuration
SUPABASE_URL=https://lanonasis.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# UAI Integration (if not already set)
UAI_ENABLED=true
UAI_TOKEN_HEADER=Authorization
```

**How to get your keys:**
1. Go to: https://supabase.com/dashboard/project/lanonasis/settings/api
2. Copy "anon public" key → `SUPABASE_ANON_KEY`
3. Copy "service_role" key → `SUPABASE_SERVICE_KEY`

---

### Step 3: Register Adapter in Gateway

**File:** `adapters/index.ts` (or wherever adapters are registered)

**Add this import:**
```typescript
import { createSupabaseAdapter } from './supabase-edge-functions/adapter';
```

**Add to adapter registry:**
```typescript
// Load config
const supabaseConfig = JSON.parse(
  fs.readFileSync('./adapters/supabase-edge-functions/config.json', 'utf-8')
);

// Create adapter instance
const supabaseAdapter = createSupabaseAdapter({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  ...supabaseConfig.discovery,
  authPassthrough: supabaseConfig.authentication.passthrough,
  uaiIntegration: supabaseConfig.authentication.uai,
});

// Register with gateway
adapters.register('supabase-edge-functions', supabaseAdapter);
```

---

### Step 4: Update Gateway Routing

**File:** `routes/index.ts` (or your main router)

**Add Supabase proxy route:**
```typescript
import { Router } from 'express';

const router = Router();

// Supabase Edge Functions proxy route
router.all('/supabase/:functionName/*', async (req, res) => {
  const { functionName } = req.params;
  const serviceId = `supabase-${functionName}`;
  
  try {
    const adapter = adapters.get('supabase-edge-functions');
    const response = await adapter.proxyRequest(
      serviceId,
      req.path.replace(`/supabase/${functionName}`, ''),
      {
        method: req.method,
        headers: req.headers,
        body: req.body,
      }
    );

    // Forward response
    res.status(response.status);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Gateway proxy error' });
  }
});

export default router;
```

---

### Step 5: Initialize Auto-Discovery

**File:** `server.ts` (or your main entry point)

**Add initialization logic:**
```typescript
async function initializeGateway() {
  console.log('🚀 Initializing Onasis Gateway...');

  // Initialize Supabase adapter
  const supabaseAdapter = adapters.get('supabase-edge-functions');
  if (supabaseAdapter) {
    console.log('🔍 Discovering Supabase Edge Functions...');
    const services = await supabaseAdapter.discoverServices();
    console.log(`✅ Discovered ${services.length} functions`);
    
    // Log discovered services
    services.forEach(service => {
      console.log(`   - ${service.name} (${service.baseUrl})`);
    });
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`✅ Gateway running on port ${PORT}`);
  });
}

initializeGateway();
```

---

### Step 6: Test the Integration

#### Test 1: Health Check

```bash
curl -X GET http://localhost:3000/health/supabase-edge-functions
```

**Expected response:**
```json
{
  "healthy": true,
  "message": "120 functions available"
}
```

#### Test 2: List Discovered Services

```bash
curl -X GET http://localhost:3000/services/supabase-edge-functions
```

**Expected response:**
```json
[
  {
    "id": "supabase-memory-create",
    "name": "memory-create",
    "baseUrl": "https://lanonasis.supabase.co/functions/v1/memory-create",
    ...
  },
  ...
]
```

#### Test 3: Proxy Request

```bash
curl -X POST http://localhost:3000/supabase/memory-create \
  -H "Authorization: Bearer YOUR_UAI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Memory",
    "content": "Testing gateway proxy",
    "type": "knowledge"
  }'
```

**Expected response:**
```json
{
  "id": "mem_abc123",
  "title": "Test Memory",
  "status": "created"
}
```

---

## Troubleshooting

### Issue: "Failed to discover Supabase functions"

**Check:**
1. `SUPABASE_SERVICE_KEY` is set correctly in `.env`
2. Supabase project is active and accessible
3. Run: `supabase functions list` to verify deployed functions

**Fix:**
```bash
# Verify Supabase CLI connection
supabase login
supabase link --project-ref lanonasis
supabase functions list
```

### Issue: "Service not found" when proxying

**Check:**
1. Function name matches Supabase slug exactly
2. Function is in `ACTIVE` status
3. Function not excluded by `excludePatterns`

**Fix:**
```bash
# Check cache
curl http://localhost:3000/services/supabase-edge-functions | jq '.[] | .slug'

# Force re-discovery (wait for cache timeout or restart gateway)
```

### Issue: Authentication errors

**Check:**
1. UAI token is valid and not expired
2. `authPassthrough` is set to `true` in config
3. Token header name matches (`Authorization` by default)

**Fix:**
```typescript
// Add debug logging in adapter.ts
console.log('Headers:', request.headers);
console.log('UAI Token:', headers[this.config.uaiIntegration.tokenHeader]);
```

---

## Hybrid Strategy: When to Use Direct Providers

Keep these adapters as **direct connections** (bypass Supabase):

### Critical Real-Time Services:
- ✅ Payment webhooks (PayStack, Flutterwave, Stripe)
- ✅ Banking APIs (SaySwitch, XpressWallet)
- ✅ Verification services (SEFTEC Hub)

**Reason:** Lower latency, fallback mechanism during Supabase downtime

### Route through Supabase:
- ✅ Memory services (MaaS)
- ✅ Intelligence/AI services
- ✅ API key management
- ✅ Configuration services
- ✅ Non-time-critical integrations

**Reason:** Centralized auth, billing tracking, audit logs

---

## Monitoring & Metrics

### Enable Request Logging

**File:** `adapters/supabase-edge-functions/config.json`

```json
{
  "monitoring": {
    "enabled": true,
    "logRequests": true,
    "trackLatency": true
  }
}
```

### View Metrics

```bash
curl http://localhost:3000/metrics/supabase-edge-functions
```

**Expected response:**
```json
{
  "totalRequests": 1523,
  "avgLatency": 45,
  "successRate": 99.8,
  "cacheHitRate": 87.3,
  "discoveredFunctions": 120
}
```

---

## Next Steps

1. ✅ **Deploy to Production:**
   - Set environment variables in your hosting platform
   - Update gateway deployment config
   - Test thoroughly in staging first

2. ✅ **Set Up Monitoring:**
   - Configure alerts for high error rates
   - Track latency metrics
   - Monitor cache hit rates

3. ✅ **Document New Routes:**
   - Update your API documentation
   - Add examples for proxied endpoints
   - Share with team

4. ✅ **Optimize Performance:**
   - Adjust cache timeout based on function update frequency
   - Enable response caching for read-heavy operations
   - Set up CDN for static responses

---

## Architecture Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ (UAI Token)
       │
┌──────▼────────────┐
│ Onasis Gateway    │
│ - Auth Check      │
│ - Rate Limiting   │
└──────┬────────────┘
       │
┌──────▼──────────────────────────────┐
│ Supabase Adapter (Auto-Discovery)   │
│ - Cache: 120 functions              │
│ - Proxy to Edge Functions           │
└──────┬──────────────────────────────┘
       │
┌──────▼─────────────────────────────┐
│ Supabase Edge Functions            │
│ - memory-create                    │
│ - intelligence-analyze-patterns    │
│ - stripe-create-payment-intent     │
│ - ... 117 more                     │
└────────────────────────────────────┘
```

---

## Questions or Issues?

If you encounter issues:
1. Check gateway logs: `npm run logs` or `docker logs onasis-gateway`
2. Verify Supabase function status: `supabase functions list`
3. Test direct Supabase access: `curl https://lanonasis.supabase.co/functions/v1/health`
4. Review this guide's troubleshooting section

Happy building! 🚀
