# NETLIFY TO VPS MIGRATION PLAN
**For:** api.lanonasis.com
**Status:** ⛔ Ready for Staged Validation — NOT Approved for DNS Cutover
**Revision:** 4.0 — Staged validation model (dimmer, not light switch)
**Date:** 2026-05-11
**Author:** L-Zero
**Source:** `lan-onasis-monorepo/.devops/.../netlify-to-vps-migration-plan.md` (Rev 2, 2026-04-30) + local reconciliation

---

## Status: Not Yet Ready for DNS Cutover

> **⚠️ DNS cutover is BLOCKED until all Phase E gates pass.** The VPS has never handled production traffic for `api.lanonasis.com`. A sudden A-record change carries blast-radius risk across CLI flows, SDKs, dashboard calls, MCP clients, auth redirects, Supabase routes, and older hardcoded integrations. Use the staged bridge model below instead.

---

## Topology — Single VPS (`ssh lanonasis-main`)

> ⚠️ **All services are on ONE server: `ssh lanonasis-main`.** The `ssh vps` alias in earlier documentation was misleading — auth-gateway, unified-gateway, enterprise-mcp, Lanonasis MCP Server all run on the same host. No cross-server proxy is needed.

**Server:** `ssh lanonasis-main`
**All backends:** `localhost` (127.0.0.1)
**Nginx:** on this server — serves `api.lanonasis.com`

---

## Revised Execution Model

```
Phase A ── No-traffic validation (--resolve smoke tests)
Phase B ── Shadow comparison (gateway.lanonasis.com vs api.lanonasis.com side-by-side)
Phase C ── Route-family bridge from Netlify (low-risk routes first)
Phase D ── Auth bridge (only after non-auth routes are stable)
Phase E ── DNS cutover (only after Phases A–D pass all gates)
Phase F ── 7-day soak → archive Netlify artifacts
```

**Principle:** Behave like a dimmer switch, not a light switch.

---

## Phase A — No-Traffic Validation

**Risk:** Zero — no external traffic involved.

### Pre-Migration Verification (on `ssh lanonasis-main`)

```bash
ssh lanonasis-main

# === BACKEND HEALTH ===
curl -sf http://localhost:4000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('auth-gw:', d['status'], '| outbox pending:', d.get('outbox',{}).get('pending'))"
curl -sf http://localhost:3000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('unified-gw:', d['status'])"
curl -sf http://localhost:3104/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('mcp-3104:', d['status'])"

# === NGINX STATE ===
sudo nginx -t
ls -la /etc/nginx/sites-enabled/

# === api.lanonasis.com NOT YET CONFIGURED ===
sudo nginx -T 2>&1 | grep -c "api.lanonasis.com"  # Must be 0

# === NO SSL CERT YET ===
sudo certbot certificates | grep "api.lanonasis.com"  # Must return nothing

# === PM2 LIST ===
pm2 jlist | python3 -c "import sys,json; [print(p['name'], p['pm2_env']['PORT']) for p in json.load(sys.stdin)]"

# === SUPABASE REACHABILITY ===
curl -sf https://mxtsdgkwzjzlttpotole.supabase.co/functions/v1/system-health \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY /opt/lanonasis/lan-onasis-monorepo/apps/onasis-core/.env 2>/dev/null | cut -d= -f2)" \
  | python3 -c "import sys,json; print('Supabase:', json.load(sys.stdin).get('status'))"
```

**If any health check fails — do not proceed. Resolve first.**

---

### Issue SSL Certificate (DNS challenge — A record stays on Netlify)

```bash
ssh lanonasis-main

sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --agree-tos \
  --email admin@lanonasis.com \
  -d api.lanonasis.com

# Certbot pauses. Add TXT record in DNS provider:
#   Name:  _acme-challenge.api.lanonasis.com
#   Type:  TXT
#   Value: <token-from-certbot>
# Wait ~60s for propagation, press Enter.

# Verify
sudo certbot certificates | grep -A2 "api.lanonasis.com"

# ⚠️ After migration (once A record points to VPS), re-issue for auto-renewal:
# sudo certbot certonly --nginx -d api.lanonasis.com
```

