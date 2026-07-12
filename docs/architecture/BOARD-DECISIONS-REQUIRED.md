# Board Decisions Required — Gateway Cutover (SDK-17)

> **Purpose:** Capture every board-level decision that gates the Phase 1→Phase 5 cutover from Netlify to the Nginx gateway on VPS. Until these are answered, **no DNS changes** are made.
>
> **Owner:** CTO (agent 347ed919)
> **Parent issue:** SDK-30 (child of SDK-27 recovery epic)
> **Related:** SDK-17, ADR-002, `NETLIFY_TO_VPS_MIGRATION_PLAN.md`, `API-GATEWAY-CONSOLIDATION-PLAN.md`, `centralisation-tasks.md`

---

## Why these decisions matter

The consolidation plan in `API-GATEWAY-CONSOLIDATION-PLAN.md` and the migration plan in `NETLIFY_TO_VPS_MIGRATION_PLAN.md` both reference authoritative ports, topology, and cutover strategy. Where those references conflict (older docs vs. current `ROUTE_MAP.yaml` / `ecosystem.config.js`), the board must pick the canonical answer before Phase 1 shadow-mode can begin. Once the answers are recorded here, Phase 1 (shadow mode) is unblocked mechanically.

The open questions originate from `docs/architecture/centralisation-tasks.md` §"Open questions before implementation" and the gaps surfaced during CTO's 2026-07-04 heartbeat. They are renumbered O1–O4 below for clean cross-referencing.

---

## O1 — Authoritative PM2 port map

**Question:** Confirm the canonical PM2 / upstream ports for the gateway.

**Current truth (from `ROUTE_MAP.yaml` v2, 2026-07-04 and `ecosystem.config.js`):**

| Service          | Port  |
|------------------|-------|
| central-gateway  | 3000  |
| auth-gateway     | 4000  |
| enterprise-mcp   | 3001  |
| mcp-core (HTTP)  | 3001  |
| mcp-core (WS)    | 3002  |
| mcp-core (SSE)   | 3003  |

**Conflict:** `API-GATEWAY-CONSOLIDATION-PLAN.md` lists auth :3003, api :3001, mcp :4000-4001 — superseded by `ROUTE_MAP.yaml`. Confirm the table above is the authoritative answer.

**Default if no answer:** proceed with `ROUTE_MAP.yaml` as authoritative.

**Impact:** Phase 1 `gateway.conf` deployment, parity tests, and cutover sequencing all depend on this.

---

## O2 — Enterprise-MCP per-user token strategy

**Question:** Should enterprise-mcp (`:3001`) drop its admin-API-key mode and accept per-user tokens validated through auth-gateway (`:4000`), per `TRUST_BOUNDARIES.md`?

**Context:** Current code uses an admin API key for all enterprise-mcp requests. The trust model says only auth-gateway mints `X-User-*` headers, but the boundary is not yet enforced for the `:3001` path.

**Options:**
- **A — Full per-user tokens now** (recommended). enterprise-mcp validates via auth-gateway introspection; admin key removed.
- **B — Dual-mode for Phase 1-2.** Keep admin key as fallback while per-user flow rolls out.
- **C — Defer to Phase 3.** Per-user tokens land with MaaS cutover.

**Default if no answer:** B (dual-mode during shadow + Phase 1, retire admin key by Phase 3 gate).

**Impact:** Determines what `gateway.conf` does with the `X-User-*` headers in front of `:3001`.

---

## O3 — Nginx-only vs. Nginx-in-front-of-Bun

**Question:** Central gateway is currently a Bun process (`unified_gateway.js` / `server.js`) on `:3000`. Should the public entrypoint be:
- **A — Nginx-only**: port 3000 becomes a pure Bun/Node Express app with Nginx doing CORS, rate limiting, SSL, request ID, and routing.
- **B — Nginx in front of Bun**: Nginx terminates SSL and applies edge policies; the Bun process continues to handle the application logic. (effectively the status quo with Nginx hardening.)

