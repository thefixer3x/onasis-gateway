# MaaS Adapter Generation Plan

**Purpose:** Use the OpenAPI contract and Direct API routes to generate MaaS adapters for central-gateway, replacing Netlify redirects with first-class gateway routing.

**Primary sources**
- `lan-onasis-monorepo/apps/onasis-core/docs/supabase-api/SUPABASE_REST_API_OPENAPI.yaml`
- `lan-onasis-monorepo/apps/onasis-core/docs/supabase-api/DIRECT_API_ROUTES.md`

---

## Step 0: Source of Truth Freeze

1. Lock the OpenAPI file as the canonical API contract for `/api/v1/*`.
2. Lock the Direct API routes doc as the canonical mapping from public paths to Supabase edge functions.
3. Update the route map: `docs/architecture/ROUTE_MAP.yaml`.

---

## Step 1: Adapter Scaffolding in central-gateway

**Goal:** Build a MaaS adapter layer that proxies to Supabase edge functions with correct method, path, and auth header handling.

**Adapter skeleton**
- Service: `services/maas/`
- Responsibilities:
  - Route mapping table (from ROUTE_MAP.yaml).
  - Request validation: method + required params.
  - Header pass-through: `Authorization`, `X-API-Key`, `X-Request-ID`.
  - Timeout profiles: standard vs intelligence endpoints.
  - Response passthrough with safe error mapping.

**Required behaviors**
- No local JWT validation in central-gateway.
- Auth is validated by auth-gateway; MaaS accepts tokens or API keys.
- Avoid logging tokens or decrypted payloads.

---

## Step 2: Route Mapping Rules

1. For every OpenAPI path under `/api/v1/*`, find the target edge function from Direct API routes.
2. If multiple public paths map to the same function, keep all aliases (example: `/api/v1/memory` and `/api/v1/memories`).
3. Map path params to query params when required:
   - `/api/v1/memory/:id` → `/functions/v1/memory-get?id=:id`
4. Preserve method semantics:
   - `GET` and `POST` to list endpoints should remain supported.

---

## Step 3: Auth Header Rules

**Allowed headers (pass-through)**
- `Authorization: Bearer <token>`
- `X-API-Key: lano_*` or `lmk_*` or `sk_*` (as required)
- `X-Request-ID`

**Blocked or sanitized**
- Never log raw tokens or full API keys.
- Strip `host` and `content-length` when proxying.

---

## Step 4: Timeout and Body Size Profiles

**Default**
- `proxy_read_timeout`: 60s
- `client_max_body_size`: 10M

**Intelligence endpoints**
- `proxy_read_timeout`: 120s

**Bulk memory endpoints**
- `client_max_body_size`: 50M

---

## Step 5: Parity Tests

**Goal:** Ensure gateway adapters return the same status and payload shape as direct Supabase calls.

Minimum test list:
- `/api/v1/memory/search` (POST)
- `/api/v1/memory/list` (GET)
- `/api/v1/memory/:id` (GET)
- `/api/v1/memory/bulk/delete` (POST)
- `/api/v1/intelligence/suggest-tags` (POST)
- `/api/v1/keys/list` (GET)
- `/api/v1/config/get` (GET)

---

## Step 6: Cutover Plan (Shadow Mode)

1. Keep Netlify redirects in place.
2. Mirror traffic through gateway in shadow mode (log-only).
3. Compare status codes and response shapes.
4. Switch DNS to gateway after parity is verified.

---

## Open Decisions

- Should all non-MaaS edge functions (payments, AI, edoc) be exposed via gateway now, or stay excluded?
- Should MaaS routes be split by subdomain later (example: `maas.lanonasis.com`)?

---

## Quick Reference: Core MaaS Routes

These are the minimum endpoints for parity:

- Memory: `/api/v1/memory`, `/api/v1/memory/:id`, `/api/v1/memory/list`, `/api/v1/memory/search`, `/api/v1/memory/stats`, `/api/v1/memory/bulk/delete`
- Intelligence: `/api/v1/intelligence/*`
- API Keys: `/api/v1/keys/*`
- Projects: `/api/v1/projects/*`
- Org: `/api/v1/organization`, `/api/v1/org`, `/api/v1/org/info`
- Config: `/api/v1/config`, `/api/v1/config/get`, `/api/v1/config/set`
- System: `/api/v1/auth/status`, `/api/v1/memory/health`
