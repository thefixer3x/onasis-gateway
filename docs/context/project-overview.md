# onasis-gateway - Context Overview

**Last Updated:** 2026-04-30 | **Version:** 1.0.0 | **Owner:** @thefixer3x

---

## Quick Navigation for AI

This is the master context file. Based on your current task, refer to:

### 📚 Essential Context Files
- **Architecture & Decisions:** `docs/context/architecture/decisions/` folder
- **Component Details:** `docs/context/components/[component-name].md`
- **Development Workflows:** `docs/context/workflows/development.md`
- **Migration Plans:** `docs/architecture/API-GATEWAY-CONSOLIDATION-PLAN.md`

### 🔗 External Resources
- **GitHub:** https://github.com/thefixer3x/onasis-gateway
- **VPS:** Hostinger (credentials in vault) - 168.231.74.29:2222
- **Domains:** `gateway.lanonasis.com`, `api.lanonasis.com`

---

## Project Essentials

### Purpose
onasis-gateway is a comprehensive API service warehouse with MCP (Model Context Protocol) server interfaces and REST endpoints. It enables selective activation of services per application/product while maintaining complete coverage of all available APIs.

### Core Capabilities
- **MCP Protocol Support:** HTTP, WebSocket, and SSE transport for AI agent integration
- **API Gateway:** Centralized routing, CORS, rate limiting, and logging
- **Auth System:** JWT, OAuth2/PKCE, session management, API key validation
- **MaaS Adapters:** Memory, Intelligence, and Config APIs via Supabase edge functions
- **Service Orchestration:** Batch operations, health checks, and analytics

### Tech Stack
| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js >=18.0.0 |
| **Framework** | Express.js, Bun (alternative) |
| **Database** | Supabase (PostgreSQL) |
| **Protocol** | MCP (Model Context Protocol) |
| **Gateway** | Nginx (target), Express (current) |
| **Auth** | JWT, OAuth2/PKCE, API Keys |
| **Testing** | Vitest, Supertest |
| **Deployment** | PM2, Railway, VPS SSH |

### Architecture Pattern
**Hybrid Microservices with Centralized Gateway**
- Single gateway layer (Nginx target, Express current)
- Multiple backend services (Auth, MCP, Core)
- Supabase edge functions for MaaS
- MCP protocol for AI integration

### Current Focus
1. **API Gateway Consolidation:** Migrating from fragmented routing to centralized Nginx gateway
2. **MaaS Integration:** Supabase edge adapter plus memory/intelligence adapters are present; route cutover is still incomplete
3. **Security Hardening:** OAuth2/PKCE flow, auth delegation, and trust-boundary cleanup
4. **Testing:** Security/auth wiring coverage exists; gateway-vs-direct parity tests are still missing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    gateway.lanonasis.com                     │
│                    (Nginx API Gateway - Target)              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Unified CORS | Rate Limiting | JSON Logging | SSL     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │  Auth GW   │   │ Central GW │   │   MCP Core │
    │   :4000    │   │   :3000    │   │ :3001-3003 │
    └────────────┘   └────────────┘   └────────────┘
           │                 │                 │
           ▼                 ▼                 ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │   JWT      │   │   Adapters │   │  Protocol  │
    │   OAuth2   │   │  Execution │   │  (WS/SSE)  │
    │   PKCE     │   │  Service   │   │            │
    └────────────┘   └────────────┘   └────────────┘
           │                 │
           ▼                 ▼
    ┌────────────┐   ┌────────────────────────────┐
    │   Auth DB  │   │      MaaS Adapters         │
    │  Sessions  │   │  (Memory, Intelligence)    │
    └────────────┘   │   OpenAPI-generated        │
                     └────────────────────────────┘
