#!/bin/bash

# Script to set up the 4 subdomains for lanonasis.com using Netlify CLI
# Since Netlify manages the nameservers, this will configure DNS automatically

echo "🌐 Setting up Lanonasis Subdomains..."

# Site IDs from netlify sites:list
API_SITE_ID="64a44156-b629-4ec8-834a-349b306df073"        # lanonasis-api
MCP_SITE_ID="cce8abf3-c454-4ae9-b6e7-299ce339c862"        # lanonasis-mcp  
MAIN_SITE_ID="4f1f3e2d-54e7-4685-af6b-d6e3d29f7719"      # lanonasis (main)

echo "📡 Configuring api.lanonasis.com..."
# Link to API site and deploy current gateway
cd /Users/seyederick/onasis-gateway
netlify unlink 2>/dev/null || true
netlify link --id=$API_SITE_ID

echo "📡 Configuring mcp.lanonasis.com..."  
# Link to MCP site for MCP-specific endpoints
netlify unlink 2>/dev/null || true
netlify link --id=$MCP_SITE_ID

echo "📡 Configuring docs.lanonasis.com..."
# We'll use the lanonasis-maas project for docs
cd /Users/seyederick/DevOps/_project_folders/lanonasis-maas
netlify unlink 2>/dev/null || true
netlify link --id=$MAIN_SITE_ID

echo "📡 Configuring dashboard.lanonasis.com..."
# Dashboard will also use the main lanonasis-maas project

echo "✅ Subdomain setup script complete!"
echo ""
echo "🔧 Manual steps needed:"
echo "1. Go to https://app.netlify.com/projects/lanonasis-api/settings/domain"
echo "2. Add custom domain: api.lanonasis.com" 
echo "3. Go to https://app.netlify.com/projects/lanonasis-mcp/settings/domain"
echo "4. Add custom domain: mcp.lanonasis.com"
echo "5. Go to https://app.netlify.com/projects/lanonasis/settings/domain" 
echo "6. Add custom domains: docs.lanonasis.com and dashboard.lanonasis.com"
echo ""
echo "🚀 Since Netlify manages lanonasis.com nameservers, DNS will be automatic!"