# Master Implementation Plan: Onasis Gateway Complete Integration

**Project:** Onasis Gateway - Unified API Gateway + MCP Server
**Repository:** https://github.com/thefixer3x/onasis-gateway
**Project Board:** https://github.com/users/thefixer3x/projects/2
**Date:** 2026-02-10
**Revised:** 2026-02-10 (v2 -- incorporates gap analysis + preflight strategy + centralisation intent)
**Status:** PLANNING -> EXECUTION
**Architecture References:**
- `docs/architecture/API-GATEWAY-CONSOLIDATION-PLAN.md` -- single gateway, Nginx routing
- `docs/architecture/centralisation-tasks.md` -- auth delegation, trust model, phased cutover
- `docs/architecture/supabase-api/DIRECT_API_ROUTES.md` -- Edge Function inventory (~80 functions)
- `middleware/onasis-auth-bridge.js` -- existing auth proxy to auth-gateway
- `docs/api-gateway-codemap.md` -- codebase analysis

---

## Revision Notes (v2)

This plan supersedes the original 7-phase plan. Key changes:

1. **Added Phase 0.5** -- Scaffolding, preflight checks, and known bug fixes that must happen before Phase 1 can execute. The original plan assumed directories and working code paths that do not exist.
2. **Added Phase 1.5** -- Quick-win payment adapter activation (Paystack + Flutterwave) immediately after core infrastructure, proving the system works end-to-end before wiring up all services.
3. **Moved UniversalSupabaseClient to `core/`** -- Keeps all client infrastructure alongside `base-client.js` where it belongs.
4. **All new adapters are CommonJS (.js)** -- The gateway runs Node.js without a TypeScript build step. Existing `.ts` adapter files are reference material for tool definitions, not runtime code.
5. **AdapterRegistry integrates with existing OperationRegistry** -- One registry system, not two competing ones.
6. **Fixed confirmed bugs** -- `execute.js` subtraction bug, BaseClient config key mismatch, auth URL normalization.

---

## Executive Summary

### The Core Problem

Three disconnected systems that should be one unified gateway:

```
CURRENT STATE (Broken):

+---------------------+     +----------------------+     +------------------------+
|  MCP Adapters       |     |  Service Clients     |     |  Supabase Edge Funcs   |
|  (Mock placeholders)|-X-  |  (Wrong URLs)        |-X-  |  (82 deployed, unused) |
|  1,604 fake tools   |     |  Point to external   |     |  Real backends ready   |
+---------------------+     +----------------------+     +------------------------+

TARGET STATE (Working):

+------------------------------------------------------------------------------+
|                        ONASIS GATEWAY (Port 3000)                            |
|                                                                              |
|  +---------------------------------------------------------------------+   |
|  |                   MCP DISCOVERY LAYER (5 meta-tools)                 |   |
|  |  gateway-intent -> gateway-execute -> gateway-adapters -> etc        |   |
|  +---------------------------------------------------------------------+   |
|                                    |                                         |
|  +---------------------------------------------------------------------+   |
|  |                     ADAPTER REGISTRY                                 |   |
|  |                                                                      |   |
|  |  +------------+  +-------------+  +--------------+  +----------+   |   |
|  |  | Supabase   |  | Auth        |  | Payment      |  | Banking  |   |   |
|  |  | Adapter    |  | Gateway     |  | Services     |  | Services |   |   |
|  |  | (82 funcs) |  | Adapter     |  | (Paystack,   |  | (Providus|   |   |
|  |  |            |  | (JWT,OAuth) |  |  Flutterwave)|  |  etc.)   |   |   |
|  |  +------------+  +-------------+  +--------------+  +----------+   |   |
|  +---------------------------------------------------------------------+   |
|                                    |                                         |
|  +---------------------------------------------------------------------+   |
|  |                     CORE INFRASTRUCTURE                              |   |
|  |  BaseClient (HTTP + Auth + Retry + Circuit Breaker)                 |   |
|  |  UniversalSupabaseClient (extends BaseClient for Edge Functions)     |   |
|  |  VendorAbstraction | MetricsCollector | ComplianceManager           |   |
|  +---------------------------------------------------------------------+   |
+------------------------------------------------------------------------------+
                                    |
                  +---------------------------------+
                  |    SUPABASE EDGE FUNCTIONS      |
                  |    (Single Source of Truth)      |
                  |                                  |
                  |  Memory API (9)  | Payments (20) |
                  |  AI & Chat (12)  | Auth (5)      |
                  |  Intelligence (6)| EDOC (11)     |
                  |  System (11)     | API Keys (5)  |
                  |                                  |
                  |  Total: ~80 Edge Functions       |
                  +---------------------------------+
```

### Key Architectural Principles

**1. Supabase Edge Functions ARE the backend, NOT a duplicate.**

**2. One endpoint. One gateway. No scattered endpoints across codebases.**

The entire reason for the API Gateway is centralisation (see `docs/architecture/API-GATEWAY-CONSOLIDATION-PLAN.md` and `docs/architecture/centralisation-tasks.md`). Services cannot have multiple endpoints coded all over the place. The gateway is the single entrypoint:

```
Client -> gateway.lanonasis.com/api/v1/{service}/{action}
       -> Nginx (CORS, rate limiting, TLS, logging)
       -> central-gateway :3000 (adapter routing, MCP discovery)
       -> Supabase Edge Function /functions/v1/{function-name}
       -> External vendor API (Paystack, Stripe, etc.)
       -> Response back up the chain
```

**3. Auth is delegated to auth-gateway, never duplicated.**

Per centralisation-tasks.md:
- Auth Gateway (`https://auth.lanonasis.com`, `:4000`) is the **single source of truth** for identity
- OnasisAuthBridge in central-gateway is a **thin proxy** -- calls auth-gateway introspection, no local JWT verification
- Auth-gateway returns verified context: `X-User-Id`, `X-User-Email`, `X-User-Role`, `X-Scopes`, `X-Session-Id`
- Central gateway attaches these headers to downstream requests
- Downstream services (Edge Functions, adapters) trust these headers when requests come from the gateway

