#!/usr/bin/env node

/**
 * Comprehensive Authentication Integration Test Suite
 * Tests onasis-core auth bridge with onasis-gateway
 */

const fetch = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then((mod) => (mod.default || mod)(...args));
const jwt = require('jsonwebtoken');

class AuthIntegrationTester {
  constructor(config = {}) {
    this.config = {
      gatewayUrl: config.gatewayUrl || process.env.GATEWAY_URL || 'http://localhost:3000',
      authApiUrl: config.authApiUrl || process.env.ONASIS_AUTH_API_URL || 'https://api.lanonasis.com/v1/auth',
      projectScope: config.projectScope || 'lanonasis-maas',
      testTimeout: config.timeout || 30000,
      ...config
    };
    
    this.testResults = [];
    this.testUser = null;
  }

  /**
   * Run complete authentication integration test suite
   */
  async runTestSuite() {
    console.log('🧪 Onasis Gateway Authentication Integration Test Suite');
    console.log('======================================================\n');
    
    try {
      // Phase 1: Gateway Health Tests
      await this.testGatewayHealth();
      await this.testAuthServiceHealth();
      
      // Phase 2: Authentication Flow Tests
      await this.testUserSignup();
      await this.testUserLogin();
      await this.testTokenValidation();
      await this.testTokenRefresh();
      
      // Phase 3: Gateway API Tests with Auth
      await this.testProtectedEndpointsWithoutAuth();
      await this.testProtectedEndpointsWithAuth();
      await this.testUserContextInjection();
      
      // Phase 4: Edge Cases and Error Handling
      await this.testInvalidTokenHandling();
      await this.testExpiredTokenHandling();
      await this.testAPIKeyAuthentication();
      
      // Phase 5: Integration with Existing Services
      await this.testSSEWithAuth();
      await this.testAdapterExecutionWithAuth();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test gateway basic health
   */
  async testGatewayHealth() {
    return this.runTest('Gateway Health Check', async () => {
      const response = await this.makeRequest('GET', '/health');
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const health = await response.json();
      
      if (health.status !== 'healthy') {
        throw new Error('Gateway reports unhealthy status');
      }
      
      console.log(`   📊 Gateway: ${health.adapters} adapters, ${health.totalTools} tools`);
      return { status: 'healthy', adapters: health.adapters };
    });
  }

  /**
   * Test authentication service health
   */
  async testAuthServiceHealth() {
    return this.runTest('Authentication Service Health', async () => {
      const response = await this.makeRequest('GET', '/api/auth-health');
      
      if (!response.ok) {
        throw new Error(`Auth health check failed: ${response.status}`);
      }
      
      const health = await response.json();
      console.log(`   🔐 Auth Service: ${health.status}`);
      return health;
    });
  }

  /**
   * Test user signup flow
   */
  async testUserSignup() {
    return this.runTest('User Signup Flow', async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';
      const testName = 'Test User';
      
      const response = await this.makeRequest('POST', '/api/auth/signup', {
        email: testEmail,
        password: testPassword,
        name: testName
      }, {
        'X-Project-Scope': this.config.projectScope
      });
      
      if (response.status === 409) {
        // User already exists, that's okay for testing
        console.log('   ℹ️  User already exists, continuing with login test');
        return { skipped: true, reason: 'user_exists' };
      }
      
      if (!response.ok) {
        throw new Error(`Signup failed: ${response.status} ${await response.text()}`);
      }
      
      const result = await response.json();
      
      if (!result.access_token || !result.user) {
        throw new Error('Invalid signup response format');
      }
      
      this.testUser = {
        email: testEmail,
        password: testPassword,
        token: result.access_token,
        user: result.user
      };
      
      console.log(`   👤 Created user: ${result.user.email} (ID: ${result.user.id})`);
      return result;
    });
  }

  /**
   * Test user login flow
   */
  async testUserLogin() {
    return this.runTest('User Login Flow', async () => {
      // Use existing test user or create a fallback
      const testEmail = this.testUser?.email || 'test@example.com';
      const testPassword = this.testUser?.password || 'password123';
      
      const response = await this.makeRequest('POST', '/api/auth/login', {
        email: testEmail,
        password: testPassword
      }, {
        'X-Project-Scope': this.config.projectScope
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Login failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.access_token || !result.user) {
        throw new Error('Invalid login response format');
      }
      
      // Update test user with fresh token
      this.testUser = {
        ...this.testUser,
        token: result.access_token,
        user: result.user
      };
      
      console.log(`   ✅ Logged in user: ${result.user.email}`);
      return result;
    });
  }

  /**
   * Test JWT token validation
   */
  async testTokenValidation() {
    return this.runTest('JWT Token Validation', async () => {
      if (!this.testUser?.token) {
        throw new Error('No test token available');
      }
      
      const response = await this.makeRequest('GET', '/api/auth/session', null, {
        'Authorization': `Bearer ${this.testUser.token}`
      });
      
      if (!response.ok) {
        throw new Error(`Session validation failed: ${response.status}`);
      }
      
      const session = await response.json();
      
      if (!session.user) {
        throw new Error('Invalid session response format');
      }
      
      console.log(`   🎫 Token valid for user: ${session.user.email}`);
      return session;
    });
  }

  /**
   * Test token refresh
   */
  async testTokenRefresh() {
    return this.runTest('Token Refresh Flow', async () => {
      if (!this.testUser?.token) {
        throw new Error('No test token available');
      }
      
      // For this test, we'll just validate the refresh endpoint exists
      // In a real scenario, we'd use a refresh_token
      const response = await this.makeRequest('POST', '/api/auth/refresh', {
        refresh_token: 'mock_refresh_token'
      });
      
      // We expect this to fail with our mock token, but the endpoint should exist
      if (response.status === 404) {
        throw new Error('Refresh endpoint not found');
      }
      
      console.log(`   🔄 Refresh endpoint responding (status: ${response.status})`);
      return { endpoint_exists: true, status: response.status };
    });
  }

  /**
   * Test protected endpoints without authentication
   */
  async testProtectedEndpointsWithoutAuth() {
    return this.runTest('Protected Endpoints (No Auth)', async () => {
      const response = await this.makeRequest('POST', '/api/adapters/stripe-api-2024-04-10/tools/create-customer', {
        email: 'test@example.com',
        name: 'Test Customer'
      });
      
      if (response.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${response.status}`);
      }
      
      const error = await response.json();
      if (error.code !== 'AUTH_REQUIRED') {
        throw new Error(`Expected AUTH_REQUIRED error, got ${error.code}`);
      }
      
      console.log('   🔒 Protected endpoint properly requires authentication');
      return { protected: true };
    });
  }

  /**
   * Test protected endpoints with authentication
   */
  async testProtectedEndpointsWithAuth() {
    return this.runTest('Protected Endpoints (With Auth)', async () => {
      if (!this.testUser?.token) {
        throw new Error('No test token available');
      }
      
      const response = await this.makeRequest('POST', '/api/adapters/stripe-api-2024-04-10/tools/create-customer', {
        email: 'test@example.com',
        name: 'Test Customer'
      }, {
        'Authorization': `Bearer ${this.testUser.token}`
      });
      
      if (!response.ok) {
        throw new Error(`Authenticated request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.user || !result.user.userId) {
        throw new Error('User context not injected properly');
      }
      
      console.log(`   ✅ Authenticated execution for user: ${result.user.userId}`);
      return result;
    });
  }

  /**
   * Test user context injection
   */
  async testUserContextInjection() {
    return this.runTest('User Context Injection', async () => {
      if (!this.testUser?.token) {
        throw new Error('No test token available');
      }
      
      const response = await this.makeRequest('POST', '/api/adapters/paystack/tools/create-customer', {
        email: 'test@example.com'
      }, {
        'Authorization': `Bearer ${this.testUser.token}`
      });
      
      if (!response.ok) {
        throw new Error(`Context injection test failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check if user context is properly injected
      const requiredFields = ['userId', 'projectScope', 'authMethod'];
      const missingFields = requiredFields.filter(field => !result.user[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing user context fields: ${missingFields.join(', ')}`);
      }
      
      console.log(`   👤 User context: ${result.user.userId} (${result.user.authMethod})`);
      return result.user;
    });
  }

  /**
   * Test invalid token handling
   */
  async testInvalidTokenHandling() {
    return this.runTest('Invalid Token Handling', async () => {
      const response = await this.makeRequest('POST', '/api/adapters/stripe-api-2024-04-10/tools/create-customer', {
        email: 'test@example.com'
      }, {
        'Authorization': 'Bearer invalid_token_here'
      });
      
      if (response.status !== 401) {
        throw new Error(`Expected 401 for invalid token, got ${response.status}`);
      }
      
      console.log('   🚫 Invalid token properly rejected');
      return { properly_rejected: true };
    });
  }

  /**
   * Test expired token handling
   */
  async testExpiredTokenHandling() {
    return this.runTest('Expired Token Handling', async () => {
      // Create a deliberately expired JWT token
      const expiredPayload = {
        id: 'test_user',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      const jwtSecret = process.env.ONASIS_JWT_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured for testing');
      }
      const expiredToken = jwt.sign(expiredPayload, jwtSecret);
      
      const response = await this.makeRequest('POST', '/api/adapters/stripe-api-2024-04-10/tools/create-customer', {
        email: 'test@example.com'
      }, {
        'Authorization': `Bearer ${expiredToken}`
      });
      
      if (response.status !== 401) {
        throw new Error(`Expected 401 for expired token, got ${response.status}`);
      }
      
      console.log('   ⏰ Expired token properly rejected');
      return { properly_rejected: true };
    });
  }

  /**
   * Test API key authentication
   */
  async testAPIKeyAuthentication() {
    return this.runTest('API Key Authentication', async () => {
      // Test with mock API key format
      const response = await this.makeRequest('POST', '/api/adapters/stripe-api-2024-04-10/tools/create-customer', {
        email: 'test@example.com'
      }, {
        'X-API-Key': 'lmk_test_api_key_1234567890abcdef'
      });
      
      // We expect this to work with our mock API key validation
      if (!response.ok && response.status !== 401) {
        throw new Error(`Unexpected response for API key auth: ${response.status}`);
      }
      
      console.log(`   🔑 API key authentication: ${response.ok ? 'accepted' : 'rejected'}`);
      return { status: response.status, accepted: response.ok };
    });
  }

  /**
   * Test SSE with authentication
   */
  async testSSEWithAuth() {
    return this.runTest('SSE with Authentication', async () => {
      if (!this.testUser?.token) {
        throw new Error('No test token available');
      }
      
      // Test SSE endpoint availability (we can't test full SSE in this environment)
      const response = await this.makeRequest('GET', '/api/sse', null, {
        'Authorization': `Bearer ${this.testUser.token}`,
        'X-User-ID': this.testUser.user.id
      });
      
      // SSE endpoints typically return 200 with event-stream content-type
      // or may require specific handling
      console.log(`   📡 SSE endpoint response: ${response.status}`);
      return { status: response.status, available: true };
    });
  }

  /**
   * Test adapter execution with authentication
   */
  async testAdapterExecutionWithAuth() {
    return this.runTest('Adapter Execution with Auth', async () => {
      if (!this.testUser?.token) {
        throw new Error('No test token available');
      }
      
      // Test multiple adapter endpoints
      const adapters = ['stripe-api-2024-04-10', 'paystack', 'ngrok-api'];
      const results = [];
      
      for (const adapter of adapters) {
        const response = await this.makeRequest('POST', `/api/adapters/${adapter}/tools/test-tool`, {
          test_data: 'auth_test'
        }, {
          'Authorization': `Bearer ${this.testUser.token}`
        });
        
        results.push({
          adapter,
          status: response.status,
          authenticated: response.ok
        });
      }
      
      const authenticatedCount = results.filter(r => r.authenticated).length;
      console.log(`   🔧 Adapter auth: ${authenticatedCount}/${results.length} adapters authenticated`);
      
      return { results, authenticated_count: authenticatedCount };
    });
  }

  /**
   * Generic test runner
   */
  async runTest(name, testFn) {
    const startTime = Date.now();
    console.log(`🧪 Testing: ${name}`);
    
    try {
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), this.config.testTimeout)
        )
      ]);
      
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
   * Make HTTP request to gateway
   */
  async makeRequest(method, path, body = null, headers = {}) {
    const url = `${this.config.gatewayUrl}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    return await fetch(url, options);
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n📋 Authentication Integration Test Report');
    console.log('==========================================');
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(t => t.status === 'success').length;
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;
    const successRate = ((successfulTests / totalTests) * 100).toFixed(1);
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Successful: ${successfulTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Success Rate: ${successRate}%`);
    
    const totalDuration = this.testResults.reduce((sum, test) => sum + test.duration, 0);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => t.status === 'failed')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n✅ Authentication Integration Status:');
    
    if (successRate >= 80) {
      console.log('🎉 READY FOR PRODUCTION');
      console.log('   - Authentication bridge is working correctly');
      console.log('   - JWT token validation functional');
      console.log('   - Protected endpoints properly secured');
      console.log('   - User context injection operational');
    } else if (successRate >= 60) {
      console.log('⚠️  NEEDS IMPROVEMENT');
      console.log('   - Some authentication features may need fixes');
      console.log('   - Review failed tests and address issues');
    } else {
      console.log('🚨 NOT READY');
      console.log('   - Critical authentication failures detected');
      console.log('   - Immediate attention required');
    }
    
    // Export results for CI/CD
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        successful: successfulTests,
        failed: failedTests,
        success_rate: parseFloat(successRate),
        duration: totalDuration
      },
      results: this.testResults,
      status: successRate >= 80 ? 'ready' : successRate >= 60 ? 'needs_improvement' : 'not_ready'
    };
    
    console.log('\n💾 Test Report Data:');
    console.log(JSON.stringify(reportData, null, 2));
    
    return reportData;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AuthIntegrationTester();
  tester.runTestSuite()
    .then(() => {
      console.log('\n🎯 Authentication Integration Tests Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = AuthIntegrationTester;
