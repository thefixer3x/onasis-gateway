# 🌐 Single Domain Backend Setup
## gateway.lanonasis.com with subpaths + Main repo folder linking

## 🎯 **Domain Strategy**

### **Backend (onasis-gateway)**
- **gateway.lanonasis.com** → Main backend service management
- **gateway.lanonasis.com/services** → MCP adapters & tools
- **gateway.lanonasis.com/adapters** → Service registry

### **Frontend (lanonasis-maas folders)**
- **api.lanonasis.com** → `lanonasis-maas/src/` (server routes)
- **docs.lanonasis.com** → `lanonasis-maas/docs/` folder
- **dashboard.lanonasis.com** → `lanonasis-maas/dashboard/` folder  
- **mcp.lanonasis.com** → `lanonasis-maas/src/routes/mcp-*` endpoints

---

## 🔧 **Step 1: Setup gateway.lanonasis.com**

```bash
# Link onasis-gateway to lanonasis-api site
cd /Users/seyederick/onasis-gateway
netlify unlink 2>/dev/null || true
netlify link --id=64a44156-b629-4ec8-834a-349b306df073

# Add custom domain
# Go to: https://app.netlify.com/projects/lanonasis-api/settings/domain
# Add: gateway.lanonasis.com
```

---

## 🔧 **Step 2: Configure Main Repo Folder Linking**

### **api.lanonasis.com** → Server Routes
**Current**: Already pointing to lanonasis-maas server
**Netlify Site**: `lanonasis` (main)
**Build Path**: `src/server.ts` routes
**Status**: ✅ Already configured

### **docs.lanonasis.com** → Docs Folder
```bash
cd /Users/seyederick/DevOps/_project_folders/lanonasis-maas

# Update netlify.toml for docs subdomain
```

### **dashboard.lanonasis.com** → Dashboard Folder  
```bash
# Should build from dashboard/ folder
# Update build configuration
```

### **mcp.lanonasis.com** → MCP Routes
```bash
# Should serve MCP-specific routes from src/routes/mcp-*
```

---

## 📁 **Netlify Configuration Updates**

### **For docs.lanonasis.com**
Create `docs/netlify.toml`:
```toml
[build]
  publish = "dist"
  command = "npm install && npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### **For dashboard.lanonasis.com**
Update `dashboard/netlify.toml`:
```toml
[build]
  publish = "dist"
  command = "npm install && npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 🚀 **Deployment Plan**

### **Step 1**: Setup backend domain
- Add `gateway.lanonasis.com` to lanonasis-api site

### **Step 2**: Link main repo folders to subdomains
- **docs.lanonasis.com** → Build from `lanonasis-maas/docs/`
- **dashboard.lanonasis.com** → Build from `lanonasis-maas/dashboard/`
- **mcp.lanonasis.com** → Route to MCP endpoints in `src/routes/`

### **Step 3**: Configure routing
- Update netlify.toml files for proper folder builds
- Set correct publish directories

---

## ✅ **Expected Results**

```
🔧 Backend Services
├── gateway.lanonasis.com          → Service management
├── gateway.lanonasis.com/services → MCP tools
└── gateway.lanonasis.com/adapters → Registry

🎯 Frontend Services (from lanonasis-maas)
├── api.lanonasis.com         → src/ (server routes) ✅
├── docs.lanonasis.com        → docs/ folder
├── dashboard.lanonasis.com   → dashboard/ folder
└── mcp.lanonasis.com         → src/routes/mcp-* routes
```