**Rollback:** `sudo certbot delete --cert-name api.lanonasis.com`

---

### Create Nginx Config (DNS still on Netlify)

```bash
ssh lanonasis-main

sudo tee /etc/nginx/sites-available/api.lanonasis.com.conf > /dev/null << 'NGINX_CONF'
# =============================================================================
# api.lanonasis.com — VPS Gateway
# Replaces: Netlify CDN + _redirects + Netlify Functions
# Based on: lan-onasis-monorepo Rev 2 (2026-04-30, corrected auth/status, CORS, profiles)
# =============================================================================

# CORS — validated origin whitelist (NOT $http_origin reflection)
map $http_origin $cors_origin {
    default                              "";
    "https://dashboard.lanonasis.com"    "https://dashboard.lanonasis.com";
    "https://mcp.lanonasis.com"          "https://mcp.lanonasis.com";
    "https://api.lanonasis.com"          "https://api.lanonasis.com";
    "https://docs.lanonasis.com"         "https://docs.lanonasis.com";
    "https://lanonasis.com"              "https://lanonasis.com";
    "http://localhost:3000"              "http://localhost:3000";
    "http://localhost:3001"              "http://localhost:3001";
    "http://localhost:5173"              "http://localhost:5173";
}

log_format json_api escape=json
    '{"time":"$time_iso8601","remote_addr":"$remote_addr",'
    '"method":"$request_method","uri":"$uri","status":$status,'
    '"upstream":"$upstream_addr","resp_time":$request_time,'
    '"referrer":"$http_referer","user_agent":"$http_user_agent"}';

limit_req_zone $binary_remote_addr zone=auth_limit:10m  rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m   rate=10r/s;
limit_req_zone $binary_remote_addr zone=memory_limit:10m rate=100r/m;

server {
    listen 80;
    listen [::]:80;
    server_name api.lanonasis.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.lanonasis.com;

    ssl_certificate      /etc/letsencrypt/live/api.lanonasis.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/api.lanonasis.com/privkey.pem;
    include              /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam          /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CORS
    add_header Access-Control-Allow-Origin  $cors_origin always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Accept,Authorization,Cache-Control,Content-Type,X-API-Key,X-Project-Scope,X-Requested-With" always;
    add_header Vary Origin always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }

    client_max_body_size 10M;

    access_log /var/log/nginx/api.lanonasis.com.access.log json_api;
    error_log  /var/log/nginx/api.lanonasis.com.error.log warn;

    # === STATIC FILES ===
    root /opt/lanonasis/lan-onasis-monorepo/apps/onasis-core;

    location = /.well-known/onasis.json {
        alias /opt/lanonasis/lan-onasis-monorepo/apps/onasis-core/public/.well-known/onasis.json;
        add_header Content-Type "application/json";
        add_header Cache-Control "public, max-age=300";
        access_log off;
    }

    location ~ ^/(auth/web|login|signup) {
        try_files /auth.html =404;
    }

    location ~* \.(css|js|svg|ico|png|jpg|jpeg|webp|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
        access_log off;
    }

    # === HEALTH ===
    location = /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    location = /info {
        proxy_pass http://localhost:3000/info;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # === AUTH — ORDER MATTERS ===
    # 1. Exact match /api/v1/auth/status → Supabase (MUST come first)
    # 2. Wildcard /api/v1/auth/* → auth-gateway :4000
    # 3. Legacy /auth/* and /oauth/* → auth-gateway :4000

    location = /api/v1/auth/status {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass https://mxtsdgkwzjzlttpotole.supabase.co/functions/v1/auth-status;
        proxy_ssl_server_name on;
        proxy_ssl_name mxtsdgkwzjzlttpotole.supabase.co;
        proxy_set_header Host mxtsdgkwzjzlttpotole.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_read_timeout 30s;
    }

    location ~ ^/api/v1/auth/ {
        limit_req zone=auth_limit burst=10 nodelay;

        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Set-Cookie;
        proxy_pass_header Cookie;
        proxy_read_timeout 60s;
    }

    location ~ ^/(auth|oauth)/ {
        limit_req zone=auth_limit burst=10 nodelay;

        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Set-Cookie;
        proxy_pass_header Cookie;
        proxy_read_timeout 60s;
    }

    # === INTELLIGENCE — direct nginx → Supabase Edge Functions ===
    location ~ ^/api/v1/intelligence/(.+)$ {
        limit_req zone=api_limit burst=10 nodelay;

        rewrite ^/api/v1/intelligence/(.+)$ /functions/v1/intelligence-$1 break;

        proxy_pass https://mxtsdgkwzjzlttpotole.supabase.co;
        proxy_ssl_server_name on;
        proxy_ssl_name mxtsdgkwzjzlttpotole.supabase.co;
        proxy_set_header Host mxtsdgkwzjzlttpotole.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_set_header X-Project-Scope $http_x_project_scope;
        proxy_set_header Content-Type $http_content_type;
        proxy_read_timeout 120s;
    }

    # === PROFILES — direct Supabase proxy (Phase 2) ===
    location ~ ^/api/v1/profiles/(.+)$ {
        limit_req zone=api_limit burst=10 nodelay;

        rewrite ^/api/v1/profiles/(.+)$ /functions/v1/intelligence-profiles/$1 break;

        proxy_pass https://mxtsdgkwzjzlttpotole.supabase.co;
        proxy_ssl_server_name on;
        proxy_ssl_name mxtsdgkwzjzlttpotole.supabase.co;
        proxy_http_version 1.1;
        proxy_set_header Host mxtsdgkwzjzlttpotole.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type $http_content_type;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # === MEMORY & MAIN API — unified-gateway :3000 ===
    location ~ ^/api/v1/(memories|memory|keys|projects|organizations|organization|config|behavior|embeddings)(/|$) {
        limit_req zone=memory_limit burst=50 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_set_header X-Project-Scope $http_x_project_scope;
        proxy_read_timeout 60s;
    }

    # === VENDOR API KEYS — /v1/keys/* (was Netlify key-manager) ===
    location ~ ^/v1/keys/ {
        limit_req zone=auth_limit burst=5 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_read_timeout 30s;
    }

    # === CATCH-ALL /api/v1/ → unified-gateway :3000 ===
    location /api/v1/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_read_timeout 30s;
    }

    # === MCP — Lanonasis MCP Server :3104 (WS/SSE) ===
    location /mcp {
        proxy_pass http://localhost:3104;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-API-Key $http_x_api_key;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }

    # === METRICS — internal only ===
    location /metrics {
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://localhost:3000/metrics;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # === ROOT — landing page SPA fallback ===
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_CONF

# Enable and test
sudo ln -sf /etc/nginx/sites-available/api.lanonasis.com.conf \
              /etc/nginx/sites-enabled/api.lanonasis.com.conf
sudo nginx -t
```

