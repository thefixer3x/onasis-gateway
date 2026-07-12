# Trust Boundaries & Header Propagation Model

> **Purpose:** Define which services are trusted to assert user identity, how context headers flow through the gateway mesh, and what each service must validate before acting on a request.
>
> **Parent:** SDK-17 — gateway stability and consolidation
> **References:** centralisation-tasks.md, ROUTE_MAP.yaml, API-GATEWAY-CONSOLIDATION-PLAN.md

---

## Trust Model Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRUST ZONES                               │
│                                                                  │
│  ┌────────────────────┐    ┌──────────────────────────────┐     │
│  │  Zone 0: External  │    │  Zone 1: Gateway Edge         │     │
│  │  (Untrusted)       │    │  (Nginx — TLS termination,    │     │
│  │                    │    │   CORS, rate limiting,         │     │
│  │  Client requests   │───▶│   request ID generation)       │     │
│  │  (browsers, SDKs,  │    │                                │     │
│  │   AI clients)      │    │  Headers added here:           │     │
│  │                    │    │  - X-Request-ID                 │     │
│  └────────────────────┘    │  - X-Forwarded-For              │     │
│                             │  - X-Forwarded-Proto            │     │
│                             └──────────────┬─────────────────┘     │
│                                            │                       │
│                             ┌──────────────▼─────────────────┐     │
│                             │  Zone 2: Auth Gateway           │     │
│                             │  (ONLY identity authority)      │     │
│                             │                                 │     │
│                             │  Headers MINTED here:           │     │
│                             │  - X-User-Id                    │     │
│                             │  - X-User-Email                 │     │
│                             │  - X-User-Role                  │     │
│                             │  - X-Scopes                     │     │
│                             │  - X-Session-Id                 │     │
│                             └──────────────┬─────────────────┘     │
│                                            │                       │
│                             ┌──────────────▼─────────────────┐     │
│                             │  Zone 3: Application Services   │     │
│                             │  (MUST NOT mint identity)       │     │
│                             │                                 │     │
│                             │  - Central Gateway (:3000)      │     │
│                             │  - Enterprise MCP (:3001)       │     │
│                             │  - MCP Core (:3001-3003)        │     │
│                             │  - Supabase Edge Functions       │     │
│                             │                                 │     │
│                             │  These services ACCEPT but      │     │
│                             │  NEVER generate X-User-*        │     │
│                             │  headers.                       │     │
│                             └─────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Rule 1: Single Identity Authority

**Only auth-gateway (:4000) is permitted to mint user identity headers.**

| Header | Minted By | Description |
|--------|-----------|-------------|
| `X-User-Id` | auth-gateway only | Authenticated user's UUID |
| `X-User-Email` | auth-gateway only | User's verified email |
| `X-User-Role` | auth-gateway only | RBAC role (admin, user, service) |
| `X-Scopes` | auth-gateway only | Space-separated OAuth2 scopes |
| `X-Session-Id` | auth-gateway only | Active session identifier |

Any other service adding these headers is a security violation and must be treated as an incident.

---

## Rule 2: Header Trust Chain

Headers flow through the system in a strict chain. Each downstream service must verify the origin of identity headers before acting on them.

### Trust Chain Flow

```
Client → Nginx → [Central Gateway] → [Auth Gateway] → [Central Gateway] → [Target Service]
                      │                    │
                      │ 1. Extract token   │ 2. Validate token
                      │    from request    │    Return X-User-*
                      │                    │
                      └────────────────────┘
                           3. Forward context headers to target
```

### Step-by-Step

1. **Nginx** receives client request. Adds `X-Request-ID` (auto-generated), `X-Forwarded-For`, `X-Forwarded-Proto`. Passes to central-gateway.

2. **Central Gateway** extracts the Bearer token or session cookie. It does **NOT** validate the token locally. It calls auth-gateway's introspection endpoint:
   ```
   POST /v1/auth/session  (or /oauth/introspect)
   Authorization: Bearer <token>
   ```
   Auth-gateway returns verified user context as response body or headers.

3. **Central Gateway** attaches the verified `X-User-*` headers to the downstream request (to enterprise-mcp, Supabase edge, etc.).

4. **Target services** (enterprise-mcp, Supabase edge functions) MUST:
   - Only trust `X-User-*` headers when the request originates from Nginx/central-gateway (verified by source IP 127.0.0.1 or shared secret)
   - Never accept `X-User-*` headers directly from external clients
   - Strip any `X-User-*` headers that arrived from outside the trust boundary

---

## Rule 3: What Central Gateway MUST NOT Do

The central-gateway must be a **thin proxy** for authentication. It MUST NOT:

- ❌ Perform local JWT verification (no `jsonwebtoken.verify()`)
- ❌ Cache or store user tokens or secrets
- ❌ Log decrypted credentials or full tokens in plaintext
- ❌ Mint or inject `X-User-*` headers without auth-gateway confirmation
- ❌ Accept `X-User-*` headers from external requests (must strip and re-verify)

### Correct Implementation: OnasisAuthBridge (Thin Proxy)

```typescript
// central-gateway: OnasisAuthBridge — THIN PROXY ONLY
async function resolveUserContext(req: Request): Promise<UserContext | null> {
  const token = extractBearerToken(req) || extractSessionCookie(req);
  if (!token) return null;

  // Delegate ALL validation to auth-gateway
  const response = await fetch('http://127.0.0.1:4000/v1/auth/session', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) return null;

  // Return ONLY what auth-gateway verified
  const { user_id, email, role, scopes, session_id } = await response.json();
  return { userId: user_id, email, role, scopes, sessionId: session_id };
}
```

