# ADR-001: Gateway Authentication Architecture

**Status**: Accepted | **Date**: 2026-01-15 | **Authors**: thefixer3x

## Context

The onasis-gateway project requires a robust authentication system that supports multiple auth methods (JWT, OAuth2/PKCE, API keys) while maintaining security and performance across API Gateway and MCP Server components.

### Problems
1. **Fragmented Auth**: Multiple authentication implementations scattered across services
2. **JWT Validation**: Should centralized gateway validate tokens or delegate?
3. **Multi-Strategy Verification**: Need to support legacy JWT, OAuth tokens, and API keys simultaneously
4. **Performance**: Auth checks should not become bottlenecks
5. **Security**: Avoid logging sensitive credentials or tokens

## Decision

**Separate Auth Gateway (Service)**: Create dedicated authentication service running on port 4000 that handles all identity verification.

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Client     │────▶│  Central Gateway │────▶│ Auth Gateway│
│  (Any)      │     │  :3000           │     │  :4000      │
└─────────────┘     └──────────────────┘     └─────────────┘
                             │                        │
                             ▼                        ▼
                      MCP Server              Identity Store
                      :3001                    (Supabase, etc.)
```

### Key Design Choices

1. **Gateway Does NOT Validate JWTs Directly**:
   - Central gateway (port 3000) only proxies to Auth Gateway
   - Auth Gateway performs actual JWT validation, session lookup, token introspection
   - Prevents gateway from holding sensitive validation logic

2. **Multi-Strategy Auth Verification**:
   ```javascript
   // Build candidate requests in priority order
   const candidateRequests = [];
   
   // 1. Try API key verification (preferred for service-to-service)
   if (apiKeyValue) {
     addCandidate('/v1/auth/verify-api-key', { api_key: apiKeyValue }, ...);
   }
   
   // 2. Try token verification (preferred for user sessions)
   if (token) {
     addCandidate('/v1/auth/verify-token', { token }, ...);
   }
   
   // 3. Legacy fallback
   addCandidate('/v1/auth/verify', verifyPayload, ...);
   ```

3. **Supabase JWT Fallback**:
   - If Auth Gateway doesn't recognize a token, try direct Supabase JWT verification
   - Controlled by `GATEWAY_ALLOW_SUPABASE_JWT_FALLBACK` (default: true)
   - Only works for JWT-shaped tokens (starts with `eyJ`), not API keys (`lano_`)
   - **Why**: Backward compatibility with clients that issue Supabase JWTs directly

4. **No Local JWT Validation in Central Gateway**:
   - `unified_gateway.js` does NOT have JWT decoding/validation logic
   - All verification deferred to Auth Gateway
   - Gateway only passes credentials through

5. **X-User-* Headers as Trust Boundary**:
   - Only Auth Gateway can mint `X-User-Id`, `X-User-Email`, `X-User-Role` headers
   - Central Gateway trusts these headers but does NOT generate them
   - Downstream services accept X-User-* headers only from Gateway/Proxy
   - Prevents client spoofing of user context

## Consequences

### Positive Outcomes

✅ **Security**: Authentication logic isolated in dedicated service
✅ **Performance**: Auth Gateway can scale independently, use optimized validation
✅ **Maintainability**: Single place to update auth methods (add OAuth, change JWT alg, etc.)
✅ **Flexibility**: Can swap auth providers without changing gateway code
✅ **Backward Compatibility**: Supabase JWT fallback ensures legacy clients continue working

### Negative Outcomes

⚠️ **Network Dependency**: Gateway must reach Auth Gateway (port 4000)
⚠️ **Added Hop**: One extra network call for every request (mitigated by local binding)
⚠️ **Complexity**: More moving parts to monitor and configure

### Trade-offs Made

| Decision | Alternative | Why Chosen |
|----------|-------------|------------|
| Separate Auth Gateway | Embed auth in gateway | Better isolation, independent scaling |
| Multi-strategy verification | Single auth method | Support legacy + modern clients |
| Supabase JWT fallback | Fail immediately on unknown tokens | Backward compatibility with existing clients |
| X-User-* headers from Auth Gateway | Gateway validates JWTs directly | Cleaner trust boundaries, security |

## Implementation Details

### Auth Bridge Implementation

```javascript
// middleware/onasis-auth-bridge.js
class OnasisAuthBridge {
  constructor({ authApiUrl, projectScope }) {
    this.authApiUrl = authApiUrl;
    this.projectScope = projectScope;
  }

  async verifyRequestIdentity(req) {
    // 1. Extract credentials (token, API key, session ID)
    const context = this.buildMcpRequestContext(req);
    
    // 2. Build candidate requests in priority order
    const candidates = this.buildCandidateRequests(context);
    
    // 3. Try each candidate until one succeeds
    for (const candidate of candidates) {
      const response = await fetch(candidate.url, {
        method: 'POST',
        headers: candidate.headers,
        body: JSON.stringify(candidate.payload)
      });
      
      if (response.ok) {
        return { ok: true, method: candidate.source, payload: data };
      }
    }
    
    // 4. Final fallback: Supabase JWT verification
    const supabaseFallback = await this.trySupabaseJwtVerification(token);
    if (supabaseFallback) return supabaseFallback;
    
    // 5. All methods failed
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
}
```

### Rate Limiting Strategy

Different rate limits for different endpoint types:

```javascript
// API Gateway rate limiter (stricter)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  keyGenerator: getRateLimitKey,
  message: 'Too many API requests'
});