> **⚠️ IMPORTANT:** Verify the Supabase project ID (`mxtsdgkwzjzlttpotole`) is correct before proceeding. Confirm against the actual `.env` on VPS. The vanity domain `lanonasis.supabase.co` may or may not be fully functional — verify it resolves to the same project before using it in production config.

---

### Phase A Smoke Tests — Verify Response Shape, Not Just "Not 502"

**Upgrade from "502 vs non-502" to actual response validation.** Every route must return an expected body shape.

```bash
VPS_IP=$(ssh lanonasis-main "curl -s ifconfig.me")
echo "VPS IP: $VPS_IP"

# === /health — unified gateway body shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/health | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('status:', d.get('status'), '| services:', d.get('api',{}).get('services'))"
# Expected: status: healthy, services: 5

# === /health → /health/full on unified-gateway (if used) ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/health/full | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('full health:', d.get('status'))"
# Expected: healthy or similar

# === /.well-known/onasis.json — exact JSON shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/.well-known/onasis.json | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('version:', d.get('version'), '| services:', list(d.get('services',{}).keys())[:3])"
# Expected: valid JSON with expected fields

# === /api/v1/auth/status — Supabase auth-status response shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/api/v1/auth/status | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('auth-status keys:', list(d.keys()))"
# Expected: specific shape from auth-status EF (NOT 502, NOT HTML)

# === /api/v1/auth/login — auth-gateway validation error shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  -X POST https://api.lanonasis.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('auth error keys:', list(d.keys()), '| code:', d.get('code'))"
# Expected: 400/401 with JSON error shape (NOT 502, NOT HTML)

# === /api/v1/memories — unified-gateway response shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/api/v1/memories \
  -H "X-API-Key: invalid-key" | \
  python3 -c "import sys,json; d=json.load(sys.stdin) if sys.stdin.read(1) == '{' else None; print('memories response valid JSON:', d is not None)"
# Expected: JSON response (auth error or data), NOT 502

# === /api/v1/intelligence/suggest-tags — Supabase direct response shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  -X POST https://api.lanonasis.com/api/v1/intelligence/suggest-tags \
  -H "X-API-Key: invalid-key" \
  -H "Content-Type: application/json" \
  -d '{}' | \
  python3 -c "import sys,json; raw=sys.stdin.read(); print('intelligence response:', raw[:100])"
# Expected: JSON from Supabase EF (not 502, not Netlify wrapper)

# === /api/v1/profiles/<id> — Supabase profiles response shape ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/api/v1/profiles/test-user-123 \
  -H "X-API-Key: invalid-key" | \
  python3 -c "import sys,json; raw=sys.stdin.read(); print('profiles response:', raw[:100])"
# Expected: JSON from Supabase EF

# === /v1/keys/test — vendor key path behavior ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/v1/keys/test \
  -H "X-API-Key: invalid-key" | \
  python3 -c "import sys,json; raw=sys.stdin.read(); print('vendor keys response:', raw[:100])"
# Expected: JSON auth error or data (NOT 502)

# === /mcp — MCP handshake behavior ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  -X POST https://api.lanonasis.com/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: invalid-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  python3 -c "import sys,json; raw=sys.stdin.read(); print('mcp response:', raw[:100])"
# Expected: MCP JSON-RPC response or 401 (NOT 502)

# === /login — serves correct auth page ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  https://api.lanonasis.com/login | head -5
# Expected: HTML page (auth.html or similar)

# === CORS — allowed origin returns ACAO ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  -H "Origin: https://dashboard.lanonasis.com" \
  https://api.lanonasis.com/api/v1/health | \
  grep -i "access-control-allow-origin"
# Expected: Access-Control-Allow-Origin: https://dashboard.lanonasis.com

# === CORS — disallowed origin returns NO ACAO ===
curl -sk --resolve api.lanonasis.com:443:$VPS_IP \
  -H "Origin: https://evil.example.com" \
  https://api.lanonasis.com/api/v1/health | \
  grep -i "access-control"
# Expected: empty (no ACAO header = correctly blocked)
```