---

## Rule 4: Enterprise MCP Token Flow

Enterprise MCP (:3001) currently uses `LANONASIS_API_KEY` (an admin-level key). This must be eliminated.

### Before (Current — Violation)

```
Client → Enterprise MCP
  Authorization: Bearer <LANONASIS_API_KEY>  ← Admin key, no user context
```

### After (Target — Per-User)

```
Client → Nginx → Central Gateway → Auth Gateway (introspect)
                                      ↓
                         Central Gateway attaches X-User-* headers
                                      ↓
                         Enterprise MCP receives:
                           X-User-Id: <uuid>
                           X-Scopes: <validated scopes>
```

### Migration Steps

1. Remove `LANONASIS_API_KEY` from enterprise-mcp environment
2. Enterprise-mcp reads `X-User-Id` and `X-Scopes` from request headers
3. Enterprise-mcp enforces scope checks based on `X-Scopes`
4. If enterprise-mcp needs to decrypt vendor keys (e.g., for payment adapters), it must use `@onasis/security-sdk` and the `vsecure` schema tables:
   - `vsecure.external_api_keys`
   - `vsecure.user_mcp_services`
   - `vsecure.api_key_scopes`
   - `vsecure.mcp_usage_logs`

---

## Rule 5: External Request Sanitization

Nginx and central-gateway MUST strip any identity headers that arrive from external clients before forwarding to internal services.

### Nginx Sanitization (in gateway.conf)

```nginx
# Strip any X-User-* headers from external requests
# These headers may ONLY be set by auth-gateway via central-gateway
proxy_set_header X-User-Id "";
proxy_set_header X-User-Email "";
proxy_set_header X-User-Role "";
proxy_set_header X-Scopes "";
proxy_set_header X-Session-Id "";

# Then proxy_pass to central-gateway, which will re-attach verified headers
```

> **Note:** This is handled differently depending on where identity headers are attached. If central-gateway attaches them AFTER auth introspection (not at Nginx level), then Nginx only needs to strip them on the inbound path. Central-gateway must strip them on the path to downstream services until re-verified.

### Central Gateway Sanitization

```typescript
// Before forwarding to any internal service, strip external identity claims
function sanitizeIncomingHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers);
  sanitized.delete('X-User-Id');
  sanitized.delete('X-User-Email');
  sanitized.delete('X-User-Role');
  sanitized.delete('X-Scopes');
  sanitized.delete('X-Session-Id');
  return sanitized;
}

// After auth introspection, attach verified headers
function attachUserContext(headers: Headers, ctx: UserContext): Headers {
  headers.set('X-User-Id', ctx.userId);
  headers.set('X-User-Email', ctx.email);
  headers.set('X-User-Role', ctx.role);
  headers.set('X-Scopes', ctx.scopes.join(' '));
  headers.set('X-Session-Id', ctx.sessionId);
  return headers;
}
```

---

## Rule 6: Logging Safety

### What MUST be sanitized in logs

| Data | Action |
|------|--------|
| Full Bearer tokens | Redact to `Bearer tok_***` (first 4 chars only) |
| Session cookies | Redact entirely or hash |
| API keys | Never log in plaintext |
| `X-User-Email` | OK to log (PII — ensure GDPR compliance) |
| `X-User-Id` | OK to log (internal identifier) |
| Passwords, secrets, keys | NEVER log |

### Nginx Log Sanitization

The JSON log format already avoids logging headers by default (only logs `$http_user_agent`). Do not add `$http_authorization` or `$http_cookie` to the log format.

---

## Rule 7: Service-to-Service Authentication

For internal service-to-service calls (central-gateway → enterprise-mcp, central-gateway → mcp-core), the trust is established by:

1. **Network boundary**: All internal services listen on `127.0.0.1` only (not `0.0.0.0`)
2. **Shared secret** (future): A rotating internal HMAC token passed as `X-Internal-Auth` for service identity verification

Until shared secret is implemented, services trust requests from `127.0.0.1` that carry valid `X-User-*` headers set by central-gateway.

---

## Audit Checklist

Before any code change touching auth or identity headers, verify:

- [ ] Does this change add `X-User-*` header generation outside auth-gateway? → REJECT
- [ ] Does this change add JWT verification in central-gateway or enterprise-mcp? → REJECT (delegate to auth-gateway)
- [ ] Does this change log tokens, secrets, or full cookies? → REJECT (sanitize first)
- [ ] Does this change accept `X-User-*` headers from external requests? → REJECT (strip and re-verify)
- [ ] Does this change use `LANONASIS_API_KEY` for user-scoped operations? → REJECT (use per-user tokens)
- [ ] Is the auth introspection endpoint called with a timeout and error handling? → Required

---

## Open Decisions

1. **Auth introspection endpoint**: Confirm whether central-gateway should call `/v1/auth/session` or `/oauth/introspect` (or both, depending on token type).
2. **Header vs response body**: Should auth-gateway return user context as HTTP headers or JSON response body? Headers are simpler for proxying; response body allows richer context (e.g., permissions object).
3. **Service identity**: Should we implement `X-Internal-Auth` HMAC now (Phase 1) or defer to post-cutover hardening?
4. **Session propagation**: Should central-gateway forward the original Bearer token to downstream services, or only the verified `X-User-*` headers? Forwarding the token allows downstream services to make their own auth-gateway calls if needed, but increases token exposure surface.

---

*Created: 2026-07-04*
*Owner: CTO (agent 347ed919)*
*Issue: SDK-17*
