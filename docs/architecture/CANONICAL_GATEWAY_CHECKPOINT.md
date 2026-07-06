# CANONICAL GATEWAY CHECKPOINT
**Date:** 2026-05-11
**Revision:** 3.0 — Corrected single-server topology + staged validation model
**Status:** ⛔ Ready for Staged Validation — NOT Approved for DNS Cutover
**Author:** L-Zero
**Classification:** Internal — Migration Preparation

> **Source authority:** `lan-onasis-monorepo/.devops/context-engineering/architecture/netlify-to-vps-migration-plan.md` (2026-04-30, revision 2) — most complete, most recently verified against live VPS state.

---

## Executive Summary

`api.lanonasis.com` currently routes through Netlify CDN + `_redirects` to Netlify Functions (`api-new`, `mcp-sse`, etc.) which proxy to Supabase Edge Functions. The migration replaces this with VPS Nginx on `ssh lanonasis-main` routing directly to backend services.

**All services are on ONE server: `ssh lanonasis-main` (Server B).** The `ssh vps` alias in the task description was misleading — all PM2 processes including `auth-gateway` are on the same host. There is no cross-server auth proxy needed.

**Bottom line:** The canonical target is Nginx on `ssh lanonasis-main` → backends on ports 3000, 3001, 3104, 4000. The Netlify `_redirects` must be eliminated.

---

## Verified Live State (as of 2026-04-30)

### PM2 Processes on `ssh lanonasis-main`

| PM2 Process | Port | Health Response | Notes |
|-------------|------|-----------------|-------|
| `auth-gateway` | 4000 | `{"status":"ok","service":"auth-gateway","outbox":{"pending":2017}}` | Auth, sessions, DB (PostgreSQL local), Redis (disabled) |
| `unified-gateway` | 3000 | `{"status":"healthy","api":{"services":5},"mcp":{"adapters":27,"tools":979}}` | Main API gateway — integrates 85 Supabase Edge Functions |
| `enterprise-mcp` | 3001 (internal) | via `mcp1.lanonasis.com` | MCP cluster, enterprise tools |
| `vortex-mcp` | 5001 (localhost) | `{"status":"healthy","server":"vortex-mcp"}` | Internal only |
| `Lanonasis MCP Server` | 3104 | `{"status":"healthy","service":"Lanonasis MCP Server"}` | REST + MCP, long uptime |
| `openclaw-gateway` | 18789 | — | Serves `control-room.connectionpoint.tech` |

### Nginx Enabled Sites (`/etc/nginx/sites-enabled/`)

| Config File | Domain | Backend |
|-------------|--------|---------|
| `gateway.lanonasis.com.conf` | `gateway.lanonasis.com` | port 3000 (unified-gateway) |
| `mcp1.lanonasis.com.conf` | `mcp1.lanonasis.com` | port 3001 (enterprise-mcp) |
| `auth.connectionpoint.tech.conf` | `auth.connectionpoint.tech` | port 4000 (auth-gateway) |
| `control-room.connectionpoint.tech.conf` | `control-room.connectionpoint.tech` | port 18789 (openclaw) |
| `default` | catch-all | returns 444 (null route) |

### SSL Certs

`gateway.lanonasis.com` ✅ `mcp1.lanonasis.com` ✅ `auth.connectionpoint.tech` ✅ `control-room.connectionpoint.tech` ✅
**`api.lanonasis.com` → NO cert yet. Must issue before cutover.**

### Infrastructure

Nginx 1.24.0 ✅ PostgreSQL 5432 ✅ Redis 6379 ✅ Ollama 11434 ✅

---