The Gateway is a **routing and orchestration layer** that:
- Provides unified MCP interface for AI agents
- Delegates authentication to auth-gateway (never validates tokens itself)
- Routes to correct Supabase Edge Function
- Provides discovery, rate limiting, caching
- Aggregates multiple services behind one endpoint

Edge Functions handle:
- Business logic
- Database operations
- External API calls (Paystack, Stripe, etc.)
- Auth enforcement (validate forwarded tokens/headers via shared `auth.ts`)
- Data transformation

### Runtime Decision

**All new adapter code is CommonJS JavaScript (.js).**

Rationale: The gateway runs on Node.js without a TypeScript compilation step. Existing `.ts` adapter files in `services/` (e.g., `paystack-mcp-adapter.ts`, `verification-mcp-adapter.ts`) are treated as **reference specifications** for tool definitions and schemas. New runnable adapters are `.js` files that the gateway can `require()` directly.

---

## Current State Analysis

### What EXISTS and WORKS

1. **Core Infrastructure** (`/core`)
   - `BaseClient` -- Universal HTTP client with auth, retry, circuit breaker
   - `VendorAbstraction` -- Multi-provider routing
   - `MetricsCollector` -- Performance monitoring
   - `ComplianceManager` -- Security and audit
   - `VersionManager` -- API versioning

2. **Supabase Edge Functions** (~80 deployed and operational)
   - Memory API (9 functions)
   - Payment integrations (20 functions)
   - AI & Chat (12 functions)
   - Auth services (5 functions)
   - Intelligence API (6 functions)
   - EDOC (11 functions)
   - System utilities (11 functions)
   - API Key management (5 functions)

3. **MCP Discovery Layer** (5 meta-tools working)
   - `gateway-intent` -- Natural language to action
   - `gateway-execute` -- Execute tools
   - `gateway-adapters` -- List services
   - `gateway-tools` -- List tools
   - `gateway-reference` -- Documentation

4. **Supabase Auto-Discovery** (Working)
   - Discovers Edge Functions automatically from DIRECT_API_ROUTES.md
   - Generates MCP tools dynamically
   - Registers in discovery layer

5. **Existing TS Adapter Specs** (reference material, not runnable)
   - `services/paystack-payment-gateway/paystack-mcp-adapter.ts`
   - `services/flutterwave-payment-gateway/` (has client, no adapter file)
   - `services/providus-bank/mcp-adapter.ts`
   - `services/providus-bank-account/mcp-adapter.ts` + `.js`
   - `services/verification-service/verification-mcp-adapter.ts`
   - `services/xpress-wallet-waas/xpress-wallet-mcp-adapter.ts`

### What's BROKEN or INCOMPLETE

1. **Adapter Loading** -- Only one real factory exists (`supabase-edge-functions`)
   ```javascript
   // unified_gateway.js:444 -- everything else becomes a mock
   if (adapterEntry.type === 'mock' || adapterEntry.source === 'mock') {
       this.adapters.set(adapterEntry.id, {
           tools: adapterEntry.toolCount || 0,
           auth: adapterEntry.auth || 'apikey'
       });
   }
   ```

2. **gateway-execute Bug** -- Cannot call any adapter
   ```javascript
   // src/mcp/discovery/tools/execute.js:117
   const adapter = this.gateway-adapters.get(adapterId);
   // ^^^ JavaScript subtraction (this.gateway minus adapters), NOT property access
   // Should be: this.gateway.adapters.get(adapterId)
   ```

3. **Service Clients** -- Point to WRONG URLs
   ```javascript
   // paystack-client.js
   this.baseURL = 'https://api.paystack.co';  // Bypasses our backend
   // SHOULD BE:
   this.baseURL = process.env.SUPABASE_URL + '/functions/v1';
   ```

4. **Missing Directories** -- Plan Phase 1/2 reference paths that do not exist
   - `src/clients/` -- does not exist
   - `services/auth-gateway/` -- does not exist
   - `services/ai-router/` -- does not exist
   - `services/security-service/` -- does not exist
   - `services/intelligence-api/` -- does not exist

5. **Catalog Structure** -- Lacks fields for real adapter loading
   ```json
   // Current: no adapterPath, no functionName, no executable flag
   { "id": "paystack", "type": "mock", "toolCount": 117 }
   ```

6. **Auth URL Ambiguity** -- `AUTH_GATEWAY_URL` interpreted inconsistently
   - Sometimes treated as base URL, sometimes as `/v1/auth` endpoint
   - `buildAuthVerifyUrl()` has heuristic guessing logic

---

## Implementation Phases

### Phase 0: Architecture & Planning (COMPLETE)

**Duration:** 1 day
**Status:** DONE

#### Deliverables
1. `MASTER_IMPLEMENTATION_PLAN.md` (this document, v2)
2. `ARCHITECTURE.md` (system architecture)
3. `GITHUB_ISSUES.md` (issue templates for project board)
4. `api-gateway-codemap.md` (codebase analysis)
5. `MISSING_LINK_ANALYSIS.md` (gap analysis)

---

### Phase 0.5: Scaffolding + Preflight + Bug Fixes (NEW)

**Duration:** 0.5-1 day
**Dependencies:** None
**Risk:** Low
**Priority:** CRITICAL -- blocks all subsequent phases

This phase eliminates structural and environment blockers so Phase 1 is purely "implement code" rather than "discover missing folders and broken code paths".

#### Task 0.5.1: Create Missing Directory Structure

Create directories that Phase 1 and Phase 2 reference:

```
mkdir -p services/auth-gateway
mkdir -p services/ai-router
mkdir -p services/security-service
mkdir -p services/intelligence-api
```

Note: `src/clients/` is NOT created. UniversalSupabaseClient goes in `core/` alongside `base-client.js`.

**Acceptance Criteria:**
- All directories referenced by Phase 1 and Phase 2 tasks exist
- Each new service directory has a minimal `README.md` for git tracking

#### Task 0.5.2: Create Preflight Script

New file: `scripts/preflight.js`

