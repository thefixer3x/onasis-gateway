# AI Router Service

AI Router is the central orchestration point for multi-provider AI execution.

## Canonical Gateway Contract

- `POST /api/v1/ai/chat`
- `GET /api/v1/ai/health`
- `GET /api/v1/ai/services` (optional)

Legacy compatibility remains for `/api/v1/ai-chat`.

## Reference Diagrams

- [End-to-end routing and auth flow](ROUTING_FLOW.md)

## MCP Tools

- `ai-chat` - Routed chat completion (provider-agnostic)
- `chat` - Backward-compatible alias for `ai-chat`
- `ollama` - Direct local Ollama route
- `embedding` - Text embedding generation
- `list-ai-services` - Available backends/providers
- `list-models` - Available model inventory
- `ai-health` - Router/provider health status

## Routing Model

1. Primary backend: `${AI_ROUTER_URL}/api/v1/ai/chat`
2. Internal fallback backend: `${SUPABASE_URL}/functions/v1/ai-router` (policy-controlled)

## Auth Model

- Forwarded caller `Authorization` is preserved when present.
- Service token auth is opt-in via `serviceAuth` / `AI_ROUTER_SERVICE_AUTH=true`.
- `Bearer undefined` injection is blocked.

## Provider Control Policy

- Backend-managed provider selection is the default.
- Per-request provider override is disabled unless `AI_ALLOW_PROVIDER_OVERRIDE=true`.
- Optional hard override via `AI_MANAGED_PROVIDER`.
- Allowed provider allowlist controlled by `AI_ALLOWED_PROVIDERS`.
