# Unified MCP Gateway

> Deployment status: Runs via PM2 as `mcp-unified-gateway` from `/root/.claude/mcp-gateway/`. This directory contains the source of truth that now lives inside the onasis-gateway repository.

The Unified MCP Gateway exposes multiple Model Context Protocol services behind a single HTTP/WebSocket interface. It is used by the vibe-frontend (default port `7777`) and other clients that need consolidated access to:

- `MCP_CORE_URL` – local mcp-core transport
- `CONTEXT7_URL` – Context7 documentation tools
- `QUICK_AUTH_URL` – quick-auth credential service
- `ONASIS_GATEWAY_URL` – onasis API gateway tools
- Neon-backed logging/analytics (via `neon-mcp-bridge.js`)
- Apple App Store reporting bridge (optional)

## Directory contents

| File | Purpose |
| ---- | ------- |
| `gateway.js` | Main HTTP/WebSocket server that fans out MCP requests to registered sources |
| `ecosystem.config.cjs` | PM2 configuration (cluster mode disabled by default) |
| `neon-mcp-bridge.js` | Optional Neon database bridge for request logging and analytics |
| `app-store-connect-bridge.js` | Helper that surfaces Apple App Store Connect APIs as MCP tools |
| `package.json` / `package-lock.json` / `bun.lock` | Dependency manifests for npm or bun |
| `.env.example` | Sanitised environment template. The real `.env` should stay out of git |

## Environment

Create a `.env` (not committed) based on `.env.example`. Key variables:

- `PORT`, `PRIMARY_PORT`, `FALLBACK_PORT` – primary (7777) and fallback (3008) listeners
- `MCP_CORE_URL`, `QUICK_AUTH_URL`, etc. – upstream MCP endpoints
- Neon credentials (`NEON_API_KEY`, `DATABASE_URL`, etc.) if using analytics
- Gateway API keys (`MASTER_API_KEY`, `VIBE_API_KEY`)
- `APPLE_*` variables when enabling the App Store bridge

## Running locally

```bash
npm install
npm start
# or
bun install
bun run gateway.js
```

By default the gateway listens on `7777` (primary) and `3008` (fallback) and exposes `/mcp` HTTP + WebSocket endpoints compatible with the MCP client SDK.

## PM2 reference

The production PM2 process uses:

```bash
pm2 start /root/.claude/mcp-gateway/gateway.js --name mcp-unified-gateway --watch
```

To redeploy from this repo snapshot:

```bash
rsync -a --delete gateways/unified-gateway/ /root/.claude/mcp-gateway/
cd /root/.claude/mcp-gateway && npm install
pm2 restart mcp-unified-gateway && pm2 save
```

## Change management

1. Update source files in this directory.
2. Keep `.env` and other secrets out of git.
3. Deploy to `/root/.claude/mcp-gateway/` and restart PM2 when ready.
4. Record updates in the VPS inventory and session summaries.