Verifies before gateway startup:
- Required env vars are present:
  - `SUPABASE_URL` (required)
  - `SUPABASE_ANON_KEY` (required)
  - `SUPABASE_SERVICE_ROLE_KEY` (optional, warn if absent)
  - `AUTH_GATEWAY_URL` or `ONASIS_AUTH_API_URL` (optional, warn if absent)
- Supabase Edge Functions reachable:
  - `GET ${SUPABASE_URL}/functions/v1/system-health` with `apikey: SUPABASE_ANON_KEY`
- Auth Gateway reachable (if URL configured):
  - `GET ${AUTH_GATEWAY_URL}/health`
- Emits clear "ready / not ready" report

**Acceptance Criteria:**
- `npm run preflight` or `node scripts/preflight.js` produces actionable output
- Non-zero exit code if critical vars missing (SUPABASE_URL, SUPABASE_ANON_KEY)
- Warnings (not failures) for optional services not reachable

#### Task 0.5.3: Normalize Auth Gateway URL Semantics

Current: `buildAuthVerifyUrl()` in `unified_gateway.js:468-483` uses heuristic string matching.

Standardize to:
- `authGatewayBaseUrl` -- e.g., `http://127.0.0.1:4000`
- `authGatewayApiUrl` -- e.g., `http://127.0.0.1:4000/v1/auth`

Rules:
- If `AUTH_GATEWAY_URL` ends with `/v1/auth`, treat as `authGatewayApiUrl`, derive base by trimming
- Otherwise treat as base, derive api url by appending `/v1/auth`

**Files to Modify:**
- `unified_gateway.js` -- replace `buildAuthVerifyUrl()` with deterministic normalization

**Acceptance Criteria:**
- Auth proxy routes and token verification hit correct endpoints
- No "double /v1/auth" or missing path segments
- Works with both `http://127.0.0.1:4000` and `http://127.0.0.1:4000/v1/auth` as input

#### Task 0.5.4: Fix Known Execution Bugs

**Bug 1: execute.js subtraction operator**

File: `src/mcp/discovery/tools/execute.js:117,125`

```javascript
// BROKEN (subtraction):
const adapter = this.gateway-adapters.get(adapterId);
// FIX:
const adapter = this.gateway.adapters.get(adapterId);
```

Same fix on line 125:
```javascript
// BROKEN:
available_adapters: Array.from(this.gateway-adapters.keys())
// FIX:
available_adapters: Array.from(this.gateway.adapters.keys())
```

**Bug 2: BaseClient config key**

File: `core/base-client.js` accepts `baseUrl` (camelCase) in constructor config at line 16, but `unified_gateway.js:295-301` sometimes passes `baseURL` (uppercase L) when constructing clients from service JSON configs.

Fix: Normalize in BaseClient constructor to accept both:
```javascript
baseUrl: config.baseUrl || config.baseURL || '',
```

**Acceptance Criteria:**
- `gateway-execute` can locate and call an adapter by ID (tested with supabase-edge-functions)
- BaseClient accepts both `baseUrl` and `baseURL` without silent failure

#### Task 0.5.5: Update Catalog Schema for Real Adapter Loading

Add optional fields to `schemas/catalog-schema.json` for `mcpAdapters[]`:
- `adapterPath` (string) -- path to `.js` file that exports adapter class
- `functionName` (string) -- Supabase Edge Function name for routing
- `adapterRuntime` (enum: `"cjs"`) -- always CommonJS for now
- `executable` (boolean) -- `true` for real adapters, `false` for mocks

Do NOT change existing catalog entries yet -- that happens in Phase 1.4.

**Acceptance Criteria:**
- Schema validates existing catalog (backwards compatible)
- Schema accepts new fields when provided

#### Files Created/Modified in Phase 0.5
- Create: `services/auth-gateway/README.md`
- Create: `services/ai-router/README.md`
- Create: `services/security-service/README.md`
- Create: `services/intelligence-api/README.md`
- Create: `scripts/preflight.js`
- Modify: `unified_gateway.js` (auth URL normalization, BaseClient config fix)
- Modify: `src/mcp/discovery/tools/execute.js` (property access fix)
- Modify: `core/base-client.js` (accept both baseUrl and baseURL)
- Modify: `schemas/catalog-schema.json` (add optional adapter fields)

---

### Phase 1: Core Adapter System (Foundation)

**Duration:** 2-3 days
**Dependencies:** Phase 0.5
**Risk:** Low
**Priority:** CRITICAL

Build the universal adapter foundation that all services will use.

#### Task 1.1: Create Universal Supabase Client

**File:** `core/universal-supabase-client.js`

Placed in `core/` alongside `base-client.js` where all client infrastructure lives.

```javascript
// core/universal-supabase-client.js
const BaseClient = require('./base-client');

class UniversalSupabaseClient extends BaseClient {
  constructor(config) {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required for UniversalSupabaseClient');
    }

    const useServiceRole = !!config.serviceRole;
    const selectedKey = useServiceRole
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.SUPABASE_ANON_KEY;

    if (!selectedKey) {
      throw new Error(
        useServiceRole
          ? 'SUPABASE_SERVICE_ROLE_KEY is required when config.serviceRole=true'
          : 'SUPABASE_ANON_KEY is required when config.serviceRole=false'
      );
    }

    super({
      name: config.serviceName || 'supabase',
      baseUrl: process.env.SUPABASE_URL + '/functions/v1',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 2,
      authentication: {
        type: 'bearer',
        config: {
          token: selectedKey
        }
      }
    });
    this.defaultFunctionName = config.functionName;
    this.selectedApiKey = selectedKey;
  }

  /**
   * Call a Supabase Edge Function.
   * Each Edge Function is a separate Deno.serve() entry point (NOT action dispatch).
   * e.g., call("memory-create", { title, content }) -> POST /functions/v1/memory-create
   *
   * @param {string} functionName - Edge Function slug (e.g. "memory-create", "intelligence-suggest-tags")
   * @param {object} payload - Request body (passed directly to the function)
   * @param {object} [options] - Additional headers, method override, auth passthrough
   */
  async call(functionName, payload = {}, options = {}) {
    const fn = functionName || this.defaultFunctionName;
    return this.request({
      path: `/${fn}`,
      method: options.method || 'POST'
    }, {
      data: payload,
      headers: {
        'apikey': this.selectedApiKey,
        ...(options.authorization && { 'Authorization': options.authorization }),
        ...(options.apiKey && { 'X-API-Key': options.apiKey }),
        ...(options.projectScope && { 'X-Project-Scope': options.projectScope }),
        ...options.headers
      }
    });
  }

  async healthCheck() {
    try {
      const result = await this.call('system-health', {}, { method: 'GET' });
      return { healthy: true, data: result };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = UniversalSupabaseClient;
```

