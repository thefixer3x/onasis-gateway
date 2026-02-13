# API Gateway Consolidation Plan

> **Objective:** Replace fragmented routing across multiple platforms with a single centralized Nginx API Gateway on VPS, and onboard MaaS via adapters generated from OpenAPI + direct edge function routes.

**Feature Branch:** `feature/centralized-api-gateway`
**Target Domain:** `gateway.lanonasis.com` (future cutover: `api.landonnet.com`)
**VPS:** Hostinger (see credentials vault for access details)

---

## Current State: The Chaos Inventory

### Routing Fragmentation

| Source | Lines/Count | Location |
|--------|-------------|----------|
| Netlify redirects | 257 lines | 3 files (`_redirects`, `netlify.toml`, etc.) |
| Nginx configs | 497 lines | 4 files (scattered across sites-available) |
| Supabase Edge Functions | 28 functions | Supabase dashboard |
| Express backends | 4 servers | Ports 3001, 3003, 4000-4001, 8080 |
| CORS implementations | 5+ versions | Scattered across all backends |
| Rate limiting strategies | 6+ different | Inconsistent across services |

### Current Backend Services (Authoritative)

| Service | Port | Purpose |
|---------|------|---------|
| Central Gateway | 3000 | Primary API gateway, adapter execution, service orchestration |
| Auth Gateway | 4000 | Auth system (JWT, OAuth2/PKCE, sessions, API keys, MCP OAuth discovery) |
| Enterprise MCP | 3001 | Enterprise MCP prototype (mcp1.lanonasis.com) |
| MCP Core (MaaS) | 3001-3003 | Full MaaS MCP HTTP/WS/SSE (mcp.lanonasis.com, monorepo) |

### Problems This Causes

1. **Debugging nightmare** - Route fails, check 6 different places
2. **Inconsistent CORS** - Some endpoints work, others don't, no pattern
3. **Rate limiting gaps** - Some routes protected, others wide open
4. **SSL termination chaos** - Mixed handling across platforms
5. **No centralized logging** - Logs scattered, no unified view
6. **Deployment friction** - Change one route, deploy to 3 platforms

---

## Target State: Single Gateway + MaaS Adapter Layer

```text
                    ┌─────────────────────────────────────────┐
                    │       gateway.lanonasis.com             │
                    │       (Nginx API Gateway)               │
                    │                                         │
                    │  ┌─────────────────────────────────┐   │
                    │  │  Unified CORS                    │   │
                    │  │  Centralized Rate Limiting       │   │
                    │  │  JSON Structured Logging         │   │
                    │  │  SSL Termination                 │   │
                    │  │  Request ID Tracking             │   │
                    │  └─────────────────────────────────┘   │
                    └──────────────┬──────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌──────────────┐      ┌──────────────┐        ┌──────────────┐
   │ Auth Gateway │      │ Central GW   │        │ MCP / MaaS   │
   │    :4000     │      │    :3000     │        │ :3001-3003   │
   └──────────────┘      └──────────────┘        └──────────────┘
                                   │
                                   ▼
                           ┌────────────────┐
                           │ MaaS Adapters  │
                           │ (OpenAPI-gen)  │
                           └────────────────┘
```

### Gateway Features

- **Single `gateway.conf`** - ALL API routing in one file
- **Unified CORS** - One policy, consistent everywhere (with origin validation)
- **Centralized rate limiting** - Zone-based, per-endpoint configurable
- **Structured JSON logging** - Every request logged with context
- **Request tracing** - `X-Request-ID` propagated through all services
- **Health aggregation** - Single `/health` endpoint checks all backends
- **MaaS adapter layer** - Generated from OpenAPI + Direct API route registry

### Non-Negotiable Routing Guardrails

To prevent the exact drift that created the current fragmentation, the route policy is:

1. **Gateway-first entrypoint is mandatory:** all clients and internal consumers call the gateway domain first (`gateway.lanonasis.com` / `api.connectionpoint.tech`), never Supabase public URLs directly.
2. **Supabase compatibility path stays gateway-owned:** use gateway-managed passthrough (`/functions/v1/:functionName` and `/api/v1/functions/:functionName`) so auth, rate limits, logging, and request tracing stay centralized.
3. **No silent bypasses:** any new service/adaptor integration must document its gateway route and must not introduce direct client-to-provider or client-to-Supabase shortcuts outside approved exceptions (for example provider webhooks).
4. **Policy visibility:** gateway exposes route policy status through `GET /api/v1/gateway/route-policy` so rollout checks can verify enforcement mode and upstream mapping.

