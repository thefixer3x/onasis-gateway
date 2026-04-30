# MCP Server Context

**Created:** 2026-04-30 | **Owner:** @thefixer3x  
**File:** `/Users/onasis/dev-hub/projects/onasis-gateway/mcp_server.js` | `unified_gateway.js`  
**Size:** 17KB (standalone) | 1,957 lines (unified) | **Port:** 3000 (unified) or 3001 (standalone)

---

## Purpose

MCP (Model Context Protocol) Server provides AI agent integration through standardized protocol support:

1. **HTTP Transport** - Standard REST API for tool discovery and execution
2. **WebSocket Transport** - Persistent bidirectional communication (port 3002)
3. **Server-Sent Events** - One-way streaming for event notifications (port 3003)

The MCP server exposes **1604 tools** across 18 adapters, enabling AI agents to interact with external services like Stripe, BAP, Wise, and more.

### Architecture Position

```
┌─────────────────────────────────────────┐
│  gateway.lanonasis.com (Nginx - Target) │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┬────────────┬────────────┐
         ▼           ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌────────┐  ┌─────────┐
    │ HTTP   │  │ WS     │  │ SSE    │  │ Central │
    │ :3001  │  │ :3002  │  │ :3003  │  │ Gateway │
    └────────┘  └────────┘  └────────┘  │ :3000 │
                                        └────────┘
                                              │
                                        ┌─────┴─────┐
                                        │ MCP Server│
                                        └───────────┘
```

### Key Features

- **Tool Discovery** - Clients can list available tools
- **Tool Execution** - Clients can execute tools with parameters
- **Service Integration** - 18 adapters covering payments, banking, infrastructure
- **Transport Flexibility** - HTTP, WebSocket, SSE support
- **Lazy Discovery** - Production uses 5 meta-tools, full mode for debugging

---

## Key Files

- `mcp_server.js` - Standalone MCP server implementation (17,823 bytes)
- `unified_gateway.js` - MCP server integrated with API gateway (1,957 lines)
- `src/mcp/discovery.js` - MCP Discovery Layer (lazy/full mode)
- `src/mcp/adapter-registry.js` - Adapter registration and management
- `src/adapters/` - Individual adapter implementations (Supabase Edge Functions)
- `services/` - 18 API service configurations (Postman-extracted)

---

## Dependencies

### External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Supabase Edge Functions** | MCP adapters for Memory, Intelligence, Keys | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **Postman Collections** | API specifications for 18 services | Extracted to `services/` directory |
| **Stripe API** | Payment processing (457 tools) | Bearer token auth |
| **BAP Postman Collection** | Nigerian payments (92 tools) | API key + HMAC |
| **Wise Multicurrency** | Multi-currency banking (47 tools) | API key auth |
| **Xpress Wallet** | Merchant payments (40 tools) | Bearer token |

### Internal Dependencies

| Component | Module | Purpose |
|-----------|--------|---------|
| **AdapterRegistry** | `./src/mcp/adapter-registry` | Register MCP adapters |
| **MCPDiscoveryLayer** | `./src/mcp/discovery` | Tool discovery (lazy/full) |
| **OnasisAuthBridge** | `./middleware/onasis-auth-bridge` | Auth gateway integration |
| **AbstractedAPIEndpoints** | `./api/abstracted-endpoints` | API endpoint abstraction |

### NPM Dependencies

```json
{
  "express": "^5.2.1",
  "ws": "^8.19.0",        // WebSocket support
  "eventsource": "^4.1.0", // SSE support
  "jsonwebtoken": "^9.0.3",
  "@supabase/supabase-js": "^2.96.0"
}
```

---

## Integration Points

### APIs Exposed

#### HTTP Transport

```http
GET /mcp/tools          # List all available tools
POST /mcp/execute       # Execute a tool
POST /mcp/tools/{toolName}/call  # Execute specific tool
```

#### WebSocket Transport

```
WS /mcp/ws
Connection → {
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": { ... }
}

Server → {
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} }
  }
}

Client → {
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}

Server → {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "stripe_customers_create",
        "description": "Create a new customer in Stripe",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}
```

#### Server-Sent Events

```
SSE /mcp/sse
Connection → {
  "type": "subscribe",
  "channel": "tool_events"
}

Server → EventStream:
  event: tool_executed
  data: {"toolName": "stripe_customers_create", "status": "success"}
  
  event: tool_error
  data: {"toolName": "stripe_customers_create", "error": "Invalid API key"}
```

### Events Published

- **Tool Executed**: When a tool completes successfully
- **Tool Error**: When a tool execution fails
- **Adapter Status**: Adapter initialization completion/failure
- **Metrics Collected**: Request/response metrics for monitoring

### Database Interactions

- **Supabase Edge Functions**: Via MCP adapters (Memory, Intelligence, Keys)
- **No direct database access**: All DB operations go through adapter layer

---

