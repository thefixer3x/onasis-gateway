# API Gateway Consolidation Plan

> **Objective:** Replace 300+ fragmented routing rules across multiple platforms with a single centralized Nginx API Gateway on VPS.

**Feature Branch:** `feature/centralized-api-gateway`
**Target Domain:** `gateway.lanonasis.com`
**VPS:** Hostinger (168.231.74.29:2222)

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

### Current Backend Services

| Service | Port | Purpose |
|---------|------|---------|
| Onasis Gateway (Bun) | 3001 | Primary API gateway, adapter execution |
| Auth Service | 3003 | Authentication, JWT, sessions |
| MCP Server | 4000-4001 | Model Context Protocol for AI agents |
| Legacy Express | 8080 | Fallback/legacy endpoints |

### Problems This Causes

1. **Debugging nightmare** - Route fails, check 6 different places
2. **Inconsistent CORS** - Some endpoints work, others don't, no pattern
3. **Rate limiting gaps** - Some routes protected, others wide open
4. **SSL termination chaos** - Mixed handling across platforms
5. **No centralized logging** - Logs scattered, no unified view
6. **Deployment friction** - Change one route, deploy to 3 platforms

---

## Target State: Single Gateway

```
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
   │ Auth Service │      │ API Gateway  │        │  MCP Server  │
   │    :3003     │      │    :3001     │        │ :4000-4001   │
   └──────────────┘      └──────────────┘        └──────────────┘
```

### Gateway Features

- **Single `gateway.conf`** - ALL API routing in one file
- **Unified CORS** - One policy, consistent everywhere
- **Centralized rate limiting** - Zone-based, per-endpoint configurable
- **Structured JSON logging** - Every request logged with context
- **Request tracing** - `X-Request-ID` propagated through all services
- **Health aggregation** - Single `/health` endpoint checks all backends

---

## Migration Phases

### Phase 1: Foundation (Week 1)
**Goal:** Gateway infrastructure, health checks, basic routing

