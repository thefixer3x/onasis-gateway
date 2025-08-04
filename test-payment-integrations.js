#!/usr/bin/env node

/**
 * Test script for Paystack and SaySwitch integrations via Onasis Gateway
 * Using ngrok tunnel: https://f525e96e43e2.ngrok-free.app
 */

const axios = require('axios');

// Configuration
const NGROK_URL = 'https://f525e96e43e2.ngrok-free.app';
const LOCAL_URL = 'http://127.0.0.1:8080';
const API_KEY = 'test-key'; // Replace with your actual API key
const WEBHOOK_URL = `${NGROK_URL}/webhook`;
const CALLBACK_URL = `${NGROK_URL}/callback`;

// Test data
const testTransaction = {
  email: 'test@example.com',
  amount: 100000, // 1000 NGN in kobo
  currency: 'NGN',
  reference: `test_${Date.now()}`,
  callback_url: CALLBACK_URL
};

const testCustomer = {
  email: 'customer@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+2348123456789'
};

async function testGatewayHealth() {
  console.log('\n🔍 Testing Gateway Health...');
  try {
    const response = await axios.get(`${LOCAL_URL}/health`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    console.log('✅ Gateway Health:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Gateway Health Failed:', error.message);
    return false;
  }
}

async function testListAdapters() {
  console.log('\n📋 Testing List Adapters...');
  try {
    const response = await axios.get(`${LOCAL_URL}/adapters`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    console.log('✅ Available Adapters:', response.data.adapters?.length || 0);
    
    // Check for Paystack and SaySwitch
    const adapters = response.data.adapters || [];
    const paystack = adapters.find(a => a.name === 'paystack-api');
    const sayswitch = adapters.find(a => a.name === 'sayswitch-api-integration');
    
    console.log('💳 Paystack Adapter:', paystack ? '✅ Found' : '❌ Missing');
    console.log('🔄 SaySwitch Adapter:', sayswitch ? '✅ Found' : '❌ Missing');
    
    return { paystack: !!paystack, sayswitch: !!sayswitch };
  } catch (error) {
    console.error('❌ List Adapters Failed:', error.message);
    return { paystack: false, sayswitch: false };
  }
}

async function testPaystackIntegration() {
  console.log('\n💳 Testing Paystack Integration...');
  
  try {
    // Test transaction initialization
    console.log('  📤 Initializing transaction...');
    const initResponse = await axios.post(`${LOCAL_URL}/execute/paystack-api/initialize-transaction`, testTransaction, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('  ✅ Transaction initialized:', initResponse.data);
    
    // Test customer creation
    console.log('  👤 Creating customer...');
    const customerResponse = await axios.post(`${LOCAL_URL}/execute/paystack-api/create-customer`, testCustomer, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('  ✅ Customer created:', customerResponse.data);
    
    // Test transaction verification (will likely fail since it's a test)
    console.log('  🔍 Verifying transaction...');
    try {
      const verifyResponse = await axios.post(`${LOCAL_URL}/execute/paystack-api/verify-transaction`, {
        reference: testTransaction.reference
      }, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      console.log('  ✅ Transaction verified:', verifyResponse.data);
    } catch (verifyError) {
      console.log('  ⚠️  Transaction verification (expected for test):', verifyError.response?.data || verifyError.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Paystack Integration Failed:', error.response?.data || error.message);
    return false;
  }
}

async function testSaySwitchIntegration() {
  console.log('\n🔄 Testing SaySwitch Integration...');
  
  try {
    // Test transaction initialization
    console.log('  📤 Initializing SaySwitch transaction...');
    const initResponse = await axios.post(`${LOCAL_URL}/execute/sayswitch-api-integration/initialize-transaction`, {
      amount: testTransaction.amount,
      email: testTransaction.email,
      callback_url: CALLBACK_URL
    }, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('  ✅ SaySwitch transaction initialized:', initResponse.data);
    
    // Test customer creation
    console.log('  👤 Creating SaySwitch customer...');
    const customerResponse = await axios.post(`${LOCAL_URL}/execute/sayswitch-api-integration/create-customer`, testCustomer, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('  ✅ SaySwitch customer created:', customerResponse.data);
    
    // Test wallet balance
    console.log('  💰 Checking wallet balance...');
    try {
      const balanceResponse = await axios.post(`${LOCAL_URL}/execute/sayswitch-api-integration/get-wallet-balance`, {}, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      console.log('  ✅ Wallet balance:', balanceResponse.data);
    } catch (balanceError) {
      console.log('  ⚠️  Wallet balance (may require auth):', balanceError.response?.data || balanceError.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ SaySwitch Integration Failed:', error.response?.data || error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('\n🔗 Testing Webhook Endpoint...');
  
  try {
    // Test webhook endpoint accessibility
    const webhookTest = await axios.post(`${NGROK_URL}/webhook`, {
      event: 'charge.success',
      data: {
        reference: testTransaction.reference,
        amount: testTransaction.amount,
        status: 'success'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Paystack-Signature': 'test-signature'
      }
    });
    
    console.log('✅ Webhook endpoint accessible:', webhookTest.status);
    return true;
  } catch (error) {
    console.log('⚠️  Webhook endpoint:', error.response?.status || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Payment Integration Tests');
  console.log('📡 Ngrok URL:', NGROK_URL);
  console.log('🏠 Local URL:', LOCAL_URL);
  console.log('🔗 Webhook URL:', WEBHOOK_URL);
  console.log('↩️  Callback URL:', CALLBACK_URL);
  
  const results = {
    health: false,
    adapters: { paystack: false, sayswitch: false },
    paystack: false,
    sayswitch: false,
    webhook: false
  };
  
  // Run tests
  results.health = await testGatewayHealth();
  results.adapters = await testListAdapters();
  
  if (results.adapters.paystack) {
    results.paystack = await testPaystackIntegration();
  }
  
  if (results.adapters.sayswitch) {
    results.sayswitch = await testSaySwitchIntegration();
  }
  
  results.webhook = await testWebhookEndpoint();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  console.log(`🏥 Gateway Health: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Paystack Adapter: ${results.adapters.paystack ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`📋 SaySwitch Adapter: ${results.adapters.sayswitch ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`💳 Paystack Integration: ${results.paystack ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔄 SaySwitch Integration: ${results.sayswitch ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔗 Webhook Endpoint: ${results.webhook ? '✅ PASS' : '❌ FAIL'}`);
  
  const totalTests = 6;
  const passedTests = Object.values(results).filter(r => 
    typeof r === 'boolean' ? r : Object.values(r).some(v => v)
  ).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Payment integrations are ready.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Run the tests
runTests().catch(console.error);
