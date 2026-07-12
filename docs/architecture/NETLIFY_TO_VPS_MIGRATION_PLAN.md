# Netlify to VPS Migration Plan

> **Objective:** Cut over all production API traffic from Netlify serverless functions to the Nginx gateway on Hostinger VPS, with zero-downtime and full rollback capability.
>
> **Parent:** SDK-17 — gateway stability and consolidation
> **References:** API-GATEWAY-CONSOLIDATION-PLAN.md, ROUTE_MAP.yaml, centralisation-tasks.md

---

## Current State: Netlify Deployment

### What's on Netlify

| Asset | Location | Purpose |
|-------|----------|---------|
| netlify.toml | repo root | Catch-all redirect: `/api/*` and `/*` → `.netlify/functions/mcp-server` |
| Netlify function | `netlify/functions/mcp-server` | Single serverless function handling all API traffic |
| DNS | Netlify-managed | `api.lanonasis.com`, `mcp.lanonasis.com`, `mcp1.lanonasis.com` |
| SSL | Netlify auto-provisioned | Let's Encrypt via Netlify |
| `_redirects` | `lan-onasis-monorepo/apps/onasis-core/_redirects` | Detailed route table (monorepo — authoritative for `/api/v1/*` mappings) |

### What's Already on VPS (Hostinger)

| Service | Port | PM2 Name | Status |
|---------|------|----------|--------|
| Central Gateway | 3000 | `central-gateway` | Running (unified_gateway.js / server.js) |
| Auth Gateway | 4000 | `auth-gateway` | Needs verification |
| Enterprise MCP | 3001 | `enterprise-mcp` | Needs verification |
| MCP Core WS | 3002 | `mcp-core` | Needs verification |
| MCP Core SSE | 3003 | `mcp-core` | Needs verification |
| Nginx | 80/443 | systemd | Config deployed, needs validation |
| SSL | Let's Encrypt | certbot | Needs verification for gateway.lanonasis.com |

**VPS access:** 168.231.74.29 (Hostinger), SSH: `ghost-vps`

---

## Target State

```
                          ┌──────────────────────────┐
                          │    Hostinger VPS          │
                          │                           │
  Internet ──────────────▶│  Nginx :80/:443           │
                          │  (gateway.lanonasis.com)  │
                          │                           │
                          │  ┌─────────────────────┐  │
                          │  │ Unified CORS         │  │
                          │  │ Rate Limiting        │  │
                          │  │ JSON Logging         │  │
                          │  │ SSL Termination      │  │
                          │  │ Request ID Tracking  │  │
                          │  └─────────┬───────────┘  │
                          │            │              │
                          │   ┌────────┼────────┐     │
                          │   ▼        ▼        ▼     │
                          │ :3000   :4000   :3001-3   │
                          │ central  auth    mcp      │
                          └──────────────────────────┘

Netlify: decommissioned (archived, not deleted — 30-day rollback window)
```

---

## Migration Phases

### Phase 0: Pre-Flight (Current — Week 0)

**Goal:** Verify VPS readiness before any traffic shift.

#### Tasks

- [ ] SSH into VPS and confirm all PM2 processes are running (`pm2 list`)
- [ ] Verify Nginx is installed and `nginx -t` passes with `gateway.conf`
- [ ] Verify SSL certs exist for `gateway.lanonasis.com`
- [ ] Test all upstream health endpoints from within VPS:
  ```bash
  curl -s http://127.0.0.1:3000/health
  curl -s http://127.0.0.1:4000/health
  curl -s http://127.0.0.1:3001/health
  ```
- [ ] Run `curl -H "Host: gateway.lanonasis.com" http://127.0.0.1/health` to test Nginx routing
- [ ] Create `/etc/nginx/snippets/proxy-headers.conf` and `/etc/nginx/snippets/cors.conf`
- [ ] Verify log rotation is configured for `/var/log/nginx/gateway_*.log`
- [ ] Set up fail2ban jails for auth endpoints (per consolidation plan)
- [ ] Confirm DNS propagation TTL is set low (300s or less) for cutover domains

