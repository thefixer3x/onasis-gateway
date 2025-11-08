#!/bin/bash

# Providus Bank API Integration - Automated Setup Script
# Usage: ./setup-providus.sh

set -e  # Exit on error

echo "🚀 Providus Bank API Integration Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo "ℹ $1"
}

# Check if running in project root
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from your project root."
    exit 1
fi

print_success "Project root detected"

# Step 1: Create service directory structure
echo ""
echo "📁 Step 1: Creating service directory structure..."
mkdir -p services/providus-bank
print_success "Directory created: services/providus-bank"

# Step 2: Copy configuration files
echo ""
echo "📝 Step 2: Setting up service files..."

if [ -f "/tmp/providus-bank-config.json" ]; then
    cp /tmp/providus-bank-config.json services/providus-bank/config.json
    print_success "Config file created"
else
    print_warning "Config template not found in /tmp"
fi

if [ -f "/tmp/providus-bank-client.ts" ]; then
    cp /tmp/providus-bank-client.ts services/providus-bank/client.ts
    print_success "Client file created"
else
    print_warning "Client template not found in /tmp"
fi

if [ -f "/tmp/providus-bank-mcp-adapter.ts" ]; then
    cp /tmp/providus-bank-mcp-adapter.ts services/providus-bank/mcp-adapter.ts
    print_success "MCP adapter created"
else
    print_warning "MCP adapter template not found in /tmp"
fi

# Step 3: Install dependencies
echo ""
echo "📦 Step 3: Installing dependencies..."

if command -v pnpm &> /dev/null; then
    print_info "Using pnpm..."
    pnpm add axios
elif command -v npm &> /dev/null; then
    print_info "Using npm..."
    npm install axios
else
    print_error "Neither npm nor pnpm found. Please install Node.js package manager."
    exit 1
fi

print_success "Dependencies installed"

# Step 4: Check for .env file
echo ""
echo "🔐 Step 4: Checking environment configuration..."

if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << 'EOF'
# Providus Bank API Configuration
PROVIDUS_MODE=sandbox
PROVIDUS_BASE_URL=https://api.providusbank.com
PROVIDUS_API_KEY=your_api_key_here
PROVIDUS_USERNAME=your_username
PROVIDUS_PASSWORD=your_password
PROVIDUS_EMAIL=merchant@example.com
EOF
    print_success ".env template created"
    print_warning "⚠️  ACTION REQUIRED: Update .env with your actual Providus Bank credentials"
else
    # Check if Providus variables exist
    if grep -q "PROVIDUS_" .env; then
        print_success "Providus Bank variables found in .env"
    else
        print_warning "Providus Bank variables not found in .env"
        cat >> .env << 'EOF'

# Providus Bank API Configuration
PROVIDUS_MODE=sandbox
PROVIDUS_BASE_URL=https://api.providusbank.com
PROVIDUS_API_KEY=your_api_key_here
PROVIDUS_USERNAME=your_username
PROVIDUS_PASSWORD=your_password
PROVIDUS_EMAIL=merchant@example.com
EOF
        print_success "Providus Bank variables added to .env"
        print_warning "⚠️  ACTION REQUIRED: Update .env with your actual credentials"
    fi
fi

# Step 5: Create TypeScript types file
echo ""
echo "📘 Step 5: Creating TypeScript types..."

cat > services/providus-bank/types.ts << 'EOF'
// TypeScript type definitions for Providus Bank API

export interface PBAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface PBMerchant {
  id: string;
  email: string;
  review: 'PENDING' | 'APPROVED' | 'REJECTED';
  businessName: string;
  canDebitCustomer: boolean;
  parentMerchant: string | null;
  createdAt: string;
  mode: 'SANDBOX' | 'PRODUCTION';
  owner: boolean;
}

export interface PBUser {
  id: string;
  role: string;
  email: string;
  lastName: string;
  firstName: string;
  phoneNumber: string;
  MerchantId: string;
  createdAt: string;
  updatedAt: string;
  Merchant: PBMerchant;
}

export interface PBAuthResponse {
  status: boolean;
  data: PBUser;
  permissions: PBPermission[];
}

