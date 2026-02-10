# GitHub Issues for Onasis Gateway Integration (Revised v2)

**Project Board:** https://github.com/users/thefixer3x/projects/2
**Revised:** 2026-02-10 (aligned with MASTER_IMPLEMENTATION_PLAN.md v2)

---

## Phase 0: Architecture & Planning

### Issue #1: Complete Architecture Documentation
**Title:** `[Phase 0] Complete Architecture Documentation`
**Labels:** `phase-0`, `priority-critical`, `type-docs`
**Status:** DONE

**Tasks:**
- [x] Create `MASTER_IMPLEMENTATION_PLAN.md` (v1)
- [x] Create `ARCHITECTURE.md`
- [x] Create `api-gateway-codemap.md`
- [x] Create `MISSING_LINK_ANALYSIS.md`
- [x] Revise plan to v2 (gap analysis + preflight strategy)

---

### Issue #2: Set up Project Board and Labels
**Title:** `[Phase 0] Set up Project Board and Issue Templates`
**Labels:** `phase-0`, `priority-high`, `type-infrastructure`

**Tasks:**
- [ ] Create project board columns (Backlog, Ready, In Progress, In Review, Done)
- [ ] Set up labels: `phase-0` through `phase-7`, `phase-0.5`, `phase-1.5`
- [ ] Add priority labels: `priority-critical`, `priority-high`, `priority-medium`
- [ ] Add type labels: `type-infrastructure`, `type-adapter`, `type-testing`, `type-bugfix`, `type-docs`
- [ ] Add service labels: `service-auth`, `service-payment`, `service-banking`, `service-memory`, `service-intelligence`, `service-edoc`
- [ ] Create milestones for each phase

---

## Phase 0.5: Scaffolding + Preflight + Bug Fixes (NEW)

### Issue #3: Create Missing Directory Structure
**Title:** `[Phase 0.5] Create missing service directories and repo scaffolding`
**Labels:** `phase-0.5`, `priority-critical`, `type-infrastructure`

**Description:**
Phase 1 and Phase 2 reference directories that do not exist. Create them now so implementation phases are purely "write code".

**Tasks:**
- [ ] Create `services/auth-gateway/` with README.md
- [ ] Create `services/ai-router/` with README.md
- [ ] Create `services/security-service/` with README.md
- [ ] Create `services/intelligence-api/` with README.md

**Note:** `src/clients/` is NOT created. UniversalSupabaseClient goes in `core/` alongside `base-client.js`.

**Acceptance Criteria:**
- All directories referenced by Phase 1 and Phase 2 exist
- Each new directory has a README.md for git tracking

---

### Issue #4: Create Preflight Script
**Title:** `[Phase 0.5] Create environment preflight check script`
**Labels:** `phase-0.5`, `priority-critical`, `type-infrastructure`

**Description:**
Create `scripts/preflight.js` that verifies environment readiness before gateway startup.

**Tasks:**
- [ ] Check required env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [ ] Warn on optional missing vars: `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_GATEWAY_URL`
- [ ] Test Supabase connectivity: `GET ${SUPABASE_URL}/functions/v1/system-health`
- [ ] Test Auth Gateway connectivity (if URL configured)
- [ ] Emit clear "ready / not ready" report
- [ ] Add `npm run preflight` script to package.json

**Acceptance Criteria:**
- `npm run preflight` produces actionable output
- Non-zero exit code if critical vars missing
- Warnings (not failures) for optional services

**Files:**
- Create: `scripts/preflight.js`
- Modify: `package.json` (add preflight script)

---

### Issue #5: Normalize Auth Gateway URL Semantics
**Title:** `[Phase 0.5] Fix auth gateway URL normalization`
**Labels:** `phase-0.5`, `priority-high`, `type-bugfix`

**Description:**
`buildAuthVerifyUrl()` in `unified_gateway.js:468-483` uses heuristic string matching that can produce wrong URLs. Standardize to deterministic normalization.

