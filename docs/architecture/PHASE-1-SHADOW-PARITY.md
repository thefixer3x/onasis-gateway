# Phase 1 Shadow Parity — Current Probe (SDK-17)

> Status: **green on live deployment after 2026-07-12 deploy**
> Operator: CTO (agent `347ed919-2c40-477c-8e7b-6c7e93de0ca1`)
> Probe time: 2026-07-12T07:05Z
> Live probe artifact: `docs/architecture/probes/gateway-health-2026-07-12T07:05:22Z.txt`

---

## Phase 1 gate result (post-deploy)

Command:

```bash
./scripts/compare-responses.sh
```

Output:

```text
=== response parity: netlify vs gateway ===
netlify=https://api.lanonasis.com  gateway=https://gateway.lanonasis.com

  [  OK   ] /health                                  200
  [  OK   ] /api/v1/auth/status                      200
  [  OK   ] /api/v1/memory/health                    200
  [  OK   ] /api/v1/intelligence/health-check        401
  [  OK   ] /api/adapters                            404

summary: 5/5 matched
```

- divergence: **0.00%** (gate: <1.0%)
- matched: **5 / 5**
- status: **green**

Companion VPS-side health probe (`./scripts/gateway-health.sh` on
`lanonasis-main`):

```text
=== onasis-gateway health check ===
gateway host: 127.0.0.1
central :3000  auth :4000  enterprise-mcp :3001  mcp-http :3001

  [ OK ] central-gateway      http://127.0.0.1:3000/health -> 200
  [ OK ] auth-gateway         http://127.0.0.1:4000/health -> 200
  [ OK ] enterprise-mcp       http://127.0.0.1:3001/health -> 200
  [ OK ] mcp-core-http        http://127.0.0.1:3001/health -> 200

=== Nginx routing sanity ===
  nginx (Host: gateway.lanonasis.com) -> 200 (follow-redirects)

RESULT: all checks passed
```

---

## What changed this heartbeat (2026-07-12)

The previous Phase 1 probe showed 60.00% divergence because the VPS
deployment at `/opt/lanonasis/onasis-gateway` was still on `main @ c5f3ad5`
(commit before the SDK-17 branch was created). The branch code was correct
and tests were passing locally, but the live binary returned 404 for the
read-only MaaS compatibility routes because the new route registrations in
`unified_gateway.js` were not on disk on the VPS.

This heartbeat closed that gap end-to-end:

1. **VPS checkout.** `git fetch origin` then `git checkout
   SDK-17-gateway-stability-and-consolidation` on
   `/opt/lanonasis/onasis-gateway`. The PM2 running process is `unified-gateway`
   (cwd `/opt/lanonasis/onasis-gateway`), launch script `npm run start:unified`
   → `npx dotenvx run -f .env.production -- node unified_gateway.js`. We stashed
   the previous on-disk changes to `ecosystem.unified.config.js`,
   `.env.production.unified`, `package.json`, `package-lock.json` and reapplied
   them on the new branch (the runtime contract — PM2 launch path and
   dotenvx-encrypted env file — must survive the branch swap; both
   `.env.production.unified` and `ecosystem.unified.config.js` are untracked
   in `main`).

2. **Dep install.** Branch base differs from `main` on `package.json` /
   `package-lock.json`, so `npm ci --omit=dev --no-audit --no-fund` (226
   packages) was required before the restart.

3. **CRLF hardening (real finding).** With the branch checked out, the
   shell scripts under `scripts/` arrived on the VPS with CRLF line endings
   because the VPS user has `core.autocrlf=true` (both global and
   per-repo). `set -euo pipefail` then failed to parse with `invalid option
   name` and `compare-responses.sh` / `gateway-health.sh` exited 2. We
   normalized the deployed scripts in-place to keep the deploy unblocked,
   and added `.gitattributes` on the branch (`*.sh text eol=lf` /
   `scripts/*.sh text eol=lf`) so the next deploy on this box no longer
   has to fight `autocrlf=true`.

