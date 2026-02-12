# Edge Function Deployment Guide

## Overview

This guide covers deploying the standardized Edge Functions for Paystack, Stripe, Flutterwave, and SaySwitch to Supabase.

## Prerequisites

1. **Supabase CLI** installed (v2.75.0+)
2. **Supabase Access Token** with format `sbp_...` (Personal Access Token from Supabase Dashboard)
3. **Project Reference**: Set via `SUPABASE_PROJECT_REF` environment variable

## Getting Your Supabase Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Give it a name (e.g., "onasis-gateway-deployment")
4. Copy the token (starts with `sbp_`)
5. Set it in your environment:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_your_token_here"
```

## Required Environment Secrets

Before deploying, ensure these secrets are set in your Supabase project:

### Paystack
- `PSTACK_SECRET_KEY_TEST` or `PAYSTACK_SECRET_KEY`

### Stripe
- `STRIPE_SECRET_KEY`

### Flutterwave
- `FLW_SECRET_KEY_TEST` or `FLUTTERWAVE_SECRET_KEY`

### SaySwitch
- `SAYSWITCH_API_KEY` (NOT `SWS_API_KEY`)

Set secrets via Supabase Dashboard or CLI:

```bash
supabase secrets set PSTACK_SECRET_KEY_TEST="sk_test_..." --project-ref $SUPABASE_PROJECT_REF
supabase secrets set STRIPE_SECRET_KEY="sk_test_..." --project-ref $SUPABASE_PROJECT_REF
supabase secrets set FLW_SECRET_KEY_TEST="FLWSECK_TEST-..." --project-ref $SUPABASE_PROJECT_REF
supabase secrets set SAYSWITCH_API_KEY="..." --project-ref $SUPABASE_PROJECT_REF
```

## Deployment Commands

### Link Project (One-time setup)

```bash
cd /home/user/onasis-gateway
supabase link --project-ref $SUPABASE_PROJECT_REF
```

### Deploy All Functions

```bash
# Deploy Paystack
supabase functions deploy paystack --project-ref $SUPABASE_PROJECT_REF 
# Deploy Stripe
supabase functions deploy stripe --project-ref $SUPABASE_PROJECT_REF 
# Deploy Flutterwave
supabase functions deploy flutterwave --project-ref $SUPABASE_PROJECT_REF 
# Deploy SaySwitch
supabase functions deploy sayswitch --project-ref $SUPABASE_PROJECT_REF 
```

### Deploy All at Once

```bash
supabase functions deploy --project-ref $SUPABASE_PROJECT_REF 
```

## Standardized Function Contract

All Edge Functions follow the same contract:

### Request Format

```json
{
  "action": "action_name_in_snake_case",
  "param1": "value1",
  "param2": "value2"
}
```

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-12T01:50:00.000Z"
}
```

### Error Format

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "timestamp": "2026-02-12T01:50:00.000Z"
}
```

## Supported Actions

### Paystack (18 actions)
- `initialize_transaction`
- `verify_transaction`
- `charge_authorization`
- `create_customer`
- `fetch_customer`
- `list_customers`
- `create_transfer_recipient`
- `initiate_transfer`
- `list_transactions`
- `list_banks`
- `verify_account`
- `create_dedicated_account`
- `list_dedicated_accounts`
- `create_subscription_plan`
- `create_subscription`
- `create_split_payment`
- `bulk_charge`
- `paystack_health_check`

### Stripe (14 actions)
- `get_api_key`
- `create_cardholder`
- `create_card`
- `get_card`
- `update_card`
- `get_card_details`
- `get_transactions`
- `list_cardholders`
- `list_cards`
- `create_authorization`
- `get_balance`
- `create_payment_intent`
- `create_customer`
- `list_customers`
- `stripe_health_check`

### Flutterwave (15 actions)
- `initiate_payment`
- `verify_transaction`
- `create_payment_link`
- `get_transaction`
- `list_transactions`
- `charge_card`
- `create_virtual_card`
- `get_virtual_card`
- `list_virtual_cards`
- `initiate_transfer`
- `get_transfer`
- `list_banks`
- `verify_account`
- `get_balance`
- `flutterwave_health_check`

### SaySwitch (16 actions)
- `purchase_airtime`
- `get_transaction`
- `pay_bill`
- `validate_customer`
- `list_billers`
- `purchase_data`
- `get_data_plans`
- `transfer_funds`
- `list_banks`
- `verify_account`
- `get_balance`
- `list_transactions`
- `purchase_cable`
- `purchase_electricity`
- `validate_meter`
- `sayswitch_health_check`

## Testing Deployed Functions

### Using curl

```bash
# Paystack: Initialize transaction
curl -X POST "$SUPABASE_URL/functions/v1/paystack" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "initialize_transaction",
    "email": "test@example.com",
    "amount": 1000,
    "currency": "NGN"
  }'

# Stripe: Get API key info
curl -X POST "$SUPABASE_URL/functions/v1/stripe" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_api_key"}'

# Flutterwave: List banks
curl -X POST "$SUPABASE_URL/functions/v1/flutterwave" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "list_banks", "country": "NG"}'

# SaySwitch: Get balance
curl -X POST "$SUPABASE_URL/functions/v1/sayswitch" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_balance"}'
```

### Health Checks

```bash
# All functions support health checks
curl -X POST "$SUPABASE_URL/functions/v1/paystack" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "paystack_health_check"}'
```

## Troubleshooting

### Invalid Access Token Format

If you get `Invalid access token format. Must be like sbp_0102...1920`:
- Ensure you're using a Personal Access Token from Supabase Dashboard
- The token must start with `sbp_`
- Set it with: `export SUPABASE_ACCESS_TOKEN="sbp_..."`

### Function Not Found

If deployment succeeds but function returns 404:
- Wait 30-60 seconds for Edge Functions to become available
- Check Supabase Dashboard > Edge Functions for deployment status

### Authentication Errors

If you get 401 errors when calling functions:
- Ensure you're passing the `Authorization: Bearer $SUPABASE_ANON_KEY` header
- Verify the anon key is correct in your environment

### Vendor API Errors

If you get errors about missing vendor API keys:
- Check that secrets are set in Supabase Dashboard > Settings > Edge Functions > Secrets
- Redeploy the function after setting secrets

## Deployment Verification

After deployment, verify all functions are working:

```bash
# Run the test script
node scripts/test-edge-functions.js
```

Or manually test each health check endpoint.

## Rollback

If a deployment fails or causes issues:

```bash
# Redeploy previous version (if you have the code)
git checkout <previous-commit>
supabase functions deploy <function-name> --project-ref $SUPABASE_PROJECT_REF

# Or delete and redeploy
supabase functions delete <function-name> --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy <function-name> --project-ref $SUPABASE_PROJECT_REF
```

## Next Steps

After successful deployment:

1. Update the onasis-gateway adapters to use these Edge Functions
2. Test the full request flow: Gateway → Edge Function → Vendor API
3. Monitor logs in Supabase Dashboard for errors
4. Set up alerting for function failures

## References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Master Implementation Plan](docs/implementation/MASTER_IMPLEMENTATION_PLAN.md)
