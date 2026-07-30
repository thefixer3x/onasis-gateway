# Behavioral Route Map: Netlify _redirects → Nginx gateway.lanonasis.com

> **Purpose:** Authoritative one-to-one mapping of every `_redirects` rule to its nginx equivalent,
> documenting behavioral differences so migration can be validated route-by-route.
>
> **Target gateway:** `gateway.lanonasis.com` (side-by-side test domain)
> **Production domain (post-cutover):** `api.lanonasis.com`
> **Source:** `apps/onasis-core/_redirects` (MD5: `55cfa2afae19b8a57b7d6d86a0a8d3f4`)
> **Updated:** 2026-07-30
> **Netlify Functions location:** `apps/onasis-core/netlify/functions/`

---

## Behavioral Category Key

| Icon | Meaning |
|------|---------|
| ✅ | Direct proxy — nginx `proxy_pass` is a clean behavioral match |
| ⚠️ | Behavioral gap — headers, path normalization, or middleware differs |
| 🔴 | Missing — no nginx equivalent exists yet, requires backend work |
| 🟡 | Partial — covers the route but has sub-behaviors to verify |

---

## Auth Routing Decision (Authoritative)

All authentication routes — including login, register, OAuth, callbacks, sessions,
API key management, CLI auth, and token verification — route through nginx directly
to the **canonical auth-gateway** at `localhost:4000` (public: `auth.lanonasis.com`).

**No attempt is made to replicate Netlify auth functions in nginx.** The canonical
auth gateway at port 4000 owns all auth logic. Nginx's job is simply `proxy_pass` +
header forwarding.

The `auth-gateway-adapter.js` (`services/auth-gateway/auth-gateway-adapter.js`) is
the unified-gateway's internal MCP tool abstraction over the same auth-gateway REST
endpoints — it is NOT a separate route layer. It maps 16 MCP tools to these endpoints:

| Tool | Endpoint | Method |
|------|----------|--------|
| login | `/v1/auth/login` | POST |
| exchange-supabase-token | `/v1/auth/token/exchange` | POST |
| logout | `/v1/auth/logout` | POST |
| get-me | `/v1/auth/me` | GET |
| get-session | `/v1/auth/session` | GET |
| verify-token | `/v1/auth/verify-token` | POST |
| list-sessions | `/v1/auth/sessions` | GET |
| initiate-oauth | `/v1/auth/oauth` | GET |
| request-magic-link | `/v1/auth/magic-link` | POST |
| verify-api-key | `/v1/auth/verify-api-key` | POST |
| create/lsit-api-key | `/v1/auth/api-keys` | POST/GET |
| get/rotate/revoke/delete-api-key | `/v1/auth/api-keys/:id` | GET/POST/POST/DELETE |

Auth routes status in this map: **✅ RESOLVED — all proxy_pass to localhost:4000**

---

## Route Family 1: Memory API (Netlify `memory-proxy.js` → unified-gateway :3000)

