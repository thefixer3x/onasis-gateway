# 🌐 Domain Deployment Strategy
## Complete Setup Guide for Onasis Gateway Domains

## **Current Status: Services Ready for Deployment**
- ✅ 5 MCP adapters registered (3 production-ready)  
- ✅ Netlify functions configured
- ✅ Supabase database ready
- ✅ Environment variables configured

---

## 🚀 **Phase 1: Deploy Core Services**

### **1. API Gateway (api.lanonasis.com)**
**Platform**: Netlify Functions + Vercel (primary)
**Purpose**: Main API endpoints and MCP server

```bash
# Deploy to Vercel (recommended for API)
npm install -g vercel
vercel --prod

# Or deploy functions to Netlify
netlify deploy --prod --functions netlify/functions
```

**Files to deploy**:
- `netlify/functions/mcp-server.ts` (already exists)
- `bun-neon-server.ts` (main server)
- All MCP adapters in `services/*/`

### **2. Documentation Site (docs.lanonasis.com)**
**Platform**: Netlify / GitHub Pages / Docusaurus
**Purpose**: API documentation, integration guides

```bash
# Create documentation site
mkdir docs-site
cd docs-site
npx create-docusaurus@latest . classic --typescript
```

**Content sources**:
- `INTEGRATION_GUIDE.md`
- `MCP_INTEGRATION_GUIDE.md` 
- `ONASIS_GATEWAY_SERVICE_ECOSYSTEM_FLOWCHART.md`
- Service-specific guides in `services/*/`

### **3. Dashboard (dashboard.lanonasis.com)**
**Platform**: Vercel / Netlify
**Purpose**: Service provider management dashboard

```bash
# Create Next.js dashboard
npx create-next-app@latest dashboard --typescript --tailwind
```

**Features needed**:
- Service usage analytics
- API key management
- Client management (from `services/xpress-wallet-waas/CLIENT_DASHBOARD_SPECIFICATION.md`)
- Billing and usage tracking

### **4. MCP Server (mcp.lanonasis.com)**
**Platform**: Railway / Render / DigitalOcean
**Purpose**: Dedicated MCP server with SSE support

```bash
# Deploy MCP server as standalone service
# Can use same codebase but focused on MCP endpoints
```

---

## 🔧 **Phase 2: DNS Configuration**

### **After Services are Deployed:**

#### **Option A: Using Cloudflare (Recommended)**
1. **Add lanonasis.com to Cloudflare**
2. **Create CNAME records**:
   ```
   api.lanonasis.com → CNAME → your-vercel-app.vercel.app
   docs.lanonasis.com → CNAME → docs-site.netlify.app  
   dashboard.lanonasis.com → CNAME → dashboard.vercel.app
   mcp.lanonasis.com → CNAME → mcp-server.railway.app
   ```

#### **Option B: Using Domain Registrar DNS**
1. **Go to your domain registrar (Namecheap, GoDaddy, etc.)**
2. **Add DNS records**:
   ```
   Type: CNAME | Host: api | Value: your-deployment-url
   Type: CNAME | Host: docs | Value: docs-deployment-url
   Type: CNAME | Host: dashboard | Value: dashboard-deployment-url
   Type: CNAME | Host: mcp | Value: mcp-deployment-url
   ```

---

## 📋 **Immediate Action Plan**

### **Step 1: Choose Primary Deployment Platform**
**Recommended Stack**:
- **API Gateway**: Vercel (best for API routes)
- **Documentation**: Netlify (great for static sites)
- **Dashboard**: Vercel (Next.js optimized)
- **MCP Server**: Railway (persistent connections)

### **Step 2: Deploy Services in Order**
1. **Deploy API Gateway first** (most critical)
2. **Deploy MCP Server** (needed for agent integrations)
3. **Deploy Documentation** (for developers)
4. **Deploy Dashboard** (for clients)

### **Step 3: Configure Custom Domains**
Only after deployments are live and have URLs

---

## 🚀 **Quick Start Commands**

### **Deploy API Gateway to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod

# Add custom domain in Vercel dashboard
# Then point api.lanonasis.com CNAME to vercel-url
```

### **Deploy MCP Server to Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Add custom domain in Railway dashboard
```

### **Deploy Docs to Netlify:**
```bash
# Create docs build
npm run build:docs

# Deploy to Netlify
netlify deploy --prod --dir=docs-build

# Add custom domain in Netlify dashboard
```

---

## 🔐 **Environment Variables for Production**

### **Required for all deployments:**
```env
# Database
DATABASE_URL=your_neon_database_url
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key

# Service APIs
PAYSTACK_SECRET_KEY=your_paystack_key
VERIFICATION_API_KEY=your_verification_key
XPRESS_API_KEY=your_xpress_key

# Security
JWT_SECRET=your_production_jwt_secret
WEBHOOK_SECRET=your_webhook_secret

# CORS
ALLOWED_ORIGINS=https://api.lanonasis.com,https://dashboard.lanonasis.com
```

---

## 🎯 **Success Metrics**

### **After deployment, you should have:**
- ✅ `https://api.lanonasis.com/health` returns 200
- ✅ `https://mcp.lanonasis.com/tools` lists all MCP tools
- ✅ `https://docs.lanonasis.com` shows documentation
- ✅ `https://dashboard.lanonasis.com` loads dashboard

### **Revenue Readiness:**
- **API Gateway**: Ready for client API calls
- **MCP Server**: Ready for AI agent integrations
- **Dashboard**: Ready for service provider clients
- **Documentation**: Ready for developer onboarding

**Next Step**: Choose your deployment platform and I'll help you deploy the first service!