**Any route returning HTML, 502, or unexpected shape = gate failure. Document and resolve before Phase B.**

---

## Phase B — Shadow Comparison

**Run both endpoints side by side.** This proves VPS behaves exactly like the current Netlify-backed `api.lanonasis.com` for equivalent requests.

```bash
# Run parallel curl comparisons and diff the outputs
# Netlify = current production, VPS = --resolve test

# EXAMPLE (shell loop):
ROUTES=("/health" "/api/v1/health" "/.well-known/onasis.json" "/api/v1/auth/status" "/login")
for ROUTE in "${ROUTES[@]}"; do
  echo "=== $ROUTE ==="
  echo "--- Netlify ---"
  curl -sk "https://api.lanonasis.com$ROUTE" | python3 -c "import sys,json; d=sys.stdin.read(); print(d[:200])"
  echo "--- VPS ---"
  curl -sk --resolve api.lanonasis.com:443:$VPS_IP "https://api.lanonasis.com$ROUTE" | python3 -c "import sys,json; d=sys.stdin.read(); print(d[:200])"
done
```

Compare:
- Status codes
- Response headers (CORS, cookies, content-type)
- Response body shape and key fields
- Latency
- Auth behavior

**Gate:** All compared routes must show no meaningful behavioral difference before proceeding to Phase C.