**Acceptance Criteria:**
- Extends BaseClient correctly (inherits retry, circuit breaker, auth injection)
- `call('memory-create', { ... })` reaches the actual Supabase Edge Function
- `apikey` header always present
- Auth passthrough works (caller's Authorization forwarded)
- Unit tests passing

#### Task 1.2: Create Base MCP Adapter Class

**File:** `core/base-mcp-adapter.js`

```javascript
// core/base-mcp-adapter.js
class BaseMCPAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.client = config.client; // UniversalSupabaseClient, BaseClient, or custom
    this.tools = [];
    this.metadata = {
      category: config.category || 'general',
      capabilities: config.capabilities || [],
      ...config.metadata
    };
    this._initialized = false;
    this._stats = { calls: 0, errors: 0, lastCall: null };
  }

  /**
   * Initialize the adapter: load tool definitions, verify connectivity.
   * Subclasses MUST override this to populate this.tools.
   */
  async initialize() {
    throw new Error(`${this.id}: initialize() must be implemented by subclass`);
  }

  /**
   * Execute a tool by name.
   * Subclasses SHOULD override for custom routing logic.
   * Default implementation delegates to this.client.call().
   */
  async callTool(toolName, args, context = {}) {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in adapter '${this.id}'`);
    }
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    try {
      return await this.client.call(toolName, args, context);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }

  listTools() {
    return this.tools;
  }

  async healthCheck() {
    if (this.client && typeof this.client.healthCheck === 'function') {
      return this.client.healthCheck();
    }
    return { healthy: true, adapter: this.id, note: 'no client health check' };
  }

  getStats() {
    return { ...this._stats, toolCount: this.tools.length, initialized: this._initialized };
  }
}

module.exports = BaseMCPAdapter;
```

**Acceptance Criteria:**
- Subclasses can override `initialize()` and `callTool()`
- Default `callTool()` routes through `this.client.call()`
- `listTools()` returns tool array in MCP-compatible format
- `healthCheck()` delegates to client
- Stats tracking works

#### Task 1.3: Create Adapter Registry

**File:** `src/mcp/adapter-registry.js`

This registry manages adapter lifecycle and provides O(1) tool lookup. It **feeds into** the existing `OperationRegistry` (at `src/mcp/discovery/registry/index.js`) rather than replacing it. The flow is:

```
AdapterRegistry (manages adapters + tool index)
       |
       v
OperationRegistry (indexes operations for discovery search)
       |
       v
MCPDiscoveryLayer (5 meta-tools use OperationRegistry for queries)
```

```javascript
// src/mcp/adapter-registry.js
class AdapterRegistry {
  constructor() {
    this.adapters = new Map();      // adapterId -> adapter instance
    this.toolIndex = new Map();     // "adapter:tool" -> { adapterId, tool }
    this.aliases = new Map();       // normalized aliases for lookup
  }

  /**
   * Register an adapter: initialize it, index its tools.
   */
  async register(adapter) {
    if (!adapter._initialized) {
      await adapter.initialize();
      adapter._initialized = true;
    }
    this.adapters.set(adapter.id, adapter);

    // Index all tools with canonical "adapter:tool-name" IDs (kebab-case)
    for (const tool of adapter.tools) {
      if (tool.name.includes('-') && tool.name.includes('_')) {
        throw new Error(
          `Invalid tool name '${tool.name}' in adapter '${adapter.id}'. ` +
          'Tool names must use only one separator style ("-" or "_"), not both.'
        );
      }
      const canonicalId = `${adapter.id}:${tool.name}`;
      this.toolIndex.set(canonicalId, { adapterId: adapter.id, tool });

      // Register aliases: snake_case <-> kebab-case
      const snakeAlias = `${adapter.id}:${tool.name.replace(/-/g, '_')}`;
      const kebabAlias = `${adapter.id}:${tool.name.replace(/_/g, '-')}`;
      if (snakeAlias !== canonicalId) this.aliases.set(snakeAlias, canonicalId);
      if (kebabAlias !== canonicalId) this.aliases.set(kebabAlias, canonicalId);
    }

    return adapter;
  }

  /**
   * Register a mock (non-executable) adapter placeholder.
   */
  registerMock(entry) {
    this.adapters.set(entry.id, {
      id: entry.id,
      name: entry.name,
      tools: [],
      toolCount: entry.toolCount || 0,
      is_mock: true,
      executable: false,
      metadata: { category: entry.category, authType: entry.authType }
    });
  }

  getAdapter(id) {
    return this.adapters.get(id);
  }

  /**
   * Resolve a tool ID, including alias resolution.
   */
  resolveTool(toolId) {
    let entry = this.toolIndex.get(toolId);
    if (!entry) {
      const canonical = this.aliases.get(toolId);
      if (canonical) entry = this.toolIndex.get(canonical);
    }
    return entry || null;
  }

  /**
   * Execute a tool by canonical or aliased ID.
   */
  async callTool(toolId, args, context = {}) {
    const entry = this.resolveTool(toolId);
    if (!entry) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    const adapter = this.adapters.get(entry.adapterId);
    if (!adapter || adapter.is_mock) {
      throw new Error(`Adapter '${entry.adapterId}' is not executable (mock)`);
    }
    return adapter.callTool(entry.tool.name, args, context);
  }

  /**
   * Get all adapters as an array (for OperationRegistry.buildFromAdapters).
   */
  toAdaptersMap() {
    return this.adapters;
  }