## Architecture Patterns

### 1. Transport Abstraction

**Problem**: MCP clients can use HTTP, WebSocket, or SSE.

**Solution**: Abstract transport layer with unified interface:

```javascript
class MCPServer {
    constructor() {
        this.httpServer = express();
        this.wsServer = new WebSocket.Server({ server: httpServer, path: '/ws' });
        this.sseServer = new SSE.Server({ server: httpServer, path: '/sse' });

        // Common handlers
        this.setupTransport();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupTransport() {
        // HTTP
        this.httpServer.post('/mcp/execute', (req, res) => {
            const toolName = req.body.toolName;
            const tool = this.adapters.get(toolName);
            return tool.execute(req.body.params);
        });

        // WebSocket
        this.wsServer.on('connection', (ws) => {
            ws.on('message', (message) => {
                const { method, params, id } = JSON.parse(message);
                this.handleWSMessage(ws, method, params, id);
            });
        });

        // SSE
        this.sseServer.on('subscribe', (client, channel) => {
            client.on('message', (message) => {
                this.handleSSESubscribe(client, channel, message);
            });
        });
    }
}
```

**Benefits**:
- Single codebase for all transports
- Clients can choose preferred transport
- Fallback between transports if needed

### 2. Adapter Registry Pattern

**Problem**: Dynamically register/unregister MCP adapters.

**Solution**: Central AdapterRegistry:

```javascript
class AdapterRegistry {
    constructor() {
        this.adapters = new Map();
        this.mockAdapters = new Map();
    }

    async register(adapter, options = {}) {
        this.adapters.set(adapter.id, adapter);
        
        if (typeof adapter.initialize === 'function') {
            await adapter.initialize(options);
        }
    }

    registerMock(entry) {
        // Mock adapter (discoverable but not executable)
        this.mockAdapters.set(entry.id, entry);
    }

    toAdaptersMap() {
        return Array.from(this.adapters.values());
    }

    getStats() {
        return {
            totalAdapters: this.adapters.size,
            realAdapters: this.adapters.size,
            mockAdapters: this.mockAdapters.size
        };
    }
}
```

**Benefits**:
- Central registration point
- Runtime adapter loading
- Statistics and monitoring
- Mock adapters for testing

### 3. Lazy Discovery Layer

**Problem**: 1600+ tools is overwhelming for clients.

**Solution**: Two discovery modes - lazy (5 meta-tools) or full (all tools):

```javascript
class MCPDiscoveryLayer {
    constructor(gateway, adapters) {
        this.gateway = gateway;
        this.adapters = adapters;
        this.metaTools = this.createMetaTools();
    }

    createMetaTools() {
        return [
            {
                name: 'listServices',
                description: 'List all available MCP adapters',
                execute: async () => Array.from(this.adapters.values())
            },
            {
                name: 'discoverTools',
                description: 'Discover tools in a specific adapter',
                execute: async ({ adapterId }) => {
                    const adapter = this.adapters.get(adapterId);
                    return adapter.tools;
                }
            },
            {
                name: 'execute',
                description: 'Execute any tool by name and parameters',
                execute: async ({ toolName, params }) => {
                    const tool = this.findTool(toolName);
                    return tool.execute(params);
                }
            },
            {
                name: 'search',
                description: 'Search tools by name or capability',
                execute: async ({ query }) => {
                    return this.searchTools(query);
                }
            },
            {
                name: 'health',
                description: 'Health check for all adapters',
                execute: async () => {
                    return this.healthCheckAllAdapters();
                }
            }
        ];
    }

    getTools() {
        if (process.env.MCP_TOOL_MODE === 'full') {
            return Array.from(this.adapters.values()).flatMap(a => a.tools);
        }
        return this.metaTools;
    }
}
```

**Benefits**:
- Reduced initial payload (5 tools vs 1600+)
- On-demand tool discovery
- Better performance in production
- Easier for clients to understand

### 4. Multi-Adapter Execution

**Problem**: Execute tools across multiple adapters.

**Solution**: Batch execution with result aggregation:

```javascript
async batchExecute(adapterId, toolName, params) {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
        throw new Error(`Adapter ${adapterId} not found`);
    }

    const tool = adapter.tools.find(t => t.name === toolName);
    if (!tool) {
        throw new Error(`Tool ${toolName} not found in ${adapterId}`);
    }

    return tool.execute(params);
}
```

**Benefits**:
- Single execution point
- Automatic adapter resolution
- Error handling per adapter
- Metrics collection

---

## Operational Considerations

### Startup Sequence

1. **Load Adapters**: Read service catalog, create adapter instances
2. **Initialize Adapters**: Call `adapter.initialize()` for each adapter
3. **Setup MCP Discovery Layer**: Create meta-tools (if lazy mode)
4. **Setup Middleware**: Auth, CORS, rate limiting, request ID, metrics
5. **Setup Routes**: Express routes for `/mcp/*`, WebSocket, SSE
6. **Start Server**: Listen on configured port

