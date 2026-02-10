#!/usr/bin/env node

/**
 * Preflight Environment Check
 *
 * Validates environment variables and service connectivity
 * before the gateway starts. Run with: npm run preflight
 *
 * Exit code 0 = all required checks pass
 * Exit code 1 = one or more required checks failed
 */

const http = require('http');
const https = require('https');
const path = require('path');

// Load .env if present
try {
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
    // dotenv not required for preflight
}

const results = [];

function pass(label) {
    results.push({ label, status: 'PASS' });
    console.log(`  [PASS] ${label}`);
}

function fail(label, detail) {
    results.push({ label, status: 'FAIL', detail });
    console.log(`  [FAIL] ${label} -- ${detail}`);
}

function warn(label, detail) {
    results.push({ label, status: 'WARN', detail });
    console.log(`  [WARN] ${label} -- ${detail}`);
}

/**
 * Make a simple HTTP(S) GET request with timeout
 */
function httpGet(url, headers = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { headers, timeout: timeoutMs }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({ status: res.statusCode, body, headers: res.headers });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        });
    });
}

/**
 * Make a simple HTTP(S) POST request with timeout
 */
function httpPost(url, data, headers = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const mod = parsedUrl.protocol === 'https:' ? https : http;
        const payload = JSON.stringify(data);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...headers
            },
            timeout: timeoutMs
        };

        const req = mod.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({ status: res.statusCode, body, headers: res.headers });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        });
        req.write(payload);
        req.end();
    });
}

async function checkEnvVars() {
    console.log('\n--- Environment Variables ---');

    // Required
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl) {
        pass('SUPABASE_URL is set');
    } else {
        fail('SUPABASE_URL is set', 'Missing. Gateway cannot reach Edge Functions without it.');
    }

    if (supabaseAnonKey) {
        pass('SUPABASE_ANON_KEY is set');
    } else {
        fail('SUPABASE_ANON_KEY is set', 'Missing. Gateway cannot authenticate with Supabase without it.');
    }

    // Warnings
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        pass('SUPABASE_SERVICE_ROLE_KEY is set');
    } else {
        warn('SUPABASE_SERVICE_ROLE_KEY is set', 'Missing. Admin/system operations will not work.');
    }

    if (process.env.AUTH_GATEWAY_URL) {
        pass('AUTH_GATEWAY_URL is set');
    } else {
        warn('AUTH_GATEWAY_URL is set', 'Missing. Auth delegation will fall back to http://127.0.0.1:4000/v1/auth');
    }
}

async function checkSupabaseConnectivity() {
    console.log('\n--- Supabase Connectivity ---');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        fail('Supabase connectivity', 'Skipped -- SUPABASE_URL or SUPABASE_ANON_KEY not set');
        return;
    }

    // Test system-health endpoint
    const healthUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/system-health`;
    try {
        const res = await httpGet(healthUrl, {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        });
        if (res.status >= 200 && res.status < 400) {
            pass(`GET system-health returned ${res.status}`);
        } else {
            fail(`GET system-health`, `Returned ${res.status}: ${res.body.substring(0, 200)}`);
        }
    } catch (err) {
        fail('GET system-health', err.message);
    }

    // Test memory-search endpoint (POST with minimal payload)
    const searchUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/memory-search`;
    try {
        const res = await httpPost(searchUrl, { query: 'preflight-test', limit: 1 }, {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        });
        if (res.status >= 200 && res.status < 500) {
            pass(`POST memory-search returned ${res.status}`);
        } else {
            fail('POST memory-search', `Returned ${res.status}: ${res.body.substring(0, 200)}`);
        }
    } catch (err) {
        fail('POST memory-search', err.message);
    }
}

async function checkAuthGateway() {
    console.log('\n--- Auth Gateway ---');

    const authUrl = process.env.AUTH_GATEWAY_URL;
    if (!authUrl) {
        warn('Auth Gateway connectivity', 'AUTH_GATEWAY_URL not set, skipping');
        return;
    }

    // Normalize: strip trailing /v1/auth or /v1 to get base
    const base = authUrl.replace(/\/+$/, '').replace(/\/v1\/auth$/, '').replace(/\/v1$/, '');

    // Health check
    try {
        const res = await httpGet(`${base}/health`);
        if (res.status >= 200 && res.status < 400) {
            pass(`Auth Gateway health returned ${res.status}`);
        } else {
            fail('Auth Gateway health', `Returned ${res.status}`);
        }
    } catch (err) {
        fail('Auth Gateway health', err.message);
    }
}

async function checkDirectoryStructure() {
    console.log('\n--- Directory Structure ---');
    const fs = require('fs');
    const base = path.resolve(__dirname, '..');

    const requiredDirs = [
        'services/auth-gateway',
        'services/ai-router',
        'services/security-service',
        'services/intelligence-api'
    ];

    for (const dir of requiredDirs) {
        const fullPath = path.join(base, dir);
        if (fs.existsSync(fullPath)) {
            pass(`${dir}/ exists`);
        } else {
            fail(`${dir}/ exists`, 'Directory missing');
        }
    }
}

async function main() {
    console.log('=== Onasis Gateway Preflight Check ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Node: ${process.version}`);

    await checkEnvVars();
    await checkDirectoryStructure();
    await checkSupabaseConnectivity();
    await checkAuthGateway();

    // Summary
    console.log('\n=== Summary ===');
    const passes = results.filter(r => r.status === 'PASS').length;
    const fails = results.filter(r => r.status === 'FAIL').length;
    const warns = results.filter(r => r.status === 'WARN').length;

    console.log(`  PASS: ${passes}  |  FAIL: ${fails}  |  WARN: ${warns}`);

    if (fails > 0) {
        console.log('\nPreflight FAILED. Fix the above issues before starting the gateway.\n');
        process.exit(1);
    } else {
        console.log('\nPreflight PASSED. Gateway is ready to start.\n');
        process.exit(0);
    }
}

main().catch((err) => {
    console.error('Preflight script error:', err);
    process.exit(1);
});