#### Tasks
- [ ] Create `gateway.lanonasis.com` DNS record
- [ ] Generate SSL certificate (Let's Encrypt)
- [ ] Create base `gateway.conf` with:
  - Upstream definitions for all backends
  - JSON logging format
  - Global CORS configuration
  - Rate limiting zones
- [ ] Implement `/health` aggregated endpoint
- [ ] Implement `/api/v1/status` gateway status
- [ ] Set up log rotation

#### Deliverables
```nginx
# /etc/nginx/sites-available/gateway.conf

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

# === LOGGING ===
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

# === RATE LIMITING ZONES ===
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;
limit_req_zone $http_authorization zone=api_key:10m rate=200r/s;

server {
    listen 443 ssl http2;
    server_name gateway.lanonasis.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/gateway.lanonasis.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gateway.lanonasis.com/privkey.pem;

    # Logging
    access_log /var/log/nginx/gateway_access.json gateway_json;
    error_log /var/log/nginx/gateway_error.log warn;

    # Global CORS
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Request-ID' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # Request ID
    set $request_id $request_id;
    add_header 'X-Request-ID' $request_id always;

    # Health check (aggregated)
    location /health {
        # Phase 1: Simple check
        return 200 '{"status":"ok","gateway":"nginx","timestamp":"$time_iso8601"}';
        add_header Content-Type application/json;
    }
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
location = /api/v1/auth/login { ... }
location = /api/v1/auth/register { ... }
location = /api/v1/auth/refresh { ... }
location = /api/v1/auth/logout { ... }
location = /api/v1/auth/verify { ... }
location = /api/v1/auth/forgot-password { ... }
location = /api/v1/auth/reset-password { ... }

# OAuth2 flows
location /api/v1/auth/oauth/ {
    proxy_pass http://auth_service;
}

# Session management
location /api/v1/sessions/ {
    proxy_pass http://auth_service;
}
```

#### Tasks
- [ ] Audit all auth routes in Netlify/Express
- [ ] Map routes to new gateway paths
- [ ] Implement auth-specific rate limiting (stricter)
- [ ] Add brute-force protection (fail2ban integration)
- [ ] Test OAuth2 flows through gateway
- [ ] Update client SDKs with new endpoints

---

### Phase 3: Memory & Intelligence APIs (Week 3)
**Goal:** Migrate core API gateway routes

#### Routes to Migrate
```nginx
# === API GATEWAY (:3001) ===

# Memory API
location /api/v1/memory/ {
    limit_req zone=api burst=50 nodelay;
    proxy_pass http://api_gateway;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Adapters
location /api/adapters {
    proxy_pass http://api_gateway;
}

location ~ ^/api/execute/(?<adapter>[^/]+)/(?<tool>[^/]+)$ {
    limit_req zone=api burst=30 nodelay;
    proxy_pass http://api_gateway/api/execute/$adapter/$tool;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# Intelligence API
location /api/v1/intelligence/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://api_gateway;
    proxy_read_timeout 120s;  # AI calls can be slow
}

# Search
location /api/v1/search/ {
    proxy_pass http://api_gateway;
}
```

#### Tasks
- [ ] Inventory all memory/intelligence routes
- [ ] Set appropriate timeouts (AI calls need longer)
- [ ] Implement request body size limits
- [ ] Add caching headers where appropriate
- [ ] Test adapter execution through gateway
- [ ] Performance baseline comparison

---

### Phase 4: MCP Protocol (Week 4)
**Goal:** WebSocket and SSE support for MCP

#### Routes to Migrate
```nginx
# === MCP SERVER (:4000-4001) ===

# MCP WebSocket
location /mcp/ws {
    proxy_pass http://mcp_server;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;  # Keep alive for 24h
    proxy_send_timeout 86400s;
}

# MCP Server-Sent Events
location /mcp/sse {
    proxy_pass http://mcp_server;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
}

# MCP REST endpoints
location /mcp/ {
    proxy_pass http://mcp_server;
    include /etc/nginx/snippets/proxy-headers.conf;
}

# MCP Tool Discovery
location /mcp/tools {
    proxy_pass http://mcp_server;
    proxy_cache_valid 200 5m;  # Cache tool list for 5 mins
}
```

#### Tasks
- [ ] Test WebSocket upgrade through Nginx
- [ ] Configure SSE with proper buffering disabled
- [ ] Implement connection limits for WS
- [ ] Add MCP-specific logging
- [ ] Test with Claude Desktop / AI clients
- [ ] Monitor connection pooling

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
```nginx
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' '$http_origin';
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Request-ID, X-API-Key';
    add_header 'Access-Control-Allow-Credentials' 'true';
    add_header 'Access-Control-Max-Age' 86400;
    add_header 'Content-Length' 0;
    add_header 'Content-Type' 'text/plain';
    return 204;
}
```

---

## Monitoring & Observability

### Log Analysis
```bash
# Real-time traffic
tail -f /var/log/nginx/gateway_access.json | jq .

# Errors only
tail -f /var/log/nginx/gateway_access.json | jq 'select(.status >= 400)'

# Slow requests (>1s)
cat /var/log/nginx/gateway_access.json | jq 'select(.response_time > 1)'

# Requests per upstream
cat /var/log/nginx/gateway_access.json | jq -r '.upstream' | sort | uniq -c
```

### Health Check Script
```bash
#!/bin/bash
# /usr/local/bin/gateway-health.sh

ENDPOINTS=(
    "http://127.0.0.1:3001/health"
    "http://127.0.0.1:3003/health"
    "http://127.0.0.1:4000/health"
)

for endpoint in "${ENDPOINTS[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
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
```
GET  /admin/gateway/status      # Overall gateway health
GET  /admin/gateway/upstreams   # Backend service status
GET  /admin/gateway/routes      # Route configuration
GET  /admin/gateway/metrics     # Request counts, latency
POST /admin/gateway/reload      # Reload nginx config
GET  /admin/gateway/logs        # Recent log entries
```

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

---

## Next Steps

1. **Immediate:** Create feature branch `feature/centralized-api-gateway`
2. **This week:** Phase 1 foundation tasks
3. **Ongoing:** Update this doc as we progress

---

*Last updated: 2026-01-24*
*Owner: @thefixer3x*
