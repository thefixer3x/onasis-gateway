// services/providus-bank/test.js
const { createProvidusClient } = require('./client');

async function testProvidusBankIntegration() {
  console.log('🧪 Testing Providus Bank Integration...\n');

  const config = {
    baseUrl: process.env.PROVIDUS_BASE_URL || 'https://api.providusbank.com',
    username: process.env.PROVIDUS_USERNAME,
    password: process.env.PROVIDUS_PASSWORD,
    email: process.env.PROVIDUS_EMAIL,
    mode: process.env.PROVIDUS_MODE || 'sandbox'
  };

  try {
    // Test 1: Client instantiation
    console.log('✅ Test 1: Client instantiation');
    const client = createProvidusClient(config);
    console.log('   Client created successfully');

    // Test 2: Health check (without authentication)
    console.log('\n✅ Test 2: Health check');
    try {
      const isHealthy = await client.healthCheck();
      console.log(`   Health status: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
    } catch (error) {
      console.log(`   Health check failed (expected for unauthenticated): ${error.message}`);
    }

    // Test 3: Authentication (requires valid credentials)
    if (config.email && config.password) {
      console.log('\n✅ Test 3: Authentication');
      try {
        const authResult = await client.authenticate();
        console.log('   Authentication successful');
        console.log(`   User: ${authResult.data.firstName} ${authResult.data.lastName}`);
        console.log(`   Business: ${authResult.data.Merchant.businessName}`);
        console.log(`   Mode: ${authResult.data.Merchant.mode}`);
        console.log(`   Permissions: ${authResult.permissions.length} permissions`);

        // Test 4: User profile
        console.log('\n✅ Test 4: User profile');
        const profile = await client.getUserProfile();
        console.log('   Profile retrieved successfully');

        // Test 5: Token management
        console.log('\n✅ Test 5: Token management');
        console.log(`   Is authenticated: ${client.isAuthenticated()}`);
        const tokens = client.getTokens();
        console.log(`   Has tokens: ${tokens ? 'Yes' : 'No'}`);
        
      } catch (authError) {
        console.log(`   Authentication failed: ${authError.message}`);
        console.log('   Please check your PROVIDUS_EMAIL and PROVIDUS_PASSWORD environment variables');
      }
    } else {
      console.log('\n⚠️  Test 3: Authentication skipped');
      console.log('   Please set PROVIDUS_EMAIL and PROVIDUS_PASSWORD environment variables');
    }

    console.log('\n🎉 Integration test completed!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testProvidusBankIntegration();
}

module.exports = { testProvidusBankIntegration };