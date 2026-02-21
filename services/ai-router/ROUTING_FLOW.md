# AI Router End-to-End Routing Flow

This document captures the current runtime flow as implemented today.

## 1) What "AI Router" is in this repo

`services/ai-router/ai-router-adapter.js` is an adapter/orchestration module, not a standalone HTTP server.

- HTTP listener for client AI requests is in `unified_gateway.js` (`POST /api/v1/ai/chat`, `/api/v1/ai-chat`).
- The adapter provides provider selection, routing, and response branding when invoked through the adapter registry/MCP abstraction layer.

## 2) End-to-End External Request Flow (`/api/v1/ai/chat`)

```mermaid
flowchart TD
    A[Client/Internal App\nPOST /api/v1/ai/chat] --> B[Unified Gateway\nonasis-gateway/unified_gateway.js]
    B --> C{Identity Required?\nAI_CHAT_REQUIRE_IDENTITY}
    C -->|Yes| D[verifyRequestIdentity + enforceIdentity]
    D -->|Fail| E[401/403 Unauthorized]
    D -->|Pass| F[Build Forward Headers\nAuthorization/X-API-Key/X-Project-Scope]
    C -->|No| F

    F --> G{Primary AI Router URL configured?\nAI_ROUTER_URL}
    G -->|No| H[Try Supabase Fallback]
    G -->|Yes| I[Forward to\n${AI_ROUTER_URL}/api/v1/ai/chat\n(then /api/v1/ai-chat legacy)]

    I -->|2xx| J[Return upstream response\nX-AI-Route: ai-router]
    I -->|4xx| J
    I -->|5xx/timeout/unreachable| K{Identity fallback allowed?\nAI_CHAT_ALLOW_IDENTITY_FALLBACK}
    K -->|No| L[502 AI router unavailable;\nidentity-safe fallback disabled]
    K -->|Yes| H

    H -->|Configured| M[Call ${SUPABASE_URL}/functions/v1/ai-chat]
    H -->|Not configured| N[502 no fallback configured]
    M --> O[Return response\nX-AI-Route: supabase]
```

## 3) AI Router Adapter Internal Flow (`services/ai-router`)

```mermaid
flowchart TD
    A[Adapter call: ai-router:ai-chat] --> B[resolveChatProvider]
    B --> C{"Provider Policy Resolution\n(priority order):\n1. AI_MANAGED_PROVIDER — hard backend override\n2. request.provider if AI_ALLOW_PROVIDER_OVERRIDE=true\n3. AI_DEFAULT_PROVIDER — fallback default"}
    C --> D[assertAllowedProvider\nvalidates against AI_ALLOWED_PROVIDERS]

    D --> E{provider}
    E -->|ollama| F[callOllama]
    E -->|claude/openai/gemini| G[callEdgeFunction]
    E -->|auto| H[try Ollama, fallback provider]

    F --> I[Inject system prompt if missing\nargs.system_prompt || OLLAMA_SYSTEM_PROMPT]
    I --> J[POST Ollama /api/chat\nmodel/messages/stream/options]

    G --> K{Supabase client ready?}
    K -->|Yes| L[supabaseClient.call(function)]
    K -->|No| M[legacy POST /api/v1/ai/chat on AI_ROUTER_URL]

    H --> J
    H --> G

    J --> Z[brandResponse\nonasis_metadata]
    L --> Z
    M --> Z
```

## 4) Where each responsibility lives

- Listener endpoint:
  - `onasis-gateway/unified_gateway.js` (`/api/v1/ai/chat`, `/api/v1/ai-chat`)
- Auth and identity enforcement for AI chat:
  - `onasis-gateway/unified_gateway.js` (`verifyRequestIdentity`, `enforceIdentity`)
- Remote auth bridge utility (used by `/api/auth` and middleware paths):
  - `onasis-gateway/middleware/onasis-auth-bridge.js`
- Provider routing policy (`managed/default/fallback/allow override`):
  - `onasis-gateway/services/ai-router/ai-router-adapter.js`
- System prompt injection:
  - `onasis-gateway/services/ai-router/ai-router-adapter.js` (`callOllama`)
- Onasis branding metadata injection:
  - `onasis-gateway/services/ai-router/ai-router-adapter.js` (`brandResponse`)
- Tool surface (AI adapter tools exposed via MCP abstraction):
  - `onasis-gateway/services/ai-router/ai-router-adapter.js` (`initialize()`)
- AI abstraction mapping (`/api/v1/ai/:operation` -> adapter tool):
  - `onasis-gateway/api/abstracted-endpoints.js`
  - `onasis-gateway/core/abstraction/vendor-abstraction.js`

## 5) Important current-state notes

- The `services/ai-router` folder does not include a standalone HTTP server process by itself.
- In this codebase, the external client ingress for AI chat is owned by `unified_gateway.js`.
- **`tools` field gap (Ollama)**: `CHAT_SCHEMA` accepts a `tools` array for `ai-chat`, but `callOllama`
  currently only forwards `model`, `messages`, `stream`, and `options` to `POST /api/chat`.
  The `tools` field is intentionally omitted from the Ollama request payload because Ollama's
  function-calling support is model-dependent and not universally stable across versions. Remote
  providers (claude/openai/gemini) receive `tools` via `callEdgeFunction → prepareEdgePayload`.

  > **TODO:** Add `tools` passthrough to `callOllama` once the minimum supported Ollama version
  > is locked. Related symbols: `CHAT_SCHEMA` (schema definition), `callOllama` (Ollama path),
  > `callEdgeFunction` and `prepareEdgePayload` (remote-provider path that already forwards tools).

## 6) Source map (function/method anchors)

> Line numbers are approximate and may drift as the codebase evolves.
> Function/method names are the stable reference — use your editor's symbol search if line numbers are stale.

| File | Function / Symbol | ~Line |
|------|-------------------|-------|
| `unified_gateway.js` | `class UnifiedGateway` constructor | 235 |
| `unified_gateway.js` | `handleAIChat` (route handler) | 1159 |
| `unified_gateway.js` | `verifyRequestIdentity` call inside handleAIChat | 1186 |
| `unified_gateway.js` | API key fallback block inside handleAIChat | 1218 |
| `unified_gateway.js` | `tryPrimary` / forward to AI Router URL | 1310 |
| `services/catalog.json` | `ai-router` service entry | 344 |
| `ai-router-adapter.js` | `resolveChatProvider` | 117 |
| `ai-router-adapter.js` | `initialize` (tool definitions) | 202 |
| `ai-router-adapter.js` | `callTool` dispatcher | 257 |
| `ai-router-adapter.js` | `assertAllowedProvider` | 313 |
| `ai-router-adapter.js` | `callOllama` | 419 |
| `ai-router-adapter.js` | `brandResponse` | 571 |
| `api/abstracted-endpoints.js` | AI operation route mapping | 502 |
| `core/abstraction/vendor-abstraction.js` | AI vendor adapter dispatch | 379 |
| `middleware/onasis-auth-bridge.js` | `class OnasisAuthBridge` | 10 |
