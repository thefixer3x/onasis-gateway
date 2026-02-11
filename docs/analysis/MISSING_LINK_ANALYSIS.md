# Missing Link Analysis: Gateway ↔ Live Services

**Date:** 2026-02-10
**Status:** 🔴 CRITICAL GAP IDENTIFIED

---

## The Problem

You have **THREE separate layers** that are NOT connected:

```
Layer 1: MCP Adapters (Gateway)         Layer 2: Service Clients          Layer 3: Supabase Edge Functions
┌─────────────────────────┐            ┌──────────────────────┐           ┌────────────────────────────┐
│ paystack-mcp-adapter.ts │────────────│ paystack-client.js   │─────✗─────│ /functions/v1/paystack     │
│ (117 tools defined)     │            │ (calls Paystack API) │           │ (REAL backend deployed)    │
│                         │            │                      │           │                            │
│ Status: EXISTS          │            │ Points to:           │           │ Status: DEPLOYED ✅        │
│ Loaded: ❌ NO           │            │ https://api.         │           │ Calls: 0                   │
│                         │            │ paystack.co ❌       │           │                            │
└─────────────────────────┘            └──────────────────────┘           └────────────────────────────┘

                                              SHOULD BE ↓

┌─────────────────────────┐            ┌──────────────────────┐           ┌────────────────────────────┐
│ paystack-mcp-adapter.ts │────────────│ supabase-client.js   │─────✅────│ /functions/v1/paystack     │
│ (117 tools defined)     │            │ (Supabase proxy)     │           │ (handles auth, routing)    │
│                         │            │                      │           │                            │
│ Status: EXISTS          │            │ Points to:           │           │ Then calls:                │
│ Loaded: ✅ YES          │            │ https://lanonasis.   │           │ → Real Paystack API        │
│                         │            │ supabase.co ✅       │           │ → Or cached data           │
└─────────────────────────┘            └──────────────────────┘           └────────────────────────────┘
```

---

## Current State

### ✅ What Works
1. **Supabase Edge Functions** - 82 functions deployed and operational
   - Memory API (9 functions)
   - Payment integrations (20 functions including paystack, stripe, flutterwave)
   - AI & Chat (12 functions)
   - Authentication (5 functions)

2. **Supabase Auto-Discovery** - Gateway discovers a filtered subset per environment (32 in the sample run below)
   ```
   ✅ Discovered 32 Supabase Edge Functions
   ✅ Supabase adapter initialized with 32 functions
   ```
   Note: 82 reflects total deployed functions in Supabase. 32 reflects what this gateway instance discovered/initialized at that time based on configured route sources and filters.

3. **MCP Discovery Layer** - 5 meta-tools working perfectly
   - `gateway-intent`, `gateway-execute`, `gateway-adapters`, etc.

### ❌ What's Broken

1. **Mock Adapters** - 19 adapters are PLACEHOLDERS
   ```javascript
   // From services/catalog.json
   {
     "id": "paystack",
     "type": "mock",  // ← This is the problem!
     "source": "mock",
     "toolCount": 117,  // Fake tools, no implementation
   }
   ```

2. **Real Adapters NOT Loaded**
   ```bash
   # These exist but are NEVER loaded:
   services/paystack-payment-gateway/paystack-mcp-adapter.ts
   services/flutterwave-payment-gateway/flutterwave-mcp-adapter.ts
   services/providus-bank/mcp-adapter.ts
   services/verification-service/verification-mcp-adapter.ts
   ```

3. **Clients Point to Wrong Endpoints**
   ```javascript
   // paystack-client.js:12
   this.baseURL = 'https://api.paystack.co';  // ❌ Direct to Paystack

   // SHOULD BE:
   this.baseURL = 'https://mxtsdgkwzjzlttpotole.supabase.co/functions/v1';  // ✅ Via Supabase
   ```

---

## Service Inventory

### Services with BOTH Real Adapter + Supabase Function

| Service | Real Adapter | Supabase Function | Status |
|---------|-------------|-------------------|--------|
| **Paystack** | ✅ `paystack-mcp-adapter.ts` | ✅ `/functions/v1/paystack` | 🔴 NOT CONNECTED |
| **Flutterwave** | ✅ `flutterwave-mcp-adapter.ts` | ✅ `/functions/v1/flutterwave` | 🔴 NOT CONNECTED |
| **Stripe** | ⚠️ Mock only | ✅ `/functions/v1/stripe` | 🔴 NO ADAPTER |
| **Providus Bank** | ✅ `mcp-adapter.ts` | ⚠️ Unknown | 🔴 NO FUNCTION? |
| **Verification** | ✅ `verification-mcp-adapter.ts` | ⚠️ Unknown | 🔴 NO FUNCTION? |

### Services with ONLY Supabase Functions (No Adapter)