---

## Phase C — Route-Family Bridge from Netlify

> **Before DNS cutover**, selectively proxy one route family from Netlify to VPS using `_redirects` on Netlify. This sends real production traffic to VPS for the safest routes first.

### Step C1 — Bridge static/health routes

Add to Netlify `_redirects` (temporarily):

```
/health          https://<VPS_IP>/health          200
/.well-known/*   https://<VPS_IP>/.well-known/:splat  200
```

Deploy and monitor Nginx logs on VPS for 1 hour:

```bash
ssh lanonasis-main
sudo tail -f /var/log/nginx/api.lanonasis.com.access.log
```

### Step C2 — Bridge intelligence routes

After static/health routes stable (no errors, expected traffic):

Add to Netlify `_redirects`:

```
/api/v1/intelligence/suggest-tags   https://<VPS_IP>/api/v1/intelligence/suggest-tags   200
/api/v1/intelligence/health-check  https://<VPS_IP>/api/v1/intelligence/health-check  200
/api/v1/intelligence/*             https://<VPS_IP>/api/v1/intelligence/:splat       200
```

Monitor `error.log` for 24 hours. Watch for:
- Unexpected 500s
- Supabase auth failures
- Header mismatches

### Step C3 — Bridge memory/project routes

After intelligence stable:

Add to Netlify `_redirects`:

```
/api/v1/memories/*    https://<VPS_IP>/api/v1/memories/:splat    200
/api/v1/memory/*      https://<VPS_IP>/api/v1/memory/:splat      200
/api/v1/projects/*    https://<VPS_IP>/api/v1/projects/:splat    200
```

Monitor 24–48 hours.

---

## Phase D — Auth Bridge

> ⚠️ **Auth is the highest-risk family.** Only bridge auth routes after all non-auth routes have handled real production traffic without errors.

### Gate Before Bridging Auth

- [ ] Phase C1 (static/health) has 0 critical errors for ≥24h
- [ ] Phase C2 (intelligence) has 0 critical errors for ≥24h
- [ ] Phase C3 (memory/projects) has 0 critical errors for ≥24h
- [ ] Auth-gateway outbox backlog explained and stable
- [ ] OAuth/PKCE callback URLs documented and aligned
- [ ] Supabase direct proxy headers verified for auth-status EF

### Step D1 — Bridge low-risk auth routes

Add to Netlify `_redirects` (lowest risk first):

```
# /api/v1/auth/status is Supabase direct — verify header behavior first
/api/v1/auth/status   https://<VPS_IP>/api/v1/auth/status   200

# Then key read operations
/api/v1/auth/api-keys   https://<VPS_IP>/api/v1/auth/api-keys   200
```

Monitor closely for 24–48 hours.

### Step D2 — Bridge OAuth / CLI auth

Only after Step D1 stable:

```
/auth/cli-login       https://<VPS_IP>/auth/cli-login       200
/oauth/*             https://<VPS_IP>/oauth/:splat         200
```

Specific things to verify for auth:
- Cookie domain, SameSite, Secure flags
- OAuth redirect URIs still valid
- CLI login flow completes
- Session persistence across requests
- `auth.lanonasis.com` vs `auth.connectionpoint.tech` issuer alignment

### Step D3 — Full auth bridge

After all above stable:

```
/api/v1/auth/login        https://<VPS_IP>/api/v1/auth/login        200
/api/v1/auth/register     https://<VPS_IP>/api/v1/auth/register     200
/api/v1/auth/refresh      https://<VPS_IP>/api/v1/auth/refresh      200
/api/v1/auth/*            https://<VPS_IP>/api/v1/auth/:splat       200
```

---

## Phase E — DNS Cutover

> **DNS cutover is blocked until all gates below pass.**

### DNS Cutover Gates

```
DNS cutover is BLOCKED until ALL of the following are true:

[ ] Phase A — all smoke tests pass with correct response shapes
[ ] Phase B — shadow comparison shows no meaningful behavioral difference
[ ] Phase C1 — static/health routes bridged, 0 critical errors for ≥24h
[ ] Phase C2 — intelligence routes bridged, 0 critical errors for ≥24h
[ ] Phase C3 — memory/project routes bridged, 0 critical errors for ≥24h
[ ] Phase D1 — low-risk auth routes bridged, 0 critical errors for ≥24h
[ ] Phase D2 — OAuth/CLI auth bridged, 0 critical errors for ≥24h
[ ] Phase D3 — full auth bridge stable for ≥24h
[ ] Auth-gateway outbox backlog explained (not a blocker if explained and stable)
[ ] Supabase direct proxy headers verified for auth-status, intelligence, profiles EFs
[ ] OAuth/PKCE callback URLs confirmed not broken by migration
[ ] CORS origin inventory complete (see below)
[ ] Postman MVP test collection passes against VPS (before DNS move)
[ ] gateway.lanonasis.com parity tests pass
```

### CORS Origin Inventory (must complete before Phase E)

Scan all active sources for origin usage:

```bash
# Search codebase for active origin declarations
grep -r "Access-Control" apps/ --include="*.ts" --include="*.js" --include="*.html" | grep -v node_modules | grep -v ".archive"
grep -r "origin" apps/ --include="*.ts" --include="*.js" | grep -i "lanonasis\|connectionpoint" | grep -v node_modules

# Check Postman environments
grep -r "origin" postman/ --include="*.json" 2>/dev/null

# Check deployed frontend configs
grep -r "\.lanonasis\.com" apps/ --include="*.json" --include="*.env*" | grep -v node_modules | grep -v ".archive"
```

**Known origins so far:**
- `https://dashboard.lanonasis.com` ✅ in whitelist
- `https://mcp.lanonasis.com` ✅ in whitelist
- `https://api.lanonasis.com` ✅ in whitelist
- `https://docs.lanonasis.com` ✅ in whitelist
- `https://lanonasis.com` ✅ in whitelist
- `http://localhost:3000/3001/5173` ✅ in whitelist (dev)

**Must verify (unknown status):**
- `https://app.lanonasis.com`
- `https://admin.lanonasis.com`
- `https://gateway.lanonasis.com`
- `https://mcp1.lanonasis.com`
- `https://auth.connectionpoint.tech` (already active in Nginx)
- Any `*.connectionpoint.tech` used by frontends
- Any hardcoded Netlify domain in SDKs/SDKs

### Execute DNS Cutover

```bash
# In DNS provider:
#   api.lanonasis.com  A  <VPS_PUBLIC_IP>  TTL: 300

# Monitor immediately after
watch -n 5 'curl -s https://api.lanonasis.com/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\"status\"), d.get(\"service\",\"\"))"'
```

Expected: continuous `healthy`/`ok`, no gap longer than TTL window.

### Postman MVP Tests (run immediately after cutover)

```bash
/Users/onasis/.local/bin/postman collection run \
  43116137-548bdff0-97b2-4ae2-a719-438f95b2191a \
  --postman-api-key $POSTMAN_API_KEY \
  -r cli,json \
  --reporter-json-export .devops/postman-results/post-migration-$(date +%Y%m%d).json

# If failures → rollback DNS immediately
```

---

## Phase F — 7-Day Soak → Archive Netlify Artifacts

> **⛔ Do NOT archive Netlify artifacts until ALL of the following pass.**

