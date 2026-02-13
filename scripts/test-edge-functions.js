#!/usr/bin/env node

/**
 * Test script for standardized Edge Functions
 * Tests all deployed payment Edge Functions
 */

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;

  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const deriveSupabaseUrlFromTokens = () => {
  const candidates = [
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ].filter(Boolean);

  for (const token of candidates) {
    const payload = decodeJwtPayload(token);
    const ref = payload && payload.ref;
    if (ref && typeof ref === 'string') {
      return `https://${ref}.supabase.co`;
    }
  }
  return null;
};

const SUPABASE_URL = process.env.SUPABASE_URL || deriveSupabaseUrlFromTokens();
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const STRIPE_SHARED_SECRET = process.env.STRIPE_SHARED_SECRET;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not set');
  console.error('   Set it with: export SUPABASE_URL="https://your-project-ref.supabase.co"');
  console.error('   Or ensure SUPABASE_ANON_KEY is set so the project ref can be derived.');
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

  const headers = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  // Stripe edge function requires an auth gate. If configured, pass the shared secret.
  if (STRIPE_SHARED_SECRET) {
    headers['X-SHARED-SECRET'] = STRIPE_SHARED_SECRET;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action,
      ...params,
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  let rawBody = null;
  let parseError = null;

  if (contentType.includes('application/json')) {
    const clone = response.clone();
    try {
      data = await response.json();
    } catch (err) {
      parseError = err;
      try {
        rawBody = await clone.text();
      } catch (_) {
        rawBody = null;
      }
    }
  } else {
    rawBody = await response.text();
    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch (err) {
      parseError = err;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    rawBody,
    parseError: parseError
      ? (parseError instanceof Error ? parseError.message : String(parseError))
      : null,
  };
}

/**
 * Test a function
 */
async function testFunction(functionName, action, params = {}, expectSuccess = true) {
  process.stdout.write(`  Testing ${functionName}:${action}... `);

  try {
    const result = await callEdgeFunction(functionName, action, params);

    const isSuccess = !!(result.ok && result.data && result.data.success === true);

    if (expectSuccess) {
      if (isSuccess) {
        console.log('✅ PASS');
        return true;
      }
    } else {
      if (!isSuccess) {
        console.log('✅ PASS (expected failure)');
        return true;
      }
    }

    console.log('❌ FAIL');
    console.log(`    Status: ${result.status}`);
    if (result.parseError) console.log(`    JSON Parse Error: ${result.parseError}`);
    if (result.rawBody) console.log(`    Raw Body: ${result.rawBody}`);
    console.log(`    Parsed:`, JSON.stringify(result.data, null, 2).split('\n').map(l => '    ' + l).join('\n'));
    return false;
  } catch (error) {
    console.log('❌ ERROR');
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ${msg}`);
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