---

## MaaS Onboarding via OpenAPI (Authoritative)

**Primary sources:**
- `lan-onasis-monorepo/apps/onasis-core/docs/supabase-api/SUPABASE_REST_API_OPENAPI.yaml`
- `lan-onasis-monorepo/apps/onasis-core/docs/supabase-api/DIRECT_API_ROUTES.md`

**Strategy:**
1. Use OpenAPI as the canonical contract for `/api/v1/*` MaaS endpoints.
2. Use Direct API routes to map each logical endpoint to its exact edge function target.
3. Generate gateway adapters that proxy to Supabase edge functions with correct method, path, and auth headers.
4. Keep Netlify redirects as fallback during shadow mode; cut over to Nginx once parity is verified.

---

## Migration Phases (Updated)

### Phase 0: Truth & Route Inventory (Week 0)
**Goal:** Freeze the authoritative route map and MaaS contract sources

#### Tasks
- [ ] Confirm ports and domains in this document (central-gateway:3000, auth-gateway:4000, enterprise-mcp:3001, mcp-core:3001-3003).
- [ ] Create a canonical route map file (single source of truth) listing:
  - Auth routes → auth-gateway
  - MaaS routes → Supabase edge functions (from OpenAPI + Direct API routes)
  - MCP routes → mcp-core/enterprise-mcp
- [ ] Enumerate all `/api/v1/*` endpoints from the OpenAPI spec.
- [ ] Validate edge function targets for each endpoint from Direct API routes.
- [ ] Lock a CORS origin whitelist and auth header policy.

#### Deliverables
- `ROUTE_MAP.yaml` (authoritative mapping)
- `MAAS_ADAPTERS.md` (adapter generation plan)

---

### Phase 1: Foundation (Week 1)
**Goal:** Gateway infrastructure, health checks, basic routing + MaaS adapter scaffolding

#### Prerequisites
> **IMPORTANT:** Create snippet files BEFORE `gateway.conf` to avoid nginx startup failures.

```bash
# Create directories and snippet files first
sudo mkdir -p /etc/nginx/snippets
sudo touch /etc/nginx/snippets/proxy-headers.conf
sudo touch /etc/nginx/snippets/cors.conf
```

