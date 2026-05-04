# Postman Operating Playbook

> **Status:** Active internal default
> **Date:** 2026-04-23
> **Audience:** Product, architecture, integration, and agent-assisted delivery workflows
> **Scope:** Postman usage, provider intake, canonical collection management, and local sync discipline

---

## Purpose

This document turns the provider-intelligence framework into a practical operating workflow the team and coding agents can follow without drifting.

The goal is to make Postman useful without letting it quietly become a second, ungoverned source of truth.

This playbook is the default operating guide for:

- discovering third-party APIs
- curating provider intake collections
- maintaining canonical collections for owned Onasis surfaces
- organizing local Postman sync/export artifacts
- preventing drift between docs, collections, OpenAPI, gateway behavior, and adapters

---

## The Five Default Rules

These five rules are the repo-level "bible" for Postman usage in this project.

### 1. How We Use Postman

Postman is the **discovery and intake layer**, not the sole source of truth.

Use Postman for:

- discovering candidate providers and public collections
- reviewing request shapes, auth patterns, environments, and examples
- importing or referencing public collections into a research workspace
- building comparable request libraries for shortlisted providers
- collection-based exploratory and sandbox testing

Do not use Postman alone to decide:

- security eligibility
- governance maturity
- regulatory suitability
- operational fitness
- international partnership readiness

### 2. What Evidence We Collect Per Provider

Every provider must produce one standard evidence pack covering:

- discovery
- technical contract
- security
- governance and operations
- regulatory and eligibility posture
- strategic fit

The details and scoring model are defined in:

- `/Users/seyederick/onasis-gateway/docs/plans/2026-04-21-integration-intelligence-provider-eligibility-framework.md`

### 3. How We Score Providers

Use a gated model, not "looks promising" intuition.

Every provider must first pass hard gates:

- usable docs/spec/examples
- stable auth model
- realistic sandbox or test path
- minimum acceptable security posture
- clear legal/operational legitimacy
- clean mediation through the central gateway

Then apply the weighted score:

- Technical Fit: 20
- Security Fit: 20
- Ops/Governance Fit: 15
- Regulatory Fit: 20
- Strategic Fit: 15
- Integration Velocity: 10

### 4. How Postman Work Feeds The Gateway Roadmap

Postman work is not a side quest. It must feed:

- adapter backlog shaping
- standards uplift
- wedge refinement
- regulatory insulation

If a Postman activity does not improve one of those four areas, it is probably noise.

### 5. Operating Model

Maintain one curated provider intelligence register and one disciplined Postman workspace structure.

Each provider gets:

- evidence pack
- score
- decision label
- owner
- last review date
- recommended action

Each collection or workspace should have one clear role:

- canonical
- provider intake
- sandbox/testing
- archive

---

## Source-Of-Truth Rules

The biggest drift risk is letting imported collections silently become "truth".

Use these rules.

### Canonical truth for owned Onasis APIs

For **owned** surfaces, the source of truth should be:

1. implementation behavior in the gateway/service
2. OpenAPI or machine-readable contract where available
3. curated canonical Postman collection generated from or reconciled against the owned contract

Postman should **not** be the first source of truth for owned APIs if the repo already owns the contract.

This applies especially to:

- Auth Gateway
- Gateway REST APIs
- Memory service REST operations
- internal service adapters exposed to applications

### Reference truth for third-party APIs

For **third-party** providers, imported Postman collections are reference material, not production truth.

Treat them as:

- intake aids
- contract clues
- testing helpers
- comparison artifacts

But always reconcile them with:

- official docs
- OpenAPI spec
- vendor changelog
- actual sandbox behavior

---

## Recommended Workspace And Collection Topology

To keep things stable, separate work by purpose.

### Workspace A: Canonical Onasis APIs

This workspace holds only owned, stable collections.

Recommended canonical collections:

- `Onasis Gateway REST API`
- `Onasis Auth Gateway API`
- `Onasis Memory Service REST API`
- `Onasis Internal Services`
- `Onasis Provider-Abstraction Test Flows`

Use this workspace for:

- standardized internal contract review
- onboarding internal app teams
- consistent request examples
- regression checks

Do **not** bulk-import public collections here.

### Workspace B: Provider Intake

This workspace holds third-party imports and comparison material.

Recommended structure:

- `Payments - Intake`
- `Identity - Intake`
- `Messaging - Intake`
- `Banking / Treasury - Intake`
- `Developer Tooling - Intake`

Use this workspace for:

- public API Network imports
- vendor comparison
- shortlist testing
- reference preservation

Do **not** call this workspace canonical.

Recommended exact workspace name:

- `Onasis Provider Intake`

### Workspace C: Sandbox / MVP Tests