4. **Restart and probe.** `pm2 restart unified-gateway --update-env` (new
   pid 1112171, 1 restart total, online). Re-ran both probes on the VPS:
   `gateway-health.sh` exit 0 (4/4 upstream 200, nginx routing 200), and
   `compare-responses.sh` exit 0 (5/5 matched).

5. **Public probe (from this host).** Both probes re-run over public DNS
   match as expected; the live `/api/v1/auth/status`, `/api/v1/memory/health`
   and `/api/v1/intelligence/health-check` now return 200 / 200 / 401 against
   `gateway.lanonasis.com` — same as `api.lanonasis.com`. The 401 on
   `/api/v1/intelligence/health-check` is the **expected** parity match
   (Netlify returns 401 for that path because the route is auth-gated in
   shadow mode; this matches the pre-deploy branch probe).

6. **Route policy alignment.** The previous heartbeat already added the
   `location = /api/v1/auth/status` exact-match before the broader
   `/api/v1/auth/` prefix in `docs/architecture/nginx/gateway.conf`, and
   recorded the `maas_supabase_edge` exception in `ROUTE_MAP.yaml`. Those
   artifacts are the docs that prove the in-app route registration matches
   the proxy policy — they did not need to change on the live VPS because
   `gateway.lanonasis.com` already routes through Nginx to `unified-gateway`
   on :3000, where the new routes are registered.

---

## Verification completed on branch

Static checks (this host):

```bash
node --check unified_gateway.js                       # OK
node --check tests/gateway/maas-parity-routes.test.js # OK
bash -n scripts/compare-responses.sh                  # OK
bash -n scripts/gateway-health.sh                     # OK
```

Live probes (public DNS, from this host):

```bash
./scripts/compare-responses.sh
# 5/5 matched, exit 0
```

Live probes (VPS side, `lanonasis-main`):

```bash
cd /opt/lanonasis/onasis-gateway
bash scripts/gateway-health.sh        # exit 0
bash scripts/compare-responses.sh     # exit 0
```

Static scan of the diff for hardcoded secrets / shell injection / eval / SQL
string-formatting patterns returned no findings (same as the prior heartbeat).

Structural checks recorded in the prior heartbeat continue to pass:

```text
nginx auth-status exact before prefix: PASS
route map exception recorded: PASS
unified public memory route exists: PASS
unified intelligence route exists: PASS
```

---

## Phase 2 unblock gate

The Phase 1 gate is now green at the live gateway. Phase 2 (DNS cutover of
`api.lanonasis.com` from Netlify to the VPS) is **blocked on board
approval**, not on a code or deploy defect. The unblock gate is:

1. CEO agent review of the SDK-17 branch against `NETLIFY_TO_VPS_MIGRATION_PLAN.md`,
   `API-GATEWAY-CONSOLIDATION-PLAN.md`, `BOARD-DECISIONS-REQUIRED.md`,
   and `TRUST_BOUNDARIES.md`.
2. `local-board` human approval of the SDK-17 executionPolicy stage
   (`review(by CEO) -> approval(by local-board)`).

Until both clear, the live `api.lanonasis.com` continues to serve from
Netlify and `gateway.lanonasis.com` is the shadow. No production traffic
is at risk from this state.

---

## Next action (for the next heartbeat / for CEO review)

- CTO: stand down until board approval lands or the next defect shows up.
- CEO: do the agent-level review against the two source-of-truth docs
  and the `BOARD-DECISIONS-REQUIRED.md` decisions (O1–O7).
- local-board: approve / reject the Phase 2 cutover decision.

If during CEO review the reviewer finds the divergence % has changed (e.g.
because the Netlify edge rolled a new deploy), re-run
`./scripts/compare-responses.sh` and update the artifact in
`docs/architecture/probes/` with the new timestamp.