**Tasks:**
- [ ] Normalize `AUTH_GATEWAY_URL` into `authGatewayBaseUrl` and `authGatewayApiUrl`
- [ ] Replace `buildAuthVerifyUrl()` with deterministic logic
- [ ] Test with both `http://127.0.0.1:4000` and `http://127.0.0.1:4000/v1/auth` as input

**Acceptance Criteria:**
- No "double /v1/auth" or missing path segments
- Auth proxy routes hit correct endpoints

**Files:**
- Modify: `unified_gateway.js`

---

### Issue #6: Fix Known Execution Bugs
**Title:** `[Phase 0.5] Fix gateway-execute bug and BaseClient config mismatch`
**Labels:** `phase-0.5`, `priority-critical`, `type-bugfix`

**Description:**
Two confirmed bugs block tool execution:

**Bug 1: execute.js subtraction operator (CRITICAL)**
```
// Line 117: this.gateway-adapters.get(adapterId)
// This is JavaScript subtraction, NOT property access
// Fix: this.gateway.adapters.get(adapterId)
```

**Bug 2: BaseClient config key mismatch**
```
// BaseClient accepts baseUrl (camelCase)
// Some callers pass baseURL (uppercase L)
// Fix: accept both in BaseClient constructor
```

**Tasks:**
- [ ] Fix `src/mcp/discovery/tools/execute.js` lines 117 and 125
- [ ] Fix `core/base-client.js` to accept both `baseUrl` and `baseURL`
- [ ] Test `gateway-execute` can call supabase-edge-functions adapter

**Acceptance Criteria:**
- `gateway-execute` can locate and call an adapter by ID
- BaseClient works with both config key formats

**Files:**
- Modify: `src/mcp/discovery/tools/execute.js`
- Modify: `core/base-client.js`

---

### Issue #7: Update Catalog Schema for Real Adapter Loading
**Title:** `[Phase 0.5] Add adapter loading fields to catalog schema`
**Labels:** `phase-0.5`, `priority-high`, `type-infrastructure`

**Description:**
Add optional fields to catalog schema so `unified_gateway.js` can load real adapters dynamically.

**New fields for `mcpAdapters[]`:**
- `adapterPath` (string) -- path to .js file exporting adapter class
- `functionName` (string) -- Supabase Edge Function name
- `adapterRuntime` (enum: "cjs") -- always CommonJS
- `executable` (boolean) -- true for real adapters, false for mocks

**Tasks:**
- [ ] Update `schemas/catalog-schema.json` with new optional fields
- [ ] Verify existing catalog.json still validates (backwards compatible)

**Files:**
- Modify: `schemas/catalog-schema.json`

---

## Phase 1: Core Adapter System

### Issue #8: Create Universal Supabase Client
**Title:** `[Phase 1] Implement Universal Supabase Client`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`
**Blocks:** #12, #13, #14, #15, #16

**Description:**
Create `core/universal-supabase-client.js` that extends `BaseClient` for all Supabase Edge Function calls. Lives in `core/` alongside `base-client.js`.

**Tasks:**
- [ ] Create `core/universal-supabase-client.js` extending BaseClient
- [ ] Implement `call(functionName, payload, options)` method
- [ ] Always include `apikey: SUPABASE_ANON_KEY` header
- [ ] Support auth passthrough (caller's Authorization header)
- [ ] Support `X-Project-Scope` header forwarding
- [ ] Implement `healthCheck()` via `system-health` function
- [ ] Write unit tests

**Acceptance Criteria:**
- `call('memory-create', {...})` reaches actual Supabase Edge Function
- Auth headers correctly injected
- Inherits retry and circuit breaker from BaseClient
- Tests passing

**Files:**
- Create: `core/universal-supabase-client.js`
- Create: `tests/core/universal-supabase-client.test.js`

---

### Issue #9: Create Base MCP Adapter Class
**Title:** `[Phase 1] Implement Base MCP Adapter Class`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`
**Blocks:** #12, #13, #14, #15, #16

**Description:**
Create `core/base-mcp-adapter.js` -- abstract base class for all service adapters.

**Contract:**
- `initialize()` -- subclass MUST override to populate tools
- `callTool(toolName, args, context)` -- execute a tool (default delegates to client)
- `listTools()` -- return tool array
- `healthCheck()` -- delegate to client
- `getStats()` -- call count, error count, tool count