This workspace is scratch space.

Use it for:

- quick experiments
- auth trial requests
- collection debugging
- temporary flows

Do **not** treat this workspace as long-term truth.

Recommended exact workspace name:

- `Onasis Sandbox`

If a flow matters after experimentation, promote it into either:

- Canonical Onasis APIs
- Provider Intake

### Workspace D: Archive

This holds frozen snapshots and deprecated references.

Use it for:

- vendor version snapshots
- retired collections
- historical evidence for drift analysis

Recommended exact workspace name:

- `Onasis Archive`

### Legacy Workspace Note

The following existing workspaces can continue temporarily, but should not be treated as the long-term naming standard:

- `SEFTEC APIs`
- `mvp tests`

---

## Local Sync Structure

Keep local Postman sync artifacts organized so agents do not scatter exports around the repo.

Recommended local structure:

```text
references/
  postman/
    README.md
    canonical/
      gateway/
      auth-gateway/
      memory-service/
    provider-intake/
      payments/
      work-productivity/
      crm-forms-scheduling/
      developer-collaboration/
      messaging/
    archive/
```

Rules:

- canonical exports belong under `references/postman/canonical/`
- third-party imports and comparisons belong under `references/postman/provider-intake/`
- historical snapshots belong under `references/postman/archive/`
- never drop random Postman exports in the repo root
- never commit secrets inside exported environments or collections

Scaffolded paths now exist in the repo:

- `/Users/seyederick/onasis-gateway/references/postman/README.md`
- `/Users/seyederick/onasis-gateway/references/postman/canonical/`
- `/Users/seyederick/onasis-gateway/references/postman/provider-intake/`
- `/Users/seyederick/onasis-gateway/references/postman/archive/`

For curated provider references already tracked in-repo, also use:

- `/Users/seyederick/onasis-gateway/postman/provider-intake.manifest.yaml`
- `/Users/seyederick/onasis-gateway/postman/collections/**/collection.ref.yaml`

---

## Anti-Drift Guardrails

### 1. Never mix owned and imported contracts in one collection

If the collection contains both:

- our owned routes
- vendor reference routes

it will drift.

### 2. Never let agent-mode imports mutate canonical collections directly

Agent-mode or AI-assisted Postman browsing is useful for discovery, but it should not be trusted to bulk-import directly into canonical workspaces without review.

Safe pattern:

1. import into Provider Intake or Sandbox
2. verify
3. curate
4. promote intentionally

### 3. Canonical collections must map back to real repo surfaces

For owned collections, every folder/request should map back to one of:

- gateway route
- service endpoint
- OpenAPI path
- internal runbook

### 4. Memory and auth collections should stay especially strict

For consistency and minimal drift:

- keep `Auth Gateway` in a canonical collection
- keep `Memory Service REST API` in a canonical collection
- align requests to actual gateway-routed behavior, not ad hoc direct calls
- prefer central gateway routes when that is the intended production architecture

### 5. Never store real secrets in collections, environments, examples, or exported JSON

Use placeholders only:

- `{{LANONASIS_API_KEY}}`
- `{{SUPABASE_URL}}`
- `{{AUTH_GATEWAY_URL}}`

Load actual secrets at runtime through 1Password or another approved secret manager.

---

## Recommended Collection Strategy For Current Onasis Work

Yes, your instinct is right: a dedicated MVP/canonical route for auth and memory REST operations would reduce drift.

The cleaner version is:

- do **not** rely on `mvp tests` as source of truth
- instead create or promote a canonical collection lane for:
  - auth gateway flows
  - gateway REST API flows
  - memory REST operations

Recommended baseline collections:

1. `Onasis Auth Gateway API`
2. `Onasis Gateway REST API`
3. `Onasis Memory Service REST API`
4. `Onasis Provider Intake - Payments`
5. `Onasis Provider Intake - Identity`

This gives us:

- consistency for internal onboarding
- less contract drift
- cleaner adapter and runbook mapping
- safer promotion from experiment to standard

### Exact Naming Scheme

Use these collection names by default.

Canonical collections:

- `Onasis Gateway REST API`
- `Onasis Auth Gateway API`
- `Onasis Memory Service REST API`
- `Onasis Internal Services`
- `Onasis Provider-Abstraction Test Flows`

Provider-intake collections:

- `Provider Intake - Payments - <Provider>`
- `Provider Intake - Work & Productivity - <Provider>`
- `Provider Intake - CRM, Forms & Scheduling - <Provider>`
- `Provider Intake - Developer & Collaboration - <Provider>`
- `Provider Intake - Messaging - <Provider>`

Archive collections:

- `Archive - <Provider> - <VersionOrDate>`

Sandbox collections:

- `Sandbox - <Topic> - <DateOrOwner>`

### Current Curated Intake Targets

The current provider-intake manifest covers these 15 listed targets:

- ClickUp API
- HubSpot CRM API
- Stripe API
- Monday.com API
- Google Drive API
- Notion API
- GitHub API
- Confluence Atlassian REST API
- Typeform API
- Jotform API
- Calendly API
- Slack Web API
- WhatsApp Cloud API
- Gmail API
- Telegram Bot API

Manifest path:

- `/Users/seyederick/onasis-gateway/postman/provider-intake.manifest.yaml`

Import helper:

- `/Users/seyederick/onasis-gateway/scripts/import-provider-intake.js`

---

## Default Agent Workflow

When an agent is asked to help with Postman setup or provider intake, it should follow this order:

1. inspect existing repo docs and local Postman-related artifacts
2. verify Postman auth path:
   - MCP if exposed in-session
   - otherwise CLI/API via `POSTMAN_API_KEY`
3. identify whether the task concerns:
   - canonical owned APIs
   - provider intake
   - sandbox testing
   - archival/reference work
4. avoid mutating canonical collections until imports or edits are verified
5. preserve local sync structure under `references/postman/`
6. update the provider-evidence workflow, not just the collection list
7. report exactly what was changed, what remains reference-only, and what should be promoted next

---

## Drop-In Prompt For Any Agent

Use this prompt when you want an agent to help with Postman setup, curation, or local sync without drifting from project standards.

```md
You are working in /Users/seyederick/onasis-gateway.

Your job is to help organize and maintain Postman usage for this project without creating drift between Postman, OpenAPI, gateway behavior, adapter logic, and repo documentation.

Follow these rules:

1. Treat Postman as the discovery and intake layer, not the sole source of truth.
2. For owned Onasis APIs, prefer repo contracts and actual gateway/service behavior first, then curate canonical Postman collections from that truth.
3. For third-party APIs, use imported collections only as reference material until reconciled with official docs/specs and sandbox behavior.
4. Never mix canonical owned collections with provider-intake collections.
5. Never store or commit real secrets in Postman collections, environments, exports, scripts, or repo files.

Default workflow:

1. Inspect existing docs and local artifacts first.
   - Read /Users/seyederick/onasis-gateway/docs/plans/2026-04-21-integration-intelligence-provider-eligibility-framework.md
   - Read /Users/seyederick/onasis-gateway/docs/plans/2026-04-23-postman-operating-playbook.md
   - Check whether Postman MCP is available in-session.
   - If MCP is not available, verify CLI/API auth using POSTMAN_API_KEY without exposing secret values.
2. Classify the task as one of:
   - canonical owned API work
   - provider intake
   - sandbox/MVP testing
   - archive/reference work
3. Use this workspace strategy:
   - Canonical Onasis APIs: owned and stable
   - Provider Intake: imported public/vendor collections
   - Sandbox/MVP: temporary experiments only
   - Archive: frozen historical snapshots
4. Use this local repo structure for exports or sync artifacts:
   - /Users/seyederick/onasis-gateway/references/postman/canonical/
   - /Users/seyederick/onasis-gateway/references/postman/provider-intake/
   - /Users/seyederick/onasis-gateway/references/postman/archive/
5. For every provider under review, capture evidence for:
   - discovery
   - technical contract
   - security
   - governance/operations
   - regulatory/eligibility
   - strategic fit
6. Apply hard gates first, then weighted scoring:
   - Technical Fit 20
   - Security Fit 20
   - Ops/Governance Fit 15
   - Regulatory Fit 20
   - Strategic Fit 15
   - Integration Velocity 10
7. For Auth Gateway, Gateway REST APIs, and Memory REST operations:
   - prefer canonical collections
   - align to actual gateway-routed production behavior
   - avoid using scratch `mvp tests` collections as long-term truth
8. Never bulk-import directly into canonical collections without review.
   - import into Provider Intake or Sandbox first
   - verify
   - curate
   - promote intentionally

Expected output:

- summarize current Postman auth/tooling status
- state what workspace/collection structure exists now
- state what should be canonical vs provider-intake vs sandbox
- identify drift risks
- make only safe changes
- report exact files, collections, or exports created or updated
- clearly label anything that is still reference-only and not yet promoted to canonical
```

---

## Companion Documents

- `/Users/seyederick/onasis-gateway/docs/plans/2026-04-21-integration-intelligence-provider-eligibility-framework.md`
- `/Users/seyederick/onasis-gateway/docs/implementation/EDOC_APP_ONBOARDING_RUNBOOK.md`
- `/Users/seyederick/onasis-gateway/docs/architecture/API-GATEWAY-CONSOLIDATION-PLAN.md`
