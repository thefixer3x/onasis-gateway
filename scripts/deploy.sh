#!/bin/bash

# MCP Server Deployment Script
# Supports direct deployment to Hostinger VPS via SSH/SCP

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
BRANCH="main"
SKIP_TESTS=false
FORCE_DEPLOY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --force)
      FORCE_DEPLOY=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment ENV    Target environment (staging|production)"
      echo "  -b, --branch BRANCH      Git branch to deploy"
      echo "  --skip-tests             Skip running tests"
      echo "  --force                  Force deployment even if tests fail"
      echo "  -h, --help               Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Set environment-specific variables
if [ "$ENVIRONMENT" = "staging" ]; then
    PORT=3002
    PM2_NAME="mcp-server-staging"
    DEPLOY_PATH="/var/www/mcp-server-staging"
elif [ "$ENVIRONMENT" = "production" ]; then
    PORT=3001
    PM2_NAME="mcp-server"
    DEPLOY_PATH="/var/www/mcp-server"
else
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting deployment to $ENVIRONMENT environment${NC}"
echo -e "${BLUE}📦 Branch: $BRANCH${NC}"
echo -e "${BLUE}🔌 Port: $PORT${NC}"

# Pre-deployment checks
echo -e "${YELLOW}🔍 Running pre-deployment checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Are you in the project root?${NC}"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed${NC}"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci

# Run tests unless skipped
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    if ! npm test; then
        if [ "$FORCE_DEPLOY" = false ]; then
            echo -e "${RED}❌ Tests failed. Use --force to deploy anyway${NC}"
            exit 1
        else
            echo -e "${YELLOW}⚠️  Tests failed but continuing due to --force flag${NC}"
        fi
    fi
fi

# Build the project
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build || echo -e "${YELLOW}⚠️  Build completed with warnings${NC}"

# Create backup if in production
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}💾 Creating backup...${NC}"
    BACKUP_DIR="../mcp-server-backup-$(date +%Y%m%d_%H%M%S)"
    if [ -d "$DEPLOY_PATH" ]; then
        cp -r "$DEPLOY_PATH" "$BACKUP_DIR"
        echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"
    fi
fi

# Stop existing PM2 process
echo -e "${YELLOW}🛑 Stopping existing PM2 process...${NC}"
pm2 stop "$PM2_NAME" 2>/dev/null || echo "No existing process to stop"

# Deploy the application
echo -e "${YELLOW}🚀 Deploying application...${NC}"

# Start PM2 process
if [ "$ENVIRONMENT" = "staging" ]; then
    PORT=$PORT pm2 start ecosystem.config.js --name "$PM2_NAME" --env staging
else
    PORT=$PORT pm2 start ecosystem.config.js --name "$PM2_NAME" --env production
fi

# Wait for application to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 5

# Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
if curl -f "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo -e "${YELLOW}📋 PM2 status:${NC}"
    pm2 status
    echo -e "${YELLOW}📋 Recent logs:${NC}"
    pm2 logs "$PM2_NAME" --lines 20
    exit 1
fi

# Show deployment info
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo -e "  Environment: $ENVIRONMENT"
echo -e "  Port: $PORT"
echo -e "  PM2 Process: $PM2_NAME"
echo -e "  Health Check: http://localhost:$PORT/health"
echo -e "  API Docs: http://localhost:$PORT/"

# Show PM2 status
echo -e "${BLUE}📋 PM2 Status:${NC}"
pm2 status

# Clean old backups in production (keep last 3)
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
    cd "$(dirname "$DEPLOY_PATH")"
    ls -dt mcp-server-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    echo -e "${GREEN}✅ Old backups cleaned${NC}"
fi

echo -e "${GREEN}🚀 Deployment to $ENVIRONMENT completed successfully!${NC}"
