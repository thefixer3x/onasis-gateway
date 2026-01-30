Report:
Yes, MCP is active and reachable. Here's the config:

Public URLs:

HTTP (local VPS): http://localhost:3000
HTTPS (public via Nginx):
https://gateway.connectionpoint.tech (currently only port 3000)
https://gateway.lanonasis.com (via nginx reverse proxy)
Authentication:

Type: JWT-based via OnasisAuthBridge
Config env vars:
ONASIS_JWT_SECRET or JWT_SECRET (required)
ONASIS_AUTH_API_URL (defaults to https://api.lanonasis.com/v1/auth)
ONASIS_PROJECT_SCOPE (defaults to lanonasis-maas)
Auth routes: /api/auth/* proxied to onasis-core auth API
Endpoints to display tools:

Root: GET http://localhost:3000/ → JSON manifest with adapter count & tool count (1604 total tools across 18 adapters)
Adapters list: GET http://localhost:3000/api/adapters → Lists all 18 adapters with auth types (bearer/apikey/oauth2)
All tools: GET http://localhost:3000/api/tools → Full tool catalog
Execute tool: POST http://localhost:3000/api/adapters/{adapter}/tools/{tool} → Run a specific tool
Current adapters (sample):

stripe-api-2024-04-10 (457 tools, bearer)
ngrok-api (217 tools, bearer)
paystack (117 tools, bearer)
flutterwave-v3 (108 tools, bearer)
shutterstock-api (109 tools, oauth2)
Auth is required for calls but the manifest/health endpoints are public.

The current architecture exposes every endpoint as a first-class MCP tool - which creates the context flooding problem you described.

---

## Recommendation: Stop tool-catalog flooding (Lazy tools + Router pattern)

### Problem
Right now the MCP handshake/tool listing effectively publishes **1,604 tools** (18 adapters). Most AI clients will pull and embed the full catalog into context, even if the user only needs **1–3 operations**. This increases latency, token usage, and makes tool selection worse.

### Target state
Expose a **small, stable control surface** (2–4 tools total per adapter, or even globally), and make everything else **discoverable and callable on-demand**.

### Recommended patterns (pick one, or combine)

#### Pattern A — Router tool (1 tool per adapter)
Expose **one** tool per adapter (e.g. `paystack.call`, `stripe.call`) that takes an operation/path and params.
- Pros: minimum tool count, simplest UX for the model
- Cons: needs strong validation + safe allow-listing

Example payload:
```json
{
  "adapter": "paystack",
  "operation": "transactions.initialize",
  "params": { "email": "user@example.com", "amount": 500000 }
}
```

#### Pattern B — Discover → Execute (2-step, best balance)
Expose:
1) `adapter.search_operations` (returns top N matches)
2) `adapter.execute` (executes by `operation_id`)

This keeps the initial tool list tiny, and only reveals the few operations needed.

Example discovery response:
```json
{
  "query": "create transfer recipient",
  "matches": [
    {
      "operation_id": "transfers.create_recipient",
      "title": "Create Transfer Recipient",
      "tags": ["transfers"],
      "method": "POST",
      "path": "/transferrecipient",
      "required": ["type", "name", "account_number", "bank_code"]
    }
  ]
}
```

#### Pattern C — Namespace + lazy group expansion
Expose only group-level tools initially:
- `paystack.groups` → returns ["customers", "transfers", "transactions", ...]
- `paystack.describe_group(group)` → returns operations for that group only
- `paystack.execute(operation_id, params)`

### Concrete changes for onasis-gateway

#### 1) Keep `/api/adapters` public, but make tool listing filtered + paginated
Add (or extend) server endpoints:
- `GET /api/tools?adapter=paystack&q=transfer&limit=20&cursor=...`
- `GET /api/tools/:adapter/:operation_id/schema`

**Do not** return all tools by default.

#### 2) Change the MCP-visible tool catalog to meta-tools only
Instead of advertising 1604 tools, advertise only these meta-tools:
- `gateway.list_adapters`
- `gateway.search_operations`
- `gateway.get_schema`
- `gateway.execute`

Optional (nice to have):
- `gateway.health`
- `gateway.capabilities`

#### 3) Execution stays the same, but routed through `gateway.execute`
Internally, `gateway.execute` can call the existing endpoint:
`POST /api/adapters/{adapter}/tools/{tool}`

So this can be implemented without breaking existing adapters.

### Backward compatibility plan
- Keep `/api/tools` (full catalog) behind auth or a `?full=1` flag for internal debugging.
- Add a config flag:
  - `MCP_TOOL_MODE=lazy` (default)
  - `MCP_TOOL_MODE=full` (debug)

### Why this works
- AI clients see only a handful of tools, so no context flooding.
- The model can still access any of the 117 Paystack endpoints — but only the ones it asks for.
- Tool selection improves because discovery returns **top matches** instead of thousands of irrelevant tools.

### Suggested next step (implementation order)
1) Implement `gateway.search_operations` + `gateway.execute` as the only MCP tools.
2) Add `gateway.get_schema` to tighten param correctness.
3) Add pagination + filtering to `/api/tools` and make the default non-flooding.
4) Gate the full tool catalog behind `full=1` and/or admin auth.

---

startup logs:

/opt/lanonasis/onasis-gateway/logs/central-gateway-out-0.log last 15 lines:
0|central- | 2026-01-28T17:19:25: 2026-01-28T17:19:25.985Z - POST /
0|central- | 2026-01-28T17:19:26: 2026-01-28T17:19:26.065Z - POST /
0|central- | 2026-01-28T17:31:18: 2026-01-28T17:31:18.589Z - GET /
0|central- | 2026-01-28T17:46:27: 2026-01-28T17:46:27.126Z - GET /
0|central- | 2026-01-28T18:06:49: 2026-01-28T18:06:49.906Z - POST /
0|central- | 2026-01-28T18:40:06: ✅ Authentication bridge initialized
0|central- | 2026-01-28T18:40:06: 🚀 Starting MCP Server...
0|central- | 2026-01-28T18:40:06: 📦 Loading 18 adapters...
0|central- | 2026-01-28T18:40:06: ✅ MCP Server running on port 3000
0|central- | 2026-01-28T18:40:06: 🔗 Health check: http://localhost:3000/health
0|central- | 2026-01-28T18:40:06: 📊 API docs: http://localhost:3000/
0|central- | 2026-01-28T18:40:06: 🛠️  Adapters: 18
0|central- | 2026-01-28T18:40:06: ⚡ Total tools: 1604
0|central- | 2026-01-28T18:40:06: 
0|central- | 🛑 Shutting down MCP Server...