**Critical behavior:** `memory-proxy.js` normalizes paths. `/api/v1/memory/search` stays as-is, but
`/api/v1/memory` (no suffix) becomes `/collection`, and `/api/v1/memory/:id` becomes `/get/:id`.
The `_redirects` file uses `200!` which is a force-rewrite — Netlify rewrites the path internally
before forwarding to the function. The unified-gateway must understand the same normalized paths.

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 1 | `/api/v1/memory/search` | `memory-proxy/search` | 200! force rewrite | `proxy_pass http://localhost:3000` | ⚠️ memory-proxy sets CORS `*`; nginx uses whitelist |
| 2 | `/api/v1/memories/search` | `memory-proxy/search` | 200! force rewrite | `proxy_pass http://localhost:3000` | ⚠️ Same as above |
| 3 | `/api/v1/memory/stats` | `memory-proxy/stats` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 4 | `/api/v1/memories/stats` | `memory-proxy/stats` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 5 | `/api/v1/memory/bulk/delete` | `memory-proxy/bulk-delete` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 6 | `/api/v1/memories/bulk/delete` | `memory-proxy/bulk-delete` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 7 | `/api/v1/memory/bulk-delete` | `memory-proxy/bulk-delete` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 8 | `/api/v1/memories/bulk-delete` | `memory-proxy/bulk-delete` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 9 | `/api/v1/memory/health` | `memory-proxy/health` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 10 | `/api/v1/memory/list` | `memory-proxy/list` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 11 | `/api/v1/memories/list` | `memory-proxy/list` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 12 | `/api/v1/memory/update` | `memory-proxy/update` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 13 | `/api/v1/memory/delete` | `memory-proxy/delete` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 14 | `/api/v1/memory/get` | `memory-proxy/legacy-get` | 200! | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 15 | `/api/v1/memory/:id` | `memory-proxy/get/:id` | 200! → memory-proxy normalizes to `get/:id` | `proxy_pass http://localhost:3000` | 🔴 **GAP:** Netlify's `:id` wildcard captures path segment. Nginx needs a regex location to capture the ID and forward it |
| 16 | `/api/v1/memories/:id` | `memory-proxy/get/:id` | Same as above | `proxy_pass http://localhost:3000` | 🔴 Same gap |
| 17 | `/api/v1/memory` | `memory-proxy/collection` | 200! → memory-proxy normalizes bare path to `collection` | `proxy_pass http://localhost:3000` | ⚠️ Bare path must route correctly |
| 18 | `/api/v1/memories` | `memory-proxy/collection` | Same as above | `proxy_pass http://localhost:3000` | ⚠️ Same |
| 19 | `/api/v1/memories/*` | `maas-api/:splat` | 200 (not forced!) → falls through to Express app | `proxy_pass http://localhost:3000` | 🟡 Fallback; maas-api is Express with full Supabase + JWT logic |
| 20 | `/api/v1/memory/*` | `maas-api/:splat` | Same as above | `proxy_pass http://localhost:3000` | 🟡 Same |

### Memory API Verdict

> **The nginx draft routes `~ ^/api/v1/(memories|memory)(/|$)` to `unified-gateway:3000`** which
> is directionally correct. However, **the unified-gateway must replicate memory-proxy.js's path
> normalization** (singular→plural, suffix-based dispatch) **and its CORS behavior**.
>
> Test: `/api/v1/memory/some-id` must return a 200 or 404 from the unified-gateway, NOT a 502.
> Compare response bodies between `api.lanonasis.com` and `gateway.lanonasis.com`.

---

## Route Family 2: API Keys (Netlify `200!` direct to Supabase → nginx direct proxy)

These route directly to Supabase Edge Functions with a `200!` force redirect.
Nginx `proxy_pass` with proper header forwarding is a clean replacement.

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 21 | `/api/v1/keys` | `lanonasis.supabase.co/functions/v1/api-key-create` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/api-key-create` | ✅ **Direct match** |
| 22 | `/api/v1/keys/create` | `lanonasis.supabase.co/functions/v1/api-key-create` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/api-key-create` | ✅ |
| 23 | `/api/v1/keys/list` | `lanonasis.supabase.co/functions/v1/api-key-list` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/api-key-list` | ✅ |
| 24 | `/api/v1/keys/rotate` | `lanonasis.supabase.co/functions/v1/api-key-rotate` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/api-key-rotate` | ✅ |
| 25 | `/api/v1/keys/revoke` | `lanonasis.supabase.co/functions/v1/api-key-revoke` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/api-key-revoke` | ✅ |
| 26 | `/api/v1/keys/delete` | `lanonasis.supabase.co/functions/v1/api-key-delete` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/api-key-delete` | ✅ |

### API Keys Verdict

> ✅ **Clean swap.** Netlify headers (`apikey`, `Authorization`) must be forwarded identically.
> The existing `nginx-unified.conf` already sets `Authorization` and `X-API-Key` headers —
> verify `apikey` (lowercase header) is also forwarded as Supabase EFs expect it.

---

## Route Family 3: Auth Gateway (✅ RESOLVED — all to canonical auth-gateway :4000)

