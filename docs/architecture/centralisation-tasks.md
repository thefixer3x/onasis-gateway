# Planned vs Repo Reality

**Validated:** 2026-04-30
**Validation basis:** local repo after pulling `origin/main`
**Warning:** this is repo truth, not live VPS truth. PM2 state, bound listeners, deployed Nginx config, and DNS still require runtime confirmation.

---

## Executive Summary

The repo confirms that gateway consolidation work is real, but the implementation is further along than some earlier summaries suggested.

Already present in the repo:
- canonical planning artifacts: `API-GATEWAY-CONSOLIDATION-PLAN.md`, `ROUTE_MAP.yaml`, `MAAS_ADAPTERS.md`
- context/ADR layer: `docs/context/`
- Express gateway features in `unified_gateway.js`: CORS, rate limiting, request IDs, `/health`, route-policy visibility, gateway-owned Supabase compatibility routes
- MaaS adapter work in `src/adapters/supabase-edge-functions-adapter.js` plus memory/intelligence adapters
- reference Nginx gateway config in `docs/architecture/nginx/gateway.conf`

Still incomplete or unverified:
- Netlify redirects still own many public routes
- `TRUST_BOUNDARIES.md`, `GATEWAY_ROLLOUT.md`, and `/api/v1/status` are missing
- unified `/health/full` is still not implemented in `unified_gateway.js`
- gateway-vs-direct MaaS parity testing is still missing as a dedicated suite

---

## Repo-Confirmed Reality

### Planning Artifacts Exist

The following are already in the repo and should be treated as real deliverables, not placeholders:
- `docs/architecture/API-GATEWAY-CONSOLIDATION-PLAN.md`
- `docs/architecture/ROUTE_MAP.yaml`
- `docs/architecture/MAAS_ADAPTERS.md`
- `docs/context/architecture/decisions/adr-001-auth-architecture.md`
- `docs/context/architecture/decisions/adr-002-api-gateway-consolidation.md`

### Central Gateway Foundation Is Partially Implemented

`unified_gateway.js` already provides:
- runtime on port `3000`
- allowlist-based CORS
- API and MCP rate limiting
- `X-Request-ID` generation
- `/health`
- `GET /api/v1/gateway/route-policy`
- gateway-owned compatibility passthrough:
  - `/functions/v1/:functionName`
  - `/api/v1/functions/:functionName`

This means the repo is beyond "Phase 0 only".

### MaaS Adapter Work Exists, But in a Different Shape

The original plan called for a dedicated `services/maas/` layer.

The repo reality is:
- `src/adapters/supabase-edge-functions-adapter.js`
- `services/memory-as-a-service/memory-adapter.js`
- `services/intelligence-api/intelligence-adapter.js`

So the right description is "implemented differently than planned," not "missing."

### Nginx Gateway Config Exists In-Repo

The repo already contains a reference gateway configuration in:
- `docs/architecture/nginx/gateway.conf`

That file already models:
- upstreams
- CORS maps
- rate limiting zones
- `/health` and `/health/full`
- auth routing
- WS/SSE proxying
- MaaS route handling

What remains unverified is whether that config is deployed on the VPS.

### Netlify Still Owns Important Public Routes

`lan-onasis-monorepo/apps/onasis-core/_redirects` still routes many production-facing paths through Netlify or direct Supabase targets, including:
- `/api/v1/memory/*`
- `/api/v1/memories/*`
- `/api/v1/intelligence/*`
- `/api/v1/keys/*`
- `/ws`
- `/sse`
- `/oauth/*`
- `/v1/auth/*`
- `/api/v1/auth/*`

So the repo does not represent a completed gateway cutover.

---

## Implemented Differently Than Planned

| Area | Original expectation | Repo reality |
|---|---|---|
| MaaS adapter layer | `services/maas/` scaffold | `supabase-edge-functions` adapter plus memory/intelligence adapters |
| Health aggregation | unified gateway owns `/health` and `/health/full` | unified gateway owns `/health`; `mcp_server.js` owns `/health/full` |
| Trust-boundary expression | dedicated trust-boundary doc + clarified header rules | auth delegation exists, but the dedicated trust-boundary doc is still missing |
| Nginx foundation | future artifact | reference config already exists in repo |

---

## Missing or Unverified

### Missing Artifacts

- `TRUST_BOUNDARIES.md`
- `GATEWAY_ROLLOUT.md`
- `/api/v1/status`

### Missing Validation Coverage

- dedicated gateway-vs-direct MaaS parity suite
- documented proof that live Nginx matches the repo reference config
- documented proof that PM2/live listeners match the route map

### Still Needs Live Infra Confirmation

These cannot be settled from the repo alone:
- PM2 process names and ports
- listeners on `3000`, `3001`, `3002`, `3003`, `4000`
- deployed Nginx config contents
- DNS cutover status
- whether gateway is fronting all production traffic

---

## Canonical Port Picture

These sources agree and should be treated as the best repo truth:
- `docs/architecture/ROUTE_MAP.yaml`
- `unified_gateway.js`
- `mcp_server.js`

| Service | Port |
|---|---|
| Central Gateway | `3000` |
| Auth Gateway | `4000` |
| Enterprise MCP | `3001` |
| MCP Core HTTP | `3001` |
| MCP Core WS | `3002` |
| MCP Core SSE | `3003` |

Some older plan snippets contained swapped sample upstream ports. Those snippets should not be treated as authoritative unless they match `ROUTE_MAP.yaml`.

---

## Recommended Next Moves

1. Keep `ROUTE_MAP.yaml` as the canonical repo truth for route ownership and ports.
2. Add `TRUST_BOUNDARIES.md` next so auth delegation, trusted headers, and Supabase fallback rules are explicit.
3. Add unified `/health/full` and `/api/v1/status`, or remove them from gateway-facing expectations.
4. Add parity tests for memory, intelligence, keys, config, and auth paths before broad cutover.
5. Confirm live infra with `pm2 list`, listener checks, and deployed Nginx config before closing the port-conflict story.