Archive gates:
- [ ] 7-day soak complete with 0 critical errors in `/var/log/nginx/api.lanonasis.com.error.log`
- [ ] Postman MVP tests: 0 failures
- [ ] No client reports related to CORS, auth, MCP, or routing
- [ ] CLI auth flows verified end-to-end
- [ ] OAuth/PKCE flows verified end-to-end
- [ ] Rollback window formally closed

```bash
ssh lanonasis-main "sudo tail -50 /var/log/nginx/api.lanonasis.com.error.log"

# Archive deprecated Netlify artifacts
git mv apps/onasis-core/_redirects apps/onasis-core/.archive/_redirects.deprecated
git mv apps/onasis-core/netlify.toml apps/onasis-core/.archive/netlify.toml.deprecated
git mv apps/onasis-core/netlify/ apps/onasis-core/.archive/netlify-functions/
git add -A && git commit -m "chore(onasis-core): archive _redirects and Netlify functions after VPS migration"
```

---

## Rollback Strategy

### Full Rollback — restore to Netlify

```bash
# 1. Revert DNS: api.lanonasis.com A → <Netlify IP>

# 2. Remove Nginx config
sudo rm /etc/nginx/sites-enabled/api.lanonasis.com.conf
sudo nginx -t && sudo nginx -s reload

# 3. Verify Netlify is back
curl -sI https://api.lanonasis.com/health 2>&1 | grep -i "netlify"
```

### Partial Rollback — Nginx config broken

```bash
sudo rm /etc/nginx/sites-enabled/api.lanonasis.com.conf
sudo nginx -t && sudo nginx -s reload
# DNS still points to VPS — Nginx now 404s. Fix Nginx config, then reload.
```

### Rollback During Bridge Phase (Phase C/D)

Simply remove the specific `_redirects` line from Netlify config and redeploy. No DNS change needed.

---

## Open Questions Before Phase E (Blockers)

| # | Question | How to Resolve |
|---|----------|----------------|
| O1 | What does the 2017 auth-gateway outbox contain? | `curl localhost:4000/health` + inspect outbox logs. Webhooks? Emails? Audit events? |
| O2 | Does `lanonasis.supabase.co` (vanity) resolve to the same project? | `dig lanonasis.supabase.co CNAME` or `nslookup lanonasis.supabase.co` |
| O3 | Is `mcp.lanonasis.com` DNS configured? | `dig mcp.lanonasis.com A +short` |
| O4 | Are there additional CORS origins in active use? | Source scan (see CORS inventory above) |
| O5 | What are the official OAuth/PKCE redirect URIs and issuer? | Inspect auth-gateway config for `issuer`, `redirect_uri` settings |
| O6 | Do any SDKs/CLIs use `api.lanonasis.com` with hardcoded assumptions? | Search for `api.lanonasis.com` in all repos |
| O7 | Is the Supabase anon key the same across all direct proxy routes? | Compare `.env` values on VPS |

---

## Deployment Readiness Assessment

| Area | Status | Comment |
|------|--------|---------|
| Route mapping | ✅ Strong | Very well thought out |
| VPS service inventory | ✅ Strong | Good operational baseline |
| Nginx config | ✅ Promising | Needs staging and exact domain/header verification |
| Supabase direct routing | ⚠️ Medium risk | Header behavior must be proven per-route |
| Auth migration | 🔴 High risk | Needs separate bridge phase |
| CORS | ⚠️ Medium risk | Inventory may be incomplete |
| DNS cutover | ⛔ Not yet approved | Too sudden without parity bridge |
| Rollback | ✅ Good | Netlify remains fallback throughout bridge |
| Netlify archive | ⛔ Later only | After soak, not before |

---

*Generated from: CANONICAL_GATEWAY_CHECKPOINT.md + monorepo netlify-to-vps-migration-plan.md (Rev 2) + staged validation feedback*
*Do not execute DNS cutover until all Phase E gates pass.*
*Do not start MaaS adapter implementation — separate workstream.*