**Decision:** All auth routes proxy through nginx to `localhost:4000` (auth.lanonasis.com).
The auth-gateway-adapter.js handles any internal MCP tool mappings from the unified-gateway side.
No Netlify auth functions are replicated.

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Status |
|---|---|---|---|---|---|
| 27 | `/api/v1/api-keys/*` | `auth.lanonasis.com/api/v1/api-keys/:splat` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |
| 28 | `/api/v1/api-keys` | `auth.lanonasis.com/api/v1/api-keys` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |
| 29 | `/api/v1/auth/status` | `lanonasis.supabase.co/functions/v1/auth-status` | 200! → Supabase EF | `location = /api/v1/auth/status` → Supabase direct | ✅ Exact match before wildcard |
| 30 | `/v1/auth/*` | `auth.lanonasis.com/v1/auth/:splat` | 200! → VPS | `location /v1/auth/` → `localhost:4000` | ✅ |
| 31 | `/api/v1/auth/*` | `auth.lanonasis.com/v1/auth/:splat` | 200! → VPS | `location /api/v1/auth/` → `localhost:4000` | ✅ |
| 32 | `/api/v1/auth/introspect` | `auth.lanonasis.com/oauth/introspect` | 200! → VPS | `proxy_pass http://localhost:4000/oauth/introspect` | ✅ |
| 33 | `/auth/callback` | `auth.lanonasis.com/v1/auth/oauth/callback` | 301! → VPS | `proxy_pass http://localhost:4000/v1/auth/oauth/callback` | ⚠️ 301 redirect vs transparent proxy — verify auth-gateway handles the callback without requiring a client-side redirect |
| 34 | `/auth/cli-login` | `auth.lanonasis.com/auth/cli-login` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |
| 35 | `/auth/cli-login/*` | `auth.lanonasis.com/auth/cli-login` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |
| 36 | `/api/cli-auth/*` | `auth.lanonasis.com/auth/cli-login` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |
| 37 | `/oauth/*` | `auth.lanonasis.com/oauth/:splat` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |
| 38 | `/api/v1/oauth/*` | `auth.lanonasis.com/oauth/:splat` | 200! → VPS | `proxy_pass http://localhost:4000` | ✅ |

### Auth Gateway Verdict

> ✅ **RESOLVED — all auth routes are proxy_pass to localhost:4000.** The adapter at
> `services/auth-gateway/auth-gateway-adapter.js` is the MCP tool layer (not routing).
>
> **Note:** `/auth/callback` was a 301 redirect in Netlify. Nginx does transparent proxy.
> Verify auth-gateway's callback handler works without needing a client-side redirect.
>
> **Note:** `proxy_set_header Host auth.lanonasis.com` may be needed if auth-gateway
> validates the Host header against its expected domain.

---

## Route Family 4: Auth Callbacks (✅ RESOLVED — all to canonical auth-gateway :4000)

**Decision:** Dashboard authentication callback routes also go through nginx to auth-gateway.
The `dashboard-callback.js` Netlify function logic (JWT verification, token exchange, redirect)
must be handled by the auth-gateway on the VPS.

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Status |
|---|---|---|---|---|---|
| 39 | `/auth/dashboard/callback` | `dashboard-callback` | 200 → Netlify function | `proxy_pass http://localhost:4000/v1/auth/dashboard/callback` | ✅ Auth-gateway must expose this endpoint |
| 40 | `/dashboard/auth/callback` | `dashboard-callback` | Same as above | `proxy_pass http://localhost:4000/v1/auth/dashboard/callback` | ✅ Same |
| 41 | `/auth/health` | `auth-health` | 200 → Netlify function | `proxy_pass http://localhost:4000/health` | ✅ |
| 42 | `/auth/verify` | `auth-verify` | Via netlify.toml | `location /auth/verify` → `proxy_pass http://localhost:4000/v1/auth/verify` | ✅ Auth-gateway verifies tokens |

---

## Route Family 5: Organization, Projects, Config (Direct to Supabase EFs)

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 43 | `/api/v1/organization` | `lanonasis.supabase.co/functions/v1/organization-info` | 200! direct | `proxy_pass https://lanonasis.supabase.co/functions/v1/organization-info` | ✅ |
| 44 | `/api/v1/organizations` | Same | 200! | Same | ✅ |
| 45 | `/api/v1/organizations/:id` | Same | 200! | Same | ✅ |
| 46 | `/api/v1/org` | Same | 200! | Same | ✅ |
| 47 | `/api/v1/org/info` | Same | 200! | Same | ✅ |
| 48 | `/api/v1/projects` | `api-project-create` | 200! | `proxy_pass https://lanonasis.supabase.co/functions/v1/project-create` | ✅ |
| 49 | `/api/v1/projects/create` | Same | 200! | Same | ✅ |
| 50 | `/api/v1/projects/list` | `api-project-list` | 200! | `proxy_pass https://lanonasis.supabase.co/functions/v1/project-list` | ✅ |
| 51 | `/api/v1/config/get` | `config-get` | 200! | `proxy_pass https://lanonasis.supabase.co/functions/v1/config-get` | ✅ |
| 52 | `/api/v1/config/set` | `config-set` | 200! | `proxy_pass https://lanonasis.supabase.co/functions/v1/config-set` | ✅ |
| 53 | `/api/v1/config/:key` | `config-get` | 200! | Nginx needs a regex location to capture `:key` | 🔴 Regex path capture needed |
| 54 | `/api/v1/config` | `config-get` | 200! | `proxy_pass https://lanonasis.supabase.co/functions/v1/config-get` | ✅ |