```

### Key Decision Points

#### Port Architecture
| Service | Port | Purpose |
|---------|------|---------|
| Central Gateway | 3000 | Primary API gateway, adapter execution |
| Auth Gateway | 4000 | JWT, OAuth2/PKCE, sessions, API keys |
| MCP Core HTTP | 3001 | MCP HTTP endpoints |
| MCP Core WS | 3002 | MCP WebSocket |
| MCP Core SSE | 3003 | MCP Server-Sent Events |
| Enterprise MCP | 3001 | Enterprise MCP prototype |

**⚠️ Note:** `ROUTE_MAP.yaml`, `unified_gateway.js`, and `mcp_server.js` align on these ports. Some planning snippets were stale and should be treated as non-authoritative unless they match the route map.

---

## Key Context Files

### Architecture Decision Records (ADRs)
Located in `docs/context/architecture/decisions/`:

- **ADR-001:** Gateway Authentication Architecture
- **ADR-002:** API Gateway Consolidation Strategy
- **Next ADRs to add:** trust boundaries, MaaS adapter architecture, rollout/cutover decisions

### Component Documentation
Located in `docs/context/components/`:

- **Central Gateway** (`unified_gateway.js` - 78KB)
  - Adapter execution
  - Service orchestration
  - Health aggregation

- **Auth Gateway** (Port 4000)
  - JWT validation
  - OAuth2/PKCE flows
  - Session management
  - API key handling

- **MCP Server** (`mcp_server.js` - 17KB)
  - HTTP transport
  - WebSocket support
  - SSE streaming
  - Tool discovery

- **MaaS Adapters** (OpenAPI-generated)
  - Memory APIs
  - Intelligence APIs
  - Config & Keys
  - Project & Org management

### Development Workflows
Located in `docs/context/workflows/`:

- **Development:** Local dev setup, hot reloading, testing
- **Deployment:** VPS SSH, Railway, PM2 processes
- **Testing:** Parity tests, integration tests, health checks
- **CI/CD:** GitHub Actions, automated deployments

---

## AI Collaboration Notes

### Coding Standards

#### JavaScript/Node.js
- Use ES6+ syntax (async/await, arrow functions)
- Follow [Airbnb JS Style Guide](https://github.com/airbnb/javascript)
- Include error handling for all async operations
- Use `dotenvx` for environment management
- Prefer `bun` for development when available

#### TypeScript
- Strict typing required for new components
- Use `@typescript-eslint` rules from `package.json`
- Avoid `any` type unless absolutely necessary
- Include JSDoc for public APIs

### Common Patterns

#### Service Discovery
```javascript
// Pattern: Central gateway lists all available services
GET /api/services
GET /api/services?capability=payment
GET /api/services?search=stripe
```

#### Adapter Execution
```javascript
// Pattern: Execute operations through central gateway
POST /api/execute/{service}/{operation}
GET /api/execute/{service}/{id}
```

#### Health Aggregation
```javascript
// Current repo reality
GET /health          // Implemented on unified gateway
GET /health/full     // Implemented on mcp_server.js, not yet on unified_gateway.js
```

#### MCP Protocol
```javascript
// Pattern: MCP tools discovery and execution
GET /mcp/tools       // List available tools
POST /mcp/execute    // Execute MCP tool
WS /mcp/ws           // WebSocket connection
SSE /mcp/sse         // Server-sent events
```

### Constraints & Considerations

#### Gateway Route Policy (Non-Negotiable)
1. **Gateway-first entrypoint is mandatory:** All clients call `gateway.lanonasis.com` first, never Supabase public URLs directly
2. **Supabase compatibility stays gateway-owned:** Use `/functions/v1/:functionName` for Supabase integration
3. **No silent bypasses:** New services must document gateway routes
4. **Policy visibility:** Expose `GET /api/v1/gateway/route-policy` for enforcement checks

#### Authentication Rules
- **Auth Gateway** is source of truth for identity
- **Central Gateway** delegates primary verification to auth-gateway and still has a Supabase JWT compatibility fallback
- **X-User-* headers** only trusted when from Nginx/Central Gateway
- **OAuth2 PKCE** flows must preserve cookies and redirects

#### Security Requirements
- **CORS origin whitelist** configured (no reflection)
- **SSL hardening** applied (TLS 1.2+, strong ciphers)
- **Rate limiting zones** in http context (not server)
- **No admin/reload endpoints** exposed
- **fail2ban** planned for auth endpoints, not yet documented as deployed

---

## Current Status & Priorities

### Migration Progress
```
Repo Reality Snapshot

