# ADR-002: API Gateway Consolidation Strategy

**Status:** Accepted | **Date:** 2026-01-24 | **Authors:** thefixer3x

## Context

The onasis-gateway project currently suffers from **severely fragmented routing** across multiple platforms and configurations, creating significant operational challenges.

### Current State (The Chaos Inventory)

| Source | Lines/Count | Location |
|--------|-------------|----------|
| Netlify redirects | 257 lines | 3 files (`_redirects`, `netlify.toml`, etc.) |
| Nginx configs | 497 lines | 4 files (scattered across sites-available) |
| Supabase Edge Functions | 28 functions | Supabase dashboard |
| Express backends | 4 servers | Ports 3001, 3003, 4000-4001, 8080 |
| CORS implementations | 5+ versions | Scattered across all backends |
| Rate limiting strategies | 6+ different | Inconsistent across services |

### Problems This Causes

1. **Debugging Nightmare**: Route fails → check 6 different places
2. **Inconsistent CORS**: Some endpoints work, others don't, no pattern
3. **Rate Limiting Gaps**: Some routes protected, others wide open
4. **SSL Termination Chaos**: Mixed handling across platforms
5. **No Centralized Logging**: Logs scattered, no unified view
6. **Deployment Friction**: Change one route → deploy to 3 platforms

### Current Backend Services (Authoritative)

| Service | Port | Purpose |
|---------|------|---------|
| Central Gateway | 3000 | Primary API gateway, adapter execution, service orchestration |
| Auth Gateway | 4000 | Auth system (JWT, OAuth2/PKCE, sessions, API keys, MCP OAuth discovery) |
| Enterprise MCP | 3001 | Enterprise MCP prototype (mcp1.lanonasis.com) |
| MCP Core (MaaS) | 3001-3003 | Full MaaS MCP HTTP/WS/SSE (mcp.lanonasis.com, monorepo) |

## Decision

**Migrate to Single Nginx API Gateway** on VPS (`gateway.lanonasis.com`) as the **only entrypoint** for all clients.

### Target Architecture

```
┌─────────────────────────────────────────┐
│  gateway.lanonasis.com                  │
│  (Nginx API Gateway)                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Unified CORS                    │   │
│  │ Centralized Rate Limiting       │   │
│  │ JSON Structured Logging         │   │
│  │ SSL Termination                 │   │
│  │ Request ID Tracking             │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┼──────────┬────────────┐
     ▼         ▼          ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ Auth GW│ │ Central│ │ MCP Http│ │MCP WS/SSE│
│ :4000  │ │ :3000  │ │:3001   │ │ :3002-3 │
└────────┘ └────────┘ └────────┘ └─────────┘
     │           │
     ▼           ▼
┌────────────────────────────────┐
│    MaaS Adapters (OpenAPI)     │
│  (Memory, Intelligence, Keys)  │
└────────────────────────────────┘
```

### Key Features

1. **Single `gateway.conf`**: ALL API routing in one file
2. **Unified CORS**: One policy, consistent everywhere (with origin validation)
3. **Centralized Rate Limiting**: Zone-based, per-endpoint configurable
4. **Structured JSON Logging**: Every request logged with context
5. **Request Tracing**: `X-Request-ID` propagated through all services
6. **Health Aggregation**: Single `/health` endpoint checks all backends
7. **MaaS Adapter Layer**: Generated from OpenAPI + Direct API route registry

## Non-Negotiable Routing Guardrails

To prevent the exact drift that created the current fragmentation:

1. **Gateway-first entrypoint is mandatory**: All clients and internal consumers call the gateway domain first (`gateway.lanonasis.com` / `api.connectionpoint.tech`), never Supabase public URLs directly.

2. **Supabase compatibility path stays gateway-owned**: Use gateway-managed passthrough (`/functions/v1/:functionName` and `/api/v1/functions/:functionName`) so auth, rate limits, logging, and request tracing stay centralized.

3. **No silent bypasses**: Any new service/adaptor integration must document its gateway route and must not introduce direct client-to-provider or client-to-Supabase shortcuts outside approved exceptions (e.g., provider webhooks).

