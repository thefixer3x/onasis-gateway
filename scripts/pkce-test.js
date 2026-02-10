#!/usr/bin/env node

/**
 * Minimal OAuth2 PKCE test script.
 * Keeps tokens local; prints only safe metadata unless PRINT_TOKENS=1.
 */

const crypto = require('crypto');
const readline = require('readline');
const fetch = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then((mod) => (mod.default || mod)(...args));

const AUTH_BASE_URL = process.env.AUTH_BASE_URL;
const AUTHORIZATION_URL = process.env.AUTHORIZATION_URL
  || (AUTH_BASE_URL ? `${AUTH_BASE_URL}/oauth/authorize` : 'http://127.0.0.1:4000/oauth/authorize');
const TOKEN_URL = process.env.TOKEN_URL
  || (AUTH_BASE_URL ? `${AUTH_BASE_URL}/oauth/token` : 'http://127.0.0.1:4000/oauth/token');

const CLIENT_ID = process.env.CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPE = process.env.SCOPE || 'openid profile email';
const AUDIENCE = process.env.AUDIENCE;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!CLIENT_ID || !REDIRECT_URI) {
  console.error('Missing CLIENT_ID or REDIRECT_URI.');
  console.error('Usage: CLIENT_ID=... REDIRECT_URI=... node scripts/pkce-test.js');
  process.exit(1);
}

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateVerifier() {
  return base64url(crypto.randomBytes(64));
}

function generateChallenge(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function buildAuthUrl({ codeChallenge, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  });

  if (AUDIENCE) {
    params.set('audience', AUDIENCE);
  }

  return `${AUTHORIZATION_URL}?${params.toString()}`;
}

function parseCodeFromInput(input) {
  try {
    if (input.includes('code=')) {
      const url = new URL(input);
      return url.searchParams.get('code');
    }
  } catch (error) {
    // fall through to treat input as raw code
  }
  return input.trim();
}

async function exchangeCode({ code, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  if (CLIENT_SECRET) {
    body.set('client_secret', CLIENT_SECRET);
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function run() {
  const codeVerifier = generateVerifier();
  const codeChallenge = generateChallenge(codeVerifier);
  const state = base64url(crypto.randomBytes(16));
  const authUrl = buildAuthUrl({ codeChallenge, state });

  console.log('Open this URL in your browser to authorize:');
  console.log(authUrl);
  console.log('');
  console.log('Paste the full redirect URL (or just the code):');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('> ', resolve));
  rl.close();

  const code = parseCodeFromInput(answer);
  if (!code) {
    throw new Error('No authorization code provided.');
  }

  const token = await exchangeCode({ code, codeVerifier });

  console.log('\nToken response summary:');
  console.log({
    token_type: token.token_type,
    expires_in: token.expires_in,
    scope: token.scope
  });

  if (token.access_token) {
    const prefix = token.access_token.slice(0, 12);
    console.log(`access_token: ${prefix}... (len=${token.access_token.length})`);
  }

  if (token.refresh_token) {
    const prefix = token.refresh_token.slice(0, 12);
    console.log(`refresh_token: ${prefix}... (len=${token.refresh_token.length})`);
  }

  if (process.env.PRINT_TOKENS === '1') {
    console.log('\nFull token payload:');
    console.log(token);
  }
}

run().catch((error) => {
  console.error('\nPKCE flow failed:', error.message);
  process.exit(1);
});