  getStats() {
    const real = [...this.adapters.values()].filter(a => !a.is_mock).length;
    const mock = [...this.adapters.values()].filter(a => a.is_mock).length;
    return {
      totalAdapters: this.adapters.size,
      realAdapters: real,
      mockAdapters: mock,
      indexedTools: this.toolIndex.size,
      aliases: this.aliases.size
    };
  }
}

module.exports = AdapterRegistry;
```

**Acceptance Criteria:**
- `register(adapter)` calls `adapter.initialize()` and indexes all tools
- `resolveTool("paystack:initialize-transaction")` returns in O(1)
- `resolveTool("paystack:initialize_transaction")` resolves via alias
- `callTool()` routes to correct adapter without scanning
- Mock adapters are stored but not executable
- `toAdaptersMap()` returns the Map that OperationRegistry expects

#### Task 1.4: Integrate Registry into unified_gateway.js

Modify `loadMCPAdapters()` to:
1. Create `this.adapterRegistry = new AdapterRegistry()`
2. Keep the existing `supabase-edge-functions` factory (it works)
3. Add a new factory path for `adapterPath`-based loading
4. Route mock entries through `registerMock()`
5. Pass `this.adapterRegistry.toAdaptersMap()` to MCPDiscoveryLayer

```javascript
// unified_gateway.js -- revised loadMCPAdapters()
async loadMCPAdapters() {
    const AdapterRegistry = require('./src/mcp/adapter-registry');
    this.adapterRegistry = new AdapterRegistry();

    const catalogAdapters = Array.isArray(this.serviceCatalog?.mcpAdapters)
        && this.serviceCatalog.mcpAdapters.length > 0
        ? this.serviceCatalog.mcpAdapters.filter(a => a.enabled !== false)
        : buildDefaultMcpCatalog();

    // Existing Supabase factory (keep as-is)
    const adapterFactories = {
        'supabase-edge-functions': async ({ gateway, adapterEntry }) => {
            // ... existing supabase initialization code unchanged ...
            // After initialization:
            // gateway.adapterRegistry.adapters.set('supabase-edge-functions', supabaseAdapter);
        },
        supabase: async (ctx) => adapterFactories['supabase-edge-functions'](ctx)
    };

    for (const adapterEntry of catalogAdapters) {
        if (!adapterEntry || !adapterEntry.id) continue;

        // 1. Check for explicit factory
        const factory = adapterFactories[adapterEntry.id]
            || (adapterEntry.type && adapterFactories[adapterEntry.type]);
        if (factory) {
            try {
                await factory({ gateway: this, adapterEntry });
            } catch (error) {
                console.warn(`${adapterEntry.id} adapter failed:`, error.message);
            }
            continue;
        }

        // 2. Check for adapterPath (real adapter with JS file)
        if (adapterEntry.adapterPath) {
            try {
                const AdapterClass = require(adapterEntry.adapterPath);
                const adapter = new AdapterClass(adapterEntry);
                await this.adapterRegistry.register(adapter);
                console.log(`Loaded ${adapterEntry.id} (${adapter.tools.length} tools)`);
            } catch (error) {
                console.warn(`${adapterEntry.id} adapter failed to load:`, error.message);
                this.adapterRegistry.registerMock(adapterEntry);
            }
            continue;
        }

        // 3. Mock adapter (fallback)
        this.adapterRegistry.registerMock(adapterEntry);
    }

    // Backwards compat: keep this.adapters pointing to registry's map
    this.adapters = this.adapterRegistry.toAdaptersMap();

    const stats = this.adapterRegistry.getStats();
    console.log(`Loaded ${stats.totalAdapters} adapters (${stats.realAdapters} real, ${stats.mockAdapters} mock, ${stats.indexedTools} tools indexed)`);

    // Initialize MCP Discovery Layer using the registry's adapter map
    if (this.mcpToolMode === 'lazy') {
        try {
            this.discoveryLayer = new MCPDiscoveryLayer(this, this.adapters);
            console.log('MCP Discovery Layer initialized (5 meta-tools active)');
        } catch (error) {
            console.warn(`Discovery Layer failed: ${error.message}`);
            this.mcpToolMode = 'full';
        }
    }
}
```

**Acceptance Criteria:**
- Supabase adapter still loads and works (no regression)
- Adapters with `adapterPath` in catalog are loaded via `require()`
- Mock adapters stored as non-executable placeholders
- `this.adapters` still works for existing code that references it
- Discovery layer initializes with real + mock adapters
- `gateway-execute` routes through registry's `callTool()`

#### Task 1.5: Update Catalog with Schema Fields

Add the new fields to existing mock entries that will become real adapters in Phase 1.5+. Leave entries as `"type": "mock"` until their adapter code exists.

Add two entries for the upcoming Phase 1.5 quick-win adapters:
```json
{
  "id": "paystack",
  "name": "Paystack API",
  "type": "mock",
  "adapterPath": null,
  "functionName": "paystack",
  "executable": false,
  "enabled": true,
  "toolCount": 117,
  "authType": "bearer",
  "category": "payments"
}
```

The `adapterPath` and `executable` fields are set to `null`/`false` until Phase 1.5 creates the actual adapter files.

**Files to Create/Modify in Phase 1:**
- Create: `core/universal-supabase-client.js`
- Create: `core/base-mcp-adapter.js`
- Create: `src/mcp/adapter-registry.js`
- Create: `tests/core/universal-supabase-client.test.js`
- Create: `tests/core/base-mcp-adapter.test.js`
- Create: `tests/mcp/adapter-registry.test.js`
- Modify: `unified_gateway.js` (loadMCPAdapters refactor)
- Modify: `src/mcp/discovery/tools/execute.js` (use registry for tool calls)
- Modify: `services/catalog.json` (add new fields to entries)

---

### Phase 1.5: Quick-Win Payment Adapters (NEW)

**Duration:** 1-2 days
**Dependencies:** Phase 1
**Risk:** Low
**Priority:** HIGH -- proves the system works end-to-end

Create runnable JS adapters for Paystack and Flutterwave that route through Supabase Edge Functions. This validates the entire stack (catalog -> registry -> adapter -> client -> Edge Function -> external API) before building all remaining adapters.

#### Task 1.5.1: Create Paystack Adapter (JS)

**File:** `services/paystack-payment-gateway/paystack-adapter.js`

Execution model: Calls Supabase Edge Function `paystack` with `{ action: <toolName>, ...params }`.

Tool definitions: Derived from the existing `paystack-mcp-adapter.ts` reference spec.

```javascript
// services/paystack-payment-gateway/paystack-adapter.js
const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

class PaystackAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    super({
      id: 'paystack',
      name: 'Paystack Payment Gateway',
      description: 'African payment processing via Paystack',
      category: 'payments',
      capabilities: ['payments', 'transfers', 'verification', 'subscriptions'],
      client: new UniversalSupabaseClient({
        serviceName: 'paystack',
        functionName: 'paystack'
      }),
      ...config
    });
  }

  async initialize() {
    // Core tools -- expand from paystack-mcp-adapter.ts reference
    this.tools = [
      { name: 'initialize-transaction', description: 'Initialize a payment transaction', inputSchema: { type: 'object', properties: { email: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', default: 'NGN' } }, required: ['email', 'amount'] } },
      { name: 'verify-transaction', description: 'Verify a transaction by reference', inputSchema: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] } },
      { name: 'list-transactions', description: 'List transactions', inputSchema: { type: 'object', properties: { perPage: { type: 'number' }, page: { type: 'number' } } } },
      { name: 'charge-authorization', description: 'Charge a saved card authorization', inputSchema: { type: 'object', properties: { email: { type: 'string' }, amount: { type: 'number' }, authorization_code: { type: 'string' } }, required: ['email', 'amount', 'authorization_code'] } },
      { name: 'create-customer', description: 'Create a new customer', inputSchema: { type: 'object', properties: { email: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' } }, required: ['email'] } },
      { name: 'list-customers', description: 'List customers', inputSchema: { type: 'object', properties: { perPage: { type: 'number' }, page: { type: 'number' } } } },
      { name: 'create-transfer-recipient', description: 'Create a transfer recipient', inputSchema: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' }, account_number: { type: 'string' }, bank_code: { type: 'string' } }, required: ['type', 'name', 'account_number', 'bank_code'] } },
      { name: 'initiate-transfer', description: 'Initiate a money transfer', inputSchema: { type: 'object', properties: { source: { type: 'string', default: 'balance' }, amount: { type: 'number' }, recipient: { type: 'string' }, reason: { type: 'string' } }, required: ['amount', 'recipient'] } },
      { name: 'verify-account', description: 'Verify a bank account number', inputSchema: { type: 'object', properties: { account_number: { type: 'string' }, bank_code: { type: 'string' } }, required: ['account_number', 'bank_code'] } },
      { name: 'list-banks', description: 'List supported banks', inputSchema: { type: 'object', properties: { country: { type: 'string', default: 'nigeria' } } } }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    try {
      // Route through Supabase Edge Function.
      // NOTE: The exact invocation contract for the `paystack` Edge Function
      // must be verified in Phase 0.5 preflight. Two possibilities:
      //
      // Option A (action dispatch): POST /functions/v1/paystack
      //   body: { action: "initialize-transaction", ...args }
      //
      // Option B (direct payload): POST /functions/v1/paystack
      //   body: { endpoint: "/transaction/initialize", method: "POST", data: args }
      //
      // This adapter will be finalized after contract verification.
      return await this.client.call('paystack', {
        action: toolName,
        ...args
      }, context);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = PaystackAdapter;
```

#### Task 1.5.2: Create Flutterwave Adapter (JS)

**File:** `services/flutterwave-payment-gateway/flutterwave-adapter.js`

Same pattern as Paystack. Calls Edge Function `flutterwave` with `{ action: <toolName>, ...params }`.

#### Task 1.5.3: Update Catalog Entries

Change Paystack and Flutterwave from mock to live:

```json
{
  "id": "paystack",
  "name": "Paystack API",
  "type": "live",
  "adapterPath": "./services/paystack-payment-gateway/paystack-adapter.js",
  "functionName": "paystack",
  "executable": true,
  "enabled": true,
  "toolCount": 10,
  "authType": "bearer",
  "category": "payments",
  "supportedCountries": ["NG", "GH", "ZA", "KE"]
},
{
  "id": "flutterwave-v3",
  "name": "Flutterwave v3 API",
  "type": "live",
  "adapterPath": "./services/flutterwave-payment-gateway/flutterwave-adapter.js",
  "functionName": "flutterwave",
  "executable": true,
  "enabled": true,
  "toolCount": 10,
  "authType": "bearer",
  "category": "payments",
  "supportedCountries": ["NG", "GH", "KE", "ZA"]
}
```

#### Task 1.5.4: End-to-End Validation

Test at least 3 representative tools per adapter through the full stack:

1. `gateway-execute` with `tool_id: "paystack:initialize-transaction"` -- should reach Supabase, which calls Paystack API
2. `gateway-execute` with `tool_id: "paystack:list-banks"` -- read-only, safe test
3. `gateway-intent` with `query: "charge a card in Nigeria"` -- should recommend paystack adapter

**Acceptance Criteria:**
- Calls do NOT hit `api.paystack.co` or `api.flutterwave.com` directly from the gateway
- Requests route through Supabase Edge Functions
- At least 3 tools per adapter execute end-to-end
- `gateway-intent` returns Paystack/Flutterwave results for relevant queries
- Error responses are structured and actionable

**Files to Create/Modify in Phase 1.5:**
- Create: `services/paystack-payment-gateway/paystack-adapter.js`
- Create: `services/flutterwave-payment-gateway/flutterwave-adapter.js`
- Modify: `services/catalog.json` (update paystack + flutterwave entries)

---

### Phase 2: Internal Services Integration

**Duration:** 3-4 days
**Dependencies:** Phase 1
**Risk:** Low
**Priority:** CRITICAL

Connect all internal services that are ready to deploy.

#### Task 2.1: Auth Gateway Adapter

**File:** `services/auth-gateway/auth-gateway-adapter.js`

This adapter calls the **existing** Auth Gateway upstream service (NOT Supabase). The auth-gateway is:
- **Production:** `https://auth.lanonasis.com` (PM2 managed, cluster mode)
- **Source:** `/opt/lanonasis/lan-onasis-monorepo/apps/onasis-core/services/auth-gateway`
- **Bridge:** `middleware/onasis-auth-bridge.js` already proxies JWT validation (`GET /session`) and API key validation (`POST /api-keys/verify`)

The adapter extends BaseMCPAdapter and uses BaseClient pointed at `AUTH_GATEWAY_URL`. It wraps the same endpoints the OnasisAuthBridge already calls, but exposes them as MCP tools for AI agents.

Tools: `authenticate-user`, `validate-token`, `refresh-token`, `generate-api-key`, `revoke-api-key`, `list-api-keys`, `get-session`, `logout`

#### Task 2.2: AI Router Adapter

**File:** `services/ai-router/ai-router-adapter.js`

Calls `ai-router` Edge Function OR configured upstream URL depending on environment.

Tools: `chat-completion`, `generate-embedding`, `stream-chat`, `list-models`

#### Task 2.3: Memory Service Adapter

**File:** `services/memory-as-a-service/memory-adapter.js`

Routes to 9 existing memory Edge Functions via UniversalSupabaseClient.

Tools: `create`, `get`, `update`, `delete`, `list`, `search`, `stats`, `bulk-delete`, `health`

Each tool maps to a **separate** Edge Function (e.g., `memory-create`, `memory-get`, etc.).
This is NOT action dispatch -- each function is its own Deno.serve() entry point.

```javascript
async callTool(toolName, args, context = {}) {
    // Map tool name to its dedicated Edge Function
    const functionMap = {
      'create': 'memory-create',
      'get': 'memory-get',
      'update': 'memory-update',
      'delete': 'memory-delete',
      'list': 'memory-list',
      'search': 'memory-search',
      'stats': 'memory-stats',
      'bulk-delete': 'memory-bulk-delete',
      'health': 'system-health'
    };
    const functionName = functionMap[toolName] || `memory-${toolName}`;
    return this.client.call(functionName, args, context);
}
```

#### Task 2.4: Intelligence API Adapter

**File:** `services/intelligence-api/intelligence-adapter.js`

Routes to 6 intelligence Edge Functions.

Tools: `suggest-tags`, `find-related`, `detect-duplicates`, `extract-insights`, `analyze-patterns`, `health-check`

#### Task 2.5: Security Service Adapter

**File:** `services/security-service/security-adapter.js`

Maps to API key management and verification Edge Functions.

Tools: `create-api-key`, `delete-api-key`, `rotate-api-key`, `revoke-api-key`, `list-api-keys`, `verify-token`

#### Task 2.6: Verification Service Adapter

**File:** `services/verification-service/verification-adapter.js`

New `.js` adapter using the existing `verification-mcp-adapter.ts` as reference for tool definitions.

#### Task 2.7: Update Catalog

Add all 6 internal service adapters to `services/catalog.json` with `type: "live"`, `adapterPath`, and `executable: true`.

**Acceptance Criteria:**
- All 6 internal services have functional `.js` adapters
- Each adapter has tool list, health check, and uses auth context
- Memory Service: all 9 functions accessible via gateway
- Intelligence API: all 6 functions accessible
- Auth Gateway: token validation and API key management work
- All services registered in catalog with `type: "live"`
- Integration tests passing

**Files to Create/Modify in Phase 2:**
- Create: `services/auth-gateway/auth-gateway-adapter.js`
- Create: `services/ai-router/ai-router-adapter.js`
- Create: `services/memory-as-a-service/memory-adapter.js`
- Create: `services/intelligence-api/intelligence-adapter.js`
- Create: `services/security-service/security-adapter.js`
- Create: `services/verification-service/verification-adapter.js`
- Modify: `services/catalog.json`

---

### Phase 3: Payment Services (Remaining)

**Duration:** 2-3 days
**Dependencies:** Phase 1.5 (Paystack + Flutterwave already done)
**Risk:** Medium
**Priority:** HIGH

#### Task 3.1: Stripe Adapter

**File:** `services/---stripe-api--2024-04-10--postman-collection/stripe-adapter.js`

Routes to `stripe` Edge Function. Tool definitions derived from existing Postman collection.

#### Task 3.2: SaySwitch Adapter

**File:** `services/sayswitch-api-integration-postman-collection/sayswitch-adapter.js`

Routes to `sayswitch` Edge Function.

#### Task 3.3: BAP Adapter

**File:** `services/bap-postman-collection/bap-adapter.js`

Routes to relevant Edge Function.

#### Task 3.4: Seftec Payment Adapter

**File:** `services/seftec-payment-collection/seftec-adapter.js`

**Acceptance Criteria:**
- All remaining payment services have adapters
- Catalog updated from mock to live for each
- End-to-end payment flows tested
- Webhook handling verified where applicable

---

### Phase 4: Banking & Finance Services

**Duration:** 2-3 days
**Dependencies:** Phase 1
**Risk:** Medium
**Priority:** HIGH

#### Task 4.1: Providus Bank Adapter (JS)

New `.js` adapter using `services/providus-bank/mcp-adapter.ts` as reference.

#### Task 4.2: Credit-as-a-Service Adapter

**File:** `services/credit-as-a-service/credit-adapter.js`

#### Task 4.3: Xpress Wallet Adapter (JS)

New `.js` adapter using `services/xpress-wallet-waas/xpress-wallet-mcp-adapter.ts` as reference.

#### Task 4.4: Open Banking Adapter

**File:** `services/open-banking-api-postman-collection/open-banking-adapter.js`

**Acceptance Criteria:**
- All banking services connected via Supabase
- Account operations, transfers, balance checks working
- Credit API functional
- WaaS features operational

---

### Phase 5: EDOC & Document Services

**Duration:** 1-2 days
**Dependencies:** Phase 1
**Risk:** Low
**Priority:** MEDIUM

#### Task 5.1: EDOC Adapter

**File:** `services/edoc-external-app-integration---for-clients-postman-collection/edoc-adapter.js`

Routes to 11 EDOC Edge Functions. Tools: `init-consent`, `consent-status`, `delete-consent`, `get-transactions`, `dashboard-data`, `webhook-handler`, etc.

**Acceptance Criteria:**
- All 11 EDOC functions accessible
- Consent management working
- Transaction tracking operational

---

### Phase 6: Testing & Quality Assurance

**Duration:** 3-4 days
**Dependencies:** All previous phases
**Risk:** Low
**Priority:** CRITICAL

#### Task 6.1: Unit Tests (Vitest)

- AdapterRegistry: tool ID normalization, alias resolution, adapter execution routing
- UniversalSupabaseClient: header injection, request shaping, retry behavior
- BaseMCPAdapter: lifecycle (initialize -> callTool -> healthCheck)
- Each service adapter: tool list completeness, callTool routing

#### Task 6.2: Integration Tests

- Gateway `/mcp` lazy mode: all 5 meta-tools work
- `gateway-execute` routes through registry (not adapter iteration)
- End-to-end flows for each service category
- Auth flow: token validation -> adapter execution -> response
- Payment flow: intent -> execute -> Supabase -> external API

#### Task 6.3: Preflight Tests

- Preflight script fails with actionable messaging when env is missing
- Preflight script passes when environment is correctly configured

#### Task 6.4: Load & Performance Tests

- Concurrent request handling
- Rate limiting verification
- Circuit breaker testing
- Latency benchmarks (target: < 500ms p95)

#### Task 6.5: Security Audit

- Authentication testing
- Authorization and scope enforcement
- API key validation
- CORS verification
- Audit logging verification

**Acceptance Criteria:**
- 80%+ code coverage for core modules (registry, client, base adapter)
- All integration tests passing
- Performance benchmarks met
- Security audit completed

---

### Phase 7: Deployment & Monitoring

**Duration:** 2-3 days
**Dependencies:** Phase 6
**Risk:** Medium
**Priority:** CRITICAL

#### Task 7.1: Railway Deployment

- Update environment variables in Railway
- Deploy to Railway
- Verify health checks
- Run preflight in production environment
- Test public MCP endpoints

#### Task 7.2: Monitoring Setup

- Metrics collection (adapter stats, tool execution times)
- Alert configuration (error rate > threshold, service down)
- Logging aggregation
- Dashboard creation

#### Task 7.3: Documentation

- API documentation for each adapter
- Updated architecture diagrams
- Deployment and operations guide
- Troubleshooting guide

**Acceptance Criteria:**
- Gateway deployed and accessible
- All services operational via MCP
- Monitoring dashboards live
- Alerts configured
- Documentation complete

---

## Phase Dependency Graph

```
Phase 0 (DONE)
    |
Phase 0.5 (scaffolding, bugs, preflight)
    |
Phase 1 (core: client, adapter, registry)
    |
    +---> Phase 1.5 (quick-win: Paystack + Flutterwave)
    |
    +---> Phase 2 (internal services)
    |         |
    |         +---> Phase 3 (remaining payments)
    |
    +---> Phase 4 (banking)
    |
    +---> Phase 5 (EDOC)
    |
    +---> Phase 6 (testing -- after 1.5 through 5)
              |
              Phase 7 (deployment)
```

Phases 2, 3, 4, and 5 can run in parallel after Phase 1. Phase 6 runs after all adapter phases complete. Phase 7 follows testing.

---

## Success Metrics

### Before (Current State)
| Metric | Value |
|--------|-------|
| Functional Tools | 82 (~5% of target) |
| Services Connected | 1 (Supabase auto-discovery only) |
| Mock Adapters | 18 (non-executable placeholders) |
| gateway-execute | Broken (subtraction bug) |
| Payment routing | Direct to external APIs (bypasses backend) |

### After (Target State)
| Metric | Value |
|--------|-------|
| Functional Tools | 200+ real tools (expandable via Edge Function discovery) |
| Services Connected | 15+ (all deployed services) |
| Real Adapters | 15+ (executable via registry) |
| gateway-execute | Routes through AdapterRegistry |
| Payment routing | Through Supabase Edge Functions |
| Tool Execution | O(1) lookup via registry + aliases |

### Key Performance Indicators
- Tool Execution Success Rate: > 99%
- Average Response Time: < 500ms
- Uptime: > 99.9%
- Error Rate: < 0.1%

---

## Assumptions and Defaults

- Default mode remains `MCP_TOOL_MODE=lazy`
- Auth enforced via Auth Gateway by default; `MCP_REQUIRE_AUTH` flag available for local dev without auth
- Supabase function inventory source of truth is `DIRECT_API_ROUTES.md` (currently lists ~80 functions)
- All new adapter code is CommonJS JavaScript (`.js`), loadable via `require()`
- Existing `.ts` files in `services/` are reference specs for tool definitions, not runtime code
- `toolCount` values in catalog (e.g., 117 for Paystack) represent the full API surface; initial adapters may expose a subset of high-priority tools and expand iteratively

---

## GitHub Project Board Structure

**Columns:**
1. Backlog
2. Ready
3. In Progress
4. In Review
5. Done

**Labels:**
- Phase: `phase-0`, `phase-0.5`, `phase-1`, `phase-1.5`, `phase-2` through `phase-7`
- Priority: `priority-critical`, `priority-high`, `priority-medium`
- Type: `type-infrastructure`, `type-adapter`, `type-testing`, `type-bugfix`, `type-docs`
- Service: `service-auth`, `service-payment`, `service-banking`, `service-memory`, `service-intelligence`, `service-edoc`

---

## Next Steps

1. **Approve this plan** -- confirm alignment with vision
2. **Execute Phase 0.5** -- scaffolding, bug fixes, preflight (0.5-1 day)
3. **Execute Phase 1** -- core adapter system (2-3 days)
4. **Execute Phase 1.5** -- prove it works with Paystack + Flutterwave (1-2 days)
5. **Create GitHub issues** -- from updated GITHUB_ISSUES.md
6. **Begin Phase 2+** -- internal services in parallel with remaining payments
