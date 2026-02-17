# AI Router Service

AI Router is the central orchestration point for multi-provider AI execution.

## Canonical Gateway Contract

- `POST /api/v1/ai/chat`
- `GET /api/v1/ai/health`
- `GET /api/v1/ai/services` (optional)

Legacy compatibility remains for `/api/v1/ai-chat`.

## MCP Tools

- `ai-chat` - Routed chat completion (provider-agnostic)
- `chat` - Backward-compatible alias for `ai-chat`
- `ollama` - Direct local Ollama route
- `list-ai-services` - Available backends/providers
- `ai-health` - Router/provider health status

## Routing Model

1. Primary backend: `${AI_ROUTER_URL}/api/v1/ai/chat`
2. Internal fallback backend: `${SUPABASE_URL}/functions/v1/ai-router` (policy-controlled)

## Auth Model

- Forwarded caller `Authorization` is preserved when present.
- Service token auth is opt-in via `serviceAuth` / `AI_ROUTER_SERVICE_AUTH=true`.
- `Bearer undefined` injection is blocked.