#### Deliverables
- VPS readiness checklist (this document, checked off)
- Health check script deployed: `/usr/local/bin/gateway-health.sh`
- Nginx config validated: `nginx -t` clean

#### Gate: Do NOT proceed to Phase 1 until all Phase 0 items pass.

---

### Phase 1: Shadow Mode (Week 1)

**Goal:** Route production traffic through Nginx gateway in parallel with Netlify, comparing responses. Zero production impact.

#### Strategy

1. Add `gateway.lanonasis.com` DNS record pointing to VPS IP (168.231.74.29) if not already present
2. Deploy `gateway.conf` to VPS with all upstreams and routing
3. Run a comparison script that sends identical requests to both Netlify and gateway, flagging differences
4. Monitor gateway logs for errors, latency spikes, or routing failures

#### Tasks

- [ ] Create `gateway.lanonasis.com` A record → 168.231.74.29
- [ ] Deploy `docs/architecture/nginx/gateway.conf` to `/etc/nginx/sites-available/gateway.conf`
- [ ] Symlink: `ln -s /etc/nginx/sites-available/gateway.conf /etc/nginx/sites-enabled/`
- [ ] Reload Nginx: `sudo nginx -t && sudo systemctl reload nginx`
- [ ] Verify: `curl https://gateway.lanonasis.com/health` returns 200
- [ ] Run response parity tests for every route group (auth, MaaS, MCP, adapters)
- [ ] Monitor error rates via `tail -f /var/log/nginx/gateway_access.json | jq -R 'fromjson? | select(.status >= 400)'`
- [ ] Compare latency: Netlify vs gateway p50/p95/p99

#### Parity Test Script

```bash
#!/bin/bash
# compare-responses.sh — verify gateway responses match Netlify

NETLIFY_BASE="https://api.lanonasis.com"
GATEWAY_BASE="https://gateway.lanonasis.com"

ENDPOINTS=(
    "/health"
    "/api/v1/auth/status"
    "/api/v1/memory/health"
    "/api/v1/intelligence/health-check"
    "/api/adapters"
)

for endpoint in "${ENDPOINTS[@]}"; do
    netlify_code=$(curl -s -o /dev/null -w "%{http_code}" "$NETLIFY_BASE$endpoint")
    gateway_code=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_BASE$endpoint")
    if [ "$netlify_code" != "$gateway_code" ]; then
        echo "MISMATCH: $endpoint — Netlify=$netlify_code Gateway=$gateway_code"
    else
        echo "OK: $endpoint — $gateway_code"
    fi
done
```

#### Gate: All route groups must show <1% response divergence before Phase 2.

---

### Phase 2: Auth Cutover (Week 2)

**Goal:** Shift auth traffic to gateway. Auth is the highest-risk path (sessions, cookies, OAuth flows), so it moves first with extended monitoring.

#### DNS Strategy

- Keep `api.lanonasis.com` on Netlify (existing traffic unaffected)
- Update clients/SDKs to use `gateway.lanonasis.com` for auth endpoints
- Or: use a weighted DNS cutover if your DNS provider supports it

#### Routes Cut Over

| Path Pattern | Target | Notes |
|-------------|--------|-------|
| `/v1/auth/*` | auth-gateway:4000 | PKCE + legacy JWT |
| `/api/v1/auth/*` | auth-gateway:4000 | Auth API |
| `/oauth/*` | auth-gateway:4000 | OAuth2 flows |
| `/register` | auth-gateway:4000 | Registration |
| `/.well-known/*` | auth-gateway:4000 | OAuth discovery |
| `/web/*` | auth-gateway:4000 | Web auth pages |
| `/admin/*` | auth-gateway:4000 | Admin auth |
| `/mcp/*` | auth-gateway:4000 | MCP auth |
| `/auth/cli-login` | auth-gateway:4000 | CLI login |

#### Tasks

