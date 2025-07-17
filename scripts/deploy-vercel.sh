#!/bin/bash

# Vercel Deployment Script for MCP Server
# Run this script to deploy your MCP server to Vercel

set -e

echo "🚀 Starting Vercel deployment for MCP Server..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Login to Vercel (if not already logged in)
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "Please log in to Vercel:"
    vercel login
fi

# Create .vercelignore file
echo "📝 Creating .vercelignore..."
cat > .vercelignore << EOF
node_modules
.git
.env.local
.env.development
logs/
vps/
postman-collections/
src/adapters/generated/
dist/
*.log
.DS_Store
EOF

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

# Get the deployment URL
DEPLOYMENT_URL=$(vercel --prod --confirm 2>&1 | grep -o 'https://[^[:space:]]*' | head -1)

if [ -n "$DEPLOYMENT_URL" ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your MCP Server is live at: $DEPLOYMENT_URL"
    echo ""
    echo "📋 Available endpoints:"
    echo "  Health Check: $DEPLOYMENT_URL/health"
    echo "  List Adapters: $DEPLOYMENT_URL/api/adapters"
    echo "  API Root: $DEPLOYMENT_URL/api"
    echo ""
    echo "🧪 Test your deployment:"
    echo "  curl $DEPLOYMENT_URL/health"
    echo "  curl $DEPLOYMENT_URL/api/adapters"
    echo ""
    echo "🔧 To add environment variables:"
    echo "  vercel env add DATABASE_URL"
    echo "  vercel env add NODE_ENV"
else
    echo "❌ Deployment failed. Please check the output above."
    exit 1
fi

echo "🎉 MCP Server deployment complete!"