---

## Route Family 6: Intelligence API (Direct to Supabase, 14 routes)

All route directly to `mxtsdgkwzjzlttpotole.supabase.co/functions/v1/intelligence-*` EFs.

| # | Netlify Rule | Netlify Target | Behavioral Notes |
|---|---|---|---|
| 55 | `/api/v1/intelligence/health-check` | → `intelligence-health-check` EF | ✅ Direct proxy match |
| 56 | `/api/v1/intelligence/health` | → Same (alias) | ✅ |
| 57 | `/api/v1/intelligence/memories` | → `intelligence-memories` EF | ✅ |
| 58 | `/api/v1/intelligence/suggest-tags` | → `intelligence-suggest-tags` EF | ✅ |
| 59 | `/api/v1/intelligence/find-related` | → `intelligence-find-related` EF | ✅ |
| 60 | `/api/v1/intelligence/detect-duplicates` | → `intelligence-detect-duplicates` EF | ✅ |
| 61 | `/api/v1/intelligence/extract-insights` | → `intelligence-extract-insights` EF | ✅ |
| 62 | `/api/v1/intelligence/analyze-patterns` | → `intelligence-analyze-patterns` EF | ✅ |
| 63 | `/api/v1/intelligence/predictive-recall` | → `intelligence-predictive-recall` EF | ✅ |
| 64 | `/api/v1/intelligence/prediction-feedback` | → `intelligence-prediction-feedback` EF | ✅ |
| 65 | `/api/v1/intelligence/behavior-record` | → `intelligence-behavior-record` EF | ✅ |
| 66 | `/api/v1/intelligence/behavior-recall` | → `intelligence-behavior-recall` EF | ✅ |
| 67 | `/api/v1/intelligence/behavior-suggest` | → `intelligence-behavior-suggest` EF | ✅ |

**Nginx equivalent (single catch-all):**
```nginx
location ~ ^/api/v1/intelligence/(.+)$ {
    rewrite ^/api/v1/intelligence/(.+)$ /functions/v1/intelligence-$1 break;
    proxy_pass https://mxtsdgkwzjzlttpotole.supabase.co;
    # forward headers: Authorization, X-API-Key, Content-Type
}
```

> ✅ **Clean swap.** The existing `nginx-unified.conf` already has this exact pattern.
> **⚠️ Critical:** Must forward both `Authorization` AND `apikey` headers (lowercase).
> Supabase EFs commonly check `apikey` specifically.

---

## Route Family 7: MCP, WebSocket, SSE (Protocol Routes)

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 68 | `/ws` | `mcp.lanonasis.com/ws` | 200! forced proxy | WebSocket upgrade | ✅ WS path, matches nginx config. But Netlify's `https://` URL means it's doing HTTPS proxy. Nginx does `http://localhost:3104` (internal). |
| 69 | `/api/v1/ws` | `mcp.lanonasis.com/ws` | Same | Same WS upgrade | ✅ |
| 70 | `/sse` | `mcp.lanonasis.com/sse` | 200! forced proxy to MCP server SSE | SSE with buffering off | ✅ |
| 71 | `/api/v1/events` | `mcp.lanonasis.com/api/v1/events` | 200! | SSE with buffering off | ✅ |
| 72 | `/message` | `mcp-message` | **200 function** (not forced!) → Netlify function runs | nginx can't run this; must go to unified-gw or mcp-backend | 🔴 **GAP.** `mcp-message.js` processes MCP tool calls. Must be handled by `mcp-server:3104` or unified-gateway. |
| 73 | `/api/v1/docs/mcp` | `docs.lanonasis.com/api/mcp` | 200! | `proxy_pass https://docs.lanonasis.com/api/mcp` | ✅ |
| 74 | `/api/v1/mcp/docs` | Same | 200! | Same | ✅ |
| 75 | `/mcp/docs` | Same | 200! | Same | ✅ |
| 76 | `/api/mcp` | `mcp` Netlify function | 200 → function runs | None | 🔴 **MISSING.** No nginx route mapped yet. |