- [ ] Verify auth-gateway:4000 is running and healthy
- [ ] Test PKCE flow end-to-end through gateway: `gateway.lanonasis.com/oauth/authorize` → token exchange
- [ ] Test legacy JWT login through gateway
- [ ] Test CLI login with cookies and redirects
- [ ] Verify `Set-Cookie` headers are not stripped by Nginx
- [ ] Verify `Access-Control-Allow-Credentials: true` is present on auth routes
- [ ] Verify fail2ban is logging and blocking auth brute-force attempts
- [ ] Monitor auth error rates for 24 hours before proceeding

#### Fallback

Keep Netlify auth redirects active. If gateway auth fails:
1. Revert client SDKs to `api.lanonasis.com` (or DNS rollback)
2. Debug using gateway JSON logs (correlated by `X-Request-ID`)

---

### Phase 3: MaaS & Intelligence Cutover (Week 3)

**Goal:** Shift memory, intelligence, API key, and config management traffic from Netlify → Supabase edge functions to gateway routing.

#### Routes Cut Over

| Path Pattern | Target | Notes |
|-------------|--------|-------|
| `/api/v1/memory/*` | central-gateway:3000 → Supabase edge | Memory CRUD |
| `/api/v1/memories/*` | central-gateway:3000 → Supabase edge | Plural alias |
| `/api/v1/intelligence/*` | central-gateway:3000 → Supabase intel edge | AI features, 120s timeout |
| `/api/v1/keys/*` | central-gateway:3000 → Supabase edge | API key management |
| `/api/v1/projects/*` | central-gateway:3000 → Supabase edge | Project management |
| `/api/v1/config/*` | central-gateway:3000 → Supabase edge | Configuration |
| `/api/v1/org*` | central-gateway:3000 → Supabase edge | Organization |
| `/api/adapters/*` | central-gateway:3000 | Adapter registry |
| `/api/tools/*` | central-gateway:3000 | Tool discovery |
| `/api/services/*` | central-gateway:3000 | Service registry |

#### Tasks

- [ ] Inventory all `/api/v1/*` responses from Netlify (baseline)
- [ ] Compare with gateway responses using parity test script
- [ ] Verify Supabase edge function targets are reachable from VPS
- [ ] Test bulk memory operations through gateway (body size limits)
- [ ] Verify intelligence endpoints work with 120s timeout (AI calls)
- [ ] Test API key CRUD through gateway
- [ ] Update OpenAPI server URL to `https://gateway.lanonasis.com/api/v1` (or keep `api.lanonasis.com` until final cutover)
- [ ] Monitor for 48 hours before proceeding

---

### Phase 4: MCP WebSocket & SSE Cutover (Week 4)

**Goal:** Shift real-time MCP traffic (WebSocket, SSE) to gateway. This is the most complex due to connection persistence.

#### Routes Cut Over

| Path Pattern | Target | Protocol |
|-------------|--------|----------|
| `/ws` | mcp-core-ws:3002 | WebSocket |
| `/mcp/ws` | mcp-core-ws:3002 | WebSocket |
| `/sse` | mcp-core-sse:3003 | SSE |
| `/api/v1/events` | mcp-core-sse:3003 | SSE |
| `/api/mcp/enterprise/*` | enterprise-mcp:3001 | HTTP |

#### Tasks

- [ ] Verify mcp-core WS (:3002) and SSE (:3003) processes are running
- [ ] Test WebSocket handshake through Nginx: `wscat -c wss://gateway.lanonasis.com/ws`
- [ ] Test SSE connection stays open > 30 minutes
- [ ] Verify connection limits (10 per IP for WS) are enforced
- [ ] Verify proxy buffering is OFF for SSE endpoints
- [ ] Test MCP tool discovery with caching (`/mcp/tools` → 5min cache)
- [ ] Test with real MCP clients (Claude Desktop, Cursor, etc.)
- [ ] Monitor WS connection counts and SSE stream health for 72 hours

---

### Phase 5: Final Cutover & Netlify Decommission (Week 5)

**Goal:** Full DNS cutover. Netlify becomes archive-only.

#### DNS Cutover Plan

