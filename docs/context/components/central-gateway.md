# Central Gateway (`unified_gateway.js`) Context

**Created:** 2026-04-30 | **Owner:** @thefixer3x  
**File:** `/Users/onasis/dev-hub/projects/onasis-gateway/unified_gateway.js`  
**Size:** 1,957 lines | **Port:** 3000

---

## Purpose

The Central Gateway is the primary API gateway and service orchestration layer for the onasis-gateway system. It combines:

1. **API Gateway** - REST API routing, service orchestration, adapter execution
2. **MCP Server** - Model Context Protocol server for AI agent integration

This allows both services to coexist on the same Express app with different route prefixes, avoiding port conflicts and simplifying deployment.

### Route Structure

| Route | Purpose |
|-------|---------|
| `/api/*` | API Gateway (REST API routing, service orchestration) |
| `/mcp/*` | MCP Server (1604 tools across 18 adapters) |
| `/health` | Health check for both services |
| `/health/full` | Full upstream status (all backends) |
| `/` | Service discovery/documentation |

### Architecture Position

```
┌─────────────────────────────────────────┐
│  gateway.lanonasis.com (Nginx - Target) │
└──────────────┬──────────────────────────┘
               │
               ▼
    ┌────────────────────┐
    │  Central Gateway   │
    │      :3000         │
    │                    │
    │  ┌──────────┐      │
    │  │ API GW   │      │
    │  │ (Adapter │      │
    │  │ Execution)│     │
    │  └──────────┘      │
    │  ┌──────────┐      │
    │  │ MCP Server│     │
    │  │ (1604 tools)│   │
    │  └──────────┘      │
    └──────────┬─────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌────────────┐  ┌────────────┐
│ Auth GW    │  │ MaaS       │
│ :4000      │  │ Adapters   │
└────────────┘  │ (Supabase) │
                └────────────┘
```

---

## Key Files

- `unified_gateway.js` - Core unified gateway implementation (1,957 lines)
- `api_server.js` - Separate API server (alternative deployment)
- `mcp_server.js` - Separate MCP server (alternative deployment)
- `ecosystem.config.js` - PM2 deployment configuration
- `vps/monitor.js` - VPS monitoring
- `services/` - 18 API service configurations (extracted from Postman)
- `src/mcp/` - MCP protocol implementation

---

## Dependencies

### External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Auth Gateway** | JWT, OAuth2, API key verification | `AUTH_GATEWAY_URL` (https://auth.lanonasis.com) |
| **Supabase** | Edge functions, database | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **AI Router** | AI provider routing | `AI_ROUTER_URL`, `AI_ROUTER_TIMEOUT_MS` |
| **Postman Collections** | Service API specifications | Extracted to `services/` directory |

### Internal Dependencies

| Component | Module | Purpose |
|-----------|--------|---------|
| **BaseClient** | `./core/base-client` | Universal API client |
| **VersionManager** | `./core/versioning/version-manager` | Service version tracking |
| **ComplianceManager** | `./core/security/compliance-manager` | Security/compliance checks |
| **MetricsCollector** | `./core/monitoring/metrics-collector` | Request/response metrics |
| **AbstractedAPIEndpoints** | `./api/abstracted-endpoints` | API endpoint abstraction |
| **OnasisAuthBridge** | `./middleware/onasis-auth-bridge` | Auth gateway integration |
| **MCPDiscoveryLayer** | `./src/mcp/discovery` | MCP tool discovery (lazy/full mode) |

### NPM Dependencies

```json
{
  "express": "^5.2.1",
  "cors": "^2.8.6",
  "helmet": "^8.1.0",
  "compression": "^1.8.1",
  "express-rate-limit": "^8.2.1",
  "jsonwebtoken": "^9.0.3",
  "@supabase/supabase-js": "^2.96.0",
  "winston": "^3.19.0",
  "prom-client": "^15.1.3",
  "ws": "^8.19.0"
}
```

