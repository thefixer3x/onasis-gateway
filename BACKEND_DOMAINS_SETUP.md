# 🔧 Backend Service Domains Setup
## Separate domains for onasis-gateway backend services

## 🎯 **Backend Service Domain Strategy**

Since lanonasis-maas is live and serving:
- ✅ **api.lanonasis.com** → Memory service (lanonasis-maas)
- ✅ **dashboard.lanonasis.com** → Frontend dashboard  
- ✅ **docs.lanonasis.com** → Documentation
- ✅ **mcp.lanonasis.com** → MCP SSE endpoints

We'll create **separate backend domains** for onasis-gateway:

| Domain | Purpose | Netlify Site |
|--------|---------|--------------|
| **gateway.lanonasis.com** | Service management backend | lanonasis-api |
| **services.lanonasis.com** | MCP adapters & tools | lanonasis-mcp |
| **adapters.lanonasis.com** | Service adapter registry | onasis-gateway |
| **backend.lanonasis.com** | Admin/management APIs | (new site) |

---

## 🚀 **CLI Commands to Setup Backend Domains**

### **1. gateway.lanonasis.com** (Main service management)
```bash
# Link to lanonasis-api site
cd /Users/seyederick/onasis-gateway
netlify unlink 2>/dev/null || true
netlify link --id=64a44156-b629-4ec8-834a-349b306df073

# Add custom domain via dashboard
echo "🌐 Add gateway.lanonasis.com to https://app.netlify.com/projects/lanonasis-api/settings/domain"
```

### **2. services.lanonasis.com** (MCP adapters)
```bash
# Link to lanonasis-mcp site
netlify unlink 2>/dev/null || true
netlify link --id=cce8abf3-c454-4ae9-b6e7-299ce339c862

# Add custom domain via dashboard
echo "🌐 Add services.lanonasis.com to https://app.netlify.com/projects/lanonasis-mcp/settings/domain"
```

### **3. adapters.lanonasis.com** (Adapter registry)
```bash
# Link to onasis-gateway site
netlify unlink 2>/dev/null || true
netlify link --id=d8903f18-f595-4c5d-8f16-a88f0bf20b76

# Add custom domain via dashboard
echo "🌐 Add adapters.lanonasis.com to https://app.netlify.com/projects/onasis-gateway/settings/domain"
```

---

## 📡 **Domain Configuration Links**

### **Direct Links to Add Custom Domains:**

1. **gateway.lanonasis.com** → [Add to lanonasis-api](https://app.netlify.com/projects/lanonasis-api/settings/domain)

2. **services.lanonasis.com** → [Add to lanonasis-mcp](https://app.netlify.com/projects/lanonasis-mcp/settings/domain)

3. **adapters.lanonasis.com** → [Add to onasis-gateway](https://app.netlify.com/projects/onasis-gateway/settings/domain)

---

## 🔧 **Service Separation**

### **gateway.lanonasis.com** (Service Management Hub)
**Purpose**: Main backend service orchestration
**Endpoints**:
- `GET /health` → Gateway health check
- `GET /adapters` → List all service adapters
- `POST /execute/:adapter/:tool` → Execute service tools
- `GET /status` → System status

### **services.lanonasis.com** (MCP Tools)
**Purpose**: MCP adapter execution
**Endpoints**:
- `GET /tools` → List MCP tools
- `POST /tools/:name` → Execute MCP tool
- `GET /capabilities` → MCP capabilities
- `GET /.netlify/functions/mcp-server/*` → MCP protocol

### **adapters.lanonasis.com** (Registry)
**Purpose**: Service adapter registry
**Endpoints**:
- `GET /registry` → Full adapter registry
- `GET /metadata` → Adapter metadata
- `GET /discovery` → Service discovery

---

## ✅ **No Conflicts with Live Services**

This approach:
- ✅ **Preserves** your live lanonasis-maas deployment
- ✅ **Maintains** existing api.lanonasis.com endpoints
- ✅ **Adds** new backend domains for service management
- ✅ **Separates** concerns cleanly

---

## 🚀 **Quick Setup**

**Step 1**: Use the domain configuration links above
**Step 2**: Add the 3 custom domains to their respective sites
**Step 3**: Deploy current onasis-gateway to each site
**Step 4**: Test backend endpoints

**Ready to add gateway.lanonasis.com first?**