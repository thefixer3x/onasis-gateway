Key findings and conflicts

Port mismatch: API-GATEWAY-CONSOLIDATION-PLAN.md uses API Gateway on (line 3001) while you stated localhost (line 3000) for the PM2 gateway; PORT_MAPPING_COMPLETE.md says MCP HTTP is (line 3001). We need to confirm the actual running port(s) and update the canonical map.
Files: API-GATEWAY-CONSOLIDATION-PLAN.md, PORT_MAPPING_COMPLETE.md
MCP ports conflict: consolidation plan shows MCP (lines 4000-4001) while port map shows MCP HTTP (line 3001), WS (line 3002), SSE (line 3003).
Files: same as above.
Netlify redirects currently own production routing for /api/v1/*, /ws, /sse, /oauth/*, and auth paths; the plan aims to move everything to Nginx.
File: lan-onasis-monorepo/apps/onasis-core/_redirects
Supabase REST OpenAPI defines /api/v1 REST endpoints as edge functions and lists https://api.lanonasis.com/api/v1 as prod. That must stay functional through the new gateway.
File: SUPABASE_REST_API_OPENAPI.yaml
Auth-gateway has a built-in router (cookie handling) that must be preserved; central gateway should forward cookies and origin credentials consistently, not reimplement app logic.
Target architecture (harmonized)

Single external entrypoint: gateway.lanonasis.com (or api.lanonasis.com after cutover).
Central routing via Nginx (per consolidation plan), with clear upstreams:
auth-gateway (PKCE + legacy JWT, cookie/session)
mcp-core (HTTP + WS + SSE)
supabase edge functions (memory, intelligence, keys, system)
optional legacy backends during transition
Centralized CORS, rate limiting, request ID, logging, and TLS.
Single source of truth for routing: a maintained route map file in repo, which can generate Nginx config + Netlify redirects during migration (to prevent drift).
Execution plan (phased, with deliverables and validation)

Phase 0 — Normalize the truth (1–2 days)

Deliverables
Canonical port/service map updated and committed (single doc).
Confirm the real PM2 ports (auth-gateway, api-gateway, mcp-core, WS, SSE).
Authoritative route inventory from _redirects + OpenAPI + existing Nginx configs.
Validation
pm2 list confirms active ports.
Route inventory includes all /api/v1/*, /oauth/*, /ws, /sse, /auth/*, /v1/auth/*.
Notes
Update dates in docs if correcting anything (e.g., “Updated on January 29, 2026”).
Phase 1 — Central gateway foundation (Week 1)

Deliverables
Nginx gateway.conf with upstreams, CORS map, rate limits, JSON logs, request IDs, health endpoint.
/health aggregated and /api/v1/status working at gateway.
Snippets: proxy-headers.conf, cors.conf.
Validation
nginx -t clean.
curl https://gateway.lanonasis.com/health returns 200 JSON.
Compatibility
Keep old Netlify redirects intact; gateway in shadow mode.
Phase 2 — Auth unification (Week 2)

Deliverables
Route auth traffic via gateway to auth-gateway preserving cookies/headers:
/v1/auth/*, /api/v1/auth/*, /oauth/*, /auth/cli-login, /web/*
Gateway ensures:
Access-Control-Allow-Credentials: true
Set-Cookie not stripped
X-Forwarded-* headers present
Validation
PKCE flow works end-to-end.
Legacy JWT login works.
CLI login works with cookies and redirects.
Fallback
Keep Netlify redirects as backup for auth.
Phase 3 — Supabase REST + Memory/Intelligence (Week 3)

Deliverables
Proxy /api/v1/memory/*, /api/v1/memories/*, /api/v1/intelligence/*, /api/v1/keys/*, /api/v1/config*, /api/v1/projects*, /api/v1/organization* to Supabase edge functions (same targets as _redirects).
Align OpenAPI server URL to new gateway domain (still serving /api/v1).
Validation
Compare responses between Netlify and gateway for each OpenAPI path.
Test bulk endpoints with body size limits.
Phase 4 — MCP WebSocket/SSE (Week 4)

Deliverables
/ws, /mcp/ws, /sse, /api/v1/events route to MCP services (ports confirmed).
WebSocket upgrade and SSE buffering configs enabled.
Validation
WS handshake success, SSE stays open > 30 min.
Connection limits enforced.
Phase 5 — Cutover + cleanup (Week 5)

Deliverables
DNS for api.lanonasis.com → gateway.
Netlify redirects archived (not deleted).
Remove redundant CORS/rate limits from backends when safe.
Validation
100% traffic via gateway, no functional regressions.
Error rates, latency, and auth flows stable.
Routing matrix (initial, to be confirmed against port truth)

Auth
/v1/auth/*, /api/v1/auth/*, /oauth/*, /auth/cli-login, /web/* → auth-gateway (line 4000)
Supabase Edge Functions
/api/v1/memory/*, /api/v1/memories/*, /api/v1/intelligence/*, /api/v1/keys/*, /api/v1/projects/*, /api/v1/config*, /api/v1/organization* → Supabase edge URLs from _redirects
MCP
/api/v1/* → mcp-core HTTP (if still used, confirm)
/ws → mcp-core WS
/api/v1/events → mcp-core SSE
Legacy
/api/* fallback to legacy gateway until fully migrated
Acceptance criteria

All routes in _redirects are reachable via gateway with identical responses.
OAuth2 PKCE flow and legacy JWT both function through gateway.
WS/SSE connections are stable and not buffered.
Unified CORS policy across all routes.
Logging + request IDs correlate across services.
Open questions before implementation

Confirm actual PM2 ports: is gateway truly (line 3000) or (line 3001)?
MCP services: are :3001/3002/3003 active, or is there a newer (lines 4000-4001) MCP server as in the consolidation doc?
Should the central gateway be Nginx only, or do you want to keep the Bun gateway and place Nginx in front as a reverse proxy layer?
Do you want a generated route map (single YAML) that outputs both Nginx config and Netlify redirects until cutover?



# execution plan

Here’s a structured, execution‑ready plan aligned to your current architecture (central‑gateway :3000, auth‑gateway :4000, enterprise‑mcp :3001) and the security guidance. I keep all current functionality, remove duplication, and make a single, coherent entrypoint.

Plan Overview

Single entrypoint at gateway.lanonasis.com (Nginx) routes by path to (line 3000) or (line 4000), with security‑first headers and centralized CORS/rate limiting.
Auth‑gateway becomes source of truth for identity, sessions, OAuth discovery, and claims.
central‑gateway becomes pure routing/adapter execution with auth delegated to auth‑gateway.
enterprise‑mcp stops using admin API key and accepts per‑user tokens with validated context.
Phase 0 — Canonical routing + trust model (1–2 days)

Deliverables
Canonical route map doc (single source of truth) updated with correct ports and domains.
Trust boundary doc: only auth‑gateway is allowed to mint user context headers; other services must only accept those headers from Nginx/central‑gateway.
Key decisions
Use token introspection at auth‑gateway (/oauth/introspect or /v1/auth/session) for all user‑token validation.
central‑gateway must not perform JWT validation; it only proxies to auth‑gateway and attaches verified context headers from auth‑gateway response.
Validation
One table of routes → upstream targets.
Auth‑gateway tested for introspection latency and failure modes.
Phase 1 — Unified Nginx routing (Week 1)

Deliverables
gateway.conf with upstreams and path routing:
/v1/auth/*, /oauth/*, /register, /.well-known/*, /web/*, /admin/*, /mcp/* → auth-gateway (line 4000)
/api/adapters/*, /api/tools/*, /health, / → central-gateway (line 3000)
Centralized CORS + rate limits + JSON logs + request IDs.
Security requirements
Preserve Set-Cookie and Authorization headers.
Set X-Request-ID and ensure it propagates downstream.
Only allow Access-Control-Allow-Credentials for trusted origins.
Validation
/.well-known/oauth-authorization-server returns auth‑gateway discovery JSON.
PKCE and legacy JWT flows pass through gateway.lanonasis.com.
Phase 2 — Auth middleware alignment (Week 2)

Deliverables
OnasisAuthBridge in central‑gateway reduced to a thin proxy:
Calls auth‑gateway introspection endpoint.
No local JWT verification or session handling.
Auth‑gateway returns verified user context fields:
X-User-Id, X-User-Email, X-User-Role, X-Scopes, X-Session-Id
Security alignment (per onasis-security-agent)
Do not store secrets in gateway.
Do not log decrypted credentials or full tokens; sanitize logs.
Validation
central‑gateway accepts only verified context from auth‑gateway.
Rejected or expired tokens never reach adapter execution.
Phase 3 — Per‑user token flow across enterprise‑mcp (Week 3)

Deliverables
Remove LANONASIS_API_KEY usage in enterprise‑mcp.
enterprise‑mcp expects user token or verified context headers from central‑gateway.
Scope checks enforced based on X-Scopes.
Security alignment
If enterprise‑mcp needs to decrypt vendor keys, it must use @onasis/security-sdk and vsecure schema (vsecure.external_api_keys, vsecure.user_mcp_services, vsecure.api_key_scopes, vsecure.mcp_usage_logs).
Validation
All enterprise‑mcp requests require user context; no admin key path.
Usage logs record user identity and scope.
Phase 4 — Unified health + discovery (Week 4)

Deliverables
/health (central‑gateway) aggregates:
auth-gateway health
central-gateway internal status
enterprise-mcp health
/health/full returns detailed upstream statuses.
Validation
Health endpoints return partial degraded status with clear upstream error reporting.
Health checks used by monitoring and deployment.
Phase 5 — Cutover and cleanup (Week 5)

Deliverables
Single entrypoint enforced; clients only use gateway.lanonasis.com.
Auth discovery and PKCE docs updated to reference the gateway domain.
Remove legacy Nginx sites if redundant.
Validation
No direct client access to auth.connectionpoint.tech unless explicitly required.
Critical controls to keep functionality intact

Cookies and sessions: Ensure proxy_set_header Cookie $http_cookie and avoid stripping Set-Cookie.
CORS: Only whitelisted origins; avoid reflection of arbitrary origin.
OAuth discovery: /.well-known/oauth-authorization-server must be routed to auth‑gateway.
Headers trust: Downstream services must trust X-User-* only when request originates from central‑gateway/Nginx.
Suggested artifacts to add (repo‑level)

ROUTE_MAP.yaml (single source of truth)
TRUST_BOUNDARIES.md (headers, auth source of truth)
GATEWAY_ROLLOUT.md (phase checklists, rollback)
Open confirmations before implementation

Confirm auth‑gateway introspection endpoint: /oauth/introspect vs /v1/auth/session (or both).
Confirm if enterprise-mcp should receive full token or only trusted X-User-* headers.
Confirm if any clients still depend on auth.connectionpoint.tech and require a redirect strategy.