---

## Integration Points

### APIs Exposed

#### REST API Endpoints

```http
GET /api/services
GET /api/services?capability=payment
GET /api/execute/{service}/{operation}
POST /api/execute/{service}/{operation}
GET /api/health
GET /api/health/full
```

#### MCP Protocol Endpoints

```http
GET /mcp/tools          # Tool discovery
POST /mcp/execute       # Tool execution
WS /mcp/ws              # WebSocket transport
SSE /mcp/sse            # Server-sent events
```

#### Health & Status

```http
GET /health             # Basic gateway health
GET /health/full        # Full upstream status
GET /api/v1/status      # Gateway API status
```

### Events Published

- **Request Metrics**: `metricsCollector.recordRequest()` - Every request logged with service, endpoint, method, status code, duration
- **Service Discovery**: `serviceCatalog` - Dynamically loads services from Postman collections
- **Adapter Discovery**: `adapterRegistry` - Registers MCP adapters (mock + real)

### Database Interactions

- **Supabase Edge Functions**: Via `/api/v1/functions/:functionName` proxy
- **Local SQLite**: Version manager stores service version history
- **No direct Postgres access**: All DB operations go through Supabase

---

## Architecture Patterns

### 1. Unified Gateway Pattern

**Problem**: Express has one HTTP server per port; can't run multiple servers on same port.

**Solution**: UnifiedGateway class combines API Gateway + MCP Server on same Express app:

```javascript
class UnifiedGateway {
    constructor() {
        this.app = express();
        this.port = 3000;

        // API Gateway components
        this.services = new Map();
        this.clients = new Map();

        // MCP Server components
        this.adapters = new Map();
        this.adapterRegistry = null;

        // Single Express app serves both
        this.setupMiddleware();  // Shared middleware
        this.setupRoutes();      // Separate routes: /api/*, /mcp/*
    }
}
```

**Benefits**:
- Single port (3000) instead of multiple
- Shared middleware (auth, logging, metrics)
- Simpler deployment (one process)
- Coordinated startup/shutdown

### 2. Multi-Strategy Auth Verification

**Problem**: Support JWT, OAuth tokens, API keys simultaneously.

**Solution**: Build candidate requests in priority order:

```javascript
const candidateRequests = [];

// 1. Try API key verification (preferred for service-to-service)
if (apiKeyValue) {
    addCandidate('/v1/auth/verify-api-key', { api_key: apiKeyValue }, ...);
}

// 2. Try token verification (preferred for user sessions)
if (token) {
    addCandidate('/v1/auth/verify-token', { token }, ...);
}

// 3. Legacy fallback
addCandidate('/v1/auth/verify', verifyPayload, ...);

// Try each candidate until one succeeds
for (const candidate of candidateRequests) {
    const response = await fetch(candidate.url, ...);
    if (response.ok) {
        return { ok: true, method: candidate.source, payload: data };
    }
}
```

**Benefits**:
- Supports multiple auth methods simultaneously
- Failover if preferred method fails
- Clear audit trail of auth method used

### 3. Supabase JWT Fallback

**Problem**: Legacy clients issue Supabase JWTs directly; new clients use Auth Gateway.

**Solution**: Conditional Supabase JWT verification:

```javascript
async trySupabaseJwtVerification(token) {
    const allowed = (process.env.GATEWAY_ALLOW_SUPABASE_JWT_FALLBACK || 'true') === 'true';
    if (!allowed) return null;

    const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const anonKey = this.supabaseAnonKey;
    if (!token || !supabaseUrl || !anonKey) return null;

    // Only intercept Supabase JWTs — skip lano_ API-key tokens
    if (token.startsWith('lano_') || !/^eyJ/i.test(token)) return null;

    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, apikey: anonKey }
        });

        if (response.ok) {
            const user = await response.json();
            return { ok: true, method: 'supabase_jwt', user };
        }
    } catch {
        // Supabase verification failed — fall through
    }
    return null;
}
```

