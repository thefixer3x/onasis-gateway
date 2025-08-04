#!/bin/bash

# Test Script for Abstracted API Endpoints
# Tests Paystack and SaySwitch integrations through vendor abstraction layer

BASE_URL="https://f525e96e43e2.ngrok-free.app"
API_KEY="test-key"

echo "🚀 Testing Abstracted API Endpoints via Ngrok Tunnel"
echo "Base URL: $BASE_URL"
echo "=========================================="

# Test 1: Health Check
echo "1. Health Check"
curl -s -X GET "$BASE_URL/health" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# Test 2: Discover Available Categories
echo "2. Discover API Categories"
curl -s -X GET "$BASE_URL/api/v1/categories" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# Test 3: Get Payment Category Info
echo "3. Payment Category Information"
curl -s -X GET "$BASE_URL/api/v1/categories/payment" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# Test 4: Get Payment Schema for Initialize Transaction
echo "4. Payment Initialize Transaction Schema"
curl -s -X GET "$BASE_URL/api/v1/categories/payment/schema/initializeTransaction" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# Test 5: Initialize Payment with Paystack (Abstracted)
echo "5. Initialize Payment - Paystack (Abstracted)"
curl -s -X POST "$BASE_URL/api/v1/payments/initialize" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-paystack-init-001" \
  -d '{
    "vendor": "paystack",
    "amount": 5000,
    "currency": "NGN",
    "email": "test@example.com",
    "metadata": {
      "test": true,
      "source": "abstracted-api"
    }
  }' | jq '.'
echo ""

# Test 6: Initialize Payment with SaySwitch (Abstracted)
echo "6. Initialize Payment - SaySwitch (Abstracted)"
curl -s -X POST "$BASE_URL/api/v1/payments/initialize" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-sayswitch-init-001" \
  -d '{
    "vendor": "sayswitch",
    "amount": 5000,
    "currency": "NGN",
    "email": "test@example.com",
    "metadata": {
      "test": true,
      "source": "abstracted-api"
    }
  }' | jq '.'
echo ""

# Test 7: Create Customer with Paystack (Abstracted)
echo "7. Create Customer - Paystack (Abstracted)"
curl -s -X POST "$BASE_URL/api/v1/payments/customer" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-paystack-customer-001" \
  -d '{
    "vendor": "paystack",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+2348012345678"
  }' | jq '.'
echo ""

# Test 8: Create Customer with SaySwitch (Abstracted)
echo "8. Create Customer - SaySwitch (Abstracted)"
curl -s -X POST "$BASE_URL/api/v1/payments/customer" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-sayswitch-customer-001" \
  -d '{
    "vendor": "sayswitch",
    "email": "customer@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "+2348087654321"
  }' | jq '.'
echo ""

# Test 9: Generic Abstracted Call - Payment Category
echo "9. Generic Abstracted Call - Payment/Initialize"
curl -s -X POST "$BASE_URL/api/v1/payment/initializeTransaction" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-generic-payment-001" \
  -d '{
    "vendor": "paystack",
    "amount": 2500,
    "currency": "NGN",
    "email": "generic@example.com"
  }' | jq '.'
echo ""

# Test 10: Banking Category Info
echo "10. Banking Category Information"
curl -s -X GET "$BASE_URL/api/v1/categories/banking" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# Test 11: Infrastructure Category Info
echo "11. Infrastructure Category Information"
curl -s -X GET "$BASE_URL/api/v1/categories/infrastructure" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# Test 12: Verify Account with BAP (Banking)
echo "12. Verify Account - BAP (Banking)"
curl -s -X POST "$BASE_URL/api/v1/banking/verify-account" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-bap-verify-001" \
  -d '{
    "vendor": "bap",
    "accountNumber": "0123456789",
    "bankCode": "044"
  }' | jq '.'
echo ""

# Test 13: Create Tunnel with Ngrok (Infrastructure)
echo "13. Create Tunnel - Ngrok (Infrastructure)"
curl -s -X POST "$BASE_URL/api/v1/infrastructure/tunnel" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-ngrok-tunnel-001" \
  -d '{
    "vendor": "ngrok",
    "port": 3000,
    "subdomain": "test-app",
    "region": "us"
  }' | jq '.'
echo ""

# Test 14: List Tunnels with Ngrok (Infrastructure)
echo "14. List Tunnels - Ngrok (Infrastructure)"
curl -s -X GET "$BASE_URL/api/v1/infrastructure/tunnels?vendor=ngrok" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-ngrok-list-001" | jq '.'
echo ""

# Test 15: Test Webhook Endpoint
echo "15. Test Webhook Endpoint"
curl -s -X POST "$BASE_URL/webhook" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Paystack-Signature: test-signature" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "test-ref-001",
      "amount": 5000,
      "currency": "NGN",
      "status": "success"
    }
  }' | jq '.'
echo ""

# Test 16: Test Callback Endpoint
echo "16. Test Callback Endpoint"
curl -s -X GET "$BASE_URL/callback?reference=test-ref-001&status=success" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "=========================================="
echo "✅ Abstracted API Testing Complete!"
echo "🔍 Check the responses above for vendor abstraction functionality"
echo "📊 All vendor-specific details should be hidden from client responses"
echo "🛡️  Client should only see standardized, abstracted responses"
