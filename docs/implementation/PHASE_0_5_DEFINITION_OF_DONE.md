# Phase 0.5: Definition of Done (Pass/Fail Checklist)

**Purpose:** Every item below must pass before Phase 1 begins. No exceptions.
**Date:** 2026-02-10

**Guiding Principle:** The API Gateway exists to centralise all service access behind one endpoint. No scattered endpoints across codebases. One gateway routes to Supabase Edge Functions (the backend), auth-gateway (identity), and MCP services. See `API-GATEWAY-CONSOLIDATION-PLAN.md` and `centralisation-tasks.md` for the full architectural intent.

---

## Bucket 1: Repo Scaffolding and Code

### 1.1 Directory Structure
| Check | Path | Status |
|-------|------|--------|
| [ ] | `services/auth-gateway/` exists | |
| [ ] | `services/ai-router/` exists | |
| [ ] | `services/security-service/` exists | |
| [ ] | `services/intelligence-api/` exists | |

Note: `src/clients/` is NOT created. UniversalSupabaseClient goes in `core/`.

### 1.2 Bug Fixes
| Check | Bug | File | Fix |
|-------|-----|------|-----|
| [ ] | `this.gateway-adapters` (subtraction, not property access) | `src/mcp/discovery/tools/execute.js:117,125` | Change to `this.gateway.adapters` |
| [ ] | BaseClient config key mismatch | `core/base-client.js:16` | Accept both `baseUrl` and `baseURL` |

**Verification:** After fixes, `gateway-execute` can locate the `supabase-edge-functions` adapter by ID.

### 1.3 Auth URL Normalization
| Check | Item |
|-------|------|
| [ ] | `buildAuthVerifyUrl()` in `unified_gateway.js` replaced with deterministic normalization |
| [ ] | Works with `AUTH_GATEWAY_URL=http://127.0.0.1:4000` |
| [ ] | Works with `AUTH_GATEWAY_URL=http://127.0.0.1:4000/v1/auth` |
| [ ] | No double `/v1/auth` segments |

### 1.4 Catalog Schema Update
| Check | Item |
|-------|------|
| [ ] | `schemas/catalog-schema.json` defines optional `adapterPath` (string) |
| [ ] | `schemas/catalog-schema.json` defines optional `functionName` (string) |
| [ ] | `schemas/catalog-schema.json` defines optional `executable` (boolean) |
| [ ] | Existing `catalog.json` still validates (backwards compatible) |

### 1.5 Preflight Script
| Check | Item |
|-------|------|
| [ ] | `scripts/preflight.js` exists |
| [ ] | Checks `SUPABASE_URL` (required -- fail if missing) |
| [ ] | Checks `SUPABASE_ANON_KEY` (required -- fail if missing) |
| [ ] | Warns on missing `SUPABASE_SERVICE_ROLE_KEY` |
| [ ] | Warns on missing `AUTH_GATEWAY_URL` |
| [ ] | Tests Supabase connectivity: `GET ${SUPABASE_URL}/functions/v1/system-health` |
| [ ] | Tests Auth Gateway connectivity if URL configured |
| [ ] | `npm run preflight` produces actionable pass/fail output |

---

## Bucket 2: External Services and Credentials

### 2.1 Supabase Connectivity
| Check | Item |
|-------|------|
| [ ] | `SUPABASE_URL` is set and valid |
| [ ] | `SUPABASE_ANON_KEY` is set and valid |
| [ ] | `GET ${SUPABASE_URL}/functions/v1/system-health` returns 200 |
| [ ] | `POST ${SUPABASE_URL}/functions/v1/memory-search` with `X-API-Key` returns structured response |
| [ ] | At least one payment function (e.g., `paystack`) responds (even if with auth error) |

### 2.2 Auth Gateway Availability
| Check | Item |
|-------|------|
| [ ] | Auth Gateway is reachable at `https://auth.lanonasis.com` (production) |
| [ ] | `GET ${AUTH_GATEWAY_URL}/health` returns healthy status |
| [ ] | Session validation endpoint works: `GET ${AUTH_GATEWAY_URL}/session` with Bearer token |
| [ ] | API key validation endpoint works: `POST ${AUTH_GATEWAY_URL}/api-keys/verify` |