**Tasks:**
- [ ] Create `core/base-mcp-adapter.js`
- [ ] Implement default callTool routing through client
- [ ] Add stats tracking
- [ ] Write unit tests

**Files:**
- Create: `core/base-mcp-adapter.js`
- Create: `tests/core/base-mcp-adapter.test.js`

---

### Issue #10: Create Adapter Registry
**Title:** `[Phase 1] Implement Adapter Registry with O(1) Tool Lookup`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`
**Blocks:** #11

**Description:**
Create `src/mcp/adapter-registry.js` that manages adapter lifecycle and provides O(1) tool lookup with alias resolution.

**Key features:**
- Register real adapters (calls `initialize()`, indexes tools)
- Register mock adapters (non-executable placeholders)
- Tool index: canonical `adapter:tool-name` (kebab-case)
- Alias resolution: `snake_case` <-> `kebab-case`
- `callTool(toolId, args)` routes to correct adapter
- `toAdaptersMap()` feeds into existing OperationRegistry

**Tasks:**
- [ ] Create `src/mcp/adapter-registry.js`
- [ ] Implement `register(adapter)` with tool indexing
- [ ] Implement `registerMock(entry)` for placeholders
- [ ] Implement `resolveTool(toolId)` with alias resolution
- [ ] Implement `callTool(toolId, args, context)`
- [ ] Write unit tests

**Acceptance Criteria:**
- O(1) tool lookup
- Alias resolution works (snake_case <-> kebab-case)
- Mock adapters stored but not executable
- Integrates with existing OperationRegistry

**Files:**
- Create: `src/mcp/adapter-registry.js`
- Create: `tests/mcp/adapter-registry.test.js`

---

### Issue #11: Integrate Registry into unified_gateway.js
**Title:** `[Phase 1] Integrate Adapter Registry into Gateway`
**Labels:** `phase-1`, `priority-critical`, `type-infrastructure`
**Blocked by:** #10

**Description:**
Refactor `loadMCPAdapters()` to use AdapterRegistry. Three loading paths:
1. Explicit factory (supabase-edge-functions -- keep existing)
2. `adapterPath`-based loading (require JS file, register)
3. Mock fallback (registerMock)

**Tasks:**
- [ ] Import and instantiate AdapterRegistry in loadMCPAdapters
- [ ] Add adapterPath loading path alongside existing factory
- [ ] Route mocks through registerMock()
- [ ] Set `this.adapters = this.adapterRegistry.toAdaptersMap()` for backwards compat
- [ ] Update gateway-execute to route through registry
- [ ] Verify MCPDiscoveryLayer still initializes correctly

**Acceptance Criteria:**
- Supabase adapter still loads (no regression)
- adapterPath entries load via require()
- Mock adapters remain discoverable
- gateway-execute routes through registry
- All existing /health and /mcp endpoints work

**Files:**
- Modify: `unified_gateway.js` (loadMCPAdapters section)
- Modify: `src/mcp/discovery/tools/execute.js` (use registry for calls)

---

## Phase 1.5: Quick-Win Payment Adapters (NEW)

### Issue #12: Create Paystack JS Adapter
**Title:** `[Phase 1.5] Create runnable Paystack adapter via Supabase`
**Labels:** `phase-1.5`, `priority-high`, `service-payment`, `type-adapter`
**Blocked by:** #8, #9, #10

**Description:**
Create `services/paystack-payment-gateway/paystack-adapter.js` that routes through Supabase Edge Function `paystack` with `{ action: <toolName>, ...params }`.

Tool definitions derived from existing `paystack-mcp-adapter.ts` reference spec.

**Initial tools (10 high-priority):**
- `initialize-transaction`
- `verify-transaction`
- `list-transactions`
- `charge-authorization`
- `create-customer`
- `list-customers`
- `create-transfer-recipient`
- `initiate-transfer`
- `verify-account`
- `list-banks`

**Tasks:**
- [ ] Create `services/paystack-payment-gateway/paystack-adapter.js`
- [ ] Implement tool definitions with input schemas
- [ ] Implement callTool routing through UniversalSupabaseClient
- [ ] Update catalog.json: change type from "mock" to "live", add adapterPath
- [ ] Test at least 3 tools end-to-end via gateway-execute

**Acceptance Criteria:**
- Calls do NOT hit api.paystack.co directly from gateway
- Requests route through Supabase Edge Function
- gateway-intent returns Paystack for "charge a card in Nigeria"
- At least 3 tools execute end-to-end

**Files:**
- Create: `services/paystack-payment-gateway/paystack-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #13: Create Flutterwave JS Adapter
**Title:** `[Phase 1.5] Create runnable Flutterwave adapter via Supabase`
**Labels:** `phase-1.5`, `priority-high`, `service-payment`, `type-adapter`
**Blocked by:** #8, #9, #10