**Benefits**:
- Backward compatibility with legacy clients
- No code changes needed in existing clients
- Controlled by environment variable (easy to disable)

### 4. Service Catalog Pattern

**Problem**: Dynamically load API services from Postman collections.

**Solution**: Service catalog loads configurations from JSON files:

```javascript
loadAPIServices() {
    const servicesDir = path.join(__dirname, 'services');

    const catalogServices = Array.isArray(this.serviceCatalog?.apiServices)
        ? this.serviceCatalog.apiServices.filter(service => service.enabled !== false)
        : [];

    if (catalogServices.length > 0) {
        // Load from catalog
        for (const service of catalogServices) {
            const configPath = service.configPath;
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const client = new BaseClient({
                baseURL: config.servers[0].url,
                version: config.info.version,
                service: config.info.name
            });
            this.services.set(config.info.name, client);
        }
    } else {
        // Fallback: scan services directory
        const serviceDirs = fs.readdirSync(servicesDir).filter(dir => /* is directory */);
        for (const serviceDir of serviceDirs) {
            // Load each service
        }
    }

    console.log(`📦 Loaded ${loadedCount} API services`);
}
```

**Benefits**:
- Dynamic service discovery
- No code changes to add new services
- Enable/disable services via catalog config
- Automatic client creation from OpenAPI spec

### 5. MCP Discovery Layer

**Problem**: 1600+ MCP tools can be overwhelming for clients.

**Solution**: Two modes - lazy (5 meta-tools) or full (all 1600+):

```javascript
// MCP Tool Mode: lazy | full
this.mcpToolMode = process.env.MCP_TOOL_MODE || 'lazy';

if (this.mcpToolMode === 'lazy') {
    try {
        this.discoveryLayer = new MCPDiscoveryLayer(this, this.adapters);
        console.log(`🔍 MCP Discovery Layer initialized (5 meta-tools active)`);
    } catch (error) {
        console.warn(`⚠️ Failed to initialize Discovery Layer: ${error.message}`);
        console.log(`⚠️ Falling back to full mode (${totalTools} tools)`);
        this.mcpToolMode = 'full';
    }
}
```

**Lazy Mode (Recommended)**:
- 5 meta-tools: listServices, discoverTools, execute, search, health
- Clients request specific tools as needed
- Reduces initial payload size
- Better for production

**Full Mode (Debug)**:
- All 1600+ tools available at once
- Useful for testing, development
- Larger initial payload

---

## Operational Considerations

### Startup Sequence

1. **Load Service Catalog**: Read `catalog.json` (from services directory or monorepo)
2. **Load API Services**: Parse Postman collections, create BaseClient instances
3. **Load MCP Adapters**: Register adapters (mock + real) via AdapterRegistry
4. **Setup Middleware**: Helmet, CORS, compression, rate limiting, request ID, metrics
5. **Setup Routes**: Express routes for `/api/*`, `/mcp/*`, `/health`, etc.
6. **Setup Error Handling**: Global error handler for 500s
7. **Start Server**: Listen on port 3000 (or configured port)

### Rate Limiting

Different limits for API vs MCP endpoints:

```javascript
// API endpoints - stricter (100 per 15 min)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: getRateLimitKey,
    message: 'Too many API requests'
});

// MCP endpoints - more permissive (1000 per 15 min)
const mcpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: getRateLimitKey,
    message: 'Too many MCP requests'
});

// Apply to routes
this.app.use('/api/', apiLimiter);
this.app.use('/mcp', mcpLimiter);
```

### Health Check Strategy

```javascript
GET /health           // Basic gateway health
GET /health/full      // Check all upstream backends

// Health targets configurable via env:
HEALTH_TARGETS: "http://127.0.0.1:4000/health,http://127.0.0.1:3001/health"
```

### Logging

- **Console**: Simple timestamp + method + path for debugging
- **Metrics**: Prometheus-style metrics via `prom-client`
- **Request IDs**: `X-Request-ID` header for tracing