**Context:** Auth Gateway is a fully built service running via PM2 at:
- Production: `https://auth.lanonasis.com`
- Source: `/opt/lanonasis/lan-onasis-monorepo/apps/onasis-core/services/auth-gateway`
- Bridge: `onasis-gateway/middleware/onasis-auth-bridge.js` already proxies to it

The OnasisAuthBridge already handles:
- JWT validation via `GET <authApiUrl>/session` with `Authorization: Bearer <token>`
- API key validation via `POST <authApiUrl>/api-keys/verify` with `{ api_key: "..." }`
- Session caching (5 min TTL)
- User context injection (`req.adapterContext`)

### 2.3 Vendor Secrets (Supabase-side)
| Check | Item |
|-------|------|
| [ ] | Paystack secret key configured in Supabase Edge Function environment |
| [ ] | Flutterwave secret key configured in Supabase Edge Function environment |
| [ ] | Stripe keys configured in Supabase Edge Function environment |

Note: These secrets live in Supabase's function environment, NOT in the gateway's env. The gateway only needs `SUPABASE_URL` + `SUPABASE_ANON_KEY` to reach the Edge Functions. The Edge Functions handle vendor authentication.

---

## Bucket 3: Contracts and Decisions

### 3.1 Edge Function Invocation Contract

**Decision: Each Edge Function is a separate Deno.serve() entry point.**

This is NOT an action-dispatch pattern. Each operation has its own URL:

```
Memory:       POST /functions/v1/memory-create     (body: { title, content, tags, ... })
              POST /functions/v1/memory-search     (body: { query, limit, threshold })
              GET  /functions/v1/memory-get?id=UUID

Intelligence: POST /functions/v1/intelligence-suggest-tags  (body: { content, ... })
              POST /functions/v1/intelligence-find-related   (body: { memory_id, ... })
```

**Implications for adapter design:**
- Memory adapter's `callTool("create", args)` must call `client.call("memory-create", args)`
- Intelligence adapter's `callTool("suggest-tags", args)` must call `client.call("intelligence-suggest-tags", args)`
- The UniversalSupabaseClient's `call(functionName, payload)` maps directly to `POST /functions/v1/{functionName}`

**For payment functions (paystack, flutterwave, stripe):**
The invocation contract depends on how the Edge Function was built. We must verify:

| Check | Item |
|-------|------|
| [ ] | Test `POST /functions/v1/paystack` -- what payload format does it expect? |
| [ ] | Determine: does `paystack` function accept an `action` parameter, or is it a single-purpose proxy? |
| [ ] | Clarify: is `paystack` vs `paystack-integration` the canonical function? |
| [ ] | Same for `sayswitch` vs `sayswitch-integration`/`sayswitch-bills`/`sayswitch-payment`/`sayswitch-transfer` |

**If payment functions are single-purpose:** Each tool maps to its own function (like memory).
**If payment functions accept action dispatch:** The adapter sends `{ action: "initialize-transaction", ... }`.

This MUST be determined before Phase 1.5 (payment adapters).

### 3.2 Tool-to-Function Mapping Table

**Required:** A definitive mapping from adapter tool name -> Edge Function name.

**Memory Service (confirmed):**
| Adapter Tool | Edge Function | Method |
|-------------|---------------|--------|
| `create` | `memory-create` | POST |
| `get` | `memory-get` | GET/POST |
| `update` | `memory-update` | POST/PUT/PATCH |
| `delete` | `memory-delete` | POST/DELETE |
| `list` | `memory-list` | GET/POST |
| `search` | `memory-search` | POST |
| `stats` | `memory-stats` | GET/POST |
| `bulk-delete` | `memory-bulk-delete` | POST/DELETE |
| `health` | `system-health` | GET |

**Intelligence API (confirmed):**
| Adapter Tool | Edge Function | Method |
|-------------|---------------|--------|
| `suggest-tags` | `intelligence-suggest-tags` | POST |
| `find-related` | `intelligence-find-related` | POST |
| `detect-duplicates` | `intelligence-detect-duplicates` | POST |
| `extract-insights` | `intelligence-extract-insights` | POST |
| `analyze-patterns` | `intelligence-analyze-patterns` | POST |
| `health-check` | `intelligence-health-check` | GET |