| Function | Category | Tools Available |
|----------|----------|----------------|
| `memory-*` (9 functions) | Memory/MaaS | Via Supabase adapter ✅ |
| `openai-*` (6 functions) | AI/Chat | NO MCP TOOLS ❌ |
| `stripe-*` (7 functions) | Payments | Mock adapter only ❌ |
| `edoc-*` (11 functions) | Documents | NO MCP TOOLS ❌ |
| `sayswitch-*` (6 functions) | Payments | NO MCP TOOLS ❌ |
| `auth-*` (5 functions) | Auth | NO MCP TOOLS ❌ |

---

## The Missing Link

### Problem 1: Adapters Not Loaded

**Location:** `unified_gateway.js:444-448`

```javascript
if (adapterEntry.type === 'mock' || adapterEntry.source === 'mock') {
    this.adapters.set(adapterEntry.id, {
        tools: adapterEntry.toolCount || 0,  // Just a number, no real tools!
        auth: adapterEntry.auth || 'apikey'
    });
}
```

**Should be:**
```javascript
if (adapterEntry.type === 'service' && adapterEntry.adapterPath) {
    const AdapterClass = require(adapterEntry.adapterPath);
    const adapter = new AdapterClass();
    await adapter.initialize(config);
    this.adapters.set(adapterEntry.id, adapter);  // Real adapter with tools!
}
```

### Problem 2: Wrong Backend URLs

**Location:** `services/*/client.js`

All clients point to external APIs instead of Supabase:

```javascript
// paystack-client.js:12
this.baseURL = 'https://api.paystack.co';  // ❌ WRONG

// flutterwave-client.js:10
this.baseURL = 'https://api.flutterwave.com/v3';  // ❌ WRONG

// SHOULD ALL BE:
this.baseURL = process.env.SUPABASE_URL + '/functions/v1';  // ✅ CORRECT
```

### Problem 3: No Bridge Layer

The Supabase Edge Functions ARE the backend, but there's no connection layer:

```
Gateway Tool Call
      ↓
MCP Adapter (if loaded)
      ↓
Client (points to wrong URL)
      ↓
❌ External API (Paystack.co) - bypasses our backend!

SHOULD BE:
      ↓
✅ Supabase Edge Function (/functions/v1/paystack)
      ↓
✅ Our backend handles auth, rate limiting, caching
      ↓
✅ THEN calls external API if needed
```

---

## Solution Roadmap

### Phase 1: Quick Win - Connect Paystack & Flutterwave

**Files to modify:**
1. `services/catalog.json` - Change from `mock` to `service`
2. `services/paystack-payment-gateway/paystack-client.js` - Update baseURL
3. `services/flutterwave-payment-gateway/flutterwave-client.js` - Update baseURL
4. `unified_gateway.js` - Load real adapters instead of mocks

**Estimated impact:** 224 tools (117 Paystack + 107 Flutterwave) become functional

### Phase 2: Create Universal Supabase Client

**Create:** `src/clients/supabase-function-client.js`

```javascript
class SupabaseFunctionClient {
  constructor(functionName) {
    this.baseURL = process.env.SUPABASE_URL + '/functions/v1';
    this.functionName = functionName;
  }

  async call(endpoint, data, options = {}) {
    return axios.post(
      `${this.baseURL}/${this.functionName}`,
      { endpoint, data, ...options },
      {
        headers: {
          'X-API-Key': process.env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
```

**Then update all clients:**
```javascript
// Instead of:
const paystackClient = new PayStackClient({ secretKey: 'sk_...' });

// Use:
const paystackClient = new SupabaseFunctionClient('paystack');
```

### Phase 3: Auto-Generate Adapters from Edge Functions

**Goal:** Any Supabase Edge Function automatically gets an MCP adapter

**Strategy:**
1. Query Edge Functions list
2. Introspect function schema (if available)
3. Auto-generate MCP tool definitions
4. Register in discovery layer

**Result:** All 82 Edge Functions become MCP tools automatically

---

## Metrics

### Current
- **Total Adapters:** 20 (1 real + 19 mocks)
- **Total Tools:** 1,686 (82 real + 1,604 fake)
- **Functional Coverage:** 4.9%
- **API Services Connected:** 1 (Supabase only)

### After Phase 1
- **Total Adapters:** 22 (3 real + 19 mocks)
- **Total Tools:** 1,686 (306 real + 1,380 fake)
- **Functional Coverage:** 18.2%
- **API Services Connected:** 3 (Supabase, Paystack, Flutterwave)

### After Phase 2
- **Total Adapters:** 25+ (all payment services)
- **Total Tools:** 2,000+
- **Functional Coverage:** 50%+
- **API Services Connected:** 8+

### After Phase 3
- **Total Adapters:** 82+ (all Edge Functions)
- **Total Tools:** 3,000+
- **Functional Coverage:** 100%
- **API Services Connected:** All deployed services

---

## Immediate Action Items

1. ✅ **Document the gap** (this file)
2. ⏳ **Phase 1 Implementation** (2-3 hours)
   - Connect Paystack adapter
   - Connect Flutterwave adapter
   - Test end-to-end flow
3. ⏳ **Create bridge client** (1-2 hours)
4. ⏳ **Generate adapters** (automated)

---

**Next Steps:** Shall we start with Phase 1 and connect Paystack + Flutterwave?