---

## Route Family 8: Vendor Keys & Legacy API

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 77 | `/v1/keys/*` | `key-manager/:splat` | 200 → Netlify function: AES-256-GCM encryption, Supabase CRUD | `proxy_pass http://localhost:3000` | ⚠️ **key-manager.js does encryption.** Unified-gw must handle vendor key encryption/decryption too. |
| 78 | `/api/v1/maas/*` | `maas-api/:splat` | 200 → Netlify function: Express app with Supabase + JWT | `proxy_pass http://localhost:3000` | ⚠️ maas-api.js is ~3000 lines; unified-gw must replicate its behavior. |

---

## Route Family 9: Health, Setup, Migration (Admin)

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 79 | `/health` | `health` function | 200 → simple health check | `/health` → unified-gw:3000/health | ✅ |
| 80 | `/api/v1/health` | `health` function | 200 → same | Same | ✅ |
| 81 | `/info` | `info` function | 200 → service info | `/info` → unified-gw:3000/info | ✅ |
| 82 | `/migrate` | `apply-migration` function | 200 → runs DB migrations | None | 🔴 **MISSING.** Admin-only; add internal-only nginx location or keep as manual SSH. |
| 83 | `/setup` | `setup-defaults` function | 200 → initializes defaults | None | 🔴 **MISSING.** Same as above. |

---

## Route Family 10: Static & SPA

| # | Netlify Rule | Netlify Target | Netlify Behavior | Nginx Equivalent | Behavioral Notes |
|---|---|---|---|---|---|
| 84 | `/.well-known/onasis.json` | `/public/.well-known/onasis.json` | 200 → static file | nginx `alias` or `try_files` | ✅ Static file |
| 85 | `/auth/login` | `/auth.html` | 200 → static HTML | nginx `try_files` | ✅ |
| 86 | `/auth` | `/auth.html` | 200 → static HTML | nginx `try_files` | ✅ |
| 87 | `/` | `/index.html` | 200 → static HTML | nginx `try_files` | ✅ |
| 88 | `/api/*` | `api-gateway/:splat` | **200 catch-all** → Netlify function (last resort) | `/api/v1/` → unified-gw:3000 | ⚠️ **api-gateway.js fallback.** Nginx routes to unified-gw instead. Verify unified-gw handles every unmatched route. |

---

## Critical Behavioral Gaps Summary

| Gap | Severity | Impact | Resolution |
|---|---|---|---|
| **CORS `*` → whitelist** | 🔴 High | Any client calling from origin not in whitelist will break | Run origin source scan, verify all real clients in whitelist |
| **`memory-proxy.js` path normalization** | 🟡 Medium | Singular/plural aliasing, suffix dispatch must match | Verify unified-gateway handles both `/memory` and `/memories` paths with same suffix logic |
| **`key-manager.js` encryption** | 🟡 Medium | AES-256-GCM encryption of vendor keys | Unified-gw must implement same encryption for `/v1/keys/*` |
| **`mcp-message`** | 🟡 Medium | MCP tool call processing function | MCP server must handle `/message` directly |
| **`/migrate`, `/setup`** | 🟢 Low | Admin-only database operations | Keep as SSH-only, no nginx route needed |
| **`apikey` header** | 🟡 Medium | Supabase EFs expect lowercase `apikey` header | Must be explicitly forwarded by nginx |
| **Memory `:id` capture** | 🟡 Medium | Netlify `:id` splat must become nginx regex capture | Add `~ ^/api/v1/memory/([^/]+)$` regex location |
| **Configuration `:key` capture** | 🟡 Medium | Same pattern for `/api/v1/config/:key` | Add `~ ^/api/v1/config/([^/]+)$` regex location |

### Resolved (no longer gaps)

| Gap | Resolution |
|---|---|
| **Auth routes (Family 3)** | ✅ All proxy_pass to canonical auth-gateway :4000 |
| **`/auth/callback` 301 vs proxy** | ⚠️ Verify auth-gateway handles callbacks without client redirect |
| **`dashboard-callback`** | ✅ Goes to auth-gateway; must expose the callback endpoint |
| **`/auth/verify`** | ✅ Route to auth-gateway `/v1/auth/verify` |

---

## Verification Test Plan

