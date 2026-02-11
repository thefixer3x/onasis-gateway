# 🏛️ Onasis Gateway Architecture

**Version:** 2.0
**Date:** 2026-02-10
**Status:** Production Architecture

---

## System Overview

Onasis Gateway is a **unified API gateway and MCP server** that provides:
- 🔌 Single entry point for 25+ services
- 🤖 MCP (Model Context Protocol) interface for AI agents
- 🔐 Centralized authentication and authorization
- 📊 Service discovery and orchestration
- 🛡️ Rate limiting, caching, and security

---

## Architecture Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                   │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ AI Agents    │  │ Web Apps     │  │ Mobile Apps  │               │
│  │ (Claude,     │  │ (React,      │  │ (iOS,        │               │
│  │  ChatGPT)    │  │  Next.js)    │  │  Android)    │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                  │                  │                        │
│         └──────────────────┼──────────────────┘                        │
│                            │                                           │
└────────────────────────────┼───────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      GATEWAY LAYER (Port 3000)                         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Protocol Handlers                                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │ MCP Server  │  │ REST API    │  │ GraphQL     │          │   │
│  │  │ (SSE/HTTP)  │  │ (JSON)      │  │ (optional)  │          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                         │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │  MCP Discovery Layer     │                                    │   │
│  │  ┌────────────────────────────────────────────────────┐      │   │
│  │  │ gateway-intent   → Natural language to action      │      │   │
│  │  │ gateway-execute  → Execute tools                   │      │   │
│  │  │ gateway-adapters → List available services         │      │   │
│  │  │ gateway-tools    → List tools in adapter           │      │   │
│  │  │ gateway-reference→ Get documentation               │      │   │
│  │  └────────────────────────────────────────────────────┘      │   │
│  └────────────────────────────────────────────────────────────────   │
│                             │                                         │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │  Middleware Stack        │                                    │   │
│  │  ┌────────────┐  ┌───────────┐  ┌──────────────┐           │   │
│  │  │ Auth       │→ │ Rate      │→ │ Validation   │           │   │
│  │  │ Validator  │  │ Limiter   │  │ & Transform  │           │   │
│  │  └────────────┘  └───────────┘  └──────────────┘           │   │
│  └────────────────────────────────────────────────────────────────   │
│                             │                                         │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │  Adapter Registry        ▼                                    │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ Map<AdapterId, Adapter>                                │  │   │
│  │  │ Map<ToolId, {adapter, tool}>                           │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────   │
│                                                                        │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ ADAPTER LAYER   │  │ ADAPTER      │  │ ADAPTER LAYER    │
│                 │  │ LAYER        │  │                  │
│ ┌─────────────┐ │  │ ┌──────────┐ │  │ ┌──────────────┐ │
│ │ Supabase    │ │  │ │ Auth     │ │  │ │ Payment      │ │
│ │ Adapter     │ │  │ │ Gateway  │ │  │ │ Services     │ │
│ │             │ │  │ │ Adapter  │ │  │ │              │ │
│ │ - Auto-     │ │  │ │          │ │  │ │ - Paystack   │ │
│ │   discovery │ │  │ │ - JWT    │ │  │ │ - Flutterwave│ │
│ │ - 82 Edge   │ │  │ │ - OAuth  │ │  │ │ - Stripe     │ │
│ │   Functions │ │  │ │ - API    │ │  │ │ - SaySwitch  │ │
│ │             │ │  │ │   Keys   │ │  │ │              │ │
│ └─────────────┘ │  │ └──────────┘ │  │ └──────────────┘ │
└─────────────────┘  └──────────────┘  └──────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      CORE INFRASTRUCTURE                               │
│                                                                        │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ BaseClient       │  │ VendorAbstract  │  │ MetricsCollector   │  │
│  │ - HTTP handling  │  │ - Multi-provider│  │ - Performance      │  │
│  │ - Auth injection │  │ - Routing       │  │ - Health checks    │  │
│  │ - Retry logic    │  │ - Failover      │  │ - Logging          │  │
│  │ - Circuit breaker│  │                 │  │                    │  │
│  └──────────────────┘  └─────────────────┘  └────────────────────┘  │
│                                                                        │
│  ┌──────────────────┐  ┌─────────────────┐                          │
│  │ ComplianceManager│  │ VersionManager  │                          │
│  │ - Security audit │  │ - API versioning│                          │
│  │ - GDPR           │  │ - Migrations    │                          │
│  └──────────────────┘  └─────────────────┘                          │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Supabase Edge Functions (82 deployed: 80 categorized + 2 utility functions) │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │ Memory API │  │ Payments   │  │ AI & Chat  │            │   │
│  │  │ (9 funcs)  │  │ (20 funcs) │  │ (12 funcs) │            │   │
│  │  └────────────┘  └────────────┘  └────────────┘            │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │ Auth       │  │ Intelligence│  │ EDOC       │            │   │
│  │  │ (5 funcs)  │  │ (6 funcs)  │  │ (11 funcs) │            │   │
│  │  └────────────┘  └────────────┘  └────────────┘            │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐                             │   │
│  │  │ System     │  │ API Keys   │                             │   │
│  │  │ (12 funcs) │  │ (5 funcs)  │                             │   │
│  │  └────────────┘  └────────────┘                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Direct Services                                              │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │ Auth GW    │  │ Enterprise │  │ MCP Core   │            │   │
│  │  │ :4000      │  │ MCP :3001  │  │ :3001-3003 │            │   │
│  │  └────────────┘  └────────────┘  └────────────┘            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

