# Onboarding Apps & SDKs to the Verification Gateway

The **Onasis Gateway** is the **central point** for verification (due diligence): all your web apps, published SDKs, and CLIs should call the gateway once; the gateway then talks to your verification backend (and SourceID, etc.). You onboard once per app/SDK with a single base URL and API key.

---

## 1. End-to-end: do you have a working service?

Yes, **if** you complete the chain:

| Layer | Role | You need |
|-------|------|----------|
| **Your app / SDK** (e.g. v-secure privacy-sdk, web app) | Calls the gateway only | Gateway URL + API key |
| **Gateway** (onasis-gateway) | Central entry; exposes verification tools (REST + MCP) | Verification adapter loaded (catalog or factory) |
| **Your backend** (e.g. verify.seftechub.com) | Calls SourceID / other providers | SourceID credentials, routes implemented |
| **SourceID** (or other providers) | Actual KYC/KYB/AML | API key from provider |

So: **follow the SourceID integration doc** to implement the backend and enable the tools you need in the gateway. Then **onboard each app/SDK** as below. After that, you have a working end-to-end due diligence flow across projects.

---

## 2. Gateway as central point

- **Single base URL** for all clients: e.g. `https://gateway.lanonasis.com` or wherever you host onasis-gateway.
- **Single auth model**: API key (e.g. `x-api-key`) or Bearer token from your auth gateway (e.g. auth.lanonasis.com).
- **Two ways to call verification**:
  - **REST** (simplest for web/SDK): `POST /api/v1/verification/identity`, `POST /api/v1/verification/status`, etc.
  - **MCP** (for agents / tools): `POST /mcp` with JSON-RPC `tools/list` and `tools/call`.

All apps (web, SDK, CLI) use the **same** gateway URL and API key; no app talks directly to SourceID or your verification backend.

---

## 3. How to onboard an app (e.g. privacy-sdk)

### Step 1: Get gateway URL and API key

- **Gateway URL**: The base URL of your deployed onasis-gateway (e.g. `https://gateway.lanonasis.com` or `http://localhost:3008`).
- **API key**: From your auth gateway or admin (e.g. `lano_live_...` or a key that has access to the gateway). Store in env (e.g. `ONASIS_GATEWAY_API_KEY` or `VSECURE_API_KEY`) and **never** commit it.

### Step 2: Call verification from the app

**Option A – REST (recommended for web and SDKs)**

```bash
# Identity verification
curl -X POST "https://gateway.lanonasis.com/api/v1/verification/identity" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "document_type": "national_id",
    "document_number": "...",
    "customer_id": "cust_123",
    "country": "NG"
  }'

# Status
curl -X POST "https://gateway.lanonasis.com/api/v1/verification/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"reference": "ref_123"}'
```

**Option B – MCP (for agents / tools)**

```bash
# List tools
curl -X POST "https://gateway.lanonasis.com/mcp" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST "https://gateway.lanonasis.com/mcp" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"verify_identity_document",
      "arguments":{"document_type":"national_id","document_number":"...","customer_id":"cust_123","country":"NG"}
    }
  }'
```

### Step 3: Configure the app/SDK

In your app or SDK (e.g. **privacy-sdk**), set:

- `GATEWAY_URL` or `ONASIS_GATEWAY_URL` = gateway base URL  
- `ONASIS_GATEWAY_API_KEY` or `VSECURE_API_KEY` = API key  

Then use REST or MCP as above. The gateway is the **only** external verification endpoint the app needs to know.

---

## 4. Example: Enhancing privacy-sdk with due diligence

The **@lanonasis/privacy-sdk** does PII detection and masking. You can **extend its coverage** with verification (due diligence) by calling the gateway from the SDK:

- **Flow**: “Verify identity/document first (gateway) → then mask/sanitize (privacy-sdk).”
- **Implementation**: Optional config `{ gatewayUrl, apiKey }` and a small client that calls:
  - `POST {gatewayUrl}/api/v1/verification/identity` (or status, etc.) with `x-api-key: apiKey`.

Then in your app:

```ts
import { PrivacySDK } from '@lanonasis/privacy-sdk';

const privacy = new PrivacySDK({
  // optional: point to gateway for due-diligence
  gatewayUrl: process.env.ONASIS_GATEWAY_URL,
  apiKey: process.env.ONASIS_GATEWAY_API_KEY,
});

// Verify first (gateway), then mask (local)
const verification = await privacy.verifyIdentity({ document_type: 'national_id', document_number: '...', customer_id: 'c1' });
if (verification.success) {
  const masked = privacy.mask(userData.ssn, 'ssn');
}
```

The SDK stays a **single integration point**: gateway for verification, same SDK for privacy. The gateway remains the **central point** for all verification.

---

## 5. Ensuring the gateway exposes verification

- **Verification adapter** must be loaded so the gateway has verification tools. You can:
  - Add **verification-service** to `services/catalog.json` under `mcpAdapters` with `adapterPath` pointing to your built verification adapter (e.g. `.js`), **or**
  - Register a **verification-service factory** in the gateway (like supabase-edge-functions) that instantiates the verification adapter.
- **REST routes**: The gateway exposes `POST /api/v1/verification/*` that delegate to the verification adapter. If you get 503 “Verification service not available”, the adapter is not loaded—fix catalog or factory as above.
- **Enabled tools**: Control which verification tools are active via `enabledTools` in `services/verification-service/verification-service.json` (see `schemas/sourceid-integration.md`).

---

## 6. Summary

| Goal | Action |
|------|--------|
| Working end-to-end due diligence | Backend + SourceID (see sourceid-integration.md) → gateway → apps |
| Gateway as central point | All apps/SDKs call **only** the gateway (same URL + API key) |
| Onboard an app | Set gateway URL + API key in env; call REST or MCP |
| Enhance privacy-sdk | Add optional gateway config + verification client that calls gateway REST |
| Extend to web / other SDKs | Same: gateway URL + API key; use REST or MCP from any stack |

Once the backend and gateway are set up, **onboarding a new app or SDK is just**: get an API key, set gateway URL + key, and call the same verification endpoints. No need to re-implement SourceID or verification logic in each project.
