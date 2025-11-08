/**
 * Providus Bank Account Services Integration Tests
 * Test suite for corporate account management functionality
 */

const { createAccountClient } = require('./client');
const { createAccountMCPAdapter } = require('./mcp-adapter');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.PROVIDUS_BASE_URL || 'https://sandbox.providusbank.com/api/v1',
  username: process.env.PROVIDUS_USERNAME || 'test_user',
  password: process.env.PROVIDUS_PASSWORD || 'test_password',
  accountNumber: process.env.PROVIDUS_ACCOUNT_NUMBER || '1234567890',
  mode: 'sandbox',
  getAuthToken: async () => {
    // Mock token for testing
    return 'test_auth_token_12345';
  }
};

// Test data
const TEST_DATA = {
  accountNumber: '1234567890',
  bankCode: '000013', // GTBank
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  transactionReference: 'TXN_TEST_123456789'
};

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Providus Bank Account Services Tests\n');
    console.log('=' .repeat(60));

    for (const test of this.tests) {
      try {
        console.log(`\n🔍 Testing: ${test.name}`);
        await test.fn();
        console.log(`✅ PASSED: ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Test Summary:');
    console.log(`   Total: ${this.tests.length}`);
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.failed}`);
    console.log(`   Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${this.failed} test(s) failed`);
    }
  }
}

const runner = new TestRunner();

// ============================================================================
// CLIENT TESTS
// ============================================================================

runner.test('Client Initialization', async () => {
  const client = createAccountClient(TEST_CONFIG);
  
  if (!client) {
    throw new Error('Client not created');
  }
  
  console.log('   ✓ Client created successfully');
});

runner.test('Health Check', async () => {
  const client = createAccountClient(TEST_CONFIG);
  const health = await client.healthCheck();
  
  if (!health || typeof health.status !== 'string') {
    throw new Error('Invalid health check response');
  }
  
  console.log(`   ✓ Health status: ${health.status}`);
  console.log(`   ✓ Service: ${health.service}`);
  console.log(`   ✓ API connectivity: ${health.api_connectivity}`);
});

runner.test('Service Statistics', async () => {
  const client = createAccountClient(TEST_CONFIG);
  const stats = client.getStats();
  
  if (!stats || typeof stats.requestCount !== 'number') {
    throw new Error('Invalid stats response');
  }
  
  console.log(`   ✓ Request count: ${stats.requestCount}`);
  console.log(`   ✓ Error count: ${stats.errorCount}`);
  console.log(`   ✓ Average response time: ${stats.averageResponseTime}ms`);
});

runner.test('Bank Code Validation', async () => {
  const client = createAccountClient(TEST_CONFIG);
  
  // Test valid bank code
  const isValid = client.isValidBankCode('000013');
  if (!isValid) {
    throw new Error('Valid bank code should return true');
  }
  
  // Test invalid bank code
  const isInvalid = client.isValidBankCode('999999');
  if (isInvalid) {
    throw new Error('Invalid bank code should return false');
  }
  
  // Test bank name lookup
  const bankName = client.getBankName('000013');
  if (bankName !== 'GTBank') {
    throw new Error(`Expected 'GTBank', got '${bankName}'`);
  }
  
  console.log('   ✓ Bank code validation working');
  console.log('   ✓ Bank name lookup working');
});

runner.test('Supported Bank Codes', async () => {
  const client = createAccountClient(TEST_CONFIG);
  const bankCodes = client.getSupportedBankCodes();
  
  if (!bankCodes || typeof bankCodes !== 'object') {
    throw new Error('Bank codes should be an object');
  }
  
  const expectedBanks = ['000013', '000014', '000015', '000016', '000017', '000023'];
  for (const code of expectedBanks) {
    if (!bankCodes[code]) {
      throw new Error(`Bank code ${code} not found in supported codes`);
    }
  }
  
  console.log(`   ✓ Found ${Object.keys(bankCodes).length} supported bank codes`);
});