For each route family, run this against **both** `api.lanonasis.com` (current) and `gateway.lanonasis.com` (candidate):

```bash
export VPS_IP="<vps-public-ip>"

compare_route() {
  local route=$1
  local method=${2:-GET}
  local headers=${3:-""}

  echo "=== $route ==="

  # Current production (via Netlify)
  echo "--- Netlify (api.lanonasis.com) ---"
  curl -sk -X $method https://api.lanonasis.com$route $headers -o /tmp/netlify-resp -w "\nHTTP: %{http_code}\n"

  # Candidate (via VPS --resolve)
  echo "--- VPS (gateway.lanonasis.com) ---"
  curl -sk --resolve gateway.lanonasis.com:443:$VPS_IP -X $method \
    https://gateway.lanonasis.com$route $headers -o /tmp/vps-resp -w "\nHTTP: %{http_code}\n"

  echo "Body diff:"
  diff <(cat /tmp/netlify-resp | python3 -m json.tool 2>/dev/null || cat /tmp/netlify-resp) \
       <(cat /tmp/vps-resp | python3 -m json.tool 2>/dev/null || cat /tmp/vps-resp) || true
  echo
}

# Run by family:
# Family 1: Memory
compare_route "/api/v1/memory/list" "GET" "-H 'Authorization: Bearer test'"
compare_route "/api/v1/memories/list" "GET" "-H 'Authorization: Bearer test'"
compare_route "/api/v1/memory/test-id" "GET" "-H 'Authorization: Bearer test'"

# Family 2: API Keys
compare_route "/api/v1/keys/list" "GET" "-H 'Authorization: Bearer test'"

# Family 3: Auth
compare_route "/api/v1/auth/status" "GET"
compare_route "/api/v1/auth/login" "POST" "-H 'Content-Type: application/json' -d '{\"email\":\"x\",\"password\":\"y\"}'"

# Family 6: Intelligence
compare_route "/api/v1/intelligence/health-check" "GET"

# Family 9: Health
compare_route "/health" "GET"
compare_route "/api/v1/health" "GET"

# CORS validation
echo "=== CORS: allowed origin ==="
curl -sk -H "Origin: https://dashboard.lanonasis.com" https://api.lanonasis.com/api/v1/health -D - 2>/dev/null | grep -i "access-control"
curl -sk --resolve gateway.lanonasis.com:443:$VPS_IP -H "Origin: https://dashboard.lanonasis.com" https://gateway.lanonasis.com/api/v1/health -D - 2>/dev/null | grep -i "access-control"

echo "=== CORS: blocked origin ==="
curl -sk -H "Origin: https://evil.example.com" https://api.lanonasis.com/api/v1/health -D - 2>/dev/null | grep -i "access-control"
curl -sk --resolve gateway.lanonasis.com:443:$VPS_IP -H "Origin: https://evil.example.com" https://gateway.lanonasis.com/api/v1/health -D - 2>/dev/null | grep -i "access-control"
```

---

## Scope Summary

| Family | Routes | Netlify → Nginx Verdict |
|---|---|---|
| 1. Memory API | 20 | 🟡 Mostly covered; path normalization to verify |
| 2. API Keys | 6 | ✅ Direct swap |
| 3. Auth Gateway | 12 | ✅ **RESOLVED — all to canonical auth-gateway :4000** |
| 4. Auth Callbacks | 4 | ✅ **RESOLVED — all to canonical auth-gateway :4000** |
| 5. Org/Projects/Config | 12 | ✅ Mostly; config/:key needs regex |
| 6. Intelligence API | 14 | ✅ Clean swap |
| 7. MCP/WS/SSE | 9 | 🟡 `/message` and `/api/mcp` missing |
| 8. Vendor Keys | 2 | ⚠️ Encryption logic must be replicated |
| 9. Health/Admin | 5 | 🟡 `/migrate` and `/setup` missing (admin-only) |
| 10. Static/SPA | 5 | ✅ Clean swap |

> **Auth families 3 & 4 are resolved: all 16 auth routes proxy directly to the canonical
> auth-gateway (`localhost:4000`). The adapter at `services/auth-gateway/auth-gateway-adapter.js`
> is the unified-gateway's MCP tool layer over the same endpoints — not a separate route path.**
>
> **Overall: ~70% of routes are a clean swap or resolved, 20% have minor gaps to verify,
> 10% have missing nginx equivalents.**
