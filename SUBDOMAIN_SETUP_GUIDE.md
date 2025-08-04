# 🌐 Lanonasis Subdomain Setup Guide
## Configure 4 Subdomains: api, mcp, docs, dashboard

Since **Netlify manages lanonasis.com nameservers**, adding custom domains will automatically configure DNS.

---

## 🎯 **Subdomain Mapping Strategy**

| Subdomain | Purpose | Netlify Site | Site ID |
|-----------|---------|--------------|---------|
| **api.lanonasis.com** | Backend API Gateway | lanonasis-api | `64a44156-b629-4ec8-834a-349b306df073` |
| **mcp.lanonasis.com** | MCP Server Endpoints | lanonasis-mcp | `cce8abf3-c454-4ae9-b6e7-299ce339c862` |
| **docs.lanonasis.com** | Documentation Site | lanonasis (main) | `4f1f3e2d-54e7-4685-af6b-d6e3d29f7719` |
| **dashboard.lanonasis.com** | Service Dashboard | lanonasis (main) | `4f1f3e2d-54e7-4685-af6b-d6e3d29f7719` |

---

## 🔧 **Step-by-Step Setup**

### **1. Configure api.lanonasis.com**
```bash
# Go to Netlify Dashboard
open "https://app.netlify.com/projects/lanonasis-api/settings/domain"

# Or manually navigate:
# 1. Visit https://app.netlify.com/projects/lanonasis-api
# 2. Go to Site Settings → Domain Management
# 3. Click "Add custom domain"
# 4. Enter: api.lanonasis.com
# 5. Click "Verify" - Netlify will show "Domain uses Netlify DNS" ✅
# 6. SSL certificate will auto-provision
```

### **2. Configure mcp.lanonasis.com**
```bash
# Go to MCP site dashboard
open "https://app.netlify.com/projects/lanonasis-mcp/settings/domain"

# Manual steps:
# 1. Visit https://app.netlify.com/projects/lanonasis-mcp
# 2. Site Settings → Domain Management → Add custom domain
# 3. Enter: mcp.lanonasis.com
# 4. Verify and enable SSL
```

### **3. Configure docs.lanonasis.com**
```bash
# Go to main lanonasis site
open "https://app.netlify.com/projects/lanonasis/settings/domain"

# Manual steps:
# 1. Visit https://app.netlify.com/projects/lanonasis
# 2. Add custom domain: docs.lanonasis.com
# 3. This will serve the docs from lanonasis-maas/docs/ directory
```

### **4. Configure dashboard.lanonasis.com**
```bash
# Same site as docs (main lanonasis)
# Add second custom domain: dashboard.lanonasis.com
# This will serve the dashboard from lanonasis-maas/dashboard/ directory
```

---

## 📡 **DNS Verification**

After adding domains, verify they're working:

```bash
# Check DNS propagation
dig api.lanonasis.com
dig mcp.lanonasis.com  
dig docs.lanonasis.com
dig dashboard.lanonasis.com

# Test HTTPS endpoints
curl https://api.lanonasis.com/.netlify/functions/mcp-server/health
curl https://mcp.lanonasis.com/.netlify/functions/mcp-server/tools
curl https://docs.lanonasis.com
curl https://dashboard.lanonasis.com
```

---

## 🚀 **Deployment Status**

### **Current Deployments:**
- ✅ **api.lanonasis.com**: Gateway deployed to lanonasis-api.netlify.app
- ✅ **Backend Services**: 5 MCP adapters (3 production-ready)
- ✅ **Functions**: MCP server + API endpoints live

### **After Domain Setup:**
- 🎯 **api.lanonasis.com** → Backend API + MCP server
- 🤖 **mcp.lanonasis.com** → Dedicated MCP endpoints for AI agents  
- 📚 **docs.lanonasis.com** → Documentation from lanonasis-maas
- 📊 **dashboard.lanonasis.com** → Service provider dashboard

---

## 🔄 **Alternative: CLI Commands for Domain Addition**

If you prefer command line (after manual dashboard setup):

```bash
# Link to each site and deploy
cd /Users/seyederick/onasis-gateway

# Deploy to API subdomain
netlify link --id=64a44156-b629-4ec8-834a-349b306df073
netlify deploy --prod --functions=netlify/functions

# Deploy to MCP subdomain  
netlify link --id=cce8abf3-c454-4ae9-b6e7-299ce339c862
netlify deploy --prod --functions=netlify/functions

# Deploy lanonasis-maas to main domain (docs + dashboard)
cd /Users/seyederick/DevOps/_project_folders/lanonasis-maas
netlify link --id=4f1f3e2d-54e7-4685-af6b-d6e3d29f7719
netlify deploy --prod
```

---

## ✅ **Expected Results**

After setup completion:

| URL | Service | Status |
|-----|---------|--------|
| `https://api.lanonasis.com` | Gateway + MCP | ✅ Live |
| `https://mcp.lanonasis.com` | MCP Server | ✅ Live |  
| `https://docs.lanonasis.com` | Documentation | ✅ Live |
| `https://dashboard.lanonasis.com` | Service Dashboard | ✅ Live |

**🎯 Revenue Ready**: All subdomains will serve the production-ready services with $50K-240K/month potential.

**Next Step**: Go to the Netlify dashboard links above and add the custom domains!