export type PBPermission =
  | 'BROWSE_CUSTOMERS'
  | 'UPDATE_CUSTOMERS'
  | 'CREATE_CUSTOMER_WALLET'
  | 'WALLET_CREDIT_DEBIT'
  | 'MANAGE_BALANCE_SETTLEMENT'
  | 'BROWSE_MERCHANT_WALLET'
  | 'ENABLE_DISABLE_WALLET'
  | 'SET_TRANSACTION_PIN'
  | 'MANAGE_TRANSFER'
  | 'BROWSE_TRANSACTIONS'
  | 'UPDATE_MERCHANT_DETAIL'
  | 'BROWSE_KEYS'
  | 'GENERATE_KEYS'
  | 'MANAGE_AIRTIME'
  | 'MANAGE_PREPAID_CARD'
  | 'INVITE_TEAM_MEMBER'
  | 'BROWSE_ROLES'
  | 'MANAGE_ROLES'
  | 'MANAGE_TEAM_MEMBER'
  | 'BROWSE_TEAM_MEMBER';

export interface NIPTransferRequest {
  beneficiaryAccountName: string;
  transactionAmount: string;
  currencyCode: 'NGN';
  narration: string;
  sourceAccountName: string;
  beneficiaryAccountNumber: string;
  beneficiaryBank: string;
  transactionReference: string;
}

export interface TransferResponse {
  status: boolean;
  message: string;
  data?: {
    transactionReference: string;
    amount: string;
    fee?: string;
    timestamp: string;
  };
}
EOF

print_success "TypeScript types created"

# Step 6: Create constants file
echo ""
echo "📋 Step 6: Creating constants..."

cat > services/providus-bank/constants.ts << 'EOF'
// Nigerian Bank Codes for NIP Transfers
export const NIGERIAN_BANKS = {
  '000001': 'Sterling Bank',
  '000002': 'Keystone Bank',
  '000003': 'First City Monument Bank (FCMB)',
  '000004': 'United Bank for Africa (UBA)',
  '000005': 'Diamond Bank',
  '000007': 'Fidelity Bank',
  '000008': 'Polaris Bank',
  '000009': 'Citibank Nigeria',
  '000010': 'Ecobank Nigeria',
  '000011': 'Unity Bank',
  '000012': 'Stanbic IBTC Bank',
  '000013': 'Guaranty Trust Bank (GTBank)',
  '000014': 'Access Bank',
  '000015': 'Zenith Bank',
  '000016': 'First Bank of Nigeria',
  '000017': 'Wema Bank',
  '000018': 'Union Bank of Nigeria',
  '000019': 'Enterprise Bank',
  '000020': 'Heritage Bank',
  '000021': 'Standard Chartered Bank',
  '000022': 'Suntrust Bank',
  '000023': 'Providus Bank',
} as const;

export type BankCode = keyof typeof NIGERIAN_BANKS;

export const API_TIMEOUTS = {
  DEFAULT: 30000,
  TRANSFER: 60000,
  HEALTH_CHECK: 5000,
} as const;

export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: 3600000, // 1 hour
  REFRESH_WINDOW: 300000, // 5 minutes before expiry
} as const;