#### Tasks
- [ ] Create `gateway.lanonasis.com` DNS record
- [ ] Generate SSL certificate (Let's Encrypt)
- [ ] Create snippet files (proxy-headers.conf, cors.conf)
- [ ] Create base `gateway.conf` with:
  - Upstream definitions for all backends
  - JSON logging format
  - CORS origin whitelist (validated)
  - Rate limiting zones
- [ ] Implement `/health` aggregated endpoint
- [ ] Implement `/api/v1/status` gateway status
- [ ] Set up log rotation
- [ ] Add MaaS adapter scaffolding in central-gateway (service registry + route table)

#### Deliverables
```nginx
# /etc/nginx/sites-available/gateway.conf
# NOTE: Rate limiting zones and maps must be in http context (nginx.conf)

# === UPSTREAMS ===
upstream auth_service {
    server 127.0.0.1:3003;
    keepalive 32;
}

upstream api_gateway {
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream mcp_server {
    server 127.0.0.1:4000;
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
# Only allow requests from trusted origins - prevents CSRF attacks
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

# === CORS PREFLIGHT HANDLING (place in http context) ===
map $request_method $cors_preflight {
    default 0;
    OPTIONS 1;
}

# === CONNECTION LIMITING FOR WEBSOCKETS (place in http context) ===
limit_conn_zone $binary_remote_addr zone=ws_conn:10m;

# === CACHING FOR MCP TOOLS (place in http context) ===
proxy_cache_path /var/cache/nginx/mcp levels=1:2 keys_zone=mcp_cache:10m max_size=100m inactive=10m;

server {
    listen 443 ssl http2;
    server_name gateway.lanonasis.com;

    # === SSL CONFIGURATION (HARDENED) ===
    ssl_certificate /etc/letsencrypt/live/gateway.lanonasis.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.lanonasis.com/privkey.pem;

    # TLS Protocol Versions - only modern protocols
    ssl_protocols TLSv1.2 TLSv1.3;

    # Cipher suites - strong, modern ciphers only
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';
    ssl_prefer_server_ciphers off;

    # Session caching for performance
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # === SECURITY HEADERS ===
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # === LOGGING ===
    access_log /var/log/nginx/gateway_access.json gateway_json;
    error_log /var/log/nginx/gateway_error.log warn;

    # === GLOBAL CORS (with validated origin whitelist) ===
    # Only origins in the whitelist get reflected - others get empty header
    add_header 'Access-Control-Allow-Origin' '$cors_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Request-ID, X-API-Key' always;
    # Only set credentials header when origin is allowed
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # === REQUEST ID TRACKING ===
    # $request_id is auto-generated by nginx 1.11.0+, no need to set it
    add_header 'X-Request-ID' $request_id always;

    # === CORS PREFLIGHT HANDLING ===
    # Handle OPTIONS requests at server level for consistency
    if ($cors_preflight) {
        add_header 'Access-Control-Allow-Origin' '$cors_origin';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Request-ID, X-API-Key';
        add_header 'Access-Control-Allow-Credentials' 'true';
        add_header 'Access-Control-Max-Age' 86400;
        add_header 'Content-Length' 0;
        return 204;
    }

    # === REQUEST BODY SIZE LIMITS ===
    client_max_body_size 10M;  # Default for most APIs

    # === HEALTH CHECK (aggregated) ===
    location /health {
        # Content-Type must come BEFORE return directive
        add_header Content-Type application/json always;
        return 200 '{"status":"ok","gateway":"nginx","timestamp":"$time_iso8601"}';
    }

    # === API STATUS ===
    location /api/v1/status {
        add_header Content-Type application/json always;
        return 200 '{"gateway":"nginx","version":"1.0.0","upstreams":["auth_service","api_gateway","mcp_server"]}';
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name gateway.lanonasis.com;
    return 301 https://$server_name$request_uri;
}
```

---

### Phase 2: Auth Routes (Week 2)
**Goal:** Migrate all authentication endpoints
**Dependency:** UAI (Unified Auth Interface) merge

#### Routes to Migrate
```nginx
# === AUTH SERVICE (:3003) ===
location /api/v1/auth/ {
    limit_req zone=auth burst=20 nodelay;
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Specific auth endpoints
location = /api/v1/auth/login {
    limit_req zone=auth burst=5 nodelay;
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
location = /api/v1/auth/register {
    limit_req zone=auth burst=3 nodelay;
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
location = /api/v1/auth/refresh {
    limit_req zone=auth burst=10 nodelay;
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
location = /api/v1/auth/logout {
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
location = /api/v1/auth/verify {
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
location = /api/v1/auth/forgot-password {
    limit_req zone=auth burst=3 nodelay;
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
location = /api/v1/auth/reset-password {
    limit_req zone=auth burst=3 nodelay;
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# OAuth2 flows
location /api/v1/auth/oauth/ {
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Session management
location /api/v1/sessions/ {
    proxy_pass http://auth_service;
    include /etc/nginx/snippets/proxy-headers.conf;
}
```

#### Tasks
- [ ] Audit all auth routes in Netlify/Express
- [ ] Map routes to new gateway paths
- [ ] Implement auth-specific rate limiting (stricter)
- [ ] Add brute-force protection (fail2ban integration)
- [ ] Test OAuth2 flows through gateway
- [ ] Update client SDKs with new endpoints
- [ ] Reduce `onasis-auth-bridge.js` to auth-gateway introspection only (no local JWT validation)

#### Fail2ban Integration for Brute-Force Protection

Create `/etc/fail2ban/filter.d/nginx-gateway-auth.conf`:
```ini
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"uri":"/api/v1/auth/(login|register)".*"status":401.*$
            ^.*"client_ip":"<HOST>".*"uri":"/api/v1/auth/(login|register)".*"status":403.*$
ignoreregex =
```

Create `/etc/fail2ban/jail.d/nginx-gateway.conf`:
```ini
[nginx-gateway-auth]
enabled = true
port = http,https
filter = nginx-gateway-auth
logpath = /var/log/nginx/gateway_access.json
maxretry = 5
findtime = 300
bantime = 3600
```

---

### Phase 3: MaaS & Intelligence APIs (Week 3)
**Goal:** Migrate MaaS from Netlify redirects to adapter-driven gateway routing

#### Routes to Migrate
```nginx
# === CENTRAL GATEWAY (:3000) ===

# Memory API
location /api/v1/memory/ {
    limit_req zone=api burst=50 nodelay;
    proxy_pass http://api_gateway;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Adapters
location /api/adapters {
    proxy_pass http://api_gateway;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Simplified adapter execution (regex capture not needed)
location /api/execute/ {
    limit_req zone=api burst=30 nodelay;
    proxy_pass http://api_gateway;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Intelligence API - needs longer timeout for AI calls
location /api/v1/intelligence/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://api_gateway;
    proxy_read_timeout 120s;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Search
location /api/v1/search/ {
    proxy_pass http://api_gateway;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Bulk operations - allow larger payloads
location /api/v1/memory/bulk {
    client_max_body_size 50M;
    proxy_pass http://api_gateway;
    include /etc/nginx/snippets/proxy-headers.conf;
}
```

#### Tasks
- [ ] Inventory all memory/intelligence routes
- [ ] Set appropriate timeouts (AI calls need longer)
- [ ] Implement request body size limits (configured above)
- [ ] Add caching headers where appropriate
- [ ] Test adapter execution through gateway
- [ ] Performance baseline comparison
- [ ] Validate every OpenAPI path maps to a Direct API edge function target

---

### Phase 4: MCP Protocol (Week 4)
**Goal:** WebSocket and SSE support for MCP

#### Routes to Migrate
```nginx
# === MCP CORE (:3001-3003) ===

# MCP WebSocket - with connection limiting
location /mcp/ws {
    # Limit concurrent WebSocket connections per IP
    limit_conn ws_conn 10;

    proxy_pass http://mcp_server;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Request-ID $request_id;

    # Reasonable timeouts - rely on app-level ping/pong for keepalive
    proxy_read_timeout 3600s;   # 1 hour (adjust based on monitoring)
    proxy_send_timeout 3600s;
}

# MCP Server-Sent Events
location /mcp/sse {
    proxy_pass http://mcp_server;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Request-ID $request_id;
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;

    # SSE connections can be long-lived
    proxy_read_timeout 3600s;
}

# MCP REST endpoints
location /mcp/ {
    proxy_pass http://mcp_server;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# MCP Tool Discovery - with caching
location /mcp/tools {
    proxy_pass http://mcp_server;
    proxy_cache mcp_cache;
    proxy_cache_valid 200 5m;  # Cache tool list for 5 mins
    add_header X-Cache-Status $upstream_cache_status;
    include /etc/nginx/snippets/proxy-headers.conf;
}
```

#### Tasks
- [ ] Test WebSocket upgrade through Nginx
- [ ] Configure SSE with proper buffering disabled
- [ ] Implement connection limits for WS (configured above)
- [ ] Add MCP-specific logging
- [ ] Test with Claude Desktop / AI clients
- [ ] Monitor connection pooling
- [ ] Implement app-level ping/pong for WebSocket keepalive

---

### Phase 5: Cleanup & Cutover (Week 5)
**Goal:** Remove legacy configs, full production cutover

#### Cleanup Tasks
- [ ] Archive old Netlify redirects (don't delete yet)
- [ ] Archive old Nginx configs
- [ ] Update DNS for `api.lanonasis.com` → gateway
- [ ] Remove legacy CORS from backends (gateway handles it)
- [ ] Consolidate rate limiting to gateway only
- [ ] Update all documentation
- [ ] Update Postman collections
- [ ] Notify API consumers of changes

#### Rollback Plan
```bash
# Keep old configs for 30 days
/etc/nginx/archive/
├── pre-gateway/
│   ├── api.conf.bak
│   ├── auth.conf.bak
│   └── mcp.conf.bak
└── rollback.sh  # One-command rollback
```

---

## Configuration Snippets

### `/etc/nginx/snippets/proxy-headers.conf`
```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Request-ID $request_id;
proxy_set_header Connection "";
proxy_connect_timeout 10s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

### `/etc/nginx/snippets/cors.conf`
> **Note:** CORS is now handled at the server level using maps. This snippet is
> provided for reference but the map-based approach in gateway.conf is preferred.

```nginx
# CORS handling using validated origin from map
# This approach avoids the problematic "if" directive

# Headers are set globally in server block using $cors_origin
# which only contains the origin if it's in the whitelist

# For locations that need specific CORS handling:
add_header 'Access-Control-Allow-Origin' '$cors_origin' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Request-ID, X-API-Key' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
```

---

## Monitoring & Observability

### Log Analysis
```bash
# NOTE: Using jq -R 'fromjson?' handles potentially malformed lines gracefully

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

### Health Endpoints (Gateway + Full Upstream Check)

**Gateway basic health**
```bash
curl https://gateway.lanonasis.com/health
```

**Full upstream aggregation**
```bash
curl https://gateway.lanonasis.com/health/full
```

**Local override (central-gateway)**
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

CURL_TIMEOUT=5  # Fail fast on unresponsive services

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

---

## Admin Dashboard Integration

Once gateway is stable, the admin dashboard will connect to:

### Gateway Management Endpoints
```http
GET  /admin/gateway/status      # Overall gateway health
GET  /admin/gateway/upstreams   # Backend service status
GET  /admin/gateway/routes      # Route configuration
GET  /admin/gateway/metrics     # Request counts, latency
GET  /admin/gateway/logs        # Recent log entries
```

> ⚠️ **SECURITY WARNING: Config Reload Endpoint**
>
> The `POST /admin/gateway/reload` endpoint has been **removed from the public API**.
>
> **Why:** Exposing nginx config reload via HTTP is extremely dangerous:
> - Attackers could inject malicious configurations
> - A bad config could cause complete gateway outage
> - No way to validate config before apply
>
> **Instead, use CI/CD pipeline:**
> 1. Push config changes to git
> 2. CI validates with `nginx -t`
> 3. If valid, deploy and reload via SSH
> 4. Rollback automatically on failure
>
> For emergency reloads, use SSH with proper authentication:
> ```bash
> ssh gateway.lanonasis.com 'sudo nginx -t && sudo systemctl reload nginx'
> ```

### Dashboard Features (Post-Gateway)
- Real-time traffic visualization
- Per-route latency graphs
- Error rate monitoring
- Rate limit status per zone
- Upstream health indicators
- Log search and filtering

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Config locations | 6+ | 1 |
| CORS implementations | 5+ | 1 |
| Rate limiting strategies | 6+ | 3 zones |
| Debug time (avg route issue) | 30+ min | <5 min |
| Deployment touches | 3+ platforms | 1 (VPS) |
| Log search locations | 4+ | 1 |

---

## Risk Mitigation

1. **Gradual rollout** - Route by route, not big bang
2. **Shadow mode** - Log new gateway traffic alongside old
3. **Feature flags** - DNS-level switching capability
4. **Rollback ready** - One command to restore old configs
5. **Monitoring first** - Alerting in place before cutover
6. **Security validation** - All configs tested with `nginx -t` before deployment

---

## Security Checklist

Before going live, verify:

- [ ] CORS origin whitelist configured (no `$http_origin` reflection)
- [ ] SSL hardening applied (TLS 1.2+, strong ciphers)
- [ ] Security headers present (HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting zones in http context (not server)
- [ ] No admin/reload endpoints exposed
- [ ] fail2ban configured for auth endpoints
- [ ] WebSocket connection limits in place
- [ ] Health check script has timeouts
- [ ] Logs using proper JSON escaping

---

## Next Steps (Updated)

1. **Immediate:** Create feature branch `feature/centralized-api-gateway`
2. **This week:** Phase 0 route inventory + MaaS adapter plan
3. **Next:** Phase 1 foundation tasks + adapter scaffolding
4. **Ongoing:** Update this doc as we progress

---

*Last updated: 2026-01-24*
*Owner: @thefixer3x*
