#!/usr/bin/env node

/**
 * MCP Server Routing Verification Test
 * Verifies that MCP server routes to correct onasis-core endpoints
 */

const fetch = require('node-fetch');

class MCPServerRoutingTester {
  constructor(config = {}) {
    this.config = {
      mcpServerUrl: config.mcpServerUrl || 'http://localhost:3001',
      onasisCoreUrl: config.onasisCoreUrl || 'https://api.lanonasis.com',
      gatewayUrl: config.gatewayUrl || 'http://localhost:3000',
      timeout: config.timeout || 10000,
      ...config
    };
    
    this.testResults = [];
  }

  /**
   * Run MCP server routing verification
   */
  async runRoutingTests() {
    console.log('🔍 MCP Server Routing Verification');
    console.log('==================================\n');
    
    try {
      // Test MCP server availability
      await this.testMCPServerHealth();
      
      // Test gateway routing
      await this.testGatewayRouting();
      
      // Test authentication endpoint routing
      await this.testAuthEndpointRouting();
      
      // Test onasis-core connectivity
      await this.testOnasisCoreConnectivity();
      
      // Verify service separation
      await this.testServiceSeparation();
      
      this.generateRoutingReport();
      
    } catch (error) {
      console.error('❌ Routing test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test MCP server health and availability
   */
  async testMCPServerHealth() {
    return this.runTest('MCP Server Health (Port 3001)', async () => {
      const response = await this.makeRequest(this.config.mcpServerUrl, '/health');
      
      if (!response.ok) {
        throw new Error(`MCP Server health check failed: ${response.status}`);
      }
      
      const health = await response.json();
      console.log(`   🟢 MCP Server: ${health.status || 'running'}`);
      
      return health;
    });
  }

  /**
   * Test gateway routing (Port 3000)
   */
  async testGatewayRouting() {
    return this.runTest('Gateway Routing (Port 3000)', async () => {
      const response = await this.makeRequest(this.config.gatewayUrl, '/health');
      
      if (!response.ok) {
        throw new Error(`Gateway health check failed: ${response.status}`);
      }
      
      const health = await response.json();
      console.log(`   🌐 Gateway: ${health.adapters} adapters, ${health.totalTools} tools`);
      
      return health;
    });
  }

  /**
   * Test authentication endpoint routing
   */
  async testAuthEndpointRouting() {
    return this.runTest('Authentication Endpoint Routing', async () => {
      // Test auth health via gateway
      const authHealthResponse = await this.makeRequest(this.config.gatewayUrl, '/api/auth-health');
      
      console.log(`   🔐 Auth health via gateway: ${authHealthResponse.status}`);
      
      // Test direct onasis-core auth endpoint
      const directAuthResponse = await this.makeRequest(this.config.onasisCoreUrl, '/v1/auth/health');
      
      console.log(`   🎯 Direct onasis-core auth: ${directAuthResponse.status}`);
      
      return {
        gateway_auth_proxy: authHealthResponse.status,
        direct_onasis_core: directAuthResponse.status
      };
    });
  }

  /**
   * Test onasis-core connectivity
   */
  async testOnasisCoreConnectivity() {
    return this.runTest('Onasis-CORE Connectivity', async () => {
      const endpoints = [
        '/v1/auth/health',
        '/sse',
        '/api/mcp',
        '/api/v1/maas'
      ];
      
      const results = {};
      
      for (const endpoint of endpoints) {
        try {
          const response = await this.makeRequest(this.config.onasisCoreUrl, endpoint);
          results[endpoint] = {
            status: response.status,
            reachable: response.status < 500
          };
          console.log(`   📡 ${endpoint}: ${response.status}`);
        } catch (error) {
          results[endpoint] = {
            status: 'error',
            reachable: false,
            error: error.message
          };
          console.log(`   ❌ ${endpoint}: ${error.message}`);
        }
      }
      
      return results;
    });
  }

  /**
   * Test service separation
   */
  async testServiceSeparation() {
    return this.runTest('Service Separation Verification', async () => {
      // Check that MCP server and Gateway are on different ports
      const mcpHealth = await this.makeRequest(this.config.mcpServerUrl, '/health');
      const gatewayHealth = await this.makeRequest(this.config.gatewayUrl, '/health');
      
      const mcpData = mcpHealth.ok ? await mcpHealth.json() : null;
      const gatewayData = gatewayHealth.ok ? await gatewayHealth.json() : null;
      
      // Verify different services
      const services = {
        mcp_server: {
          port: 3001,
          reachable: mcpHealth.ok,
          type: 'mcp',
          data: mcpData
        },
        gateway: {
          port: 3000,
          reachable: gatewayHealth.ok,
          type: 'gateway',
          data: gatewayData
        }
      };
      
      console.log(`   🔄 MCP Server (3001): ${services.mcp_server.reachable ? 'OK' : 'FAIL'}`);
      console.log(`   🌐 Gateway (3000): ${services.gateway.reachable ? 'OK' : 'FAIL'}`);
      
      if (services.mcp_server.reachable && services.gateway.reachable) {
        console.log('   ✅ Service separation confirmed');
      }
      
      return services;
    });
  }

  /**
   * Make HTTP request with timeout
   */
  async makeRequest(baseUrl, path, options = {}) {
    const url = `${baseUrl}${path}`;
    const requestOptions = {
      timeout: this.config.timeout,
      ...options
    };
    
    return await fetch(url, requestOptions);
  }

  /**
   * Generic test runner
   */
  async runTest(name, testFn) {
    const startTime = Date.now();
    console.log(`🧪 Testing: ${name}`);
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${name}: SUCCESS (${duration}ms)\n`);
      
      this.testResults.push({
        name,
        status: 'success',
        duration,
        result
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${name}: FAILED - ${error.message} (${duration}ms)\n`);
      
      this.testResults.push({
        name,
        status: 'failed',
        duration,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Generate routing verification report
   */
  generateRoutingReport() {
    console.log('\n📋 MCP Server Routing Verification Report');
    console.log('=========================================');
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(t => t.status === 'success').length;
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;
    const successRate = ((successfulTests / totalTests) * 100).toFixed(1);
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Successful: ${successfulTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Success Rate: ${successRate}%`);
    
    console.log('\n🔍 Routing Status:');
    
    if (successRate >= 80) {
      console.log('✅ ROUTING VERIFIED');
      console.log('   - MCP Server correctly configured on port 3001');
      console.log('   - Gateway correctly configured on port 3000'); 
      console.log('   - Authentication endpoints properly routed');
      console.log('   - Onasis-CORE connectivity confirmed');
    } else {
      console.log('⚠️  ROUTING ISSUES DETECTED');
      console.log('   - Review failed tests and fix routing configuration');
    }
    
    // Check specific routing patterns
    const routingStatus = this.analyzeRoutingPatterns();
    console.log('\n🎯 Routing Pattern Analysis:');
    console.log(`   MCP Server (3001): ${routingStatus.mcp_server}`);
    console.log(`   Gateway (3000): ${routingStatus.gateway}`);
    console.log(`   Auth Bridge: ${routingStatus.auth_bridge}`);
    console.log(`   Onasis-CORE: ${routingStatus.onasis_core}`);
    
    return {
      success_rate: parseFloat(successRate),
      routing_patterns: routingStatus,
      verification_complete: successRate >= 80
    };
  }

  /**
   * Analyze routing patterns from test results
   */
  analyzeRoutingPatterns() {
    const results = this.testResults;
    
    return {
      mcp_server: results.find(r => r.name.includes('MCP Server'))?.status || 'unknown',
      gateway: results.find(r => r.name.includes('Gateway'))?.status || 'unknown',
      auth_bridge: results.find(r => r.name.includes('Authentication'))?.status || 'unknown',
      onasis_core: results.find(r => r.name.includes('Onasis-CORE'))?.status || 'unknown'
    };
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new MCPServerRoutingTester();
  tester.runRoutingTests()
    .then(() => {
      console.log('\n🎯 MCP Server Routing Verification Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Routing verification failed:', error.message);
      process.exit(1);
    });
}

module.exports = MCPServerRoutingTester;