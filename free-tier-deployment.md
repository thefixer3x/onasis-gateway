# Free Tier Deployment: Neon + Vercel

## Architecture
```
[Your MCP Server] → [Vercel Hosting] → [Neon Database]
     (Bun/TS)         (Free Tier)       (Free Tier)
```

## Step 1: Setup Neon Database (FREE)

### Create Neon Project
```bash
# Login to Neon
neon auth

# Create project
neon projects create --name "mcp-server-db"

# Get connection string
neon connection-string --project-id your-project-id
```

### Database Schema
```sql
-- Run this in Neon SQL Editor
CREATE SCHEMA IF NOT EXISTS mcp_core;

CREATE TABLE mcp_core.adapters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    config JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mcp_core.request_logs (
    id SERIAL PRIMARY KEY,
    adapter_name VARCHAR(100),
    tool_name VARCHAR(200),
    status_code INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Step 2: Deploy to Vercel (FREE)

### Install Vercel CLI
```bash
npm i -g vercel
```

### Create vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "bun-neon-server.ts",
      "use": "@vercel/bun"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "bun-neon-server.ts"
    }
  ],
  "env": {
    "DATABASE_URL": "@database_url"
  }
}
```

### Deploy Commands
```bash
# Set environment variable
vercel env add DATABASE_URL

# Deploy
vercel --prod
```

## Step 3: Environment Variables

### Vercel Environment Variables
```bash
# Add your Neon connection string
vercel env add DATABASE_URL
# Example: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb

# Add other variables
vercel env add NODE_ENV production
vercel env add PORT 3000
```

## Free Tier Limits

### Neon Free Tier
- ✅ **Storage**: 512 MB (plenty for logs/metadata)
- ✅ **Compute**: 1 unit (sufficient for API calls)
- ✅ **Connections**: 100 concurrent
- ✅ **Branches**: 1 (main)

### Vercel Free Tier
- ✅ **Bandwidth**: 100 GB/month
- ✅ **Function Duration**: 10 seconds
- ✅ **Function Memory**: 1024 MB
- ✅ **Deployments**: Unlimited

## Cost Breakdown
- **Neon**: $0/month (free tier)
- **Vercel**: $0/month (free tier)
- **Domain**: $0 (vercel.app subdomain)
- **SSL**: $0 (included)
- **Total**: **$0/month** 🎉

## Upgrade Path
When you need more:
- **Neon Pro**: $19/month (more storage/compute)
- **Vercel Pro**: $20/month (more bandwidth/functions)

## Benefits of This Setup
- ✅ **No VPS needed** - Bypass connectivity issues
- ✅ **No Supabase dependency** - Avoid outages
- ✅ **Serverless scaling** - Handle traffic spikes
- ✅ **Global CDN** - Fast worldwide access
- ✅ **Automatic HTTPS** - Security included
- ✅ **Git-based deployment** - Push to deploy

## Alternative Free Hosting Options
If Vercel doesn't work:
- **Railway**: $5/month after free trial
- **Render**: Free tier with limitations
- **Fly.io**: Generous free tier
- **Netlify**: Good for static + functions

Would you like me to set this up for you?
