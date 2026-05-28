# Version Manager Hardening + Package Publishing — Session Handoff

**Date:** 2026-05-28
**Scope:** two repos — `onasis-gateway` (version manager) and `lan-onasis-monorepo` (package publishing).
**Guardrails applied:** `version-manager` guardian skill (semver / deprecation / migration / breaking-change rules), TDD.

---

## 1. Version Manager hardening — `onasis-gateway/core/versioning/version-manager.js`

Closed three gaps found auditing the file against the Version Manager guardian rules.

### What changed
| # | Gap (vs guardian rule) | Fix |
|---|---|---|
| 1 | `executeMigration` had **no rollback** — violated *"NEVER execute migrations without rollback capability."* | Migrations now snapshot input (deep clone) before running. On failure: invoke the explicit rollback handler if registered, else restore the snapshot; emit `migration:rolled_back`; if rollback itself throws, emit `migration:rollback_failed` and throw a composite error. Original error always re-thrown. |
| 2 | Base-URL breaking change emitted `type: 'baseUrl'` — mismatched the documented `baseUrl_changed`, so consumers filtering by type silently missed it. | Renamed to `type: 'baseUrl_changed'`. |
| 3 | No test coverage for a safety-critical module used by `unified_gateway.js` + `api_server.js`. | Added `tests/core/version-manager.test.js` (10 tests). |

### API additions (backward compatible)
- `registerMigrationHandler(serviceId, from, to, handler, rollbackHandler?)` — new optional 5th arg. Existing 4-arg calls keep working (snapshot-restore is the default rollback).
- New events: `migration:rolled_back`, `migration:rollback_failed`.
- `migration:failed` now carries `{ rolledBack: true, restoredData }`.
- New helper `_snapshot(data)` (structuredClone → JSON fallback → as-is).

### Verification
```
npx vitest run tests/core/version-manager.test.js   # 10/10 pass
npx vitest run tests/core                            # 20/20 pass (no regressions)
```
Developed test-first: 4 tests failed RED for the missing rollback + naming, then went GREEN after implementation.

---

## 2. Package publishing pipeline — `lan-onasis-monorepo` (private)

A dual-registry (npm + GitHub Packages) auto-sync pipeline that keeps already-published `@lanonasis/*` packages in step and publishes on version bump.

### Files added (in `lan-onasis-monorepo`)
- `scripts/publishable-packages.json` — allowlist (name → canonical dir → registries).
- `scripts/registry-sync-audit.mjs` — read-only audit; fails only on policy violations.
- `scripts/publish-packages.mjs` — version-diff publisher; `DRY_RUN` defaults true; writes `.published.json`.
- `.github/workflows/publish-packages.yml` — `audit` job (PR/push) + `publish` job gated by the `npm-publish` GitHub Environment.

### Key constraints encoded
- **No `--provenance`** — fails from a private repo.
- **GitHub Packages needs `GH_PACKAGES_TOKEN`** (PAT, `write:packages` on `lanonasis` org); built-in `GITHUB_TOKEN` can't publish `@lanonasis/*` from a `thefixer3x`-owned repo.
- Security trio (`oauth-client`, `security-sdk`, `privacy-sdk`) publishes from `apps/v-secure/*`; the other three from `packages/*`. `scripts/sync-security-packages.sh` keeps them at par.
- **Visibility:** GitHub Packages + Releases from the private monorepo are **private**; npm stays public.

### Verified
- `node scripts/registry-sync-audit.mjs` → clean, flags `@lanonasis/brand-kit` (1.1.0 > npm 1.0.1) as the one to publish; no policy violations.
- `publish-packages.mjs` → dry-run default + skips in-sync packages.

---

## 3. Follow-ups / TODO (tracked in Hermes Kanban)

### Version manager (onasis-gateway)
- [ ] Implement deprecation→removal **lifecycle enforcement** (30-day timeline, warning headers Day 1-29, safe-remove gate). Currently `deprecateVersion` flags only; no `removeVersion` exists.
- [ ] `getLatestVersion` should optionally **exclude deprecated** versions.
- [ ] Align `compareAuthentication` presence-flip type (`authentication_changed`) with the documented breaking-change taxonomy, or document it as an intentional 4th auth case.
- [ ] Add a **compatibility-matrix report** test + JSDoc/usage doc for migration handlers (handler + rollback contract).

### Publishing pipeline (lan-onasis-monorepo)
- [ ] Operator: create the `npm-publish` GitHub **Environment** + protection rules; add `NPM_TOKEN`, `GH_PACKAGES_TOKEN` secrets.
- [ ] Decide whether GitHub-side artifacts should be **public** → if so, run the GH step from the public `v-secure`/`lanonasis-maas` submodule repos.
- [ ] Reconcile version drift: `brand-kit` (1.1.0 vs 1.0.1), `auth-gateway` (0.2.0 vs 0.0.1) — confirm intentional before first auto-publish.
- [ ] First publish must remain **manual** for any brand-new name; allowlist is sync-only by design.

### Documentation TODO (future actions to document)
- [ ] Add a top-level `docs/RELEASE.md` in `lan-onasis-monorepo` describing the publish flow + required secrets/environment.
- [ ] Document the `sync-security-packages.sh` bidirectional contract (which side is authoritative when).
- [ ] Add migration-handler authoring guide (how to register rollback handlers) to the gateway docs.
- [ ] Cross-link this handoff from each repo's CLAUDE.md / README once reviewed.
