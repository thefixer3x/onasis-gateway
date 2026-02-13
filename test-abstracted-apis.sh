#!/usr/bin/env bash

# Smoke tests for abstracted API endpoints.
# Source of truth: core/abstraction/vendor-abstraction.js

set -u

BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-3000}}"
API_KEY="${API_KEY:-test-key}"
INCLUDE_NEGATIVE_TESTS="${INCLUDE_NEGATIVE_TESTS:-1}"

PASSED=0
FAILED=0

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_command curl
require_command jq

request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"

  local url="${BASE_URL}${path}"
  local headers=(
    -H "Content-Type: application/json"
    -H "X-Request-ID: abstracted-$(date +%s)-$RANDOM"
  )

  if [[ -n "${API_KEY}" ]]; then
    headers+=(-H "X-API-Key: ${API_KEY}")
  fi

  if [[ -n "${payload}" ]]; then
    curl -sS -X "${method}" "${url}" "${headers[@]}" -d "${payload}" -w '\n__STATUS__:%{http_code}'
  else
    curl -sS -X "${method}" "${url}" "${headers[@]}" -w '\n__STATUS__:%{http_code}'
  fi
}

run_case() {
  local name="$1"
  local method="$2"
  local path="$3"
  local payload="${4:-}"
  local expected="${5:-2xx}" # 2xx | 4xx

  echo ""
  echo "=== ${name} ==="
  echo "${method} ${path}"

  local raw
  raw="$(request "${method}" "${path}" "${payload}")"

  local status
  status="$(echo "${raw}" | sed -n 's/^__STATUS__://p')"
  local body
  body="$(echo "${raw}" | sed '/^__STATUS__:/d')"

  echo "HTTP ${status}"
  if echo "${body}" | jq '.' >/dev/null 2>&1; then
    echo "${body}" | jq '.'
  else
    echo "${body}"
  fi

  local ok=0
  if [[ "${expected}" == "2xx" && "${status}" =~ ^2 ]]; then
    ok=1
  fi
  if [[ "${expected}" == "4xx" && "${status}" =~ ^4 ]]; then
    ok=1
  fi

  if [[ "${ok}" -eq 1 ]]; then
    echo "Result: PASS"
    PASSED=$((PASSED + 1))
  else
    echo "Result: FAIL (expected ${expected})"
    FAILED=$((FAILED + 1))
  fi
}

echo "Abstracted API smoke test"
echo "BASE_URL=${BASE_URL}"
echo "INCLUDE_NEGATIVE_TESTS=${INCLUDE_NEGATIVE_TESTS}"

# Health and discovery
run_case "Health check" "GET" "/health"
run_case "List categories" "GET" "/api/v1/categories"
run_case "Payment category info" "GET" "/api/v1/categories/payment"
run_case "Banking category info" "GET" "/api/v1/categories/banking"
run_case "Infrastructure category info" "GET" "/api/v1/categories/infrastructure"

# Schema checks from vendor-abstraction.js
run_case "Payment schema: initializeTransaction" "GET" "/api/v1/categories/payment/schema/initializeTransaction"
run_case "Payment schema: verifyTransaction" "GET" "/api/v1/categories/payment/schema/verifyTransaction"
run_case "Payment schema: createCustomer" "GET" "/api/v1/categories/payment/schema/createCustomer"
run_case "Banking schema: verifyAccount" "GET" "/api/v1/categories/banking/schema/verifyAccount"
run_case "Infrastructure schema: createTunnel" "GET" "/api/v1/categories/infrastructure/schema/createTunnel"

# Canonical generic endpoint checks (matches deployed route precedence)
run_case "Payment initializeTransaction (paystack)" "POST" "/api/v1/payment/initializeTransaction" '{
  "vendor": "paystack",
  "amount": 5000,
  "currency": "NGN",
  "email": "test@example.com",
  "metadata": { "test": true, "source": "abstracted-api" }
}'

run_case "Payment initializeTransaction (flutterwave)" "POST" "/api/v1/payment/initializeTransaction" '{
  "vendor": "flutterwave",
  "amount": 5000,
  "currency": "NGN",
  "email": "test@example.com",
  "metadata": { "test": true, "source": "abstracted-api" }
}'

