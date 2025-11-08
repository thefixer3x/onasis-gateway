#!/usr/bin/env node

// Simple test server to preview the MCP interface
const http = require('http');
const url = require('url');

// Mock adapter data (same as in Netlify function)
const mockAdapters = [
  {
    name: 'stripe-api',
    version: '2024-04-10',
    description: 'Stripe payment processing API with 457 tools',
    status: 'active',
    toolCount: 457,
    authType: 'Bearer',
    baseUrl: 'https://api.stripe.com',
    category: 'payment'
  },
  {
    name: 'hostinger-api',
    version: '1.0.0',
    description: 'Hostinger VPS and domain management API with 85 tools',
    status: 'active',
    toolCount: 85,
    authType: 'Bearer',
    baseUrl: 'https://api.hostinger.com',
    category: 'hosting'
  },
  {
    name: 'wise-mca-api',
    version: '1.0.0',
    description: 'Wise Multicurrency Account Platform API with 67 tools',
    status: 'active',
    toolCount: 67,
    authType: 'Bearer',
    baseUrl: 'https://api.wise.com',
    category: 'financial'
  },
  {
    name: 'bap-api',
    version: '1.0.0',
    description: 'Nigerian Biller Aggregation Portal API with 92 tools',
    status: 'active',
    toolCount: 92,
    authType: 'API Key + HMAC',
    baseUrl: 'https://api.bap.ng',
    category: 'payment'
  },
  {
    name: 'ngrok-api',
    version: '1.0.0',
    description: 'ngrok tunnel management API with 217 tools',
    status: 'active',
    toolCount: 217,
    authType: 'Bearer',
    baseUrl: 'https://api.ngrok.com',
    category: 'networking'
  }
];

function generateHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Onasis Gateway - MCP Server</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white; 
            padding: 40px;
            text-align: center;
        }
        .header h1 { 
            font-size: 2.5em; 
            margin-bottom: 10px;
            font-weight: 700;
        }
        .header p { 
            font-size: 1.2em; 
            opacity: 0.9;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 40px;
            background: #f8f9fa;
        }
        .stat-card { 
            background: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            transition: transform 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-number { 
            font-size: 3em; 
            font-weight: bold; 
            color: #2a5298;
            margin-bottom: 10px;
        }
        .stat-label { 
            color: #666; 
            font-size: 1.1em;
            font-weight: 500;
        }
        .adapters { 
            padding: 40px;
        }
        .adapters h2 { 
            font-size: 2em; 
            margin-bottom: 30px;
            color: #333;
            text-align: center;
        }
        .adapter-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
        }
        .adapter-card { 
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 15px;
            padding: 25px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .adapter-card:hover { 
            border-color: #2a5298;
            box-shadow: 0 10px 30px rgba(42, 82, 152, 0.1);
        }
        .adapter-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            margin-bottom: 15px;
        }
        .adapter-name { 
            font-size: 1.3em; 
            font-weight: bold; 
            color: #2a5298;
        }
        .adapter-status { 
            background: #28a745;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .adapter-description { 
            color: #666; 
            margin-bottom: 20px;
            line-height: 1.5;
        }
        .adapter-details { 
            display: grid; 
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: 0.9em;
        }
        .detail-item { 
            display: flex; 
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .detail-label { 
            color: #666; 
            font-weight: 500;
        }
        .detail-value { 
            color: #333; 
            font-weight: 600;
        }
        .api-endpoints { 
            background: #f8f9fa;
            padding: 40px;
            text-align: center;
        }
        .api-endpoints h3 { 
            font-size: 1.5em; 
            margin-bottom: 20px;
            color: #333;
        }
        .endpoint-list { 
            display: flex; 
            justify-content: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .endpoint { 
            background: white;
            padding: 10px 20px;
            border-radius: 25px;
            border: 2px solid #e9ecef;
            font-family: 'Monaco', monospace;
            font-size: 0.9em;
            color: #2a5298;
            font-weight: 500;
        }
        .footer { 
            background: #333;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .category-badge {
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(42, 82, 152, 0.1);
            color: #2a5298;
            padding: 5px 10px;
            border-radius: 10px;
            font-size: 0.8em;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Onasis Gateway</h1>
            <p>MCP Server - API Integration Hub</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">17</div>
                <div class="stat-label">Active Adapters</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">1,596</div>
                <div class="stat-label">API Tools</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">94.4%</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">5</div>
                <div class="stat-label">Categories</div>
            </div>
        </div>
        
        <div class="adapters">
            <h2>📡 Available Adapters</h2>
            <div class="adapter-grid">
                ${mockAdapters.map(adapter => `
                    <div class="adapter-card">
                        <div class="category-badge">${adapter.category}</div>
                        <div class="adapter-header">
                            <div class="adapter-name">${adapter.name}</div>
                            <div class="adapter-status">${adapter.status}</div>
                        </div>
                        <div class="adapter-description">${adapter.description}</div>
                        <div class="adapter-details">
                            <div class="detail-item">
                                <span class="detail-label">Tools:</span>
                                <span class="detail-value">${adapter.toolCount}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Auth:</span>
                                <span class="detail-value">${adapter.authType}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Version:</span>
                                <span class="detail-value">${adapter.version}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Base URL:</span>
                                <span class="detail-value">${adapter.baseUrl}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="api-endpoints">
            <h3>🔗 API Endpoints</h3>
            <div class="endpoint-list">
                <div class="endpoint">GET /health</div>
                <div class="endpoint">GET /api/adapters</div>
                <div class="endpoint">GET /api/adapters/{name}</div>
                <div class="endpoint">POST /api/execute/{adapter}/{tool}</div>
            </div>
        </div>
        
        <div class="footer">
            <p>🌟 Powered by Netlify + Neon + Bun Runtime</p>
            <p>Ready for production deployment</p>
        </div>
    </div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateHTML());
  } else if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      adapters: mockAdapters.length,
      tools: mockAdapters.reduce((sum, a) => sum + a.toolCount, 0)
    }));
  } else if (path === '/api/adapters') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ adapters: mockAdapters }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Onasis Gateway test server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://localhost:${PORT}/health`);
  console.log(`   http://localhost:${PORT}/api/adapters`);
  console.log(`\n✨ This shows what your Netlify deployment will look like!`);
});