Note: The two utility functions not shown in category boxes are `create-checkout-session` and `create-portal-session`.

---

## Data Flow

### MCP Tool Execution Flow

```
1. AI Agent Request
   └→ POST /mcp
       {
         "method": "tools/call",
         "params": {
           "name": "paystack:initialize-transaction",
           "arguments": { "amount": 10000, "email": "user@example.com" }
         }
       }

2. Gateway Reception
   └→ Protocol Handler (MCP Server)
       └→ Parse JSON-RPC request
       └→ Extract tool name and arguments

3. Discovery Layer
   └→ gateway-execute receives call
       └→ Looks up "paystack:initialize-transaction" in registry

4. Adapter Registry
   └→ Finds PaystackAdapter
       └→ Retrieves tool definition
       └→ Validates arguments against schema

5. Middleware Stack
   └→ Auth Validator
       ├→ Check API key/JWT
       └→ Verify permissions
   └→ Rate Limiter
       ├→ Check rate limits
       └→ Update counters
   └→ Validation & Transform
       ├→ Validate input schema
       └→ Transform if needed

6. Adapter Execution
   └→ PaystackAdapter.callTool("initialize-transaction", args)
       └→ Uses UniversalSupabaseClient
           └→ POST https://[supabase]/functions/v1/paystack
               {
                 "action": "initialize_transaction",
                 "amount": 10000,
                 "email": "user@example.com"
               }

7. Supabase Edge Function
   └→ Receives request
       └→ Validates authentication
       └→ Calls real Paystack API
           └→ POST https://api.paystack.co/transaction/initialize
       └→ Returns response

8. Response Flow
   └→ Edge Function → Adapter → Registry → Discovery Layer → Protocol Handler
       └→ Returns to AI Agent
           {
             "result": {
               "content": [{
                 "type": "text",
                 "text": "{ status: true, data: { authorization_url: '...' } }"
               }]
             }
           }
```

---

## Adapter Architecture

### Base Adapter Interface

```typescript
interface MCPAdapter {
  id: string;
  name: string;
  version: string;
  description: string;

  tools: MCPTool[];
  metadata: AdapterMetadata;

  initialize(): Promise<void>;
  callTool(toolName: string, args: any): Promise<any>;
  healthCheck(): Promise<HealthStatus>;
  getStats(): AdapterStats;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  examples?: ToolExample[];
  tags?: string[];
  riskLevel?: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}
```

### Adapter Types

1. **Supabase Adapter** (Auto-Discovery)
   - Discovers all Edge Functions automatically
   - Maps function signatures to MCP tools
   - Handles authentication and routing

2. **Service Adapters** (Direct Integration)
   - Auth Gateway (OAuth, JWT, API Keys)
   - Payment Services (Paystack, Flutterwave, Stripe)
   - Banking Services (Providus, SaySwitch)
   - Custom business logic

3. **Proxy Adapters** (Third-party APIs)
   - External services routed through Supabase
   - Unified authentication
   - Rate limiting and caching

---

## Security Architecture

### Authentication Flow