### Rate Limiting

Different limits for HTTP vs WebSocket vs SSE:

```javascript
// HTTP - 1000 per 15 min
const mcpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: getRateLimitKey,
    message: 'Too many MCP requests'
});

// WebSocket - connection limiting per IP
limit_conn_zone $binary_remote_addr zone=ws_conn:10m;

// SSE - no rate limiting (long-lived connections)
```

### Health Check Strategy

```javascript
GET /mcp/health
// Returns: {
//   "status": "healthy",
//   "adapters": {
//     "supabase-edge-functions": "healthy",
//     "stripe-api": "healthy",
//     ...
//   },
//   "totalTools": 1604
// }
```

### Logging

- **Tool Execution**: Log tool name, parameters, duration, result (sanitized)
- **Connection Events**: WebSocket connect/disconnect
- **Error Events**: Tool execution failures with error context

---

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | HTTP server port (standalone) |
| `MCP_TOOL_MODE` | `lazy` | `lazy` (5 tools) or `full` (1600+ tools) |
| `AUTH_GATEWAY_URL` | `https://auth.lanonasis.com` | Auth gateway URL |
| `SUPABASE_URL` | - | Supabase instance URL |
| `SUPABASE_ANON_KEY` | - | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | - | Supabase service role key |
| `MCP_WS_PORT` | `3002` | WebSocket server port |
| `MCP_SSE_PORT` | `3003` | SSE server port |

### Runtime Configuration

- **Adapter Catalog**: Built-in default (18 mock adapters) or from catalog
- **Discovery Mode**: Configurable via `MCP_TOOL_MODE` env var
- **Rate Limits**: Configurable via environment

---

## Common Patterns

### Tool Discovery

```javascript
GET /mcp/tools
// Returns: [
//   {
//     "name": "stripe_customers_create",
//     "description": "Create a new customer in Stripe",
//     "inputSchema": {
//       "type": "object",
//       "properties": {
//         "name": { "type": "string" },
//         "email": { "type": "string" }
//       },
//       "required": ["name"]
//     }
//   },
//   ...
// ]
```

### Tool Execution

```javascript
POST /mcp/execute
{
    "toolName": "stripe_customers_create",
    "params": {
        "name": "John Doe",
        "email": "john@example.com"
    }
}

// Returns: {
//   "success": true,
//   "result": {
//     "id": "cus_xxxxxxxxx",
//     "name": "John Doe",
//     "email": "john@example.com",
//     "created": 1234567890
//   }
// }
```

### Batch Tool Execution

```javascript
POST /mcp/batch/execute
{
    "tools": [
        { "name": "stripe_customers_create", "params": { "name": "John" } },
        { "name": "stripe_customers_create", "params": { "name": "Jane" } }
    ]
}

// Returns: [
//   { "toolName": "stripe_customers_create", "result": { "id": "cus_..." } },
//   { "toolName": "stripe_customers_create", "result": { "id": "cus_..." } }
// ]
```

---

## Troubleshooting

### Tools Not Discoverable

**Symptom**: `/mcp/tools` returns empty or limited list

**Diagnosis**:
1. Check `MCP_TOOL_MODE` env var
2. Verify adapters loaded successfully

**Fix**:
```bash
# Force full mode for debugging
export MCP_TOOL_MODE=full
npm start
```

### WebSocket Connections Failing

**Symptom**: WebSocket handshake fails, connection dropped

**Diagnosis**:
1. Check WebSocket port is open (3002)
2. Verify firewall rules allow WebSocket
3. Check CORS configuration

**Fix**:
```bash
# Check if WebSocket server is running
netstat -tlnp | grep 3002

# Test WebSocket connection
websocat ws://localhost:3002/mcp/ws
```

### Tool Execution Failing

**Symptom**: Tool execution returns error

**Diagnosis**:
1. Check tool name is correct
2. Verify adapter is loaded and initialized
3. Check required parameters are provided
4. Verify auth credentials are valid

**Fix**:
```bash
# List all available tools
curl http://localhost:3001/mcp/tools

# Test tool execution
curl http://localhost:3001/mcp/execute -X POST -d '{
    "toolName": "stripe_customers_list",
    "params": {}
}'
```

---

## Success Metrics

✅ **1604 MCP tools** across 18 adapters  
✅ **18 API services** integrated (Stripe, BAP, Wise, etc.)  
✅ **Lazy discovery** (5 meta-tools in production)  
✅ **Transport flexibility** (HTTP, WebSocket, SSE)  
✅ **Multi-strategy auth** (JWT, API key, OAuth)  
✅ **Zero repetitive integration cycles** through upfront cataloging  

---

**Need updates?** Reference `docs/context/context-engineering-progress.md` for methodology and current status.  
**Want to continue?** Use: `Continue context engineering - read context-engineering-progress.md`
