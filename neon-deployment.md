# Neon Deployment Strategy for MCP Server

## Why Neon?
- **Reliable**: No current outages like Supabase us-east-1
- **Serverless Postgres**: Auto-scaling, branching, point-in-time recovery
- **Better Performance**: Lower latency, faster cold starts
- **Cost Effective**: Pay-per-use model

## Neon Setup Steps

### 1. Create Neon Project
```bash
# Install Neon CLI
npm install -g @neondatabase/cli

# Login to Neon
neon auth

# Create new project
neon projects create --name "api-integration-baseline"
```

### 2. Database Schema Setup
```sql
-- Create core schema for MCP server
CREATE SCHEMA IF NOT EXISTS mcp_core;

-- API adapters registry
CREATE TABLE mcp_core.adapters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API tools registry
CREATE TABLE mcp_core.tools (
    id SERIAL PRIMARY KEY,
    adapter_id INTEGER REFERENCES mcp_core.adapters(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    input_schema JSONB,
    output_schema JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Request logs for observability
CREATE TABLE mcp_core.request_logs (
    id SERIAL PRIMARY KEY,
    adapter_name VARCHAR(100),
    tool_name VARCHAR(200),
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Health check logs
CREATE TABLE mcp_core.health_checks (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100),
    status VARCHAR(20),
    response_time_ms INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_adapters_name ON mcp_core.adapters(name);
CREATE INDEX idx_tools_adapter_id ON mcp_core.tools(adapter_id);
CREATE INDEX idx_request_logs_created_at ON mcp_core.request_logs(created_at);
CREATE INDEX idx_health_checks_created_at ON mcp_core.health_checks(created_at);
```

### 3. Environment Configuration
```bash
# .env.neon
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
NEON_PROJECT_ID="your-project-id"
NEON_BRANCH="main"
NODE_ENV="production"
PORT=3001
```

## Neon-Optimized MCP Server

### Database Connection Pool
```javascript
// config/neon.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### Adapter Registry with Neon
```javascript
// services/adapter-registry.js
const pool = require('../config/neon');

class AdapterRegistry {
  async registerAdapter(name, version, config) {
    const query = `
      INSERT INTO mcp_core.adapters (name, version, config)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE SET
        version = $2,
        config = $3,
        updated_at = NOW()
      RETURNING id;
    `;
    
    const result = await pool.query(query, [name, version, config]);
    return result.rows[0].id;
  }

  async getActiveAdapters() {
    const query = `
      SELECT * FROM mcp_core.adapters
      WHERE status = 'active'
      ORDER BY name;
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  async logRequest(adapterName, toolName, requestData, responseData, statusCode, duration) {
    const query = `
      INSERT INTO mcp_core.request_logs 
      (adapter_name, tool_name, request_data, response_data, status_code, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6);
    `;
    
    await pool.query(query, [
      adapterName,
      toolName,
      requestData,
      responseData,
      statusCode,
      duration
    ]);
  }
}

module.exports = new AdapterRegistry();
```

## Deployment Options

### Option 1: Neon + Vercel
```bash
# Deploy to Vercel with Neon backend
vercel --prod
```

### Option 2: Neon + Railway
```bash
# Deploy to Railway with Neon backend
railway deploy
```

### Option 3: Neon + Your VPS (when connectivity is restored)
```bash
# Deploy to your Hostinger VPS with Neon backend
./scripts/deploy.sh production
```

## Migration Benefits

### From Supabase to Neon
- ✅ **No Edge Functions dependency** - Pure Node.js server
- ✅ **Better connection pooling** - Native PostgreSQL
- ✅ **Branching support** - Database branches for staging/prod
- ✅ **Point-in-time recovery** - Better backup strategy
- ✅ **Auto-scaling** - Handles traffic spikes
- ✅ **Lower latency** - Optimized for performance

### Immediate Actions
1. **Create Neon project** - Get database URL
2. **Update MCP server** - Add Neon connection
3. **Deploy to stable platform** - Vercel/Railway
4. **Test all endpoints** - Verify functionality
5. **Monitor performance** - Use Neon dashboard

## Cost Comparison
- **Supabase**: $25/month + Edge Functions costs
- **Neon**: $19/month + compute usage
- **Savings**: ~30% cost reduction + better reliability

Would you like me to proceed with the Neon setup?