export const ERROR_CODES = {
  AUTHENTICATION_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_BANK_CODE: 'INVALID_BANK',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  DUPLICATE_REFERENCE: 'DUPLICATE_REF',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
EOF

print_success "Constants file created"

# Step 7: Create utility functions
echo ""
echo "🔧 Step 7: Creating utility functions..."

cat > services/providus-bank/utils.ts << 'EOF'
import { NIGERIAN_BANKS, BankCode } from './constants';

/**
 * Generate a unique transaction reference
 */
export function generateTransactionReference(prefix: string = 'PB'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validate Nigerian bank code
 */
export function isValidBankCode(code: string): code is BankCode {
  return code in NIGERIAN_BANKS;
}

/**
 * Get bank name from code
 */
export function getBankName(code: string): string | undefined {
  return NIGERIAN_BANKS[code as BankCode];
}

/**
 * Format amount for API (always 2 decimal places)
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Validate transaction amount
 */
export function isValidAmount(amount: string | number): boolean {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(numAmount) && numAmount > 0;
}

/**
 * Encode credentials to base64 (as required by PB API)
 */
export function encodeCredentials(value: string): string {
  return Buffer.from(value).toString('base64');
}

/**
 * Decode base64 credentials
 */
export function decodeCredentials(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Validate Nigerian phone number
 */
export function isValidNigerianPhone(phone: string): boolean {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Should be 11 digits starting with 0, or 10 digits, or 13 digits starting with 234
  return (
    /^0\d{10}$/.test(cleaned) || // 0XXXXXXXXXX
    /^\d{10}$/.test(cleaned) || // XXXXXXXXXX
    /^234\d{10}$/.test(cleaned) // 234XXXXXXXXXX
  );
}

/**
 * Format Nigerian phone number to standard format
 */
export function formatNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('234')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('0')) {
    return `234${cleaned.substr(1)}`;
  }
  
  return `234${cleaned}`;
}
EOF

print_success "Utility functions created"

# Step 8: Create README
echo ""
echo "📖 Step 8: Creating documentation..."

cat > services/providus-bank/README.md << 'EOF'
# Providus Bank API Integration

## Overview
This module provides integration with Providus Bank's Xpress Wallet API, including fund transfers, wallet management, and merchant operations.

## Quick Start

### 1. Authentication
\`\`\`typescript
import { createProvidusClient } from './client';

const client = createProvidusClient({
  baseUrl: process.env.PROVIDUS_BASE_URL,
  username: process.env.PROVIDUS_USERNAME,
  password: process.env.PROVIDUS_PASSWORD,
  email: process.env.PROVIDUS_EMAIL,
  mode: 'sandbox',
});

await client.authenticate();
\`\`\`

### 2. Execute Transfer
\`\`\`typescript
const result = await client.nipFundTransfer({
  beneficiaryAccountName: 'John Doe',
  beneficiaryAccountNumber: '0012345678',
  beneficiaryBank: '000013', // GTBank
  sourceAccountName: 'My Business',
  transactionAmount: '5000.00',
  narration: 'Payment for services',
  transactionReference: generateTransactionReference(),
});
\`\`\`

### 3. Using MCP Tools
\`\`\`typescript
import { createProvidusMCPAdapter } from './mcp-adapter';

const adapter = createProvidusMCPAdapter(config);
const result = await adapter.executeTool('pb_nip_transfer', {
  // ... transfer params
});
\`\`\`

## Available MCP Tools
1. `pb_authenticate` - Authenticate and get tokens
2. `pb_get_user_profile` - Get user profile and permissions
3. `pb_logout` - Invalidate session
4. `pb_nip_transfer` - Execute NIP transfer
5. `pb_multi_debit_transfer` - Multi-account transfer
6. `pb_update_password` - Update password
7. `pb_health_check` - Check API health

## Files
- `config.json` - Service configuration
- `client.ts` - API client with authentication
- `mcp-adapter.ts` - MCP protocol adapter
- `types.ts` - TypeScript type definitions
- `constants.ts` - Bank codes and constants
- `utils.ts` - Utility functions
- `health-check.ts` - Health check script
- `test-suite.ts` - Integration tests

## Testing
\`\`\`bash
# Run health check
npx ts-node services/providus-bank/health-check.ts

# Run test suite
npx ts-node services/providus-bank/test-suite.ts
\`\`\`

## Documentation
- Main Docs: https://developer.providusbank.com
- Xpress Wallet API: https://developer.providusbank.com/xpress-wallet-api
- Transfer Services: https://developer.providusbank.com/transfer-services
EOF

print_success "README created"

# Step 9: Summary
echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📁 Files created:"
echo "   • services/providus-bank/config.json"
echo "   • services/providus-bank/client.ts"
echo "   • services/providus-bank/mcp-adapter.ts"
echo "   • services/providus-bank/types.ts"
echo "   • services/providus-bank/constants.ts"
echo "   • services/providus-bank/utils.ts"
echo "   • services/providus-bank/README.md"
echo ""
echo "📝 Next steps:"
echo "   1. Update .env with your Providus Bank credentials"
echo "   2. Copy health-check.ts and test-suite.ts from /tmp"
echo "   3. Run: npx ts-node services/providus-bank/health-check.ts"
echo "   4. Register service in your API Gateway"
echo ""
echo "📚 Documentation:"
echo "   • Integration Guide: /tmp/providus-integration-guide.md"
echo "   • Plan Review: /tmp/providus-plan-review.md"
echo ""
print_success "Ready to integrate! 🚀"