4. **Policy visibility**: Gateway exposes `GET /api/v1/gateway/route-policy` so rollout checks can verify enforcement mode and upstream mapping.

## Migration Strategy

### 5-Phase Migration Plan

**Feature Branch:** `feature/centralized-api-gateway`  
**Target Domain:** `gateway.lanonasis.com` (future cutover: `api.landonnet.com`)  
**VPS:** Hostinger (credentials in vault) - 168.231.74.29:2222

#### Phase 0: Truth & Route Inventory (Week 0) ✅ COMPLETE

**Goal:** Freeze the authoritative route map and MaaS contract sources

**Tasks Completed:**
- ✅ Created canonical route map file (`ROUTE_MAP.yaml`)
- ✅ Listed all `/api/v1/*` endpoints from OpenAPI spec
- ✅ Validated edge function targets for each endpoint
- ✅ Locked CORS origin whitelist and auth header policy

**Deliverables:**
- ✅ `docs/architecture/ROUTE_MAP.yaml` (authoritative mapping)
- ✅ `docs/architecture/MAAS_ADAPTERS.md` (adapter generation plan)

#### Phase 1: Foundation (Week 1) ⏳ PLANNED

**Goal:** Gateway infrastructure, health checks, basic routing + MaaS adapter scaffolding

**Tasks:**
- [ ] Create `gateway.lanonasis.com` DNS record
- [ ] Generate SSL certificate (Let's Encrypt)
- [ ] Create snippet files (proxy-headers.conf, cors.conf)
- [ ] Create base `gateway.conf` with upstreams, JSON logging, CORS whitelist, rate limiting zones
- [ ] Implement `/health` aggregated endpoint
- [ ] Implement `/api/v1/status` gateway status
- [ ] Set up log rotation
- [ ] Add MaaS adapter scaffolding in central-gateway (service registry + route table)

#### Phase 2: Auth Routes (Week 2) ⏳ PLANNED

**Goal:** Migrate all authentication endpoints through gateway

**Tasks:**
- [ ] Audit all auth routes in Netlify/Express
- [ ] Map routes to new gateway paths
- [ ] Implement auth-specific rate limiting (stricter: 10 r/s)
- [ ] Add brute-force protection (fail2ban integration)
- [ ] Test OAuth2 flows through gateway
- [ ] Update client SDKs with new endpoints
- [ ] Reduce `onasis-auth-bridge.js` to auth-gateway introspection only (no local JWT validation)

#### Phase 3: MaaS & Intelligence APIs (Week 3) ⏳ PLANNED

**Goal:** Migrate MaaS from Netlify redirects to adapter-driven gateway routing

**Tasks:**
- [ ] Inventory all memory/intelligence routes
- [ ] Set appropriate timeouts (AI calls need longer: 120s)
- [ ] Implement request body size limits (configured above)
- [ ] Add caching headers where appropriate
- [ ] Test adapter execution through gateway
- [ ] Performance baseline comparison
- [ ] Validate every OpenAPI path maps to a Direct API edge function target

**Note:** Memory plural aliases `/api/v1/memories/*` were added in April 21, 2026 (commit `33c86c3273df80969caf2060961d94692056962c`) to fix 404s for enterprise-mcp API clients.

#### Phase 4: MCP Protocol (Week 4) ⏳ PLANNED

**Goal:** WebSocket and SSE support for MCP

**Tasks:**
- [ ] Test WebSocket upgrade through Nginx
- [ ] Configure SSE with proper buffering disabled
- [ ] Implement connection limits for WS (10 concurrent per IP)
- [ ] Add MCP-specific logging
- [ ] Test with Claude Desktop / AI clients
- [ ] Monitor connection pooling
- [ ] Implement app-level ping/pong for WebSocket keepalive

#### Phase 5: Cleanup & Cutover (Week 5) ⏳ PLANNED

**Goal:** Remove legacy configs, full production cutover

**Tasks:**
- [ ] Archive old Netlify redirects (don't delete yet)
- [ ] Archive old Nginx configs
- [ ] Update DNS for `api.lanonasis.com` → gateway
- [ ] Remove legacy CORS from backends (gateway handles it)
- [ ] Consolidate rate limiting to gateway only
- [ ] Update all documentation
- [ ] Update Postman collections
- [ ] Notify API consumers of changes

## Configuration Template

### `/etc/nginx/sites-available/gateway.conf`

```nginx
# === UPSTREAMS ===
upstream auth_service {
    server 127.0.0.1:4000;
    keepalive 32;
}

upstream api_gateway {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream mcp_server {
    server 127.0.0.1:3001;
    keepalive 16;
}

# === LOGGING (place in http context) ===
log_format gateway_json escape=json '{'
    '"timestamp":"$time_iso8601",'
    '"request_id":"$request_id",'
    '"client_ip":"$remote_addr",'
    '"method":"$request_method",'
    '"uri":"$uri",'
    '"status":$status,'
    '"bytes":$body_bytes_sent,'
    '"response_time":$request_time,'
    '"upstream":"$upstream_addr",'
    '"user_agent":"$http_user_agent"'
'}';

# === RATE LIMITING ZONES (place in http context) ===
# General rate limit per IP - 20 r/s is reasonable for most APIs
limit_req_zone $binary_remote_addr zone=general:10m rate=20r/s;

# Stricter rate limit for auth endpoints
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/s;

# API rate limit per IP
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;

# Anonymous requests (no Authorization header) - separate bucket
limit_req_zone $binary_remote_addr zone=anon:10m rate=10r/s;

# === CORS ORIGIN WHITELIST (place in http context) ===
map $http_origin $cors_origin {
    default "";
    "https://app.lanonasis.com" $http_origin;
    "https://dashboard.lanonasis.com" $http_origin;
    "https://admin.lanonasis.com" $http_origin;
    "https://gateway.lanonasis.com" $http_origin;
    "https://api.lanonasis.com" $http_origin;
    # Development origins (remove in production)
    "http://localhost:3000" $http_origin;
    "http://localhost:5173" $http_origin;
    "http://127.0.0.1:3000" $http_origin;
}
```

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Config locations | 6+ | 1 |
| CORS implementations | 5+ | 1 |
| Rate limiting strategies | 6+ | 3 zones |
| Debug time (avg route issue) | 30+ min | <5 min |
| Deployment touches | 3+ platforms | 1 (VPS) |
| Log search locations | 4+ | 1 |

## Risk Mitigation

1. **Gradual rollout**: Route by route, not big bang
2. **Shadow mode**: Log new gateway traffic alongside old
3. **Feature flags**: DNS-level switching capability
4. **Rollback ready**: One command to restore old configs
5. **Monitoring first**: Alerting in place before cutover
6. **Security validation**: All configs tested with `nginx -t` before deployment

## Security Checklist Before Going Live

- [ ] CORS origin whitelist configured (no `$http_origin` reflection)
- [ ] SSL hardening applied (TLS 1.2+, strong ciphers)
- [ ] Security headers present (HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting zones in http context (not server)
- [ ] No admin/reload endpoints exposed
- [ ] fail2ban configured for auth endpoints
- [ ] WebSocket connection limits in place
- [ ] Health check script has timeouts
- [ ] Logs using proper JSON escaping

## Alternatives Considered

### Alternative 1: Keep Current Fragmented Setup

**Approach**: Maintain Netlify redirects + scattered Nginx configs + multiple Express backends.

**Pros**:
- No migration effort required
- No risk of new issues

**Cons**:
- Already causing debugging nightmares
- Inconsistent CORS and rate limiting
- Deployment friction
- No unified logging

**Why Rejected**: The current state is unsustainable and causing operational pain.

### Alternative 2: Single Express Gateway Only

**Approach**: Consolidate all routing into a single Express.js gateway, remove Nginx.

**Pros**:
- Simpler tech stack (one language)
- Faster to implement

**Cons**:
- Express not optimized for reverse proxy features (SSL, CORS, rate limiting)
- Harder to scale independently
- No native JSON logging
- No built-in connection limiting for WebSocket

**Why Rejected**: Nginx is purpose-built for these tasks and provides better performance.

### Alternative 3: Kong/Traefik API Gateway

**Approach**: Use dedicated API gateway software (Kong, Traefik, etc.)

**Pros**:
- Feature-rich out of the box
- Plugin ecosystem
- Built-in observability

**Cons**:
- Additional dependency to maintain
- More complex to configure
- Overkill for current scale (single VPS)

**Why Rejected**: Nginx is simpler, more familiar, and sufficient for current needs. Can always add Kong later.

## Monitoring & Observability

### Log Analysis

```bash
# Real-time traffic (tolerates malformed lines)
tail -f /var/log/nginx/gateway_access.json | jq -R 'fromjson?'

# Errors only (HTTP status >= 400)
tail -f /var/log/nginx/gateway_access.json | jq -R 'fromjson? | select(.status >= 400)'

# Slow requests (>1s)
cat /var/log/nginx/gateway_access.json | jq -R 'fromjson? | select(.response_time > 1)'

# Requests per upstream
cat /var/log/nginx/gateway_access.json | jq -R 'fromjson? | .upstream' | sort | uniq -c

# Error rate by endpoint
cat /var/log/nginx/gateway_access.json | jq -R 'fromjson? | select(.status >= 400) | .uri' | sort | uniq -c | sort -rn
```

### Health Endpoints

**Gateway basic health:**
```bash
curl https://gateway.lanonasis.com/health
```

**Full upstream aggregation:**
```bash
curl https://gateway.lanonasis.com/health/full
```

**Local override (central-gateway):**
```bash
HEALTH_AUTH_URL="http://127.0.0.1:4000/health" \
HEALTH_MCP_CORE_URL="http://127.0.0.1:3001/health" \
HEALTH_ENTERPRISE_MCP_URL="http://127.0.0.1:3001/health" \
curl http://127.0.0.1:3000/health/full
```

### Health Check Script

```bash
#!/bin/bash
# /usr/local/bin/gateway-health.sh
CURL_TIMEOUT=5 # Fail fast on unresponsive services

ENDPOINTS=(
    "http://127.0.0.1:3001/health"
    "http://127.0.0.1:3003/health"
    "http://127.0.0.1:4000/health"
)

for endpoint in "${ENDPOINTS[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$CURL_TIMEOUT" "$endpoint")
    if [ "$status" != "200" ]; then
        echo "UNHEALTHY: $endpoint returned $status"
        exit 1
    fi
done

echo "ALL HEALTHY"
exit 0
```

## Related Documents

- [API Gateway Consolidation Plan](../../API-GATEWAY-CONSOLIDATION-PLAN.md) - Full 5-phase migration plan
- [ROUTE_MAP.yaml](../../ROUTE_MAP.yaml) - Authoritative route mapping
- [MAAS_ADAPTERS.md](../../MAAS_ADAPTERS.md) - MaaS adapter generation plan
- [centralisation-tasks.md](../../centralisation-tasks.md) - Execution tasks
- [ADR-001](./adr-001-auth-architecture.md) - Auth architecture

## Open Questions

1. **Should we use Let's Encrypt or managed SSL?**
   - Option: Let's Encrypt (free, requires renewal)
   - Option: Cloudflare Proxy (automatic SSL, paid feature)
   - Decision: Let's Encrypt for now (free tier sufficient)

2. **Should we add API Gateway admin dashboard?**
   - Option: Build custom dashboard (control, complexity)
   - Option: Use Grafana (familiar, less control)
   - Decision: Not needed yet, use log analysis CLI first

3. **Should we split MaaS onto separate subdomain?**
   - Option: `maas.lanonasis.com` (clean separation)
   - Option: `/maas/*` under main gateway (simpler)
   - Decision: Keep under main gateway for now, can split later

---

**Superseded By:** None  
**Last Reviewed:** 2026-01-24  
**Next Review:** 2026-04-24 (quarterly)
