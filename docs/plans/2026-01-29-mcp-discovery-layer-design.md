# MCP Discovery Layer Design

> **Status:** Approved
> **Date:** 2026-01-29
> **Author:** Design collaboration session
> **Branch:** TBD (feature/mcp-discovery-layer)

---

## Problem Statement

The Onasis Gateway currently exposes **1,604 tools** across 18 adapters as first-class MCP tools. This causes:

- **Context flooding**: AI agents receive massive tool catalogs, increasing latency and token usage
- **Poor tool selection**: Models struggle to pick the right tool from thousands of options
- **Learning curve**: No guided flow for discovering and using the right operations

### Current State

| Adapter | Tool Count | Auth Type |
|---------|------------|-----------|
| stripe-api-2024-04-10 | 457 | bearer |
| ngrok-api | 217 | bearer |
| paystack | 117 | bearer |
| flutterwave-v3 | 108 | bearer |
| shutterstock-api | 109 | oauth2 |
| *...13 more adapters* | *~596* | *various* |
| **Total** | **1,604** | |

---

## Solution: MCP Discovery Layer

Replace 1,604 first-class tools with **5 meta-tools** that provide guided discovery and execution.

### Design Principles

1. **Intent-first**: Natural language queries return structured, executable actions
2. **Ready-to-execute**: Responses include everything needed - no follow-up schema lookups
3. **Confidence + reasoning**: AI knows WHY a tool was recommended
4. **Hybrid search**: Global search by default, adapter-specific when scoped
5. **Zero learning curve**: Guided flow with `next_step` in every response

### Approach

- **Additive**: New discovery layer alongside existing tools
- **Backwards compatible**: Existing REST API unchanged
- **Configurable**: `MCP_TOOL_MODE=lazy|full` controls exposure

---

## Tool Catalog (5 Tools)

| Tool | Purpose | Required Input |
|------|---------|----------------|
| `gateway.intent` | Natural language → action options | `query` |
| `gateway.execute` | Execute a specific tool | `tool_id`, `params` |
| `gateway.adapters` | List available services | *(none)* |
| `gateway.tools` | List tools within an adapter | `adapter` |
| `gateway.reference` | Get docs, examples, guides | `topic` |

---

## Tool Schemas

### 1. `gateway.intent`

**Purpose:** Transform natural language intent into structured, executable action options.

#### Input Schema

```typescript
{
  name: "gateway.intent",
  description: "Find the right tool for your task. Describe what you want to do in natural language.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What you want to accomplish (e.g., 'charge a card in Nigeria')"
      },
      adapter: {
        type: "string",
        description: "Optional: Limit search to specific adapter (e.g., 'paystack')"
      },
      context: {
        type: "object",
        description: "Optional: Additional context to improve matching",
        properties: {
          currency: { type: "string" },
          country: { type: "string" },
          use_case: { type: "string", enum: ["one-time", "subscription", "marketplace"] }
        }
      },
      limit: {
        type: "integer",
        default: 3,
        description: "Max number of alternatives to return"
      }
    },
    required: ["query"]
  }
}
```

#### Output Structure

```typescript
{
  recommended: {
    adapter: "paystack",
    tool: "charge-authorization",
    tool_id: "paystack:charge-authorization",
    confidence: 0.95,
    why: "Best match for card charging in Nigeria. Paystack supports NGN and has lowest fees."
  },

  ready_to_execute: {
    tool_id: "paystack:charge-authorization",
    required_params: ["amount", "email", "authorization_code"],
    optional_params: ["reference", "currency", "metadata"],
    param_schemas: {
      amount: { type: "integer", description: "Amount in kobo" },
      email: { type: "string", format: "email" },
      authorization_code: { type: "string" }
    },
    example: {
      amount: 500000,
      email: "customer@example.com",
      authorization_code: "AUTH_xxxxx"
    },
    constraints: {
      risk_level: "high",
      requires_idempotency: true,
      requires_confirmation: false,
      rate_limit: "100 req/min"
    }
  },

  missing_inputs: [],  // Or list of { field, question } if ambiguous
  next_step: "Call gateway.execute with tool_id and params",

  alternatives: [
    {
      adapter: "flutterwave",
      tool: "charge-card",
      tool_id: "flutterwave:charge-card",
      confidence: 0.82,
      why: "Alternative Nigerian payment provider"
    }
  ],

  search_context: {
    mode: "global",  // or "adapter-specific"
    matched_adapters: ["paystack", "flutterwave"],
    query_interpreted: "card payment, Nigeria, one-time charge"
  }
}
```