## Single-Server Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ ssh lanonasis-main (Server B — the only VPS server)              │
│                                                                  │
│ Nginx (port 80/443) ───→ api.lanonasis.com.conf                 │
│         │                                                           │
│         ├── /api/v1/auth/status ──────────→ Supabase direct      │
│         ├── /api/v1/auth/* ───────────────→ auth-gateway :4000   │
│         ├── /auth/*, /oauth/* ─────────────→ auth-gateway :4000   │
│         ├── /api/v1/intelligence/* ───────→ Supabase direct      │
│         ├── /api/v1/(memories|memory|...) ─→ unified-gateway :3000│
│         ├── /v1/keys/* ────────────────────→ unified-gateway :3000│
│         ├── /api/v1/* (catch-all) ─────────→ unified-gateway :3000│
│         └── /mcp ─────────────────────────→ Lanonasis MCP :3104  │
│                                                                  │
│ Backend services (all on localhost):                             │
│   Port 3000: unified-gateway (PM2)                               │
│   Port 3001: enterprise-mcp (PM2)                                │
│   Port 3104: Lanonasis MCP Server (PM2)                          │
│   Port 4000: auth-gateway (PM2)                                  │
│   Port 5001: vortex-mcp (localhost only)                         │
│   Port 18789: openclaw-gateway                                   │
│                                                                  │
│ ⚠️ api.lanonasis.com NOT yet in Nginx. No config exists yet.    │
│ ⚠️ api.lanonasis.com SSL cert NOT yet issued.                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Netlify (CURRENT — to be eliminated)                             │
│                                                                  │
│ api.lanonasis.com → Netlify CDN → _redirects → Netlify Functions│
│   ├── memory/* → memory-proxy.js → Supabase Edge Functions        │
│   ├── auth/*  → auth-api.js → auth-gateway                        │
│   ├── mcp/*   → mcp-sse.js → Lanonasis MCP Server :3104          │
│   ├── api/v1/intelligence/* → api-new.js → Supabase Edge Funcs   │
│   └── maas-api.js, key-manager.js, cli-auth.js                   │
│                                                                  │
│ ⚠️ This dependency must be fully removed post-migration.         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Domain Map — Current vs. Target

| Domain | Current State | Target State | Notes |
|--------|--------------|--------------|-------|
| `api.lanonasis.com` | Netlify CDN + `_redirects` → Netlify Functions | **VPS Nginx** → backends | Migration target |
| `gateway.lanonasis.com` | VPS Nginx → :3000 unified-gateway | No change | Already on VPS |
| `mcp1.lanonasis.com` | VPS Nginx → :3001 enterprise-mcp | No change | Already on VPS |
| `mcp.lanonasis.com` | **Unknown** — no Nginx config | VPS Nginx → :3104 (Lanonasis MCP Server) | DNS target unclear |
| `auth.connectionpoint.tech` | VPS Nginx → :4000 auth-gateway | No change | Auth domain |
| `auth.lanonasis.com` | **Not active** | Planned — Nginx → :4000 | Future |
| `docs.lanonasis.com` | VPS Nginx static (docs.lanonasis.com nginx.conf) | No change | Already on VPS |
| `dashboard.lanonasis.com` | Netlify SPA | Out of scope | Not this migration |

---

## Discrepancy Table

| # | Item | Local (`onasis-gateway` + `lanonasis-maas`) | VPS (`ssh lanonasis-main`) Live | Classification | Resolution |
|---|------|---------------------------------------------|-----------------------------------|----------------|------------|
| 1 | `api.lanonasis.com` Nginx config | Does not exist in local | **Not present in Nginx** — no `api.lanonasis.com.conf` | **C — live differs from both** | Create `/etc/nginx/sites-available/api.lanonasis.com.conf` on VPS |
| 2 | `api.lanonasis.com` SSL cert | Not in local | **Not present** (`certbot certificates` → no api.lanonasis.com) | **C — live differs from both** | Issue via certbot DNS challenge |
| 3 | WS/SSE ports (3002/3003) | `ROUTE_MAP.yaml` (2026-01-29) defines these as upstreams | **Not listening** — actual WS/SSE is on port 3104 | **D — documentation stale** | Retire 3002/3003 from canonical map; WS/SSE routes go to :3104 |
| 4 | `/api/v1/auth/status` routing | `gateway.conf`: `location = /health/full` → :3000 only | Not in Nginx (no api.lanonasis.com.conf yet) | **D — documentation stale** | In new Nginx config: exact `location = /api/v1/auth/status` → **Supabase direct** `auth-status` Edge Function (per monorepo plan Rev 2) |
| 5 | Intelligence routes | `netlify.toml`: `/api/v1/intelligence/*` → Netlify `api-new` | Not in Nginx (no api.lanonasis.com.conf yet) | **C — live differs from both** | In new Nginx config: direct proxy to Supabase `intelligence-$1` Edge Functions |
| 6 | Auth-gateway port | `gateway.conf`: `auth.connectionpoint.tech` → `127.0.0.1:4000` | `auth-gateway` is on port **4000** on same server ✅ | **B — VPS newer than local** | Confirmed — auth-gateway is on localhost:4000 on VPS |
| 7 | Memory routes | `gateway.conf`: `/api/v1/memor` → `127.0.0.1:3000` | `unified-gateway` on port **3000** ✅ | **B — VPS newer than local** | Confirmed — memory routes proxy to localhost:3000 |
| 8 | `/mcp` WS/SSE routing | `netlify.toml`: `/mcp` → Netlify `mcp-sse` function | In VPS Nginx (existing): `mcp1.lanonasis.com.conf` → :3001, but **`/mcp` path not in api.lanonasis.com.conf** | **C — live differs from both** | Add `/mcp` location in new api.lanonasis.com.conf → port 3104 |
| 9 | `mcp.lanonasis.com` DNS/Nginx | Not in local `gateway.conf` | **No Nginx config for `mcp.lanonasis.com`** | **D — documentation stale** | Verify DNS; add Nginx config → port 3104 |
| 10 | `auth.lanonasis.com` | Not in local | **Not active** (no Nginx config, no DNS) | **D — documentation stale** | Planned future work — not this migration |
| 11 | `lanonasis-maas` Express server (`src/server.ts`) | Express server in local (`lanonasis-maas/src/server.ts`) | **Not deployed** — VPS runs `onasis-gateway` via PM2, not `lanonasis-maas` Express | **A — local newer than VPS** | Not in scope for this migration. This migration replaces Netlify functions with VPS Nginx + existing PM2 services. MaaS adapter is separate workstream. |
| 12 | Profiles routes (`/api/v1/profiles/*`) | Not in local `gateway.conf` | **Pre-cutover config exists on VPS** (`lanonasis-unified` in `sites-available`, not yet enabled). Routes to Supabase `intelligence-profiles` EF | **B — VPS newer than local** | Confirmed from completion checklist (2026-05-09): profiles block already validated in `sites-available` |

---

## Canonical Target Map

### Port Assignments (Authoritative)

| Port | Service | Status | Notes |
|------|---------|--------|-------|
| 3000 | unified-gateway | ✅ Live | Main API gateway — integrates 85 Supabase Edge Functions |
| 3001 | enterprise-mcp | ✅ Live | MCP cluster, enterprise tools — via `mcp1.lanonasis.com` |
| 3104 | Lanonasis MCP Server | ✅ Live | REST + MCP, WS/SSE long-lived. WS/SSE routes go HERE, not 3002/3003 |
| 4000 | auth-gateway | ✅ Live | Auth, sessions, PostgreSQL (local), Redis disabled |
| 5001 | vortex-mcp | ✅ Live | Internal only — not in Nginx |
| 18789 | openclaw-gateway | ✅ Live | `control-room.connectionpoint.tech` only |

### Ports RETIRED from canonical map

| Port | Was | Reason |
|------|-----|--------|
| 3002 | `mcp_core_ws` placeholder | Never stood up. ROUTE_MAP.yaml (2026-01-29) is stale. |
| 3003 | `mcp_core_sse` placeholder | Never stood up. |

### Nginx routing for `api.lanonasis.com` (to be created)

| Route | Backend | Notes |
|-------|---------|-------|
| `= /api/v1/auth/status` | Supabase `auth-status` EF | Exact match, BEFORE wildcard |
| `~ ^/api/v1/auth/` | auth-gateway :4000 | Wildcard auth routes |
| `~ ^/(auth\|oauth)/` | auth-gateway :4000 | Legacy auth paths |
| `~ ^/api/v1/intelligence/(.+)$` | Supabase direct (`intelligence-$1`) | Direct nginx → Supabase proxy |
| `~ ^/api/v1/profiles/(.+)$` | Supabase direct (`intelligence-profiles/$1`) | Pre-existing in `sites-available` |
| `~ ^/api/v1/(memories\|memory\|keys\|...)` | unified-gateway :3000 | Memory, keys, projects, org, config |
| `~ ^/v1/keys/` | unified-gateway :3000 | Vendor API keys (was Netlify key-manager) |
| `/api/v1/` (catch-all) | unified-gateway :3000 | Any unlisted v1 routes |
| `/mcp` | Lanonasis MCP Server :3104 | WS/SSE long-lived |
| `/.well-known/onasis.json` | nginx static | Service discovery |
| `~ ^/(auth/web\|login\|signup)` | nginx static (`auth.html`) | Auth web UI |
| `/*` (SPA fallback) | nginx static (`index.html`) | Landing page |

---

## Execution Model — Staged Validation (Dimmer, Not Light Switch)

**Revised from:** Direct DNS cutover → phased bridge
**Rationale:** `api.lanonasis.com` touches CLI flows, SDKs, dashboard calls, MCP clients, auth redirects, Supabase routes, and older hardcoded integrations. A sudden cutover carries blast-radius risk.

```
Phase A ── No-traffic validation (--resolve smoke tests, response shape verification)
Phase B ── Shadow comparison (gateway.lanonasis.com vs api.lanonasis.com side-by-side)
Phase C ── Route-family bridge from Netlify (static → intelligence → memory/projects)
Phase D ── Auth bridge (only after non-auth routes stable)
Phase E ── DNS cutover (only after Phases A–D all gates pass)
Phase F ── 7-day soak → archive Netlify artifacts
```

### DNS Cutover Gates (Phase E blockers)

- [ ] Phase A — all smoke tests pass with correct response shapes (not just "not 502")
- [ ] Phase B — shadow comparison shows no meaningful behavioral difference
- [ ] Phase C1 — static/health routes bridged, 0 critical errors for ≥24h
- [ ] Phase C2 — intelligence routes bridged, 0 critical errors for ≥24h
- [ ] Phase C3 — memory/project routes bridged, 0 critical errors for ≥24h
- [ ] Phase D1 — low-risk auth routes bridged, 0 critical errors for ≥24h
- [ ] Phase D2 — OAuth/CLI auth bridged, 0 critical errors for ≥24h
- [ ] Phase D3 — full auth bridge stable for ≥24h
- [ ] Auth-gateway outbox backlog explained (not a blocker if explained and stable)
- [ ] Supabase direct proxy headers verified for auth-status, intelligence, profiles EFs
- [ ] OAuth/PKCE callback URLs confirmed not broken
- [ ] CORS origin inventory complete
- [ ] Postman MVP test collection passes against VPS (before DNS move)
- [ ] gateway.lanonasis.com parity tests pass

---

## Unresolved Items

| # | Question | How to Verify |
|---|----------|---------------|
| U1 | Is `mcp.lanonasis.com` DNS pointing? | `dig mcp.lanonasis.com A +short` |
| U2 | What Nginx config does `mcp.lanonasis.com` need? | Route `/mcp*` → `localhost:3104` |
| U3 | Is `auth.lanonasis.com` DNS configured? | `dig auth.lanonasis.com A +short` |
| U4 | Is `lanonasis-unified` in `sites-available` the same as planned `api.lanonasis.com.conf`? | Compare file contents on VPS |
| U5 | Auth-gateway outbox 2017 pending — is it growing? | `curl localhost:4000/health` repeatedly, watch `outbox.pending` |

---

## Recommended Promotion Direction

| Config | From | To | Rationale |
|--------|------|----|-----------|
| `api.lanonasis.com.conf` | Monorepo plan (Step 3) | VPS `sites-available` | Authoritative, Rev 2 corrected auth/status → Supabase, CORS whitelist, profiles block |
| WS/SSE routes to `:3104` | Live VPS state | `api.lanonasis.com.conf` | Monorepo plan already routes `/mcp` → :3104 |
| `/api/v1/auth/status` → Supabase direct | Monorepo plan Rev 2 | `api.lanonasis.com.conf` | Corrected per migration plan revision 2 |
| CORS validated origin whitelist | Monorepo plan Rev 2 | `api.lanonasis.com.conf` | Security fix — no `$http_origin` reflection |
| Profiles routes | VPS `sites-available/lanonasis-unified` | `api.lanonasis.com.conf` | Already validated on VPS (2026-05-09) |

**Do NOT promote:**
- Local `netlify.toml` WS/SSE routes to Netlify functions
- Ports 3002/3003 as WS/SSE targets
- `lanonasis-maas/src/server.ts` deployment (separate workstream)

---

## Validation Commands (Run on `ssh lanonasis-main`)

```bash
# === PRE-FLIGHT ===
# 1. All backend services healthy
curl -sf http://localhost:4000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('auth-gw:', d['status'], 'outbox:', d.get('outbox',{}).get('pending'))"
curl -sf http://localhost:3000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('unified-gw:', d['status'])"
curl -sf http://localhost:3104/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('mcp-3104:', d['status'])"

# 2. Nginx syntax + enabled sites
sudo nginx -t
ls -la /etc/nginx/sites-enabled/

# 3. api.lanonasis.com NOT yet in Nginx
sudo nginx -T 2>&1 | grep -c "api.lanonasis.com"  # Must return 0

# 4. No SSL cert yet
sudo certbot certificates | grep "api.lanonasis.com"  # Must return nothing

# 5. Check lanonasis-unified (pre-cutover config in sites-available)
ls /etc/nginx/sites-available/lanonasis-unified 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"

# 6. PM2 list
pm2 jlist | python3 -c "import sys,json; [print(p['name'], p['pm2_env']['PORT']) for p in json.load(sys.stdin)]"
```

## Rollback Commands

```bash
# === FULL ROLLBACK — restore api.lanonasis.com to Netlify ===

# 1. Revert DNS: api.lanonasis.com A → <Netlify IP> (in DNS provider console)

# 2. Remove Nginx config
sudo rm /etc/nginx/sites-enabled/api.lanonasis.com.conf
sudo nginx -t && sudo nginx -s reload

# 3. Verify Netlify is back
curl -sI https://api.lanonasis.com/health 2>&1 | grep -i "netlify"

# === PARTIAL ROLLBACK — Nginx config broken ===
sudo rm /etc/nginx/sites-enabled/api.lanonasis.com.conf
sudo nginx -t && sudo nginx -s reload
# DNS still points to VPS — fix Nginx config immediately, then reload
```