// MCP rate limiter (more permissive)
const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // 1000 requests per window
  keyGenerator: getRateLimitKey,
  message: 'Too many MCP requests'
});

// Apply to routes
this.app.use('/api/', apiLimiter);
this.app.use('/mcp', mcpLimiter);
```

## Alternatives Considered

### Alternative 1: Embedded JWT Validation

**Approach**: Gateway decodes and validates JWTs locally using public keys.

**Pros**:
- Faster (no network hop)
- Simpler architecture

**Cons**:
- Gateway holds validation logic (tight coupling)
- Harder to rotate signing keys
- Can't support multiple auth providers
- Security risk if gateway code has vulnerabilities

**Why Rejected**: Violates separation of concerns, harder to maintain.

### Alternative 2: OAuth2 Introspection Only

**Approach**: Use standard OAuth2 introspection endpoint for all tokens.

**Pros**:
- Standard protocol
- Single verification method

**Cons**:
- No support for API keys (common in service-to-service)
- No legacy JWT support
- Requires all clients to use OAuth2

**Why Rejected**: Too restrictive for our diverse client base.

### Alternative 3: Gateway Validates, Proxies Auth State

**Approach**: Gateway validates tokens, passes authenticated user context to downstream.

**Pros**:
- Gateway has full knowledge of auth state
- Can implement complex policies

**Cons**:
- Gateway must hold validation logic
- Harder to audit (where did auth happen?)
- Risk of inconsistent auth policies

**Why Rejected**: Violates trust boundary principle.

## Security Considerations

### What Gets Logged

✅ **Logged**:
- Request ID (for tracing)
- Endpoint path
- HTTP status code
- Duration

❌ **NOT Logged**:
- Raw tokens
- API keys (even hashed)
- User emails or PII
- Full request bodies

### Token Handling

```javascript
// Extract token from headers (strips "Bearer " prefix)
const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
};

// NEVER log the token, only use it for verification
const token = extractBearerToken(req.headers.authorization);
// ✅ Verify token
await verifyToken(token);
// ❌ Don't do this: console.log(token);
```

### Trust Boundaries

**Auth Gateway (Port 4000)**:
- ✅ Can mint X-User-* headers
- ✅ Has access to user data
- ✅ Performs JWT validation
- ✅ Manages sessions

**Central Gateway (Port 3000)**:
- ✅ Proxies requests to Auth Gateway
- ✅ Accepts X-User-* headers from Auth Gateway
- ✅ Does NOT validate JWTs
- ✅ Does NOT generate X-User-* headers

**Clients**:
- ✅ Can send tokens or API keys
- ❌ CANNOT mint X-User-* headers (gateway ignores them)
- ❌ CANNOT bypass auth by setting X-User-Id directly

## Monitoring & Observability

### Auth Metrics

Track these metrics in Auth Gateway:

```javascript
// Auth verification metrics
metricsCollector.recordAuth({
  method: 'jwt',           // 'jwt', 'api_key', 'oauth', 'supabase_fallback'
  success: true,           // boolean
  duration_ms: 45,         // time taken
  endpoint: '/api/v1/memory/list'
});
```

### Failure Modes

1. **Auth Gateway Unreachable** (503):
   - Logs: `Auth gateway unavailable`
   - Falls back to: Supabase JWT verification if enabled
   - If not enabled: Return 503 error

2. **Invalid Token** (401):
   - Logs: `Unauthorized - invalid token`
   - No fallback (security)

3. **Expired Token** (401):
   - Logs: `Unauthorized - token expired`
   - No fallback (security)

4. **Unknown Token Format** (400):
   - Logs: `Invalid token format`
   - Suggests: Check Authorization header syntax

## Related Documents

- [Centralisation Tasks](../../centralisation-tasks.md) - Auth unification tasks
- [API Gateway Consolidation Plan](../../API-GATEWAY-CONSOLIDATION-PLAN.md) - Phase 2: Auth Routes
- [OnasisAuthBridge Implementation](../../../middleware/onasis-auth-bridge.js) - Actual code
- [TRUST_BOUNDARIES.md](./adr-002-trust-boundaries.md) - Trust boundary documentation

## Open Questions

1. **Should we implement token caching?** 
   - Option: Cache validated tokens in Redis to avoid repeated validation
   - Trade-off: Adds complexity vs. performance gain
   - Decision: Not needed yet (auth gateway is fast, <100ms)

2. **Should we support mTLS for internal auth?**
   - Option: Require mutual TLS between gateway and auth gateway
   - Trade-off: Extra security vs. deployment complexity
   - Decision: Not implemented yet (internal network is trusted)

3. **How do we handle auth gateway rotation?**
   - Option: Support multiple auth gateway instances with load balancing
   - Trade-off: High availability vs. complexity
   - Decision: Single instance for now, add HA if needed

---

**Superseded By**: None
**Last Reviewed**: 2026-01-15
**Next Review**: 2026-04-15 (quarterly)