---

### 2. `gateway.execute`

**Purpose:** Execute any tool with validated parameters and risk management.

#### Input Schema

```typescript
{
  name: "gateway.execute",
  description: "Execute a specific tool. Use gateway.intent first to find the right tool_id.",
  inputSchema: {
    type: "object",
    properties: {
      tool_id: {
        type: "string",
        description: "Tool identifier in 'adapter:tool' format",
        pattern: "^[a-z0-9-]+:[a-z0-9-]+$"
      },
      params: {
        type: "object",
        description: "Parameters for the tool"
      },
      options: {
        type: "object",
        properties: {
          timeout: { type: "integer", default: 30000 },
          idempotency_key: { type: "string", description: "REQUIRED for high-risk operations" },
          dry_run: { type: "boolean", default: false },
          confirmed: { type: "boolean", default: false, description: "REQUIRED for destructive operations" }
        }
      }
    },
    required: ["tool_id", "params"]
  }
}
```

#### Risk Enforcement

```typescript
// High-risk operations require idempotency_key
if (operationMeta.risk_level === "high" && !options.idempotency_key) {
  return {
    success: false,
    error: {
      code: "IDEMPOTENCY_REQUIRED",
      message: "This operation modifies financial data. Provide idempotency_key.",
      risk_level: "high"
    }
  };
}

// Destructive operations require explicit confirmation
if (operationMeta.requires_confirmation && !options.confirmed) {
  return {
    success: false,
    error: {
      code: "CONFIRMATION_REQUIRED",
      message: "This operation is destructive and cannot be undone.",
      suggestion: "Add confirmed: true to proceed"
    }
  };
}
```

#### Output Structure

```typescript
{
  success: true,
  tool_id: "paystack:charge-authorization",
  execution_time_ms: 342,

  data: {
    // Underlying API response passthrough
    status: true,
    message: "Charge attempted",
    data: { reference: "ref_xxxxx", status: "success", amount: 500000 }
  },

  meta: {
    adapter: "paystack",
    tool: "charge-authorization",
    request_id: "req_abc123",
    timestamp: "2026-01-29T10:30:00Z",
    operation: {
      risk_level: "high",
      idempotent: true,
      reversible: false,
      category: "payments"
    }
  }
}
```

---

### 3. `gateway.adapters`

**Purpose:** List available service adapters with capabilities.

#### Input Schema

```typescript
{
  name: "gateway.adapters",
  description: "List available service adapters and their capabilities.",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["payments", "infrastructure", "analytics", "storage", "communication", "all"]
      },
      capability: { type: "string" },
      country: { type: "string" }
    },
    required: []
  }
}
```

#### Output Structure

```typescript
{
  total: 18,
  filters_applied: { category: "payments", country: "NG" },

  adapters: [
    {
      id: "paystack",
      name: "Paystack",
      description: "Payment processing for African markets",
      category: "payments",
      capabilities: ["card_payments", "bank_transfers", "subscriptions", "refunds"],
      supported_countries: ["NG", "GH", "ZA", "KE"],
      supported_currencies: ["NGN", "GHS", "ZAR", "KES"],
      tool_count: 117,
      tool_categories: { "transactions": 15, "customers": 8, "transfers": 12 },
      auth_type: "bearer",
      status: "operational",
      common_operations: ["paystack:initialize-transaction", "paystack:verify-transaction"]
    }
  ],

  next_step: "Use gateway.intent with your task, or gateway.tools to explore an adapter"
}
```

---

### 4. `gateway.tools`

**Purpose:** List tools within a specific adapter.

#### Input Schema

