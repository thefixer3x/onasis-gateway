#!/bin/bash

# Edge Functions Deployment Script
# Deploys all standardized payment Edge Functions to Supabase

set -e

# Get project reference from environment variable
PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
FUNCTIONS=("paystack" "stripe" "flutterwave" "sayswitch")

echo "========================================"
echo "Edge Functions Deployment Script"
echo "========================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    echo "   Download from: https://github.com/supabase/cli/releases"
    exit 1
fi

echo "✅ Supabase CLI version: $(supabase --version)"
echo ""

# Check if project reference is set
if [ -z "$PROJECT_REF" ]; then
    echo "❌ SUPABASE_PROJECT_REF not set"
    echo ""
    echo "Please set your Supabase project reference:"
    echo "  export SUPABASE_PROJECT_REF=\"your-project-ref\""
    echo ""
    exit 1
fi

echo "✅ Project reference: $PROJECT_REF"
echo ""

# Check if access token is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ SUPABASE_ACCESS_TOKEN not set"
    echo ""
    echo "Please set your Personal Access Token:"
    echo "  1. Go to https://supabase.com/dashboard/account/tokens"
    echo "  2. Generate a new token"
    echo "  3. Run: export SUPABASE_ACCESS_TOKEN=\"sbp_your_token_here\""
    echo ""
    exit 1
fi

# Validate token format
if [[ ! "$SUPABASE_ACCESS_TOKEN" =~ ^sbp_ ]]; then
    echo "❌ Invalid access token format"
    echo "   Token must start with 'sbp_'"
    echo ""
    exit 1
fi

echo "✅ Access token found and valid"
echo ""

# Check if project is linked
echo "🔗 Linking to project $PROJECT_REF..."
if supabase link --project-ref "$PROJECT_REF" 2>&1 | grep -q "Linked"; then
    echo "✅ Project linked successfully"
else
    echo "⚠️  Project may already be linked"
fi
echo ""

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
    echo "========================================"
    echo "Deploying $func..."
    echo "========================================"

    # Deploy with JWT verification enabled for security
    if supabase functions deploy "$func" --project-ref "$PROJECT_REF"; then
        echo "✅ $func deployed successfully"
    else
        echo "❌ Failed to deploy $func"
        exit 1
    fi

    echo ""
done

echo "========================================"
echo "✅ All Edge Functions deployed!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Verify deployment in Supabase Dashboard"
echo "  2. Test functions with: node scripts/test-edge-functions.js"
echo "  3. Check function logs for any errors"
echo ""
echo "Function URLs:"
SUPABASE_URL="${SUPABASE_URL:-https://$PROJECT_REF.supabase.co}"
for func in "${FUNCTIONS[@]}"; do
    echo "  • $SUPABASE_URL/functions/v1/$func"
done
echo ""
