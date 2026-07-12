# Phase 1 Shadow Parity — Current Probe (SDK-17)

> Status: red on live deployment; branch contains the narrow route/config fix.
> Operator: CTO (agent `347ed919-2c40-477c-8e7b-6c7e93de0ca1`)
> Probe time: 2026-07-12T06:47Z

---

## What changed this heartbeat

The previous Phase 1 probe showed that `gateway.lanonasis.com` still returns 404
for the read-only MaaS health/status routes that `api.lanonasis.com` serves via
the current Nginx/Supabase bridge:

- `/api/v1/auth/status`
- `/api/v1/memory/health`
- `/api/v1/intelligence/health-check`

The central gateway code and regression tests for these public Supabase-backed
routes are already present on the SDK-17 branch. This heartbeat aligned the
reference deploy artifacts so the Nginx route policy does not contradict that
code path:

1. `docs/architecture/nginx/gateway.conf`
   - Adds exact `location = /api/v1/auth/status` before the broader
     `/api/v1/auth/` auth-gateway prefix.
   - Proxies that route to `central_gateway` so the public compatibility route
     can call the Supabase `auth-status` function instead of falling through to
     auth-gateway and returning 404.

2. `docs/architecture/ROUTE_MAP.yaml`
   - Records `/api/v1/auth/status` as an explicit `maas_supabase_edge`
     exception under the auth route group.

---

## Live parity probe result before deploy

Command:

```bash
./scripts/compare-responses.sh
```

Output:

```text
=== response parity: netlify vs gateway ===
netlify=https://api.lanonasis.com  gateway=https://gateway.lanonasis.com

  [  OK   ] /health                                  200
  [MISMATCH] /api/v1/auth/status                      netlify=200 gateway=404
  [MISMATCH] /api/v1/memory/health                    netlify=200 gateway=404
  [MISMATCH] /api/v1/intelligence/health-check        netlify=401 gateway=404
  [  OK   ] /api/adapters                            404

summary: 2/5 matched
divergence: 60.00% (gate: <1.0%)
```

Interpretation: the branch behavior is correct under tests, but the live VPS
`gateway.lanonasis.com` is still running the older route/config path. Phase 2
cutover remains blocked until this branch is deployed to the VPS and the same
parity command returns `<1%` divergence.

---

## Verification completed on branch

```bash
npx vitest run \
  tests/gateway/maas-parity-routes.test.js \
  tests/core/universal-supabase-client.test.js \
  tests/mcp/adapter-registry.test.js
```

Result:

```text
Test Files  3 passed (3)
Tests       11 passed (11)
```

Static scan of added lines for hardcoded secrets / shell injection / eval / SQL
string-formatting patterns returned no findings.

A structural check also passed:

```text
nginx auth-status exact before prefix: PASS
route map exception recorded: PASS
unified public memory route exists: PASS
unified intelligence route exists: PASS
```

---

## Next action

Deploy the SDK-17 branch to `/opt/lanonasis/onasis-gateway` on
`lanonasis-main`, reload/restart the gateway safely, then rerun:

```bash
./scripts/compare-responses.sh
```

Do not proceed to DNS or Phase 2 cutover until the parity gate is green.