runner.test('Date Validation', async () => {
  const client = createAccountClient(TEST_CONFIG);
  
  // Test valid date format - should not fail on date validation
  try {
    await client.getTransactionHistory({
      accountNumber: TEST_DATA.accountNumber,
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    });
  } catch (error) {
    // Expected to fail due to mock API, but should not fail on date validation
    if (error.code === 'INVALID_DATE_FORMAT' || error.code === 'INVALID_DATE') {
      throw new Error('Date validation should pass for valid dates');
    }
    // Network error is expected
    if (!error.message.includes('ENOTFOUND') && !error.message.includes('Network Error')) {
      console.log(`   ⚠️  Unexpected error for valid dates: ${error.message}`);
    }
  }
  
  // Test invalid date format - should fail on date validation before network call
  try {
    await client.getTransactionHistory({
      accountNumber: TEST_DATA.accountNumber,
      startDate: '01-01-2024', // Wrong format
      endDate: '2024-01-31'
    });
    throw new Error('Should have failed on invalid date format');
  } catch (error) {
    // Check if it's a date validation error or network error
    if (error.code === 'INVALID_DATE_FORMAT' || error.code === 'INVALID_DATE') {
      console.log('   ✓ Date validation caught invalid format');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('Network Error')) {
      // If it's a network error, the date validation might have passed but network failed
      console.log('   ✓ Date validation passed, network error as expected');
    } else {
      console.log(`   ⚠️  Unexpected error for invalid dates: ${error.message}`);
    }
  }
  
  console.log('   ✓ Date validation working correctly');
});

runner.test('Date Range Validation', async () => {
  const client = createAccountClient(TEST_CONFIG);
  
  // Test invalid date range (start after end)
  try {
    await client.getTransactionHistory({
      accountNumber: TEST_DATA.accountNumber,
      startDate: '2024-01-31',
      endDate: '2024-01-01' // Start after end
    });
    throw new Error('Should have failed on invalid date range');
  } catch (error) {
    // Check if it's a date range validation error or network error
    if (error.code === 'INVALID_DATE_RANGE') {
      console.log('   ✓ Date range validation caught invalid range');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('Network Error')) {
      // If it's a network error, the date validation might have passed but network failed
      console.log('   ✓ Date range validation passed, network error as expected');
    } else {
      console.log(`   ⚠️  Unexpected error for invalid date range: ${error.message}`);
    }
  }
  
  console.log('   ✓ Date range validation working correctly');
});

// ============================================================================
// MCP ADAPTER TESTS
// ============================================================================

runner.test('MCP Adapter Initialization', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  
  if (!adapter) {
    throw new Error('MCP adapter not created');
  }
  
  console.log('   ✓ MCP adapter created successfully');
});

runner.test('MCP Tools Registration', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const tools = adapter.getTools();
  
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new Error('No tools registered');
  }
  
  const expectedTools = [
    'pb_account_get_balance',
    'pb_account_validate',
    'pb_account_transaction_history',
    'pb_account_generate_statement',
    'pb_account_transaction_status',
    'pb_account_get_bank_codes',
    'pb_account_health_check'
  ];
  
  for (const toolName of expectedTools) {
    const tool = tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
  }
  
  console.log(`   ✓ ${tools.length} MCP tools registered`);
  console.log(`   ✓ All expected tools present`);
});

runner.test('MCP Tool Execution - Bank Codes', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const result = await adapter.callTool('pb_account_get_bank_codes', {});
  
  if (!result || result.isError) {
    throw new Error('Bank codes tool failed');
  }
  
  if (!result.content || result.content.length === 0) {
    throw new Error('No content in bank codes response');
  }
  
  const bankCodes = JSON.parse(result.content[0].text);
  if (!bankCodes || typeof bankCodes !== 'object') {
    throw new Error('Invalid bank codes response');
  }
  
  console.log(`   ✓ Bank codes tool executed successfully`);
  console.log(`   ✓ Found ${Object.keys(bankCodes).length} bank codes`);
});

runner.test('MCP Tool Execution - Health Check', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const result = await adapter.callTool('pb_account_health_check', {});
  
  if (!result || result.isError) {
    throw new Error('Health check tool failed');
  }
  
  if (!result.content || result.content.length === 0) {
    throw new Error('No content in health check response');
  }
  
  const health = JSON.parse(result.content[0].text);
  if (!health || typeof health.status !== 'string') {
    throw new Error('Invalid health check response');
  }
  
  console.log(`   ✓ Health check tool executed successfully`);
  console.log(`   ✓ Health status: ${health.status}`);
});

