#!/usr/bin/env bun

/**
 * MCP Server with Bun + Neon Database
 * High-performance API integration baseline
 */

import { serve } from "bun";
import { Pool } from "pg";
import { existsSync } from "fs";

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Adapter registry with Neon backend
class AdapterRegistry {
  async registerAdapter(name: string, version: string, config: any) {
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

  async logRequest(adapterName: string, toolName: string, requestData: any, responseData: any, statusCode: number, duration: number) {
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

const registry = new AdapterRegistry();

// Load adapters dynamically
async function loadAdapters() {
  try {
    const adaptersPath = (process.env.ADAPTERS_PATH || "./src/adapters/generated").replace(/\0/g, "");
    if (!existsSync(adaptersPath)) {
      console.warn(`⚠️  Adapters directory not found: ${adaptersPath}`);
      console.warn("ℹ️  Set ADAPTERS_PATH or generate adapters before boot.");
      return new Map();
    }

    const files = await Array.fromAsync(new Bun.Glob("*.ts").scan(adaptersPath));
    
    const adapters = new Map();
    
    for (const file of files) {
      try {
        const adapterModule = await import(`${adaptersPath}/${file}`);
        const AdapterClass = adapterModule.default;
        
        if (AdapterClass) {
          const adapterName = file.replace('.ts', '');
          const adapter = new AdapterClass();
          adapters.set(adapterName, adapter);
          
          // Register in database
          await registry.registerAdapter(adapterName, '1.0.0', {
            file,
            toolCount: adapter.tools?.length || 0,
            loadedAt: new Date().toISOString()
          });
          
          console.log(`✅ Loaded adapter: ${adapterName} (${adapter.tools?.length || 0} tools)`);
        }
      } catch (error) {
        console.error(`❌ Failed to load adapter ${file}:`, error.message);
      }
    }
    
    return adapters;
  } catch (error) {
    console.error('❌ Failed to load adapters:', error);
    return new Map();
  }
}

// Initialize adapters
const adapters = await loadAdapters();

// Health check with database
async function healthCheck() {
  const startTime = Date.now();
  
  try {
    // Test database connection
    const dbResult = await pool.query('SELECT NOW() as timestamp');
    const dbLatency = Date.now() - startTime;
    
    // Log health check
    await pool.query(`
      INSERT INTO mcp_core.health_checks (service_name, status, response_time_ms, details)
      VALUES ($1, $2, $3, $4)
    `, ['mcp-server', 'healthy', dbLatency, {
      adapters: adapters.size,
      database: 'connected',
      timestamp: dbResult.rows[0].timestamp
    }]);
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      adapters: adapters.size,
      database: {
        status: 'connected',
        latency: `${dbLatency}ms`
      },
      memory: process.memoryUsage(),
      version: '1.0.0'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Main server
const server = serve({
  port: process.env.PORT || 3001,
  
  async fetch(req) {
    const url = new URL(req.url);
    const startTime = Date.now();
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
    }
    
    try {
      // Health endpoint
      if (url.pathname === '/health') {
        const health = await healthCheck();
        return Response.json(health, {
          status: health.status === 'healthy' ? 200 : 503,
          headers: corsHeaders
        });
      }
      
      // List adapters
      if (url.pathname === '/api/adapters') {
        const adapterList = Array.from(adapters.entries()).map(([name, adapter]) => ({
          name,
          tools: adapter.tools?.length || 0,
          description: adapter.description || `${name} API adapter`,
          version: '1.0.0'
        }));
        
        return Response.json({
          adapters: adapterList,
          total: adapterList.length,
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }
      
      // List tools for specific adapter
      if (url.pathname.startsWith('/api/adapters/') && url.pathname.endsWith('/tools')) {
        const adapterName = url.pathname.split('/')[3];
        const adapter = adapters.get(adapterName);
        
        if (!adapter) {
          return Response.json({ error: 'Adapter not found' }, { 
            status: 404, 
            headers: corsHeaders 
          });
        }
        
        return Response.json({
          adapter: adapterName,
          tools: adapter.tools || [],
          count: adapter.tools?.length || 0
        }, { headers: corsHeaders });
      }
      
      // Execute tool
      if (url.pathname.startsWith('/api/execute/') && req.method === 'POST') {
        const pathParts = url.pathname.split('/');
        const adapterName = pathParts[3];
        const toolName = pathParts[4];
        
        const adapter = adapters.get(adapterName);
        if (!adapter) {
          return Response.json({ error: 'Adapter not found' }, { 
            status: 404, 
            headers: corsHeaders 
          });
        }
        
        const requestData = await req.json();
        const duration = Date.now() - startTime;
        
        try {
          // Execute tool (placeholder - implement actual tool execution)
          const result = {
            adapter: adapterName,
            tool: toolName,
            input: requestData,
            output: { message: 'Tool execution placeholder' },
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
          };
          
          // Log request
          await registry.logRequest(adapterName, toolName, requestData, result, 200, duration);
          
          return Response.json(result, { headers: corsHeaders });
        } catch (error) {
          await registry.logRequest(adapterName, toolName, requestData, { error: error.message }, 500, duration);
          
          return Response.json({ 
            error: error.message,
            adapter: adapterName,
            tool: toolName 
          }, { 
            status: 500, 
            headers: corsHeaders 
          });
        }
      }
      
      // Default 404
      return Response.json({ error: 'Not found' }, { 
        status: 404, 
        headers: corsHeaders 
      });
      
    } catch (error) {
      console.error('Server error:', error);
      return Response.json({ error: 'Internal server error' }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  },
  
  error(error) {
    console.error('Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

console.log(`🚀 MCP Server running on http://localhost:${server.port}`);
console.log(`📊 Loaded ${adapters.size} adapters`);
console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

export default server;
