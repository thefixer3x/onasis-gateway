# 📡 Netlify Subdomain Configuration Guide
## Setting up api.lanonasis.com, mcp.lanonasis.com, docs.lanonasis.com, dashboard.lanonasis.com

## Current Netlify Sites Available:
- **lanonasis** (`https://lanonasis.com`) - Main site
- **lanonasis-api** (`https://lanonasis-api.netlify.app`) - For api.lanonasis.com
- **lanonasis-mcp** (`https://lanonasis-mcp.netlify.app`) - For mcp.lanonasis.com

---

## 🚀 **Step 1: Configure Custom Domains in Netlify Dashboard**

### **For api.lanonasis.com:**
1. **Go to lanonasis-api site**: https://app.netlify.com/projects/lanonasis-api
2. **Domain settings** → **Add custom domain**
3. **Enter**: `api.lanonasis.com`
4. **Netlify will automatically configure DNS** (since it manages lanonasis.com nameservers)

### **For mcp.lanonasis.com:**
1. **Go to lanonasis-mcp site**: https://app.netlify.com/projects/lanonasis-mcp  
2. **Domain settings** → **Add custom domain**
3. **Enter**: `mcp.lanonasis.com`
4. **Netlify auto-configures DNS**

### **For docs.lanonasis.com:**
**Option A: Create new site**
```bash
# Create docs site manually in Netlify dashboard
# Then add custom domain docs.lanonasis.com
```

**Option B: Use existing site**
```bash
# Pick any existing site and add docs.lanonasis.com domain
```

### **For dashboard.lanonasis.com:**
**Same process - either create new site or reuse existing**

---

## 🔧 **Step 2: Deploy Current Gateway to API Subdomain**

Since we want this gateway project on `api.lanonasis.com`:

```bash
# Link to lanonasis-api project
netlify link --id=64a44156-b629-4ec8-834a-349b306df073

# Deploy the gateway
netlify deploy --prod --functions=netlify/functions
```

---

## 📋 **Step 3: Manual Domain Configuration (If CLI fails)**

### **Via Netlify Dashboard:**

1. **Visit**: https://app.netlify.com/projects/lanonasis-api/settings/domain
2. **Click**: "Add custom domain"
3. **Enter**: `api.lanonasis.com`
4. **Netlify will show**: "This domain is registered with us" ✅
5. **Click**: "Configure domain"
6. **SSL will auto-provision**

### **Repeat for other subdomains:**
- lanonasis-mcp → mcp.lanonasis.com
- Create new sites for docs & dashboard subdomains

---

## 🎯 **Step 4: Deploy Different Services to Each Subdomain**

### **api.lanonasis.com (Gateway + MCP)**
**Deploy**: Current onasis-gateway project
**Content**: MCP server, API endpoints, all adapters

### **mcp.lanonasis.com (MCP-only)**  
**Deploy**: MCP-focused build
**Content**: Just MCP server endpoints for AI agents

### **docs.lanonasis.com (Documentation)**
**Deploy**: Static documentation site
**Content**: Integration guides, API docs

### **dashboard.lanonasis.com (Client Dashboard)**
**Deploy**: React/Next.js dashboard  
**Content**: Service provider management interface

---

## 🔄 **Alternative: Use Redirects on Main Site**

If you prefer to keep everything on one site with redirects:

**netlify.toml:**
```toml
[[redirects]]
  from = "https://api.lanonasis.com/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "https://mcp.lanonasis.com/*"  
  to = "/.netlify/functions/mcp-server/:splat"
  status = 200

[[redirects]]
  from = "https://docs.lanonasis.com/*"
  to = "/docs/:splat"
  status = 200

[[redirects]]
  from = "https://dashboard.lanonasis.com/*"
  to = "/dashboard/:splat"
  status = 200
```

---

## ✅ **Next Steps:**

1. **Manually configure domains** in Netlify dashboard for each site
2. **Deploy gateway** to lanonasis-api site  
3. **Verify** api.lanonasis.com works
4. **Repeat** for other subdomains

**Since Netlify manages your nameservers, domain configuration will be automatic once you add the custom domains in the dashboard.**