✅ Phase 0: Route inventory complete (`ROUTE_MAP.yaml`, `MAAS_ADAPTERS.md`)
⚠️ Phase 1: Partial - reference `gateway.conf` exists; unified gateway already has CORS, rate limiting, request IDs, `/health`
⚠️ Phase 2: Partial - auth verification/delegation exists; trust-boundary docs and final cleanup are pending
⚠️ Phase 3: Partial - Supabase edge adapter exists; memory/intelligence routing work exists; parity suite is missing
⚠️ Phase 4: Partial - WS/SSE proxy paths exist in reference config; live deployment still needs confirmation
⏳ Phase 5: Planned - cutover and cleanup remain outstanding
```

### Immediate Priorities (Next Sprint)
1. ✅ **Confirm canonical repo ports** - route map and runtime code now agree
2. ⏳ **Confirm live VPS ports and PM2 state** - still needs `pm2 list` / listener checks
3. ⏳ **Add unified gateway `/health/full` and `/api/v1/status`** - docs expect them; runtime does not yet provide both
4. ⏳ **Document trust boundaries** - `TRUST_BOUNDARIES.md`
5. ⏳ **Create parity tests** - gateway vs. direct MaaS calls

### Known Gaps
- No component-level context files (should be in `docs/context/components/`)
- No `TRUST_BOUNDARIES.md` document
- No `GATEWAY_ROLLOUT.md` document
- Unified gateway lacks `/health/full` and `/api/v1/status`
- Netlify still owns many production-facing routes
- Dedicated gateway-vs-direct parity suite is missing
- Missing MCP workflow documentation

---

## Quick Reference

### Starting Services
```bash
# Development
npm run dev              # Bun watch mode
npm start                # PM2 with dotenvx
npm start:pm2            # PM2 runtime
npm start:unified        # Unified gateway

# Testing
npm test                 # Vitest
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Maintenance
npm run health-check     # Health check script
npm run lint             # ESLint
npm run generate-adapters # Generate MCP adapters
```

### Key Scripts
- `npm run extract` - Extract service configs from Postman
- `npm run deploy` - Deploy to VPS via SSH
- `npm run test-mcp-adapters` - Test MCP adapter functionality
- `npm run sync:deployed-functions` - Sync deployed Supabase functions

### Environment Management
```bash
# Use dotenvx for encrypted env files
npx dotenvx run -f .env.production -- node unified_gateway.js

# Production env is AES-256-GCM encrypted (safe to commit)
# .env.production contains ciphertext
# .env.keys contains decryption keys (do NOT commit)
```

---

## Getting Help

### For AI Collaborators
1. **Read this file first** - It's your entry point to the project
2. **Check ADRs** - Understand architectural decisions
3. **Review component docs** - See detailed context for specific services
4. **Follow workflows** - Respect development and deployment patterns

### For Human Developers
1. **Postman Operating Playbook:** `docs/plans/2026-04-23-postman-operating-playbook.md`
2. **API Gateway Plan:** `docs/architecture/API-GATEWAY-CONSOLIDATION-PLAN.md`
3. **Integration Guide:** `docs/architecture/INTEGRATION_GUIDE.md`
4. **Context Progress:** `docs/context/context-engineering-progress.md`

### Troubleshooting
- **Route failures:** Use unified gateway `/health`; use `mcp_server.js` `/health/full` until unified aggregation lands
- **Auth issues:** Verify OAuth2 PKCE flow, check `onasis-auth-bridge.js` logs
- **CORS errors:** Ensure origin is in whitelist, check `gateway.conf` CORS map
- **MCP connectivity:** Test WebSocket upgrade, verify `limit_conn_ws_conn` settings

---

## Success Indicators

✅ **AI Collaboration Working When:**
- AI provides accurate, project-aware responses without re-explaining architecture
- New developers understand system quickly using documentation
- Architecture decisions are clearly documented and traceable
- Component context helps AI suggest fitting changes

🎯 **This project's goal:** Zero repetitive integration cycles through upfront cataloging and selective activation.

---

**Need updates?** Reference `context-engineering-progress.md` for methodology and current status.  
**Want to continue?** Use: `Continue context engineering - read context-engineering-progress.md`
