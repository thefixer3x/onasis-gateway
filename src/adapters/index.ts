/**
 * MCP Adapter Registry
 * Registry of all available MCP adapters in Onasis Gateway
 */

import { MCPAdapter } from '../types/mcp.js';

// Service-specific MCP adapters
import VerificationServiceMCPAdapter from '../../services/verification-service/verification-mcp-adapter.js';
import PayStackMCPAdapter from '../../services/paystack-payment-gateway/paystack-mcp-adapter.js';
import XpressWalletMCPAdapter from '../../services/xpress-wallet-waas/xpress-wallet-mcp-adapter.js';

// Auto-generated adapters (legacy)
import FlutterwaveV3Adapter from './generated/flutterwave-v3.js';
import PaystackAdapter from './generated/paystack.js';

export interface AdapterConstructor {
  new (): MCPAdapter;
}

export const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
  // Production-ready service adapters
  'verification-service': VerificationServiceMCPAdapter,
  'paystack-payment-gateway': PayStackMCPAdapter,
  'xpress-wallet-waas': XpressWalletMCPAdapter,
  
  // Legacy auto-generated adapters
  'flutterwave-v3': FlutterwaveV3Adapter,
  'paystack': PaystackAdapter,
};

export const ADAPTER_METADATA = [
  // Production-ready service adapters
  {
    "name": "verification-service",
    "className": "VerificationServiceMCPAdapter",
    "description": "Comprehensive KYC, KYB, and AML verification service",
    "tools": [
      "verify_identity_document",
      "verify_phone_email", 
      "verify_address",
      "verify_business_registration",
      "verify_tax_identification",
      "verify_bank_account",
      "facial_recognition",
      "liveness_detection",
      "age_gender_detection",
      "sanctions_screening",
      "pep_screening",
      "adverse_media_screening",
      "criminal_background_check",
      "employment_history_check",
      "get_verification_status",
      "list_supported_countries",
      "get_verification_providers"
    ],
    "authType": "apikey",
    "baseUrl": "https://verify.seftechub.com:9985",
    "category": "identity_verification",
    "supported_regions": ["NG", "KE", "GH", "UG", "ZA", "global"]
  },
  {
    "name": "paystack-payment-gateway", 
    "className": "PayStackMCPAdapter",
    "description": "Comprehensive PayStack payment processing for African markets",
    "tools": [
      "initialize_transaction",
      "verify_transaction",
      "charge_authorization",
      "create_customer",
      "fetch_customer",
      "list_customers",
      "create_dedicated_account",
      "list_dedicated_accounts",
      "create_subscription_plan",
      "create_subscription",
      "create_transfer_recipient",
      "initiate_transfer",
      "create_split_payment",
      "bulk_charge",
      "list_transactions",
      "paystack_health_check"
    ],
    "authType": "bearer",
    "baseUrl": "https://api.paystack.co",
    "category": "payment_gateway",
    "supported_currencies": ["NGN", "GHS", "ZAR", "KES"]
  },
  {
    "name": "xpress-wallet-waas",
    "className": "XpressWalletMCPAdapter", 
    "description": "Wallet-as-a-Service with multi-tenant architecture",
    "tools": [
      "create_wallet",
      "get_wallet_balance",
      "transfer_funds",
      "get_transaction_history",
      "freeze_wallet",
      "unfreeze_wallet",
      "generate_payment_link",
      "process_bulk_payments",
      "get_wallet_analytics",
      "manage_wallet_limits",
      "create_virtual_card",
      "wallet_health_check"
    ],
    "authType": "bearer",
    "baseUrl": "https://api.xpresswallet.com",
    "category": "wallet_service",
    "service_provider_ready": true
  },
  
  // Legacy auto-generated adapters
  {
    "name": "flutterwave-v3",
    "className": "FlutterwaveV3",
    "tools": [
      "charges-card",
      "charges-mobile-money-ghana",
      "charges-mobile-money-uganda",
      "charges-mobile-money-francophone",
      "charges-mobile-money-zambia",
      "charges-mobile-money-tanzania",
      "charges-mobile-money-mpesa",
      "charges-mobile-money-rwanda",
      "charges-ussd",
      "charges-debit-ng-account",
      "charges-debit-uk-eu-account",
      "charges-ach-payment",
      "charges-pay-with-bank-transfer",
      "charges-voucher-payment",
      "charges-enaira",
      "charges-applepay",
      "charges-fawrypay",
      "charges-googlepay",
      "charges-validate-charge",
      "tokenized-charges-create-a-tokenized-charge",
      "tokenized-charges-create-bulk-tokenized-charge",
      "tokenized-charges-get-bulk-tokenized-transactions",
      "tokenized-charges-get-status-of-bulk-tokenized-charge",
      "tokenized-charges-update-a-card-token",
      "preauthorization-capture-a-charge",
      "preauthorization-create-a-refund",
      "preauthorization-initiate-preauth-charge",
      "preauthorization-void-a-charge",
      "transactions-verify-a-transaction",
      "transactions-verify-a-transaction-by-transaction-reference",
      "transactions-create-a-refund",
      "transactions-get-multiple-transactions",
      "transactions-get-all-refunds",
      "transactions-get-transactions-fees-collections",
      "transactions-resend-failed-webhooks",
      "transactions-view-transaction-timeline",
      "transfers-initiate-a-transfer",
      "transfers-retry-a-transfer",
      "transfers-create-a-bulk-transfer",
      "transfers-get-transfer-fee",
      "transfers-fetch-a-transfer",
      "transfers-fetch-a-transfer-retry",
      "transfers-fetch-a-bulk-transfer",
      "transfers-get-transfer-rates",
      "transfers-fetch-all-transfers",
      "beneficiaries-create-a-transfer-beneficiary",
      "beneficiaries-list-all-transfer-beneficiaries",
      "beneficiaries-fetch-a-transfer-beneficiary",
      "beneficiaries-delete-a-transfer-beneficiary",
      "virtual-cards-create-a-virtual-card",
      "virtual-cards-get-all-virtual-cards",
      "virtual-cards-get-a-virtual-card",
      "virtual-cards-fund-a-virtual-card",
      "virtual-cards-withdraw-from-a-virtual-card",
      "virtual-cards-block-unblock-a-virtual-card",
      "virtual-cards-terminate-a-virtual-card",
      "virtual-cards-fetch-a-virtual-card-s-transactions",
      "virtual-account-numbers-create-a-virtual-account-number",
      "virtual-account-numbers-create-bulk-virtual-account-numbers",
      "virtual-account-numbers-fetch-a-virtual-account-number",
      "virtual-account-numbers-fetch-bulk-virtual-account-details",
      "virtual-account-numbers-update-bvn",
      "virtual-account-numbers-delete-a-virtual-account-number",
      "collection-subaccounts-create-a-collection-subaccount",
      "collection-subaccounts-fetch-all-subaccounts",
      "collection-subaccounts-fetch-a-subaccount",
      "collection-subaccounts-update-a-subaccount",
      "collection-subaccounts-delete-a-subaccount",
      "payout-subaccounts-create-a-payout-subaccount",
      "payout-subaccounts-list-all-payout-subaccounts",
      "payout-subaccounts-get-a-payout-subaccount",
      "payout-subaccounts-update-a-payout-subaccount",
      "payout-subaccounts-fetch-transactions",
      "payout-subaccounts-fetch-available-balance",
      "payout-subaccounts-fetch-static-virtual-accounts",
      "subscriptions-get-all-subscriptions",
      "subscriptions-activate-a-subscription",
      "subscriptions-deactivate-a-subscription",
      "payment-plans-create-a-payment-plan",
      "payment-plans-get-all-payment-plans",
      "payment-plans-get-a-payment-plan",
      "payment-plans-update-a-payment-plan",
      "payment-plans-cancel-a-payment-plan",
      "bill-payments-get-supported-bill-categories",
      "bill-payments-get-biller-details",
      "bill-payments-get-a-bill-information",
      "bill-payments-validate-customer-details",
      "bill-payments-create-a-bill-payment",
      "bill-payments-get-bill-payments-summary",
      "bill-payments-get-a-bill-payment-status",
      "bill-payments-create-bulk-bills-payment",
      "bill-payments-get-bill-payments-history",
      "banks-get-all-banks",
      "banks-get-bank-branches",
      "misc-get-multiple-wallet-balances",
      "misc-get-a-single-wallet-balance",
      "misc-resolve-account-details",
      "misc-resolve-card-bin",
      "misc-get-balance-history",
      "misc-initiate-bvn-consent",
      "misc-verify-bvn-consent",
      "settlements-get-all-settlements",
      "settlements-get-a-settlement",
      "otps-create-an-otp",
      "otps-validate-an-otp",
      "chargebacks-get-all-chargebacks",
      "chargebacks-accept-decline-chargebacks",
      "chargebacks-fetch-a-chargeback"
    ],
    "authType": "bearer",
    "baseUrl": "https://api.example.com"
  },
  {
    "name": "paystack",
    "className": "Paystack",
    "tools": [
      "transaction-id-fetch-transaction",
      "transaction-id-get-transaction-event",
      "transaction-id-get-transaction-session",
      "transaction-list-transactions",
      "transaction-initialize-transaction",
      "transaction-verify-transaction",
      "transaction-fetch-transaction-timeline",
      "transaction-transaction-totals",
      "transaction-export-transactions",
      "transaction-charge-authorization",
      "transaction-partial-debit",
      "split-id-subaccount-add-subaccount-to-split",
      "split-id-subaccount-remove-subaccount-from-split",
      "split-id-fetch-split",
      "split-id-update-split",
      "split-create-split",
      "split-list-splits",
      "customer-code-fetch-customer",
      "customer-code-update-customer",
      "customer-code-validate-customer",
      "customer-create-customer",
      "customer-list-customers",
      "customer-white-blacklist-customer",
      "customer-deactivate-authorization",
      "dedicated-account-account-id-fetch-dedicated-account",
      "dedicated-account-account-id-deactivate-dedicated-account",
      "dedicated-account-create-dedicated-account",
      "dedicated-account-list-dedicated-accounts",
      "dedicated-account-fetch-bank-providers",
      "dedicated-account-split-dedicated-account-transaction",
      "subaccount-code-fetch-subaccount",
      "subaccount-code-update-subaccount",
      "subaccount-create-subaccount",
      "subaccount-list-subaccounts",
      "plan-code-fetch-plan",
      "plan-code-update-plan",
      "plan-create-plan",
      "plan-list-plans",
      "subscription-code-manage-generate-update-subscription-link",
      "subscription-code-manage-send-update-subscription-link",
      "subscription-code-fetch-subscription",
      "subscription-create-subscription",
      "subscription-list-subscriptions",
      "subscription-disable-subscription",
      "subscription-enable-subscription",
      "product-id-fetch-product",
      "product-id-update-product",
      "product-id-delete-product",
      "product-create-product",
      "product-list-products",
      "page-id-fetch-page",
      "page-id-update-page",
      "page-id-add-products",
      "page-create-page",
      "page-list-pages",
      "page-check-slug-availability",
      "paymentrequest-id-fetch-payment-request",
      "paymentrequest-id-update-payment-request",
      "paymentrequest-create-payment-request",
      "paymentrequest-list-payment-request",
      "paymentrequest-verify-payment-request",
      "paymentrequest-send-notification",
      "paymentrequest-payment-request-total",
      "paymentrequest-finalize-payment-request",
      "paymentrequest-archive-payment-request",
      "settlement-fetch-settlements",
      "settlement-settlement-transactions",
      "transferrecipient-code-fetch-transfer-recipient",
      "transferrecipient-code-update-transfer-recipient",
      "transferrecipient-code-delete-transfer-recipient",
      "transferrecipient-create-transfer-recipient",
      "transferrecipient-list-transfer-recipients",
      "transferrecipient-bulk-create-transfer-recipient",
      "transfer-initiate-transfer",
      "transfer-list-transfers",
      "transfer-finalize-transfer",
      "transfer-initiate-bulk-transfer",
      "transfer-fetch-transfer",
      "transfer-verify-transfer",
      "transfer-export-transfers",
      "transfer-resend-otp-for-transfer",
      "transfer-disable-otp-requirement-for-transfers",
      "transfer-finalize-disabling-of-otp-requirement-for-transfers",
      "transfer-enable-otp-requirement-for-transfers",
      "balance-fetch-balance",
      "balance-balance-ledger",
      "charge-create-charge",
      "charge-submit-pin",
      "charge-submit-otp",
      "charge-submit-phone",
      "charge-submit-birthday",
      "charge-submit-address",
      "charge-check-pending-charge",
      "bulkcharge-code-fetch-bulk-charge-batch",
      "bulkcharge-code-fetch-charges-in-a-batch",
      "bulkcharge-initiate-bulk-charge",
      "bulkcharge-list-bulk-charge-batches",
      "bulkcharge-pause-bulk-charge-batch",
      "bulkcharge-resume-bulk-charge-batch",
      "integration-payment-session-timeout-fetch-payment-session-timeout",
      "integration-payment-session-timeout-update-payment-session-timeout",
      "refund-create-refund",
      "refund-list-refunds",
      "refund-fetch-refund",
      "dispute-id-fetch-dispute",
      "dispute-id-update-dispute",
      "dispute-id-get-upload-url",
      "dispute-id-resolve-a-dispute",
      "dispute-id-add-evidence",
      "dispute-list-disputes",
      "dispute-export-disputes",
      "dispute-list-transaction-disputes",
      "bank-fetch-banks",
      "bank-resolve-account-number",
      "resolve-card-bin",
      "list-countries",
      "list-states-avs"
    ],
    "authType": "bearer",
    "baseUrl": "https://api.paystack.co"
  }
];

export function getAdapter(name: string): AdapterConstructor | undefined {
  return ADAPTER_REGISTRY[name];
}

export function listAdapters(): string[] {
  return Object.keys(ADAPTER_REGISTRY);
}

export function getAdapterMetadata(name: string) {
  return ADAPTER_METADATA.find(adapter => adapter.name === name);
}

export function getAllAdapterMetadata() {
  return ADAPTER_METADATA;
}

export async function createAdapterInstance(name: string): Promise<MCPAdapter | null> {
  const AdapterClass = getAdapter(name);
  if (!AdapterClass) {
    return null;
  }
  
  return new AdapterClass();
}

export default {
  ADAPTER_REGISTRY,
  ADAPTER_METADATA,
  getAdapter,
  listAdapters,
  getAdapterMetadata,
  getAllAdapterMetadata,
  createAdapterInstance
};