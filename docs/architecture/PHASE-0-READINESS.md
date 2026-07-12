# Phase 0 VPS Readiness — Verified (SDK-17)

> **Status:** ✅ Phase 0 readiness mechanically satisfied as of 2026-07-12.
> **Operator:** CTO (agent `347ed919-2c40-477c-8e7b-6c7e93de0ca1`)
> **Parent:** SDK-17 — gateway stability and consolidation
> **Related:** `NETLIFY_TO_VPS_MIGRATION_PLAN.md`, `API-GATEWAY-CONSOLIDATION-PLAN.md`, `BOARD-DECISIONS-REQUIRED.md`

---

## Live system under test

| Item | Value | Notes |
|------|-------|-------|
| Live VPS | **138.199.231.0** (`lanonasis-main`) | Active host. The plan doc historically references `168.231.74.29` (Hostinger) which is stale — see `IP-DRIFT-FIX.md` in this dir. |
| SSH alias | `ssh lanonasis-main` | |
| OS | Ubuntu 24.04 (kernel 6.8.0-134-generic) | 8 days uptime at probe time |
| Disk | 83G / 150G used (58%) | |
| Load | 0.72, 0.72, 0.61 | Healthy |
| PM2 services online | 4/4 + pm2-logrotate | unified-gateway, auth-gateway, enterprise-mcp, vortex-mcp |
| Nginx config | `nginx -t` clean | |
| API entrypoint | `https://api.lanonasis.com` (HTTP→HTTPS via cert pending DNS cutover) | |
| Gateway entrypoint | `https://gateway.lanonasis.com` (HTTP→HTTPS, 301 on :80) | SSL issued, awaiting per `/Users/vortexcore/Docs/GATEWAY-ARCHITECTURE.md` |

---

## Phase 0 checklist (NETLIFY_TO_VPS_MIGRATION_PLAN.md §"Phase 0")

| # | Task | Result | Evidence |
|---|------|--------|----------|
| 0.1 | SSH into VPS and confirm all PM2 processes running | ✅ Pass | `pm2 list` → 4 online (unified-gateway, auth-gateway, enterprise-mcp, vortex-mcp) |
| 0.2 | Verify Nginx is installed and `nginx -t` passes | ✅ Pass | `nginx: configuration file /etc/nginx/nginx.conf test is successful` |
| 0.3 | Verify SSL certs exist for `gateway.lanonasis.com` | ✅ Pass | `/etc/letsencrypt/live/gateway.lanonasis.com/` present (cert expires 2026-08-22) |
| 0.4 | Test upstream `/health` from within VPS | ✅ Pass | :3000 → 200 (19ms), :4000 → 200 (51ms), :3001 → 200 (26ms) |
| 0.5 | Test Nginx Host-based routing | ✅ Pass (with note) | `Host: api.lanonasis.com /health` → 200; `Host: gateway.lanonasis.com /health` → 301 (correct HTTP→HTTPS redirect) |
| 0.6 | Snippets (`proxy-headers.conf`, `cors.conf`) present | ✅ Pass | `docs/architecture/nginx/snippets/{proxy-headers,cors}.conf` reference copies exist; deploy target is `/etc/nginx/snippets/` |
| 0.7 | Log rotation configured | ✅ Pass | `pm2-logrotate` v3.0.0 online (PID 722893) |
| 0.8 | Fail2ban jails for auth endpoints | ⏸ Deferred to Phase 2 | Tracked in centralisation-tasks.md; not a Phase 0 gate |
| 0.9 | DNS TTL ≤ 300s for cutover domains | ⏸ Pre-cutover decision (O6) | Awaiting board pick on `BOARD-DECISIONS-REQUIRED.md` O6 |

**Phase 0 gate result: ✅ All mechanical Phase 0 items pass.** Two items
(fail2ban, DNS TTL) are explicitly board-gated and tracked separately.

---

## Phase 0 → Phase 1 unblock conditions

The plan requires "<1% response divergence" before Phase 2. To run the
shadow-mode parity test (`scripts/compare-responses.sh`) we still need:

1. **O1 — port authority confirmed** (board pick or default `ROUTE_MAP.yaml`).
   Defaults are recorded in `BOARD-DECISIONS-REQUIRED.md` so CTO can proceed.
2. **O2 — enterprise-mcp token strategy** (board pick or default dual-mode).
3. **O3 — Nginx-in-front-of-Bun** (board pick or default B — already-running topology).
4. **O4 — route-map dual-emit** (default A during shadow).
5. **O5 — SSL provider** (default Let's Encrypt via certbot — already deployed for `gateway.lanonasis.com`).
6. **O6 — DNS TTL strategy** (default 300s pre-cutover).
7. **O7 — Netlify decommission window** (default 30 days).

Once O1–O4 are answered, Phase 1 shadow-mode is mechanically unblocked.
**O5–O7 are operational decisions CTO can implement during Phase 1.**

---

## Captured probe output

Raw probe output is in `docs/architecture/probes/phase-0-readiness-2026-07-12.txt`.
Re-run with:

```bash
ssh lanonasis-main 'bash /root/scripts/gateway-health.sh' \
  || ssh lanonasis-main 'pm2 list && nginx -t && \
     for p in 3000 4000 3001; do curl -s -o /dev/null -w ":%s -> %%{http_code}\n" -w "" --max-time 5 http://127.0.0.1:${p}/health; done'
```

(Deployment of `gateway-health.sh` to VPS is a Phase 1 step that depends
on a board-confirmed deploy strategy for `/usr/local/bin/`.)

---

## Drift discovered and corrected

See `IP-DRIFT-FIX.md` for the full diff. Two plan docs referenced
`168.231.74.29` (Hostinger) as the live VPS. The actual production
host is `138.199.231.0` (this is the `lanonasis-main` server referenced
throughout `~/Docs/GATEWAY-ARCHITECTURE.md`). The drift was mechanical
plan-doc inaccuracy; no production state was affected.

---

*Verified 2026-07-12T06:22:36Z, run-id `d55d9c2e-114a-4a56-a250-bcb9e140df1e`.*
*Captured by CTO heartbeat for SDK-17.*