**Description:**
Same pattern as Paystack. Create `services/flutterwave-payment-gateway/flutterwave-adapter.js` routing through Edge Function `flutterwave`.

**Files:**
- Create: `services/flutterwave-payment-gateway/flutterwave-adapter.js`
- Modify: `services/catalog.json`

---

## Phase 2: Internal Services Integration

### Issue #14: Create Auth Gateway Adapter
**Title:** `[Phase 2] Implement Auth Gateway Service Adapter`
**Labels:** `phase-2`, `priority-critical`, `service-auth`, `type-adapter`
**Blocked by:** #9

**Description:**
Build `services/auth-gateway/auth-gateway-adapter.js`. Uses BaseClient (not UniversalSupabaseClient) since auth-gateway is a separate upstream service at AUTH_GATEWAY_URL.

**Tools:**
- `authenticate-user` -- Email/password login
- `validate-token` -- JWT/API key validation
- `refresh-token` -- Refresh JWT
- `generate-api-key` -- Create new API key
- `revoke-api-key` -- Revoke access
- `list-api-keys` -- List user's API keys
- `get-session` -- Get current session
- `logout` -- End session

**Files:**
- Create: `services/auth-gateway/auth-gateway-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #15: Create AI Router Adapter
**Title:** `[Phase 2] Implement AI Router Service Adapter`
**Labels:** `phase-2`, `priority-high`, `service-ai`, `type-adapter`
**Blocked by:** #8, #9

**Description:**
Build `services/ai-router/ai-router-adapter.js`. Routes to `ai-router` Edge Function or configured upstream URL.

**Tools:**
- `chat-completion` -- Multi-provider chat
- `generate-embedding` -- Text embeddings
- `stream-chat` -- Streaming chat
- `list-models` -- Available models

**Files:**
- Create: `services/ai-router/ai-router-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #16: Create Memory Service Adapter
**Title:** `[Phase 2] Implement Memory Service (MaaS) Adapter`
**Labels:** `phase-2`, `priority-high`, `service-memory`, `type-adapter`
**Blocked by:** #8, #9

**Description:**
Build `services/memory-as-a-service/memory-adapter.js`. Routes to 9 existing memory Edge Functions.

**Tools (each maps to a different Edge Function):**
- `create` -> `memory-create`
- `get` -> `memory-get`
- `update` -> `memory-update`
- `delete` -> `memory-delete`
- `list` -> `memory-list`
- `search` -> `memory-search`
- `stats` -> `memory-stats`
- `bulk-delete` -> `memory-bulk-delete`
- `health` -> `system-health`

**Files:**
- Create: `services/memory-as-a-service/memory-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #17: Create Intelligence API Adapter
**Title:** `[Phase 2] Implement Intelligence & Analytics API Adapter`
**Labels:** `phase-2`, `priority-high`, `service-intelligence`, `type-adapter`
**Blocked by:** #8, #9

**Description:**
Build `services/intelligence-api/intelligence-adapter.js`. Routes to 6 intelligence Edge Functions.

**Tools:**
- `suggest-tags` -> `intelligence-suggest-tags`
- `find-related` -> `intelligence-find-related`
- `detect-duplicates` -> `intelligence-detect-duplicates`
- `extract-insights` -> `intelligence-extract-insights`
- `analyze-patterns` -> `intelligence-analyze-patterns`
- `health-check` -> `intelligence-health-check`

**Files:**
- Create: `services/intelligence-api/intelligence-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #18: Create Security Service Adapter
**Title:** `[Phase 2] Implement Security & API Key Management Adapter`
**Labels:** `phase-2`, `priority-medium`, `service-security`, `type-adapter`
**Blocked by:** #8, #9

