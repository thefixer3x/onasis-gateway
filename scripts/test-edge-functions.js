#!/usr/bin/env node

/**
 * Test script for standardized Edge Functions
 * Tests all deployed payment Edge Functions
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not set');
  console.error('   Set it with: export SUPABASE_URL="https://your-project-ref.supabase.co"');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY not set');
  console.error('   Set it with: export SUPABASE_ANON_KEY="your-anon-key"');
  process.exit(1);
}

/**
 * Call Edge Function
 */
async function callEdgeFunction(functionName, action, params = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      ...params,
    }),
  });

  const data = await response.json();

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

/**
 * Test a function
 */
async function testFunction(functionName, action, params = {}, expectSuccess = true) {
  process.stdout.write(`  Testing ${functionName}:${action}... `);

  try {
    const result = await callEdgeFunction(functionName, action, params);

    if (result.ok && result.data.success) {
      console.log('✅ PASS');
      return true;
    } else if (!expectSuccess && !result.ok) {
      console.log('✅ PASS (expected failure)');
      return true;
    } else {
      console.log('❌ FAIL');
      console.log(`    Status: ${result.status}`);
      console.log(`    Response:`, JSON.stringify(result.data, null, 2).split('\n').map(l => '    ' + l).join('\n'));
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`    ${error.message}`);
    return false;
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('========================================');
  console.log('Edge Functions Test Suite');
  console.log('========================================\n');

  const results = {
    passed: 0,
    failed: 0,
  };

  // Paystack Tests
  console.log('🟡 Paystack Edge Function');
  if (await testFunction('paystack', 'paystack_health_check')) results.passed++; else results.failed++;
  if (await testFunction('paystack', 'list_banks', { country: 'nigeria' })) results.passed++; else results.failed++;
  console.log('');

  // Stripe Tests
  console.log('🔵 Stripe Edge Function');
  if (await testFunction('stripe', 'stripe_health_check')) results.passed++; else results.failed++;
  if (await testFunction('stripe', 'get_api_key')) results.passed++; else results.failed++;
  console.log('');

  // Flutterwave Tests
  console.log('🟠 Flutterwave Edge Function');
  if (await testFunction('flutterwave', 'flutterwave_health_check')) results.passed++; else results.failed++;
  if (await testFunction('flutterwave', 'list_banks', { country: 'NG' })) results.passed++; else results.failed++;
  console.log('');

  // SaySwitch Tests
  console.log('🟢 SaySwitch Edge Function');
  if (await testFunction('sayswitch', 'sayswitch_health_check')) results.passed++; else results.failed++;
  if (await testFunction('sayswitch', 'list_banks')) results.passed++; else results.failed++;
  console.log('');

  // Results
  console.log('========================================');
  console.log('Test Results');
  console.log('========================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);
  console.log('');

  if (results.failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
