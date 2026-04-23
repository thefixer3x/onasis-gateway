# Integration Intelligence & Provider Eligibility Framework

> **Status:** Draft
> **Date:** 2026-04-21
> **Audience:** Internal strategy, architecture, integration, and partner-readiness planning
> **Primary Buyer Assumption:** Tier-2 Nigerian bank
> **Operating Posture:** Infrastructure-only, bank-fronted

---

## Purpose

This document defines how Onasis Gateway evaluates third-party APIs and providers so we do not confuse endpoint availability with partnership readiness.

The goal is to make provider discovery, comparison, and onboarding support the long-term agenda:

- connect Nigeria to global financial infrastructure cleanly
- preserve security, governance, operations, and regulatory discipline
- improve gateway adapter investment decisions
- strengthen international partnership readiness over time
- maintain optionality through primary and fallback providers

This framework is a **companion** to the repo-aligned open-banking productisation plan. It does not replace the core build roadmap. It supplies the intake, qualification, and comparative intelligence layer around it.

For day-to-day execution guidance, use the companion operating playbook:

- `/Users/seyederick/onasis-gateway/docs/plans/2026-04-23-postman-operating-playbook.md`

---

## Core Decision

Postman is part of the answer, but not the whole answer.

### Postman's role

Postman is the **discovery and intake layer** for third-party APIs.

Use Postman for:

- finding candidate providers and public collections
- reviewing request flows, auth patterns, environments, and examples
- importing or curating collections for research and sandbox validation
- building comparable request libraries for shortlisted providers
- collection-based exploratory testing

Do **not** use Postman alone to decide:

- whether a provider is secure enough
- whether a provider is regulator-safe
- whether a provider is operationally mature
- whether a provider is suitable for Tier-1 global counterparty expectations
- whether a provider deserves adapter investment

### Supporting layers

Postman must be supplemented by:

- official docs and standards review
- OpenAPI/spec review
- security and governance due diligence
- operational and regulatory evaluation
- strategic fit assessment against the gateway roadmap

---

## Tooling Model

### 1. Postman MCP

Preferred for:

- searching public Postman elements
- discovering public collections and requests
- browsing workspaces and Postman-native assets
- collection/workspace/environment management

Known role boundary:

- best tool for public-network discovery and collection intake
- should be preferred once directly exposed in-session

### 2. Postman CLI

Preferred for:

- authenticated request execution
- collection runs
- validating imported or local collection workflows
- workspace asset preparation and push workflows

Known role boundary:

- useful for execution and testing
- not the best primary interface for public API-network discovery

### 3. Official Docs / Standards Docs

Preferred for:

- authoritative auth models
- regulatory or standards claims
- versioning and deprecation policy
- supported security controls
- implementation details not visible in collections

### 4. OpenAPI / Machine-readable Contracts

Preferred for:

- contract completeness
- code generation readiness
- schema quality
- validation and typing potential
- consistency scoring

---

## Integration Intelligence Workflow

### Stage 1: Discover

Goal: find candidate providers without overcommitting engineering time.

Inputs:

- Postman public collections
- official docs
- OpenAPI specs
- SDK repos
- changelogs
- partner recommendations
- regulatory and market research

Outputs:

- provider shortlist
- category classification
- first-pass risks
- initial evidence links

### Stage 2: Intake

Goal: collect a standard evidence pack for each provider.

Every candidate gets one evidence record with:

- provider identity
- jurisdiction and licensing posture
- docs/spec links
- auth model
- collection availability
- sandbox availability
- webhook/event model
- operational maturity indicators
- compliance/reliability notes
- integration relevance to Onasis

### Stage 3: Gate

Goal: stop weak providers early.

A provider is **not eligible** for active onboarding if any hard gate fails:

- no usable auth model
- no testable sandbox or equivalent non-production path
- no reliable docs/spec/examples
- security posture below category minimum
- unclear legal or operational legitimacy for intended use
- cannot be abstracted cleanly behind gateway controls

### Stage 4: Score

Goal: rank remaining providers fairly and consistently.

Eligible providers receive a weighted score and final label.

### Stage 5: Route

Goal: decide what happens next.

Every provider gets one route:

- ignore
- monitor
- research deeper
- sandbox test
- adapter candidate
- strategic partnership candidate

---

## Evidence Pack Structure

Each provider record must include the following sections.

### A. Discovery Summary

- provider name
- category
- primary market/jurisdiction
- target use case
- Postman workspace/collection links
- official docs link
- OpenAPI/spec link if available
- SDK/client libraries
- changelog/status page

### B. Technical Contract Evidence

- auth mechanism
- endpoint structure quality
- request/response consistency
- idempotency support
- webhook availability
- webhook signing or verification model
- versioning strategy
- error model quality
- pagination/filtering quality
- rate limiting semantics
- async workflow support
- bulk/file support where relevant
- OpenAPI completeness

### C. Security Evidence

- OAuth2/OIDC/FAPI posture
- private_key_jwt / mTLS / DPoP support where relevant
- API key handling model
- secret rotation support
- replay protection
- tenant isolation / RBAC
- IP allowlisting or network controls
- auditability / traceability features
- security documentation or trust center
- compliance attestations if public

### D. Governance & Operations Evidence

- SLA / uptime commitments
- status page quality
- incident communication practice
- support and escalation path
- deprecation/version policy
- environment separation
- request IDs / correlation IDs
- observability hooks
- change management maturity
- onboarding/offboarding clarity

### E. Regulatory & Eligibility Evidence

- licensing or regulated status
- contracting posture with banks or enterprises
- data residency implications
- controller/processor posture
- AML/KYC implications
- sanctions or export-control considerations
- audit evidence quality
- jurisdiction risk

### F. Strategic Fit Evidence

- relevance to Tier-2 bank-first strategy
- relevance to Naira↔USD thin slice
- relevance to treasury and partner rails positioning
- international counterparty credibility
- pluggability into gateway adapter model
- fallback/secondary-provider value
- moat contribution over time

---

## Scoring Model

### Hard Gates

A provider is ineligible if any of the following are true:

- docs are inadequate for safe implementation
- no realistic sandbox or test path exists
- auth/security model is below category minimum
- legal or operational legitimacy is unclear
- provider cannot be mediated through central gateway policy

### Weighted Score (100 points)

| Pillar | Weight | What it measures |
|---|---:|---|
| Technical Fit | 20 | Contract quality, consistency, abstraction fit |
| Security Fit | 20 | Auth strength, verification, auditability, control maturity |
| Regulatory Fit | 20 | Jurisdictional viability, licensing, audit/regulatory defensibility |
| Ops & Governance Fit | 15 | Reliability, lifecycle maturity, support, change discipline |
| Strategic Fit | 15 | Relevance to long-term rails and global plugability |
| Integration Velocity | 10 | Ease and speed of getting to a safe pilot |

### Decision Bands

| Score | Meaning | Action |
|---|---|---|
| 85-100 | Strong primary candidate | Prioritize for sandbox and adapter work |
| 70-84 | Good secondary/fallback | Keep warm, validate deeper |
| 55-69 | Conditional/watchlist | Research or sandbox only |
| <55 | Not worth active investment now | Reject or archive |

### Final Labels

Every provider gets exactly one label:

- `Primary Rail`
- `Secondary Rail`
- `Fallback Rail`
- `Watchlist`
- `Rejected`

---

## Minimum Global-Readiness Bar

To support future integration with international firms, shortlisted providers should increasingly trend toward this minimum bar:

- strong and documented auth model
- stable versioning and deprecation policy
- machine-readable contract or high-quality spec
- signed webhook/event model where events matter
- clear sandbox and production separation
- operational maturity with status and incident posture
- audit-friendly traceability
- ability to sit cleanly behind Onasis Gateway mediation
- no requirement for direct client bypass of central guardrails
- compatibility with eventual FAPI / consent / trust-registry trajectory

This is not the same as requiring every provider to be fully FAPI-native today. It means we avoid onboarding providers that structurally block that future.

---

## How This Feeds The Gateway / Open-Banking Roadmap

This framework feeds the main roadmap in four ways.

### 1. Adapter Investment Prioritization

It tells us which providers deserve engineering time.

Effects:

- reduces wasteful adapter generation
- highlights providers worth custom abstraction work
- identifies fallback providers before production dependency forms

### 2. Standards Uplift Direction

It reveals what global-grade counterparties expect in practice.

Effects:

- strengthens priorities around consent, FAPI, trust registry, signed events, and audit spine
- helps separate local convenience from internationally credible architecture

### 3. Thin-Slice Wedge Refinement

It helps choose the best path for Naira↔USD and related treasury flows.

Effects:

- informs provider selection for first wedge partners
- improves resilience by maintaining backups and alternatives
- supports correspondent-banking modernization positioning

### 4. Regulatory Insulation

It helps avoid partners and providers that weaken the bank-fronted software-vendor posture.

Effects:

- flags providers that force direct client bypasses
- flags providers with poor auditability or weak data posture
- supports the matryoshka defense by preferring better-documented, better-controlled partners

---

## Relationship To Existing Repo-Aligned Framework Plan

This framework does **not** replace the repo-aligned plan.

### What stays unchanged

- Tier-2 bank-first strategy
- infrastructure-only, bank-fronted posture
- priority of consent substrate as first-class entity
- priority of FAPI/trust-registry/canonical-model work
- gateway-first architecture and central guardrail enforcement

### What changes

A new companion track is added:

- provider intelligence
- evidence-driven provider selection
- fallback strategy
- comparative international benchmarking
- stronger basis for deciding which adapters and partner rails matter most

### Practical interpretation

- the repo-aligned framework remains the **spine**
- this document becomes the **sensing and qualification layer** around it

---

## Operating Artifacts

The following artifacts should exist for active use.

### 1. Provider Register

A living table/database of all reviewed providers with:

- category
- evidence links
- score
- label
- owner
- last review date
- next action

### 2. Evidence Folder or Page Per Provider

One page per provider containing the evidence pack.

### 3. Shortlist View

A filtered view of:

- current primary candidates
- secondary/fallback candidates
- watchlist entries

### 4. Roadmap Linkage

Each shortlisted provider should map to one of:

- no build action
- research action
- adapter generation action
- custom adapter action
- partnership development action

---

## Suggested First Uses

Use this framework first on provider categories most relevant to the current strategic agenda:

1. treasury / FX / remittance APIs
2. correspondent-banking-adjacent payment rails
3. identity / KYC / KYB / AML providers
4. messaging/notification infrastructure for operational workflows
5. open-finance / consent / data-access comparables from mature jurisdictions

---

## Provider Review Template

Use this compact template for each provider:

```md
# Provider Review: <name>

## Summary
- Category:
- Jurisdictions:
- Primary use case:
- Recommended label:
- Score:
- Owner:
- Last reviewed:

## Discovery Links
- Postman:
- Docs:
- OpenAPI/spec:
- SDKs:
- Status page:

## Hard Gates
- Docs/spec usable: yes/no
- Sandbox/test path available: yes/no
- Security minimum met: yes/no
- Legitimacy clear: yes/no
- Gateway mediation possible: yes/no

## Evidence Notes
### Technical
### Security
### Ops/Governance
### Regulatory
### Strategic Fit

## Decision
- Recommended route:
- Why now:
- Key risks:
- Next action:
```

---

## Current Tooling Findings (2026-04-21)

Observed from local validation:

- Postman CLI is installed and authenticated once login-shell secrets are loaded
- Postman API `/me` works with `POSTMAN_API_KEY`
- Postman API `/workspaces` works and returns accessible workspaces
- public Postman network discovery is not cleanly exposed through guessed REST search endpoints
- official Postman MCP documentation explicitly supports public element discovery, making MCP the preferred discovery interface once directly available in-session

Implication:

- use Postman CLI now for authenticated execution and workspace-adjacent validation
- prefer Postman MCP later for public-network discovery and collection intake workflows

---

## Decision Summary

- Keep the repo-aligned framework plan intact
- Add this provider-intelligence framework as a companion artifact
- Treat Postman as the discovery/intake layer, not the complete due diligence system
- Use weighted scoring plus hard gates to avoid weak providers
- Prefer providers that strengthen the long-term path toward globally credible, standards-aligned integration