```
Before cutover:
  api.lanonasis.com    → Netlify (current)
  gateway.lanonasis.com → VPS 168.231.74.29 (shadow)

After cutover:
  api.lanonasis.com    → VPS 168.231.74.29 (CNAME or A record)
  gateway.lanonasis.com → VPS 168.231.74.29 (unchanged)
```

#### Cutover Procedure (Scheduled Maintenance Window)

1. **T-30min:** Notify API consumers of maintenance window
2. **T-15min:** Verify all VPS services healthy (`gateway-health.sh`)
3. **T-10min:** Reduce DNS TTL to 60s on `api.lanonasis.com`
4. **T-0:** Update `api.lanonasis.com` DNS record to VPS IP
5. **T+5min:** Verify DNS propagation (`dig api.lanonasis.com`)
6. **T+10min:** Run full parity test comparing `api.lanonasis.com` (now VPS) responses
7. **T+30min:** Monitor error rates, latency, auth flows
8. **T+2h:** If stable, declare cutover complete
9. **T+24h:** Archive Netlify configs (keep for 30 days)
10. **T+7d:** If no issues, decommission Netlify project

#### Tasks

- [ ] Schedule maintenance window with stakeholders
- [ ] Prepare cutover runbook (this section)
- [ ] Update `api.lanonasis.com` DNS A record → 168.231.74.29
- [ ] Add `api.lanonasis.com` to Nginx `server_name` directive
- [ ] Regenerate SSL cert to include `api.lanonasis.com`: `certbot --nginx -d api.lanonasis.com -d gateway.lanonasis.com`
- [ ] Run full integration test suite
- [ ] Monitor for 24 hours post-cutover
- [ ] Archive Netlify `_redirects` and `netlify.toml` to `docs/archive/netlify/`
- [ ] Update all documentation (README, Postman collections, SDK docs)
- [ ] Notify API consumers of new base URL (if changed)

#### Immediate Rollback (if cutover fails)

```bash
# 1. Revert DNS: point api.lanonasis.com back to Netlify
# 2. Wait for DNS propagation (60s TTL = fast rollback)
# 3. Verify traffic returns to Netlify
# 4. Debug VPS using gateway JSON logs
# 5. Fix issue, re-test in shadow mode, re-attempt cutover
```

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Auth gateway not running on VPS | Medium | High — all auth breaks | Verify in Phase 0; keep Netlify auth as fallback |
| MCP WebSocket upgrade fails through Nginx | Low | Medium — real-time features break | Test exhaustively in Phase 4 shadow mode |
| DNS propagation delay | High | Low — stale caches hit Netlify | Low TTL (60s) during cutover window |
| SSL cert doesn't cover new domain | Low | High — HTTPS breaks | Pre-generate cert before DNS cutover |
| Supabase edge function latency from VPS | Medium | Medium — slower MaaS responses | Monitor latency in shadow mode; keep direct-path fallback |
| Memory/CPU saturation on VPS | Medium | High — all services degrade | Set PM2 memory limits (1GB); monitor with `htop` |

---

## Success Criteria

- [ ] All routes in Netlify `_redirects` reachable via gateway with identical HTTP status codes
- [ ] PKCE and legacy JWT auth flows work through gateway
- [ ] WebSocket and SSE connections stable, no buffering
- [ ] Unified CORS policy across all routes (no per-service CORS)
- [ ] JSON logs with `X-Request-ID` correlate across services
- [ ] Zero production incidents attributable to the migration
- [ ] Netlify fully decommissioned within 30 days of cutover

---

## Related Documents

- **API-GATEWAY-CONSOLIDATION-PLAN.md** — Detailed Nginx configuration and per-phase route mapping
- **ROUTE_MAP.yaml** — Canonical route → upstream mapping (single source of truth)
- **centralisation-tasks.md** — Harmonized architecture decisions and open questions
- **TRUST_BOUNDARIES.md** — Header trust model and auth delegation rules
- **vps/VPS-COMPLETE-GUIDE.md** — VPS access, management, and troubleshooting

---

*Created: 2026-07-04*
*Owner: CTO (agent 347ed919)*
*Issue: SDK-17*