**Description:**
Build `services/security-service/security-adapter.js`. Maps to API key management Edge Functions.

**Tools:**
- `create-api-key` -> `api-key-create`
- `delete-api-key` -> `api-key-delete`
- `rotate-api-key` -> `api-key-rotate`
- `revoke-api-key` -> `api-key-revoke`
- `list-api-keys` -> `api-key-list`

**Files:**
- Create: `services/security-service/security-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #19: Create Verification Service Adapter (JS)
**Title:** `[Phase 2] Create JS Verification Service Adapter`
**Labels:** `phase-2`, `priority-medium`, `service-verification`, `type-adapter`
**Blocked by:** #8, #9

**Description:**
Create new `services/verification-service/verification-adapter.js` using existing `verification-mcp-adapter.ts` as reference for tool definitions.

**Files:**
- Create: `services/verification-service/verification-adapter.js`
- Modify: `services/catalog.json`

---

## Phase 3: Remaining Payment Services

### Issue #20: Create Stripe Adapter
**Title:** `[Phase 3] Create Stripe Payment Adapter`
**Labels:** `phase-3`, `priority-high`, `service-payment`, `type-adapter`

**Files:**
- Create: `services/---stripe-api--2024-04-10--postman-collection/stripe-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #21: Create SaySwitch Adapter
**Title:** `[Phase 3] Create SaySwitch Bills & Payment Adapter`
**Labels:** `phase-3`, `priority-medium`, `service-payment`, `type-adapter`

**Files:**
- Create: `services/sayswitch-api-integration-postman-collection/sayswitch-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #22: Create BAP Adapter
**Title:** `[Phase 3] Create BAP Payment Service Adapter`
**Labels:** `phase-3`, `priority-medium`, `service-payment`, `type-adapter`

**Files:**
- Create: `services/bap-postman-collection/bap-adapter.js`
- Modify: `services/catalog.json`

---

## Phase 4: Banking & Finance Services

### Issue #23: Create Providus Bank Adapter (JS)
**Title:** `[Phase 4] Create Providus Bank Adapter`
**Labels:** `phase-4`, `priority-high`, `service-banking`, `type-adapter`

**Description:**
New `.js` adapter using `services/providus-bank/mcp-adapter.ts` as reference.

**Files:**
- Create: `services/providus-bank/providus-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #24: Create Credit-as-a-Service Adapter
**Title:** `[Phase 4] Create Credit Service Adapter`
**Labels:** `phase-4`, `priority-medium`, `service-banking`, `type-adapter`

**Files:**
- Create: `services/credit-as-a-service/credit-adapter.js`
- Modify: `services/catalog.json`

---

### Issue #25: Create Xpress Wallet Adapter (JS)
**Title:** `[Phase 4] Create Xpress Wallet (WaaS) Adapter`
**Labels:** `phase-4`, `priority-medium`, `service-banking`, `type-adapter`

**Description:**
New `.js` adapter using `services/xpress-wallet-waas/xpress-wallet-mcp-adapter.ts` as reference.

**Files:**
- Create: `services/xpress-wallet-waas/xpress-wallet-adapter.js`
- Modify: `services/catalog.json`

---

## Phase 5: EDOC & Document Services

### Issue #26: Create EDOC Adapter
**Title:** `[Phase 5] Create Electronic Document (EDOC) Service Adapter`
**Labels:** `phase-5`, `priority-medium`, `service-edoc`, `type-adapter`

**Description:**
Build adapter for 11 EDOC Edge Functions.

**Files:**
- Create: `services/edoc-external-app-integration---for-clients-postman-collection/edoc-adapter.js`
- Modify: `services/catalog.json`