---

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP server port |
| `AUTH_GATEWAY_URL` | `https://auth.lanonasis.com` | Auth gateway URL |
| `SUPABASE_URL` | - | Supabase instance URL |
| `SUPABASE_ANON_KEY` | - | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | - | Supabase service role key |
| `AI_ROUTER_URL` | - | AI router URL |
| `AI_ROUTER_TIMEOUT_MS` | `12000` | AI router timeout (ms) |
| `AUTH_GATEWAY_TIMEOUT_MS` | `8000` | Auth gateway timeout (ms) |
| `GATEWAY_ENFORCE_IDENTITY_VERIFICATION` | `true` | Require auth for all requests |
| `GATEWAY_ALLOW_INSECURE_AUTH_BYPASS` | `false` | Allow auth bypass (development) |
| `GATEWAY_ALLOW_SUPABASE_JWT_FALLBACK` | `true` | Try Supabase JWT if auth gateway fails |
| `ALLOWED_ORIGINS` | - | CORS allowed origins (CSV) |
| `CORS_ALLOW_LOCALHOST` | `true` | Allow localhost origins |
| `MCP_TOOL_MODE` | `lazy` | `lazy` (5 tools) or `full` (1600+ tools) |

### Runtime Configuration

- **Service Catalog**: Loaded from `services/catalog.json` or extracted from Postman
- **Adapter Catalog**: Built-in default (18 mock adapters) or from catalog
- **Health Targets**: Configurable via `HEALTH_TARGETS` env var

---

## Common Patterns

### Service Discovery

```javascript
GET /api/services
// Returns: [
//   { id: 'stripe-api', type: 'payment', enabled: true },
//   { id: 'bap-postman-collection', type: 'payment', enabled: true },
//   ...
// ]

GET /api/services?capability=payment
// Returns only payment-related services
```

### Batch Operations

```javascript
POST /api/batch/activate
{
    "services": ["stripe", "bap-postman-collection", "wise-multicurrency"],
    "config": { "timeout": 30000 }
}
```

### Proxy Requests

```javascript
POST /api/proxy/stripe/customers
{
    "name": "John Doe",
    "email": "john@example.com"
}

// Gateway forwards to Stripe API with proper auth
```

---

## Troubleshooting

### Services Not Loading

**Symptom**: "Loaded 0 API services" on startup

**Diagnosis**:
1. Check `services/` directory exists
2. Verify `services/catalog.json` is valid JSON
3. Ensure services have `enabled: true` in catalog

**Fix**:
```bash
ls -la services/
cat services/catalog.json
```

### MCP Tools Not Available

**Symptom**: `/mcp/tools` returns empty list

**Diagnosis**:
1. Check `MCP_TOOL_MODE` env var
2. Verify adapters loaded successfully

**Fix**:
```bash
# Force full mode for debugging
export MCP_TOOL_MODE=full
npm start
```

### Auth Verification Failing

**Symptom**: 401 Unauthorized errors

**Diagnosis**:
1. Check `AUTH_GATEWAY_URL` is correct
2. Verify `X-API-Key` or `Authorization` header present
3. Check auth gateway is reachable

**Fix**:
```bash
# Test auth gateway directly
curl https://auth.lanonasis.com/v1/auth/verify -X POST -d '{}'
```

---

## Success Metrics

✅ **Zero repetitive integration cycles** through upfront cataloging  
✅ **Selective activation** per application/product  
✅ **1604 MCP tools** across 18 adapters  
✅ **18 API services** extracted from Postman  
✅ **Multi-strategy auth** (JWT, API key, OAuth)  
✅ **Lazy MCP discovery** (5 meta-tools in production)  

---

**Need updates?** Reference `docs/context/context-engineering-progress.md` for methodology and current status.  
**Want to continue?** Use: `Continue context engineering - read context-engineering-progress.md`