run_case "Payment initializeTransaction (sayswitch)" "POST" "/api/v1/payment/initializeTransaction" '{
  "vendor": "sayswitch",
  "amount": 5000,
  "currency": "NGN",
  "email": "test@example.com",
  "metadata": { "test": true, "source": "abstracted-api" }
}'

run_case "Payment verifyTransaction (paystack)" "POST" "/api/v1/payment/verifyTransaction" '{
  "vendor": "paystack",
  "reference": "test-ref-001"
}'

run_case "Payment createCustomer (sayswitch)" "POST" "/api/v1/payment/createCustomer" '{
  "vendor": "sayswitch",
  "email": "customer@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+2348087654321"
}'

# Generic category/operation endpoint
run_case "Generic payment initializeTransaction" "POST" "/api/v1/payment/initializeTransaction" '{
  "vendor": "paystack",
  "amount": 2500,
  "currency": "NGN",
  "email": "generic@example.com"
}'

# Banking and infrastructure abstractions
run_case "Banking verifyAccount (bap)" "POST" "/api/v1/banking/verifyAccount" '{
  "vendor": "bap",
  "accountNumber": "0123456789",
  "bankCode": "044"
}'

run_case "Banking getAccountBalance (wise)" "POST" "/api/v1/banking/getAccountBalance" '{
  "vendor": "wise",
  "accountId": "acct_demo_001"
}'

run_case "Infrastructure createTunnel (ngrok)" "POST" "/api/v1/infrastructure/createTunnel" '{
  "vendor": "ngrok",
  "port": 3000,
  "subdomain": "test-app",
  "region": "us"
}'

run_case "Infrastructure list tunnels (ngrok)" "GET" "/api/v1/infrastructure/tunnels?vendor=ngrok"

# Current abstraction behavior: unsupported vendor preference falls back to default vendor.
if [[ "${INCLUDE_NEGATIVE_TESTS}" == "1" ]]; then
  run_case "Payment initializeTransaction with vendor=stripe (falls back to default vendor)" "POST" "/api/v1/payment/initializeTransaction" '{
    "vendor": "stripe",
    "amount": 5000,
    "currency": "NGN",
    "email": "test@example.com"
  }' "2xx"
fi

# Internal service tests
run_case "Auth service: get session info" "POST" "/api/v1/auth/get-session" '{}'
run_case "Auth service: verify token" "POST" "/api/v1/auth/verify-token" '{"token": "test-token"}'
run_case "Auth service: list API keys" "POST" "/api/v1/auth/list-api-keys" '{}'

run_case "AI service: chat completion" "POST" "/api/v1/ai/chat" '{
  "messages": [{"role": "user", "content": "Hello, how are you?"}]
}'
run_case "AI service: health check" "POST" "/api/v1/ai/health" '{}'

run_case "Memory service: create memory" "POST" "/api/v1/memory/create" '{
  "title": "Test Memory",
  "content": "This is a test memory entry",
  "memory_type": "context"
}'
run_case "Memory service: search memories" "POST" "/api/v1/memory/search" '{
  "query": "test"
}'

run_case "Intelligence service: analyze patterns" "POST" "/api/v1/intelligence/analyze-patterns" '{}'
run_case "Intelligence service: suggest tags" "POST" "/api/v1/intelligence/suggest-tags" '{
  "content": "This is sample content for tag suggestion"
}'

run_case "Security service: verify API key" "POST" "/api/v1/security/verify-api-key" '{
  "api_key": "test-api-key"
}'
run_case "Security service: list API keys" "POST" "/api/v1/security/list-api-keys" '{}'

run_case "Verification service: verify NIN" "POST" "/api/v1/verification/verify-nin" '{
  "nin": "12345678901",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01"
}'
run_case "Verification service: verify BVN" "POST" "/api/v1/verification/verify-bvn" '{
  "bvn": "12345678901",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01"
}'

echo ""
echo "=========================================="
echo "Summary: PASS=${PASSED} FAIL=${FAILED}"

if [[ "${FAILED}" -gt 0 ]]; then
  exit 1
fi

exit 0
