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