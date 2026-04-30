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
2. **MaaS Integration:** OpenAPI-generated adapters for Memory and Intelligence APIs
3. **Security Hardening:** OAuth2/PKCE flow, auth-bridge simplification
4. **Testing:** Parity tests for gateway vs. direct API calls

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

**⚠️ Note:** Port documentation conflicts exist. Update `centralisation-tasks.md` as needed.

---

## Key Context Files

### Architecture Decision Records (ADRs)
Located in `docs/context/architecture/decisions/`:

- **ADR-001:** API Gateway Consolidation Strategy (Why Nginx, migration phases)
- **ADR-002:** Centralized CORS & Rate Limiting (Security approach)
- **ADR-003:** MaaS Adapter Architecture (OpenAPI-based generation)
- **ADR-004:** Auth Gateway vs Auth Bridge (Introspection pattern)

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
// Pattern: Health check all backends
GET /health          // Basic gateway health
GET /health/full     // Full upstream status
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
- **Central Gateway** only forwards tokens, doesn't validate locally
- **X-User-* headers** only trusted when from Nginx/Central Gateway
- **OAuth2 PKCE** flows must preserve cookies and redirects

#### Security Requirements
- **CORS origin whitelist** configured (no reflection)
- **SSL hardening** applied (TLS 1.2+, strong ciphers)
- **Rate limiting zones** in http context (not server)
- **No admin/reload endpoints** exposed
- **fail2ban** configured for auth endpoints

---

## Current Status & Priorities

### Migration Progress
```
Overall Progress: 15% complete ████████░░░░░░░░░░░░░

✅ Phase 0: Route Inventory (COMPLETE) - ROUTE_MAP.yaml created
⚠️ Phase 1: Nginx Foundation (0/12 tasks) - Gateway config, health checks
⚠️ Phase 2: Auth Unification (0/8 tasks) - OAuth2 flows, rate limiting
⚠️ Phase 3: MaaS Integration (1/7 tasks) - Memory aliases added
⚠️ Phase 4: MCP Protocol (0/7 tasks) - WebSocket/SSE support
⚠️ Phase 5: Cutover (0/8 tasks) - Production deployment
```

### Immediate Priorities (Next Sprint)
1. ✅ **Confirm actual ports** - Run `pm2 list` on VPS
2. ⏳ **Create Nginx gateway config** - `/etc/nginx/sites-available/gateway.conf`
3. ⏳ **Implement health aggregation** - `/health` and `/health/full` endpoints
4. ⏳ **Document trust boundaries** - `TRUST_BOUNDARIES.md`
5. ⏳ **Create parity tests** - Gateway vs. direct calls

### Known Gaps
- No ADR documentation (should be in `docs/context/architecture/decisions/`)
- No component-level context files (should be in `docs/context/components/`)
- Port documentation conflicts in `centralisation-tasks.md`
- No `TRUST_BOUNDARIES.md` document
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
- **Route failures:** Check `gateway.lanonasis.com/health/full` for upstream status
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