```typescript
{
  name: "gateway.tools",
  description: "List available tools within a specific adapter.",
  inputSchema: {
    type: "object",
    properties: {
      adapter: { type: "string", description: "Adapter ID" },
      category: { type: "string" },
      search: { type: "string" },
      limit: { type: "integer", default: 20, maximum: 50 },
      offset: { type: "integer", default: 0 }
    },
    required: ["adapter"]
  }
}
```

#### Output Structure

```typescript
{
  adapter: "paystack",
  total_tools: 117,
  returned: 20,
  offset: 0,
  categories: ["transactions", "customers", "transfers", "subscriptions"],

  tools: [
    {
      tool_id: "paystack:initialize-transaction",
      name: "Initialize Transaction",
      description: "Start a new payment transaction",
      category: "transactions",
      method: "POST",
      risk_level: "medium",
      required_params: ["amount", "email"],
      optional_param_count: 12
    }
  ],

  next_step: "Use gateway.intent with a tool_id for full schema"
}
```

---

### 5. `gateway.reference`

**Purpose:** Get documentation, examples, and usage guides.

#### Input Schema

```typescript
{
  name: "gateway.reference",
  description: "Get documentation, examples, and usage guides.",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Adapter name, tool_id, or concept"
      },
      section: {
        type: "string",
        enum: ["overview", "authentication", "examples", "errors", "webhooks", "best_practices", "all"]
      }
    },
    required: ["topic"]
  }
}
```

#### Output Structure (for adapter)

```typescript
{
  topic: "paystack",
  type: "adapter",

  overview: {
    name: "Paystack",
    description: "Payment processing for African markets",
    documentation: "https://paystack.com/docs/api"
  },

  authentication: {
    type: "bearer",
    header: "Authorization: Bearer sk_live_xxxxx",
    env_var: "PAYSTACK_SECRET_KEY"
  },

  examples: [
    {
      title: "Initialize a payment",
      tool_id: "paystack:initialize-transaction",
      request: { amount: 500000, email: "customer@example.com" },
      response: { status: true, data: { authorization_url: "https://..." } }
    }
  ],

  common_errors: [
    { code: "invalid_key", meaning: "API key invalid", fix: "Check env var" }
  ],

  best_practices: [
    "Always verify transactions server-side",
    "Use idempotency keys for charges"
  ]
}
```

---

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ONASIS GATEWAY                                 │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                  MCP DISCOVERY LAYER (NEW)                         │ │
│  │                                                                    │ │
│  │   gateway.intent  gateway.execute  gateway.adapters                │ │
│  │   gateway.tools   gateway.reference                                │ │
│  │                          │                                         │ │
│  │                          ▼                                         │ │
│  │   ┌────────────────────────────────────────────────────────────┐  │ │
│  │   │              OPERATION REGISTRY                             │  │ │
│  │   │  • 1,604 operations indexed with tags, schemas, risk       │  │ │
│  │   │  • schema_version + last_verified_at                       │  │ │
│  │   └────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                │                                        │
│                                ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    EXISTING ADAPTER LAYER                          │ │
│  │   Paystack(117) Stripe(457) Flutterwave(108) ngrok(217) ...       │ │
│  │                                │                                   │ │
│  │              POST /api/adapters/{adapter}/tools/{tool}             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
mcp-server/
├── index.js                    # Entry point
├── server.js                   # MCP server config
├── discovery/                  # NEW: Discovery layer
│   ├── index.js               # Registers 5 meta-tools
│   ├── tools/
│   │   ├── intent.js          # gateway.intent
│   │   ├── execute.js         # gateway.execute
│   │   ├── adapters.js        # gateway.adapters
│   │   ├── tools.js           # gateway.tools
│   │   └── reference.js       # gateway.reference
│   ├── registry/
│   │   ├── index.js           # Registry loader
│   │   ├── operations.json    # Generated operation index
│   │   └── generator.js       # Builds registry from adapters
│   └── search/
│       ├── index.js           # Search engine
│       └── ranking.js         # Confidence scoring
└── tools/                      # Existing implementations
```

### Configuration

```bash
# .env additions
MCP_TOOL_MODE=lazy              # lazy (5 tools) | full (1604 tools)
MCP_REGISTRY_PATH=./discovery/registry/operations.json
MCP_SEARCH_MIN_CONFIDENCE=0.5
MCP_DEFAULT_LIMIT=3
```

### Startup Logic

```javascript
const mode = process.env.MCP_TOOL_MODE || 'lazy';