```
1. Request arrives with credentials
   ├→ API Key: X-API-Key header
   ├→ JWT: Authorization: Bearer <token>
   └→ OAuth: Authorization: Bearer <access_token>

2. Auth Validator Middleware
   ├→ Extract credentials
   ├→ Validate format
   └→ Call Auth Gateway service

3. Auth Gateway
   ├→ Check API key in database
   ├→ Verify JWT signature
   ├→ Validate OAuth token
   └→ Return user context + permissions

4. Permission Check
   ├→ Check tool access rules
   ├→ Verify org/project access
   └→ Apply rate limits

5. Request proceeds or rejected
   ├→ Success: Continue to adapter
   └→ Failure: 401/403 response
```

### Rate Limiting

```
┌─────────────────────────────────────┐
│ Rate Limit Zones                    │
├─────────────────────────────────────┤
│ Global:     1000 req/min            │
│ Per API Key: 100 req/min            │
│ Per IP:      300 req/min            │
│ Per Tool:    Custom limits          │
└─────────────────────────────────────┘
```

Rate limiting is enforced by gateway instances using a shared Redis store (Redis/Redis Cluster), not instance-local memory, so limits remain consistent under horizontal scaling. The implementation uses a token-bucket strategy with atomic Redis operations (Lua/transactional increments) for distributed counters, keyed by global, API key, IP, and tool dimensions. This provides strong consistency for the active counter path; if Redis is temporarily unavailable, the gateway falls back to best-effort local protection and emits rate-limit headers/telemetry so clients and operators can detect degraded enforcement.

---

## Service Categories

### Internal Services (Supabase-hosted)
- Memory as a Service (MaaS)
- AI Router & Chat
- Intelligence API
- API Key Management
- System utilities

### External Integrations (via Edge Functions)
- Payment gateways
- Banking APIs
- Verification services
- Document services (EDOC)

### Direct Services (Separate processes)
- Auth Gateway (:4000)
- Enterprise MCP (:3001)
- MCP Core (:3001-3003)

---

## Scalability & Performance

### Horizontal Scaling

```
┌─────────────────────────────────────────────┐
│ Load Balancer (Railway/Nginx)              │
└──────────┬──────────┬──────────┬────────────┘
           │          │          │
           ▼          ▼          ▼
      ┌────────┐ ┌────────┐ ┌────────┐
      │Gateway │ │Gateway │ │Gateway │
      │Instance│ │Instance│ │Instance│
      │   1    │ │   2    │ │   3    │
      └────────┘ └────────┘ └────────┘
```

### Caching Strategy

- **Adapter Registry:** In-memory, refreshed every 5 minutes
- **Tool Schemas:** In-memory, loaded at startup
- **Auth Tokens:** Redis-backed shared cache, TTL derived from token/session expiry
- **API Responses:** Configurable per-tool caching

### Performance Targets

- **Gateway Latency:** < 50ms (overhead)
- **End-to-end:** < 500ms (including backend)
- **Throughput:** 1000+ requests/second
- **Uptime:** 99.9%

---

## Monitoring & Observability

### Metrics Collected

- Request count (by service, tool, status)
- Response time (p50, p95, p99)
- Error rate (by type)
- Active connections
- Cache hit rate
- Circuit breaker status

### Health Checks

```
GET /health
{
  "status": "healthy",
  "services": {
    "api": { "status": "online", "services": 25 },
    "mcp": { "status": "online", "adapters": 25, "tools": 2000+ },
    "supabase": { "status": "healthy", "functions": 82 }
  },
  "uptime": 1234567,
  "version": "2.0.0"
}
```

---

## Deployment Architecture

### Development
```
localhost:3000 → Gateway
localhost:4000 → Auth Gateway
Supabase → Edge Functions (staging)
```

### Production
```
api.connectionpoint.tech → Gateway (Railway)
auth.lanonasis.com → Auth Gateway
mxtsdgkwzjzlttpotole.supabase.co → Edge Functions
```

---

## Technology Stack

- **Runtime:** Node.js 20
- **Server:** Express.js
- **Protocol:** MCP (Model Context Protocol)
- **Backend:** Supabase Edge Functions (Deno)
- **Database:** PostgreSQL (Supabase)
- **Distributed Cache:** Redis (shared rate-limit + auth/session cache)
- **Deployment:** Railway
- **Monitoring:** Built-in metrics + external APM

---

**Architecture Version:** 2.0
**Last Updated:** 2026-02-10
**Status:** Production-Ready