**Recommended:** B — least disruptive, matches what the running VPS already does, and isolates edge-policy changes from app code.

**Default if no answer:** B.

**Impact:** Drives whether Phase 1 ships a brand-new `unified_gateway` or only Nginx hardening.

---

## O4 — Generated route map as the single source of truth

**Question:** Generate a single YAML route map that outputs **both** `gateway.conf` (Nginx) and Netlify `_redirects` until cutover, so both platforms stay in sync?

**Context:** Today `ROUTE_MAP.yaml` is the source of truth but the generator only emits Nginx. If Netlify continues to receive production traffic during shadow mode, its `_redirects` must stay accurate.

**Options:**
- **A — Yes, dual-emit.** Add a `bun run scripts/generate-routes.ts` that writes both `gateway.conf` and `_redirects` from `ROUTE_MAP.yaml`.
- **B — No, Netlify is frozen.** Once Phase 0 VPS readiness is confirmed, treat `_redirects` as read-only until decommission.

**Default if no answer:** A during shadow mode (Phase 1), B from Phase 2 onward.

**Impact:** Scope of `scripts/generate-routes.ts` work and whether Netlify remains editable in Phase 1.

---

## O5 — SSL / certificate provider for `gateway.lanonasis.com`

**Question:** Use Let's Encrypt via `certbot` on the VPS (the assumed default), or a different provider (Cloudflare proxy in front, manual CSR, etc.)?

**Default if no answer:** Let's Encrypt via certbot with auto-renewal (`certbot renew --deploy-hook "systemctl reload nginx"`).

**Impact:** Phase 1 deploy script, runbook for renewal, and whether the VPS needs outbound HTTPS for ACME challenges.

---

## O6 — DNS TTL strategy for cutover domains

**Question:** What TTL should `api.lanonasis.com`, `mcp.lanonasis.com`, `mcp1.lanonasis.com` carry during the cutover window?

**Recommended:** Pre-cutover TTL 300s (5 min) for at least 24h before any A-record change, then drop to 60s during the cutover window itself. Restore to 3600s after cutover stabilizes.

**Default if no answer:** 300s pre-cutover, 60s in cutover window, 3600s post.

**Impact:** Cutover risk matrix (rollback speed vs. DNS propagation delay).

---

## O7 — Netlify decommission window

**Question:** The plan keeps Netlify archived (not deleted) for a 30-day rollback window after cutover. Is 30 days acceptable, or does the board want a shorter (faster cost savings) or longer (more rollback safety) window?

**Default if no answer:** 30 days, matching the plan.

**Impact:** Cost (Netlify keeps billing), rollback capability, and the date the `_redirects` generator stops running.

---

## How the board should answer

The CTO cannot make these calls unilaterally — they have product, cost, and reliability implications that sit with the founder / board. Recommended path:

1. CEO (or board user `local-board`) reviews this document.
2. Board approves O1–O7 in a single decision (request_confirmation interaction on SDK-30, or comment on this file).
3. CTO records the answers in the **Resolved answers** section below.
4. Once O1–O4 are answered, Phase 1 shadow-mode is mechanically unblocked — CTO can proceed without further board action. O5–O7 are operational decisions CTO can implement during Phase 1 once approved.

---

## Resolved answers

| # | Decision | Answer | Decided by | Date |
|---|----------|--------|-----------|------|
| O1 | Authoritative PM2 ports | _pending_ | | |
| O2 | enterprise-mcp token strategy | _pending_ | | |
| O3 | Nginx-only vs. Nginx-in-front-of-Bun | _pending_ | | |
| O4 | Generated dual route map | _pending_ | | |
| O5 | SSL / certificate provider | _pending_ | | |
| O6 | DNS TTL strategy | _pending_ | | |
| O7 | Netlify decommission window | _pending_ | | |

---

*Created: 2026-07-12 (CTO heartbeat, SDK-30)*
*Last updated: 2026-07-12*