---

## Phase 6: Testing & Quality Assurance

### Issue #27: Core Module Unit Tests (Vitest)
**Title:** `[Phase 6] Unit tests for registry, client, and base adapter`
**Labels:** `phase-6`, `priority-critical`, `type-testing`

**Tasks:**
- [ ] AdapterRegistry: tool ID normalization, alias resolution, execution routing
- [ ] UniversalSupabaseClient: header injection, request shaping, retry behavior
- [ ] BaseMCPAdapter: lifecycle (initialize -> callTool -> healthCheck)
- [ ] Target: 80%+ coverage for core modules

---

### Issue #28: Integration Tests
**Title:** `[Phase 6] End-to-end integration testing`
**Labels:** `phase-6`, `priority-critical`, `type-testing`

**Tasks:**
- [ ] Gateway `/mcp` lazy mode: 5 meta-tools work
- [ ] `gateway-execute` routes through registry (not adapter iteration)
- [ ] Auth flow: token validation -> adapter execution
- [ ] Payment flow: intent -> execute -> Supabase -> external API
- [ ] Memory operations via gateway

---

### Issue #29: Preflight + Load Testing
**Title:** `[Phase 6] Preflight validation and performance benchmarks`
**Labels:** `phase-6`, `priority-high`, `type-testing`

**Tasks:**
- [ ] Preflight fails with actionable messages when env missing
- [ ] Concurrent request handling
- [ ] Latency benchmarks (target: < 500ms p95)
- [ ] Rate limiting verification
- [ ] Circuit breaker testing

---

### Issue #30: Security Audit
**Title:** `[Phase 6] Security audit and compliance review`
**Labels:** `phase-6`, `priority-critical`, `type-testing`

**Tasks:**
- [ ] Authentication testing
- [ ] Authorization and scope enforcement
- [ ] API key validation
- [ ] CORS verification
- [ ] Audit logging verification

---

## Phase 7: Deployment & Monitoring

### Issue #31: Production Deployment
**Title:** `[Phase 7] Deploy to Production (Railway)`
**Labels:** `phase-7`, `priority-critical`, `type-infrastructure`

**Tasks:**
- [ ] Run preflight in production environment
- [ ] Update Railway environment variables
- [ ] Deploy to Railway
- [ ] Verify health checks
- [ ] Test public MCP endpoints

---

### Issue #32: Monitoring & Alerting
**Title:** `[Phase 7] Configure production monitoring`
**Labels:** `phase-7`, `priority-critical`, `type-infrastructure`

**Tasks:**
- [ ] Metrics collection (adapter stats, tool execution times)
- [ ] Alert configuration (error rate, service down)
- [ ] Logging aggregation
- [ ] Dashboard creation

---

### Issue #33: Documentation
**Title:** `[Phase 7] Finalize all documentation`
**Labels:** `phase-7`, `priority-high`, `type-docs`

**Tasks:**
- [ ] API documentation per adapter
- [ ] Updated architecture diagrams
- [ ] Deployment and operations guide
- [ ] Troubleshooting guide

---

## Summary

**Total Issues:** 33

### By Phase:
| Phase | Issues | Focus |
|-------|--------|-------|
| Phase 0 | 2 | Architecture (DONE) |
| Phase 0.5 | 5 | Scaffolding, bugs, preflight |
| Phase 1 | 4 | Core adapter system |
| Phase 1.5 | 2 | Quick-win payments |
| Phase 2 | 6 | Internal services |
| Phase 3 | 3 | Remaining payments |
| Phase 4 | 3 | Banking |
| Phase 5 | 1 | Documents |
| Phase 6 | 4 | Testing |
| Phase 7 | 3 | Deployment |

### By Priority:
| Priority | Count |
|----------|-------|
| Critical | 14 |
| High | 12 |
| Medium | 7 |

### Dependency Chain (Critical Path):
```
#3 (dirs) + #6 (bugs) -> #8 (client) + #9 (adapter) + #10 (registry) -> #11 (gateway) -> #12 (paystack) -> #14-19 (services) -> #27-30 (tests) -> #31 (deploy)
```