**AI & Chat (confirmed):**
| Adapter Tool | Edge Function | Method |
|-------------|---------------|--------|
| `chat` | `ai-chat` | POST |
| `route` | `ai-router` | POST |
| `openai` | `openai` | POST |
| `openai-chat` | `openai-chat` | POST |
| `claude` | `claude-ai` | POST |
| `gemini` | `gemini-ai` | POST |
| `embedding` | `generate-embedding` | POST |
| `nixie` | `nixie-ai` | POST |
| `nixie-stream` | `nixie-ai-streaming` | POST |
| `personalized` | `personalized-ai-chat` | POST |

**Payments (needs verification):**
| Adapter Tool | Edge Function | Status |
|-------------|---------------|--------|
| paystack:* | `paystack` or `paystack-integration` | VERIFY |
| flutterwave:* | `flutterwave` | VERIFY |
| stripe:* | `stripe` or individual functions | VERIFY |
| sayswitch:* | `sayswitch` / `sayswitch-bills` / `sayswitch-payment` / `sayswitch-transfer` | VERIFY |

**API Key Management (confirmed):**
| Adapter Tool | Edge Function | Method |
|-------------|---------------|--------|
| `generate` | `generate-api-key` | POST |
| `verify` | `verify-api-key` | POST |
| `hash` | `hash-api-key` | POST |
| `sync-key` | `sync-api-key` | POST |
| `sync-user` | `sync-user` | POST |

### 3.3 Canonical Tool Naming Rules

**Decision:**
- Canonical format: `adapter-id:tool-name` (kebab-case)
- Example: `memory-service:create`, `paystack:initialize-transaction`
- Aliases: `snake_case` variant automatically registered (e.g., `paystack:initialize_transaction`)
- Unprefixed names: NOT supported (too ambiguous across adapters)
- Collisions: Canonical ID is always `adapter:tool`, so collisions can only happen within one adapter (which is a bug in that adapter's tool list)

### 3.4 Memory Service Architecture

**Decision: Supabase Edge Functions are the primary backend.**

The `memory-service.json` shows endpoints on `api.lanonasis.com`, but those routes map to Edge Functions per DIRECT_API_ROUTES.md:
- `/api/v1/memory` (POST) -> `/functions/v1/memory-create`
- `/api/v1/memory/search` -> `/functions/v1/memory-search`
- etc.

The memory adapter in the gateway will call Edge Functions directly via UniversalSupabaseClient, NOT the `api.lanonasis.com` REST endpoints.

### 3.5 Auth Propagation

**Decision: Forward the caller's auth to Edge Functions.**

Flow:
```
Client -> Gateway (OnasisAuthBridge validates) -> Edge Function (receives forwarded auth)
```

Headers forwarded to Edge Functions:
1. `Authorization: Bearer <token>` -- the caller's original token
2. `X-API-Key: <key>` -- if caller used API key auth
3. `apikey: SUPABASE_ANON_KEY` -- always present (Supabase requires it)
4. `X-Project-Scope: lanonasis-maas` -- project context

Edge Functions validate auth independently using their shared `auth.ts` module (supports `lano_*`, `lms_*`, `pk_*` API key formats + JWT).

The gateway does NOT need to re-authenticate with Supabase service role key for most calls -- the caller's auth is passed through. The `SUPABASE_SERVICE_ROLE_KEY` is only needed for admin/system operations where no user token exists.

---

## Phase 0.5 Exit Gate

**All items in Bucket 1 must pass.** These are code changes we control.

**Bucket 2 items that must pass:**
- Supabase URL + anon key configured and `system-health` responds
- Auth Gateway health check passes (if auth is required)

**Bucket 2 items that can be deferred:**
- Vendor secrets (can test without actual payment processing)
- Railway deployment config (Phase 7)

**Bucket 3 items that must be resolved:**
- Memory and Intelligence function contracts (confirmed above)
- Payment function contract (MUST test before Phase 1.5)
- Naming rules (confirmed above)
- Auth propagation (confirmed above)

**Bucket 3 items that can be deferred:**
- Complete tool-to-function mapping for all 80 functions (build incrementally per phase)

---

## Action Items

1. Execute Bucket 1 changes (code -- we do this)
2. Verify Bucket 2 connectivity (run preflight)
3. Test payment Edge Function contracts (`paystack`, `flutterwave`) to resolve Bucket 3 ambiguity
4. Proceed to Phase 1
