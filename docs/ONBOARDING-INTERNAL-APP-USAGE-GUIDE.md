# Internal App Onboarding & Usage Guide

This guide is the source of truth for integrating any internal app with the Onasis Gateway.

## 1) Integration Principle

All application traffic must enter through the central gateway first.

- Gateway base URL (prod): `https://gateway.lanonasis.com`
- Never call provider APIs directly from app clients.
- Never call Supabase Edge Functions directly from app clients unless the route is explicitly approved for internal infrastructure tooling.

## 2) Required Request Headers

Use these headers consistently across services.

| Header | Required | Purpose |
|---|---|---|
| `Content-Type: application/json` | Yes | JSON payload parsing |
| `Authorization: Bearer <token>` | Yes (preferred) | User/service identity |
| `X-API-Key: <key>` | Optional | API key auth mode |
| `X-Project-Scope: <scope>` | Strongly recommended | Tenant/project isolation |
| `X-Request-ID: <id>` | Strongly recommended | Traceability and debugging |
| `X-Session-ID: <id>` | Optional | Session-level observability |

## 3) Authentication Rules

The gateway enforces identity by default for protected routes.

- Preferred: JWT bearer token in `Authorization`
- Alternative: API key via `X-API-Key`
- If both are present, services may use both for policy checks.
- Do not send empty auth headers.

## 4) AI Routing Policy (Backend-Controlled)

Provider selection is backend-managed unless explicitly enabled.

Relevant environment controls:

- `AI_MANAGED_PROVIDER` (optional hard override)
- `AI_ALLOW_PROVIDER_OVERRIDE` (default: `false`)
- `AI_ALLOWED_PROVIDERS` (default: `auto,ollama,claude,openai,gemini`)
- `AI_DEFAULT_PROVIDER` (default: `auto`)
- `AI_FALLBACK_PROVIDER` (default: `claude`)

Recommended production setting:

- `AI_ALLOW_PROVIDER_OVERRIDE=false`
- Set provider policy centrally via env/config, not by client payload.

## 5) Canonical REST Endpoints

### AI Chat

- `POST /api/v1/ai/chat` (canonical)
- `POST /api/v1/ai-chat` (legacy compatibility)

Example:

```bash
curl -X POST "https://gateway.lanonasis.com/api/v1/ai/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "X-Project-Scope: lanonasis-maas" \
  -H "X-Request-ID: req-ai-001" \
  -d '{
    "messages": [
      { "role": "user", "content": "Summarize today'\''s deployment status." }
    ],
    "temperature": 0.2,
    "max_tokens": 400
  }'
```

### Abstracted Service Pattern

Example payment abstraction:

- `POST /api/v1/payment/initializeTransaction`

```bash
curl -X POST "https://gateway.lanonasis.com/api/v1/payment/initializeTransaction" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "X-Request-ID: req-pay-001" \
  -d '{
    "amount": 5000,
    "currency": "NGN",
    "email": "user@example.com"
  }'
```

## 6) MCP Usage (for agent/tool execution)

Use MCP `gateway-execute` for tool-level operations.

```bash
curl -X POST "https://gateway.lanonasis.com/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{
      "name":"gateway-execute",
      "arguments":{
        "tool_id":"ai-router:ai-chat",
        "params":{
          "messages":[{"role":"user","content":"Hello"}]
        }
      }
    }
  }'
```

## 7) Error Handling Contract

Handle these classes consistently:

- `401/403`: authentication/authorization issues
- `400`: validation/input issues
- `5xx`: upstream/service availability issues

Always log:

- `X-Request-ID`
- endpoint
- status code
- sanitized error body

## 8) Idempotency (Financial/State-Changing Operations)

For high-risk operations, include idempotency metadata where supported:

- `options.idempotency_key` for MCP execution
- deterministic request IDs for retried REST operations

## 9) Integration Checklist

Before going live, verify:

1. Auth header is present and valid.
2. `X-Project-Scope` is set correctly.
3. Calls hit gateway URL, not provider URLs.
4. AI provider override is disabled in production unless explicitly required.
5. Client logs include `X-Request-ID` correlation.
6. Retry logic avoids duplicate financial operations.

## 10) Troubleshooting Quick Notes

- If AI route returns identity errors: check `Authorization` and gateway auth config.
- If provider behavior looks unexpected: confirm backend policy env (`AI_MANAGED_PROVIDER`, `AI_DEFAULT_PROVIDER`, `AI_FALLBACK_PROVIDER`).
- If fallback behavior differs across environments: verify Supabase/AI router env parity.