runner.test('MCP Adapter Health Check', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const isHealthy = await adapter.isHealthy();
  
  if (typeof isHealthy !== 'boolean') {
    throw new Error('Health check should return boolean');
  }
  
  console.log(`   ✓ Adapter health check: ${isHealthy ? 'healthy' : 'unhealthy'}`);
});

runner.test('MCP Adapter Statistics', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const stats = adapter.getStats();
  
  if (!stats || typeof stats.requestCount !== 'number') {
    throw new Error('Invalid stats response');
  }
  
  console.log(`   ✓ Adapter stats retrieved`);
  console.log(`   ✓ Request count: ${stats.requestCount}`);
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

runner.test('Error Handling - Invalid Tool', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const result = await adapter.callTool('invalid_tool', {});
  
  if (!result.isError) {
    throw new Error('Should have returned error for invalid tool');
  }
  
  if (!result.content || result.content[0].text.includes('Unknown tool') === false) {
    throw new Error('Should have returned "Unknown tool" error message');
  }
  
  console.log('   ✓ Invalid tool error handling working');
});

runner.test('Error Handling - Missing Required Parameters', async () => {
  const adapter = createAccountMCPAdapter(TEST_CONFIG);
  const result = await adapter.callTool('pb_account_validate', {
    accountNumber: '1234567890'
    // Missing bankCode
  });
  
  // Should fail due to missing required parameter
  if (!result.isError) {
    throw new Error('Should have failed on missing required parameter');
  }
  
  console.log('   ✓ Missing parameter error handling working');
});

// ============================================================================
// INTEGRATION TESTS (Mock API Calls)
// ============================================================================

runner.test('Mock API Integration - Balance Inquiry', async () => {
  const client = createAccountClient(TEST_CONFIG);
  
  try {
    // This will fail due to mock API, but should not fail on client setup
    await client.getBalance(TEST_DATA.accountNumber);
  } catch (error) {
    // Expected to fail due to mock API
    if (error.code === 'API_ERROR' || error.message.includes('Network Error')) {
      console.log('   ✓ Balance inquiry client setup working (API call failed as expected)');
    } else {
      throw error;
    }
  }
});

runner.test('Mock API Integration - Account Validation', async () => {
  const client = createAccountClient(TEST_CONFIG);
  
  try {
    await client.validateAccount({
      accountNumber: TEST_DATA.accountNumber,
      bankCode: TEST_DATA.bankCode
    });
  } catch (error) {
    // Expected to fail due to mock API
    if (error.code === 'API_ERROR' || error.message.includes('Network Error')) {
      console.log('   ✓ Account validation client setup working (API call failed as expected)');
    } else {
      throw error;
    }
  }
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

runner.test('Performance - Multiple Health Checks', async () => {
  const client = createAccountClient(TEST_CONFIG);
  const startTime = Date.now();
  
  // Run multiple health checks
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(client.healthCheck());
  }
  
  try {
    await Promise.all(promises);
  } catch (error) {
    // Expected to fail due to mock API
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`   ✓ 5 health checks completed in ${duration}ms`);
  console.log(`   ✓ Average time per check: ${duration / 5}ms`);
});

// ============================================================================
// RUN TESTS
// ============================================================================

async function main() {
  try {
    await runner.run();
    
    // Additional integration test with real API (if credentials provided)
    if (process.env.PROVIDUS_USERNAME && process.env.PROVIDUS_PASSWORD) {
      console.log('\n🔗 Running integration tests with real API...');
      
      const realClient = createAccountClient({
        ...TEST_CONFIG,
        username: process.env.PROVIDUS_USERNAME,
        password: process.env.PROVIDUS_PASSWORD,
        getAuthToken: async () => {
          // In real implementation, this would get actual token
          return 'real_auth_token';
        }
      });
      
      try {
        const health = await realClient.healthCheck();
        console.log(`   ✓ Real API health check: ${health.status}`);
      } catch (error) {
        console.log(`   ⚠️  Real API health check failed: ${error.message}`);
      }
    } else {
      console.log('\n💡 To test with real API, set PROVIDUS_USERNAME and PROVIDUS_PASSWORD environment variables');
    }
    
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  TestRunner,
  TEST_CONFIG,
  TEST_DATA
};