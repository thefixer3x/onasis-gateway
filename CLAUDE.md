# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Onasis Gateway is a comprehensive API service warehouse that prevents costly omissions through upfront cataloging of all available APIs. It provides both MCP (Model Context Protocol) server interfaces for AI agents and REST API endpoints for applications.

## Architecture

The project uses a multi-runtime approach:
- **Bun runtime**: Primary server (`bun-neon-server.ts`) with PostgreSQL/Neon database
- **Node.js**: Fallback server (`server.js`) and MCP server
- **TypeScript**: Main development language with Bun types
- **Supabase**: Database backend with comprehensive schema

## Commands

### Development
```bash
# Start with Bun (recommended)
bun run start              # Production mode
bun run dev               # Development mode with --watch

# Node.js fallback
npm run node-start        # Start with Node.js

# Database setup
bun run db:setup          # Initialize Neon database
```

### Build & Deployment
```bash
# Generate service adapters from Postman collections
bun run generate-adapters

# Build registry
bun run registry:build

# Deploy to cloud
bun run deploy           # Uses deploy.sh script

# Health check
bun run health          # Check system health
```

### Code Quality
```bash
# Linting
npm run lint            # ESLint for TypeScript files

# Type checking
bun run build          # TypeScript compilation check

# Clean build artifacts
npm run clean          # Remove dist and generated files
```

### Testing
```bash
# Run tests (when available)
npm test               # Jest test suite
```

## Code Architecture

### Directory Structure
- `src/adapters/`: Generated API adapters from Postman collections
- `services/`: Extracted service configurations (19 payment/hosting APIs)
- `mcp-server/`: MCP protocol server for AI agents
- `core/`: Base client and universal utilities
- `database/`: Migration files
- `supabase/`: Supabase configuration and migrations

### Key Components

1. **Adapter System**: Dynamic loading of API adapters with tool discovery
2. **Database Integration**: PostgreSQL with comprehensive audit logging
3. **Authentication**: Multiple auth types (Bearer, API Key, HMAC, OAuth2)
4. **Rate Limiting**: Built-in rate limiting with database tracking
5. **CORS Support**: Configurable CORS for web integrations

### Database Schema
- `core.api_keys`: API authentication and authorization
- `onasis.adapters`: Registry of available API adapters
- `onasis.tools`: Individual endpoints within adapters
- `audit.request_logs`: Complete request/response logging
- `audit.rate_limits`: Rate limiting enforcement

### Service Categories
- **Payment Services**: Stripe, BAP, Wise MCA, Xpress Wallet
- **Infrastructure**: Hostinger, ngrok
- **Analytics**: Google Analytics
- **Financial**: Open Banking, Business API
- **Media**: Shutterstock

## Development Guidelines

### Adding New Services
1. Place Postman collection JSON in root directory
2. Run extraction: `node scripts/extract-service.js [collection.json] services/`
3. Verify in `services/[service-name]/` directory
4. Run `bun run generate-adapters` to create TypeScript adapters

### Environment Variables
Required variables in `.env`:
- `DATABASE_URL`: PostgreSQL/Neon connection string
- `PORT`: Server port (default: 3001)
- Service-specific tokens (STRIPE_TOKEN, BAP_API_KEY, etc.)

### API Integration Pattern
```typescript
// Adapters are loaded dynamically from src/adapters/generated/
// Each adapter exports tools with standardized interfaces
// Authentication is handled per-adapter based on auth_type
```

### Error Handling
- All errors logged to `audit.request_logs`
- Standardized error responses with codes
- Circuit breaker pattern for external APIs

## Important Notes

1. **Multi-Runtime**: Project supports both Bun and Node.js runtimes
2. **Database Required**: PostgreSQL connection required for full functionality
3. **Dynamic Loading**: Adapters loaded at runtime from generated files
4. **Comprehensive Logging**: All requests logged for audit and analytics
5. **Rate Limiting**: Enforced at database level per API key

## Common Tasks

### Check Service Health
```bash
curl http://localhost:3001/health
```

### List Available Adapters
```bash
curl http://localhost:3001/api/adapters
```

### Execute API Tool
```bash
curl -X POST http://localhost:3001/api/execute/stripe-api/create-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"parameters": {...}}'
```