# VPS IP Drift Fix (SDK-17)

> **Status:** ✅ Applied 2026-07-12 by CTO heartbeat.
> **Parent:** SDK-17 — gateway stability and consolidation

---

## What drifted

Two plan documents referenced the live VPS by its **historical Hostinger
IP `168.231.74.29`**. The current production VPS is
**`138.199.231.0`** (alias `lanonasis-main`, Ubuntu 24.04, kernel 6.8.0).

| Document | Was | Now |
|----------|-----|-----|
| `NETLIFY_TO_VPS_MIGRATION_PLAN.md` | `168.231.74.29 (Hostinger)`, `SSH: ghost-vps` | `138.199.231.0 (lanonasis-main)` |
| `API-GATEWAY-CONSOLIDATION-PLAN.md` (header) | `Hostinger (see credentials vault)` | `lanonasis-main (138.199.231.0)` |

The Hostinger IP appears in the plans because the original cutover plan
was authored before the migration to the current VPS host. The current
live system is fully documented in `~/Docs/GATEWAY-ARCHITECTURE.md`
which is the source of truth for "what is actually running".

No production state was affected — only the plan documents referenced a
stale hostname. The actual nginx config, PM2 ecosystem, and SSL certs
are all on `lanonasis-main` and have been since long before this drift
was noticed.

---

## Verification

```bash
ssh -o StrictHostKeyChecking=accept-new lanonasis-main 'hostname; ip -4 addr show eth0 | grep inet'
# lanonasis-main
#     inet 138.199.231.0/24 ...
```

`lanonasis-main` is the SSH alias in `~/.ssh/config` for that IP.

---

## Out of scope

- Reverse DNS / PTR record alignment (PTR control sits with the VPS host).
- Switching DNS records (Netlify → VPS). That is Phase 5 of the migration
  plan and remains board-gated via `BOARD-DECISIONS-REQUIRED.md`.