if (mode === 'lazy') {
  const discovery = require('./discovery');
  discovery.registerTools(mcpServer);
  console.log('MCP Discovery Layer: 5 meta-tools registered');
} else {
  const adapters = require('./adapters');
  adapters.registerAllTools(mcpServer);
  console.log('MCP Full Mode: 1604 tools registered');
}
```

---

## Operation Registry Schema

```typescript
{
  "schema_version": "1.0.0",
  "last_verified_at": "2026-01-29T00:00:00Z",
  "operation_count": 1604,
  "operations": {
    "paystack:charge-authorization": {
      "adapter": "paystack",
      "tool": "charge-authorization",
      "description": "Charge a previously authorized card",
      "tags": ["payments", "cards", "charge", "nigeria", "ngn"],
      "method": "POST",
      "path": "/transaction/charge_authorization",
      "input_schema": { /* JSON Schema */ },
      "required_params": ["amount", "email", "authorization_code"],
      "optional_params": ["reference", "currency", "metadata"],
      "risk_level": "high",
      "idempotent": true,
      "reversible": false,
      "requires_confirmation": false,
      "example_request": { /* ... */ },
      "common_errors": ["invalid_authorization", "insufficient_funds"]
    }
  }
}
```

---

## Potential Pitfalls & Mitigations

| Pitfall | Mitigation |
|---------|------------|
| Intent resolver complexity | Deterministic ranking with tags, metadata, confidence thresholds |
| Version drift | `schema_version` + `last_verified_at` in registry |
| Security (broad execute power) | `risk_level`, `requires_confirmation`, `idempotent` flags enforced |
| Agent confusion (hybrid search) | Single `gateway.intent` with optional `adapter` param |
| Legacy tool exposure | `MCP_TOOL_MODE=lazy` hides 1604 tools by default |

---

## Implementation Order

1. **Create operation registry** - Generate from existing adapters
2. **Implement 5 meta-tools** - intent, execute, adapters, tools, reference
3. **Add lazy mode** - `MCP_TOOL_MODE` environment variable
4. **Harden execute** - Risk enforcement, idempotency, confirmation
5. **Add search ranking** - Confidence scoring for intent matching
6. **Documentation** - Update MCP server README

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Tools exposed to MCP clients | 1,604 | 5 |
| Calls to find right tool | 1-5 (guessing) | 1 (intent) |
| Context tokens per request | High | Minimal |
| New adapter integration | Code changes | Registry update only |

---

## Backward Compatibility

- REST API (`/api/adapters/{adapter}/tools/{tool}`) unchanged
- `MCP_TOOL_MODE=full` available for debugging
- Existing adapter code untouched
- New layer is purely additive

---

## Plan Hardening Patch (Reality Alignment + Fewer Moving Parts)

### 1) Repo Reality Alignment (No New Service)
**Constraint:** Avoid introducing a separate “mcp-server” process unless required.

**Update:**
- The MCP Discovery Layer should live **inside the existing gateway runtime** (e.g., `gateways/unified-gateway/...`) so it shares:
  - auth middleware
  - adapter loading lifecycle
  - logging + tracing
  - deploy/runtime configuration

**Result:** one deployment unit, one process, one port. No extra breakpoints.

---

### 2) Single Source of Truth Rule (Registry is a Cache, Not Truth)
**Risk:** `operations.json` can drift from the live adapter tool catalog.

**Rule:**
- **Canonical truth = in-memory adapter tool catalog** loaded at startup.
- `operations.json` is optional and treated as a **cache artifact**.

**Implementation expectation:**
- At startup:
  1) load adapters → build in-memory tool catalog
  2) build registry from the in-memory catalog
  3) (optional) write `operations.json` if enabled

**Hard requirement:**
- `gateway.execute` must reject unknown `tool_id` unless explicitly in debug mode.

---

### 3) Lazy Mode Must Actually Hide the 1,604 Tools
**Problem:** “Additive” can still flood MCP clients if the legacy 1,604 tools remain exposed.

**Rule:**
- `MCP_TOOL_MODE=lazy` MUST expose only these tools to MCP clients:
  - `gateway.intent`
  - `gateway.execute`
  - `gateway.adapters`
  - `gateway.tools`
  - `gateway.reference`

**`MCP_TOOL_MODE=full`** is debug-only and exposes the legacy 1,604 tools.

**Non-negotiable:** Lazy mode is the default.

---

### 4) Execution Must Be Deny-by-Default (Policy Guardrails)
`gateway.execute` is powerful, so it must enforce policy **server-side**, not “best effort”.

Add policy metadata per operation:
- `risk_level`: `low|medium|high|destructive`
- `idempotency_required`: boolean
- `confirmation_required`: boolean
- `required_scopes`: string[] (e.g., `["payments:write"]`)
- `rate_limit_bucket`: string (e.g., `payments_high_risk`)

**Enforcement order in `gateway.execute`:**
1) Auth + scope check  
2) Confirmation/idempotency requirements  
3) Schema validation (strict)  
4) Adapter call  
5) Audit log fields (request_id, tool_id, params_hash, actor_id, timestamp)

**Default stance:** if metadata is missing → treat as **high risk** and require safe controls.

---

### 5) Keep “Intent” Boring and Deterministic (v1)
To reduce fragility, v1 should NOT rely on embeddings or complex heuristics.

**Ranking v1:**
- exact match on `tool_id` / name
- tag overlap score
- keyword overlap score (query vs name/description)
- adapter boost ONLY when `adapter` is explicitly provided
- confidence threshold: if below threshold → return 2–3 options + `needs_selection: true`

**Rule:** intent is a resolver, not a guesser.

---

### 6) `gateway.reference` Should Not Become a Second Documentation System
**Rule:**
- Reference content is **thin** and gateway-specific:
  - auth/env vars used by gateway
  - common error mapping + fixes
  - safe usage patterns (idempotency, confirmation)
  - minimal examples
- All deep docs should link to canonical provider docs.

---

### 7) Contract Tests to Prevent Drift (Foolproof Mechanism)
Add CI checks (or startup assertions) to guarantee registry matches the live catalog:

**Required checks:**
- Every registry `tool_id` exists in the live tool catalog
- Schema required fields are present
- Risk metadata exists for all operations
- `operation_count` matches expected count (or matches live tool catalog size)

**Fail-fast:** If contract tests fail → refuse to start in lazy mode (or run in safe degraded mode with intent disabled).

---

## Updated File Layout (Conceptual; map to unified-gateway paths)
**Discovery module should be part of unified-gateway**, not necessarily a new root folder.

Example mapping:
- `gateways/unified-gateway/src/mcp/discovery/`
  - `index.ts|js` (register meta-tools)
  - `tools/` (intent/execute/adapters/tools/reference)
  - `registry/` (builder + optional cache writer)
  - `search/` (ranking logic)

---

## Updated Implementation Order (Min Moving Parts)
1) **Lazy exposure only**: `MCP_TOOL_MODE=lazy` registers 5 tools only  
2) **In-memory registry** built from existing adapter catalog (no JSON file required)  
3) `gateway.execute` with strict policy enforcement + schema validation  
4) `gateway.adapters` and `gateway.tools` (thin list endpoints)  
5) `gateway.intent` deterministic ranking + confidence thresholds  
6) Optional: write `operations.json` as a cache artifact  
7) Add CI contract tests to prevent registry drift

---

## Acceptance Criteria (No Regression, No Flooding)
- MCP client tools/list returns **exactly 5 tools** in lazy mode
- Existing REST execution endpoint remains unchanged
- 2-call flow works end-to-end:
  - `gateway.intent` → returns `ready_to_execute`
  - `gateway.execute` → executes successfully or fails with actionable error
- High-risk operations require idempotency + appropriate scope
- Low confidence intent returns options + asks for clarification (does not guess)

---

*Last updated: 2026-01-29*
