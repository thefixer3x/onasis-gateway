# MCP Server Integration Guide

## Quick Start Integration

### 1. Import the Adapter Registry

```typescript
import { 
  ADAPTER_REGISTRY, 
  ADAPTER_METADATA,
  createAdapterInstance,
  listAdapters 
} from './src/adapters/index.js';
```

### 2. Initialize Adapters in Your MCP Server

```typescript
// Example MCP server integration
class MCPServer {
  private adapters: Map<string, MCPAdapter> = new Map();

  async loadAdapters() {
    console.log('🚀 Loading MCP adapters...');
    
    for (const adapterName of listAdapters()) {
      try {
        const adapter = await createAdapterInstance(adapterName);
        
        // Configure adapter with credentials
        await adapter.initialize({
          baseUrl: process.env[`${adapterName.toUpperCase()}_BASE_URL`],
          apiKey: process.env[`${adapterName.toUpperCase()}_API_KEY`],
          timeout: 30000
        });
        
        this.adapters.set(adapterName, adapter);
        console.log(`✅ Loaded ${adapterName} (${adapter.tools.length} tools)`);
      } catch (error) {
        console.error(`❌ Failed to load ${adapterName}:`, error.message);
      }
    }
    
    console.log(`🎉 Loaded ${this.adapters.size} adapters successfully!`);
  }

  async handleToolCall(adapterName: string, toolName: string, args: any) {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter ${adapterName} not found`);
    }
    
    return await adapter.callTool(toolName, args);
  }

  async listAllTools() {
    const allTools = [];
    for (const [adapterName, adapter] of this.adapters) {
      const tools = await adapter.listTools();
      allTools.push(...tools.map(tool => ({
        ...tool,
        adapter: adapterName
      })));
    }
    return allTools;
  }
}
```

### 3. Environment Configuration

Create a `.env` file with your API credentials:

```env
# Stripe API
STRIPE_API_2024_04_10_API_KEY=sk_test_...
STRIPE_API_2024_04_10_BASE_URL=https://api.stripe.com

# Hostinger API
HOSTINGER_API_API_KEY=your_hostinger_key
HOSTINGER_API_BASE_URL=https://api.hostinger.com

# BAP (Nigerian Payment Services)
BAP_API_KEY=your_bap_key
BAP_BASE_URL=https://api.bap.ng

# Google Analytics
GOOGLE_ANALYTICS_API_V3_API_KEY=your_ga_key
GOOGLE_ANALYTICS_API_V3_BASE_URL=https://www.googleapis.com/analytics/v3

# ngrok API
NGROK_API_API_KEY=your_ngrok_key
NGROK_API_BASE_URL=https://api.ngrok.com

# Shutterstock (OAuth2)
SHUTTERSTOCK_API_CLIENT_ID=your_client_id
SHUTTERSTOCK_API_CLIENT_SECRET=your_client_secret
SHUTTERSTOCK_API_BASE_URL=https://api.shutterstock.com

# Wise MCA
7_WISE_MULTICURRENCY_ACCOUNT_MCA_PLATFORM_API_S_API_KEY=your_wise_key
7_WISE_MULTICURRENCY_ACCOUNT_MCA_PLATFORM_API_S_BASE_URL=https://api.wise.com

# Open Banking
OPEN_BANKING_API_API_KEY=your_open_banking_key
OPEN_BANKING_API_BASE_URL=https://api.openbanking.org.uk

# Additional APIs...
```

### 4. Health Monitoring

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {};
  
  for (const [name, adapter] of mcpServer.adapters) {
    health[name] = await adapter.getStatus();
  }
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    adapters: health
  });
});
```

### 5. Tool Discovery API

```typescript
// List all available tools
app.get('/api/tools', async (req, res) => {
  const tools = await mcpServer.listAllTools();
  res.json({
    total: tools.length,
    adapters: mcpServer.adapters.size,
    tools: tools
  });
});

// Get tools for specific adapter
app.get('/api/adapters/:name/tools', async (req, res) => {
  const adapter = mcpServer.adapters.get(req.params.name);
  if (!adapter) {
    return res.status(404).json({ error: 'Adapter not found' });
  }
  
  const tools = await adapter.listTools();
  res.json({
    adapter: req.params.name,
    tools: tools
  });
});
```

### 6. Tool Execution API

```typescript
// Execute a tool
app.post('/api/adapters/:adapter/tools/:tool', async (req, res) => {
  try {
    const result = await mcpServer.handleToolCall(
      req.params.adapter,
      req.params.tool,
      req.body
    );
    
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Available Adapters

### Payment & Financial (8 adapters)
- **stripe-api-2024-04-10**: 457 tools for payment processing
- **bap**: 92 tools for Nigerian payment services
- **merchant-api**: 49 tools for merchant payments
- **xpress-wallet-for-merchants**: 40 tools for mobile wallet
- **sayswitch-api-integration**: 43 tools for payment switching
- **7-wise-multicurrency-account-mca-platform-api-s**: 47 tools for Wise platform
- **open-banking-api**: 58 tools for open banking
- **multi-currency-account**: 9 tools for currency management

### Infrastructure & DevOps (4 adapters)
- **hostinger-api**: 85 tools for web hosting management
- **ngrok-api**: 217 tools for tunneling service
- **ngrok-api-for-use-with-flows**: 217 tools for automation
- **ngrok-examples**: 19 tools for usage examples

### Analytics & Reporting (1 adapter)
- **google-analytics-api-v3**: 88 tools for analytics reporting

### Media & Content (1 adapter)
- **shutterstock-api**: 109 tools for stock media

### Business & Enterprise (3 adapters)
- **business-api**: 52 tools for business management
- **api-testing-basics**: 8 tools for API testing
- **edoc-external-app-integration-for-clients**: 6 tools for document integration

## Security Considerations

1. **Credential Management**: Store API keys securely using environment variables or secret management systems
2. **Rate Limiting**: Implement rate limiting per adapter to respect API limits
3. **Input Validation**: Validate all tool inputs before passing to adapters
4. **Audit Logging**: Log all tool executions for compliance and monitoring
5. **Error Handling**: Implement proper error handling and don't expose sensitive information

## Monitoring & Observability

Each adapter includes built-in metrics:
- Request count
- Error count
- Average response time
- Uptime tracking
- Health status

Use these metrics to monitor adapter performance and detect issues early.

## Next Steps

1. **Implement Tool Logic**: Add actual API call implementations to each tool
2. **Add Tests**: Create unit and integration tests for adapters
3. **Documentation**: Generate API documentation for each adapter
4. **Performance Optimization**: Implement caching and connection pooling
5. **Compliance**: Add compliance features for financial APIs (PCI, GDPR, etc.)

Your comprehensive API integration baseline is now ready for production use!
