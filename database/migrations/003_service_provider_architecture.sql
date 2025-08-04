-- ============================================================================
-- SERVICE PROVIDER ARCHITECTURE SCHEMA
-- Multi-tenant Xpress Wallet Service Provider Platform
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create service provider schemas
CREATE SCHEMA IF NOT EXISTS service_provider;
CREATE SCHEMA IF NOT EXISTS client_management;

-- ============================================================================
-- SERVICE PROVIDER CORE TABLES
-- ============================================================================

-- Service Provider Clients (Mega Meal, etc.)
CREATE TABLE service_provider.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_code VARCHAR(50) UNIQUE NOT NULL, -- 'MEGA_MEAL', 'FOOD_CORP'
    business_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    business_address TEXT,
    
    -- Authentication & API Access
    api_key_hash TEXT NOT NULL, -- bcrypt hash of API key
    webhook_url TEXT,
    webhook_secret TEXT,
    
    -- Service Configuration
    service_tier VARCHAR(50) DEFAULT 'STANDARD', -- BASIC, STANDARD, PREMIUM, ENTERPRISE
    features_enabled JSONB DEFAULT '{}', -- {"batch_operations": true, "bank_transfers": true}
    
    -- Transaction Limits & Controls
    daily_transaction_limit DECIMAL(20,2),
    monthly_transaction_limit DECIMAL(20,2),
    single_transaction_limit DECIMAL(20,2),
    approval_threshold DECIMAL(20,2), -- Transactions above this need approval
    auto_approval_enabled BOOLEAN DEFAULT false,
    
    -- Billing & Revenue
    transaction_fee_rate DECIMAL(5,4) DEFAULT 0.015, -- 1.5%
    fixed_fee_per_transaction DECIMAL(10,2) DEFAULT 50,
    monthly_service_fee DECIMAL(15,2),
    billing_day INTEGER DEFAULT 1, -- Day of month for billing
    
    -- Status & Settings
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, terminated
    timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE
);

-- Client Users (People who can access client dashboard/APIs)
CREATE TABLE service_provider.client_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- admin, manager, operator, viewer
    permissions JSONB DEFAULT '{}', -- {"approve_transactions": true, "view_analytics": true}
    is_primary_contact BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, user_id)
);

-- Client-specific Wallet Configuration
CREATE TABLE service_provider.client_wallet_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    
    -- Wallet Settings
    wallet_prefix VARCHAR(10), -- 'MGM' for Mega Meal wallets
    default_wallet_type VARCHAR(50) DEFAULT 'personal',
    kyc_required BOOLEAN DEFAULT true,
    bvn_verification_required BOOLEAN DEFAULT false,
    
    -- Transaction Settings
    enable_bank_transfers BOOLEAN DEFAULT true,
    enable_inter_wallet_transfers BOOLEAN DEFAULT true,
    enable_batch_operations BOOLEAN DEFAULT false,
    require_transaction_approval BOOLEAN DEFAULT false,
    
    -- Branding & Customization
    brand_name VARCHAR(100),
    brand_logo_url TEXT,
    brand_colors JSONB, -- {"primary": "#007bff", "secondary": "#6c757d"}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CLIENT-ISOLATED WALLET TABLES (RLS ENABLED)
-- ============================================================================

-- Client Customer Wallets (Enhanced with client isolation)
CREATE TABLE wallet.client_customer_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    client_customer_id VARCHAR(100) NOT NULL, -- Client's internal customer ID
    user_id UUID REFERENCES auth.users(id), -- Optional: if linked to auth system
    
    -- Xpress Wallet Details
    provider_id UUID REFERENCES wallet.providers(id),
    external_wallet_id VARCHAR(255) UNIQUE,
    account_number VARCHAR(20) UNIQUE,
    account_name VARCHAR(255),
    
    -- Wallet Configuration
    wallet_type VARCHAR(50) DEFAULT 'personal',
    currency VARCHAR(10) DEFAULT 'NGN',
    tier_level INTEGER DEFAULT 1, -- 1=Basic, 2=Standard, 3=Premium
    
    -- Balance Information
    balance DECIMAL(20,2) DEFAULT 0,
    available_balance DECIMAL(20,2) DEFAULT 0,
    ledger_balance DECIMAL(20,2) DEFAULT 0,
    
    -- Limits & Controls
    daily_transaction_limit DECIMAL(20,2),
    monthly_transaction_limit DECIMAL(20,2),
    daily_spent DECIMAL(20,2) DEFAULT 0,
    monthly_spent DECIMAL(20,2) DEFAULT 0,
    last_limit_reset DATE DEFAULT CURRENT_DATE,
    
    -- Status & Metadata
    status VARCHAR(50) DEFAULT 'active',
    kyc_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
    bvn_verified BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    
    -- Sync & Timestamps
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(client_id, client_customer_id)
);

-- Client Transactions (Enhanced with client isolation and approval workflow)
CREATE TABLE wallet.client_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallet.client_customer_wallets(id),
    
    -- Transaction Details
    external_transaction_id VARCHAR(255) UNIQUE,
    reference VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- credit, debit, transfer_in, transfer_out, bank_transfer
    amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    
    -- Balance Tracking
    balance_before DECIMAL(20,2),
    balance_after DECIMAL(20,2),
    
    -- Transaction Context
    description TEXT,
    narration TEXT,
    initiated_by VARCHAR(100), -- client_api, client_dashboard, customer_app
    channel VARCHAR(50), -- mobile, web, api, batch
    
    -- Status & Approval
    status VARCHAR(50) DEFAULT 'pending',
    approval_status VARCHAR(50) DEFAULT 'auto_approved', -- auto_approved, pending_approval, approved, rejected
    approved_by UUID REFERENCES service_provider.client_users(id),
    approval_notes TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Enhanced Labeling (Service Provider View)
    category VARCHAR(50), -- TOP_UP, SAVINGS, WITHDRAWAL, TRANSFER, REFUND
    sub_category VARCHAR(100),
    business_unit VARCHAR(50),
    revenue_type VARCHAR(50),
    
    -- Client Labeling (Client's Internal Categories)
    client_category VARCHAR(100), -- Client's own categorization
    client_reference VARCHAR(255), -- Client's internal reference
    client_metadata JSONB DEFAULT '{}',
    
    -- Reconciliation & Fees
    settlement_batch VARCHAR(100),
    settlement_date TIMESTAMP WITH TIME ZONE,
    fees_charged DECIMAL(10,2) DEFAULT 0,
    client_fee DECIMAL(10,2) DEFAULT 0, -- Fee charged to client
    service_provider_fee DECIMAL(10,2) DEFAULT 0, -- Our revenue
    net_amount DECIMAL(20,2),
    reconciliation_status VARCHAR(50) DEFAULT 'pending',
    
    -- Risk & Compliance
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    compliance_check_status VARCHAR(50) DEFAULT 'passed',
    flagged_for_review BOOLEAN DEFAULT false,
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE
);

-- Client Bank Transfers (Enhanced with approval workflow)
CREATE TABLE wallet.client_bank_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallet.client_customer_wallets(id),
    transaction_id UUID REFERENCES wallet.client_transactions(id),
    
    -- Bank Details
    bank_code VARCHAR(10) NOT NULL,
    bank_name VARCHAR(100),
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(255),
    
    -- Transfer Details
    amount DECIMAL(20,2) NOT NULL,
    narration TEXT,
    reference VARCHAR(255) UNIQUE,
    session_id VARCHAR(255),
    
    -- Status & Approval
    status VARCHAR(50) DEFAULT 'pending',
    approval_status VARCHAR(50) DEFAULT 'pending_approval',
    requires_approval BOOLEAN DEFAULT true,
    approved_by UUID REFERENCES service_provider.client_users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Processing
    external_reference VARCHAR(255), -- Xpress transfer reference
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Client Batch Operations
CREATE TABLE wallet.client_batch_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    
    -- Batch Details
    batch_reference VARCHAR(255) UNIQUE NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- credit, debit, bank_transfer
    total_count INTEGER NOT NULL,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_amount DECIMAL(20,2),
    
    -- Approval & Status
    status VARCHAR(50) DEFAULT 'pending',
    approval_status VARCHAR(50) DEFAULT 'pending_approval',
    initiated_by UUID REFERENCES service_provider.client_users(id),
    approved_by UUID REFERENCES service_provider.client_users(id),
    approval_notes TEXT,
    
    -- Processing
    items JSONB NOT NULL, -- Array of batch items
    results JSONB DEFAULT '{}',
    processing_started_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- CLIENT ANALYTICS & REPORTING TABLES
-- ============================================================================

-- Client Daily Summary (For client-specific analytics)
CREATE TABLE service_provider.client_daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES service_provider.clients(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    
    -- Transaction Metrics
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    pending_approvals INTEGER DEFAULT 0,
    
    -- Volume Metrics
    total_volume DECIMAL(20,2) DEFAULT 0,
    credit_volume DECIMAL(20,2) DEFAULT 0,
    debit_volume DECIMAL(20,2) DEFAULT 0,
    transfer_volume DECIMAL(20,2) DEFAULT 0,
    
    -- Revenue Metrics
    total_fees_collected DECIMAL(15,2) DEFAULT 0,
    service_provider_revenue DECIMAL(15,2) DEFAULT 0,
    
    -- Customer Metrics
    active_wallets INTEGER DEFAULT 0,
    new_wallets INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, summary_date)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Client-related indexes
CREATE INDEX idx_clients_client_code ON service_provider.clients(client_code);
CREATE INDEX idx_clients_status ON service_provider.clients(status);

-- Client users indexes
CREATE INDEX idx_client_users_client_id ON service_provider.client_users(client_id);
CREATE INDEX idx_client_users_role ON service_provider.client_users(role);

-- Client wallets indexes
CREATE INDEX idx_client_wallets_client_id ON wallet.client_customer_wallets(client_id);
CREATE INDEX idx_client_wallets_client_customer_id ON wallet.client_customer_wallets(client_id, client_customer_id);
CREATE INDEX idx_client_wallets_external_id ON wallet.client_customer_wallets(external_wallet_id);
CREATE INDEX idx_client_wallets_status ON wallet.client_customer_wallets(status);

-- Client transactions indexes
CREATE INDEX idx_client_transactions_client_id ON wallet.client_transactions(client_id);
CREATE INDEX idx_client_transactions_wallet_id ON wallet.client_transactions(wallet_id);
CREATE INDEX idx_client_transactions_status ON wallet.client_transactions(status);
CREATE INDEX idx_client_transactions_approval_status ON wallet.client_transactions(approval_status);
CREATE INDEX idx_client_transactions_created_at ON wallet.client_transactions(created_at);
CREATE INDEX idx_client_transactions_reference ON wallet.client_transactions(reference);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all client-isolated tables
ALTER TABLE service_provider.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_provider.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.client_customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.client_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.client_bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.client_batch_operations ENABLE ROW LEVEL SECURITY;

-- Service Provider Super Admin Access (Full access)
CREATE POLICY "Service provider admins can access all clients" ON service_provider.clients
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_provider_admin');

-- Client Access Policies (Limited to their own data)
CREATE POLICY "Clients can view their own data" ON service_provider.clients
    FOR SELECT USING (
        id IN (
            SELECT client_id FROM service_provider.client_users 
            WHERE user_id = auth.uid()
        )
    );

-- Client Users RLS
CREATE POLICY "Client users can view their client's users" ON service_provider.client_users
    FOR SELECT USING (
        client_id IN (
            SELECT client_id FROM service_provider.client_users 
            WHERE user_id = auth.uid()
        )
    );

-- Client Wallets RLS
CREATE POLICY "Clients can only access their own wallets" ON wallet.client_customer_wallets
    FOR ALL USING (
        client_id IN (
            SELECT client_id FROM service_provider.client_users 
            WHERE user_id = auth.uid()
        )
    );

-- Client Transactions RLS
CREATE POLICY "Clients can only access their own transactions" ON wallet.client_transactions
    FOR ALL USING (
        client_id IN (
            SELECT client_id FROM service_provider.client_users 
            WHERE user_id = auth.uid()
        )
    );

-- Similar policies for other tables...

-- ============================================================================
-- FUNCTIONS FOR CLIENT MANAGEMENT
-- ============================================================================

-- Function to generate client API key
CREATE OR REPLACE FUNCTION service_provider.generate_client_api_key()
RETURNS TEXT AS $$
DECLARE
    api_key TEXT;
BEGIN
    api_key := 'sp_' || encode(gen_random_bytes(32), 'base64');
    RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate client API key and get client context
CREATE OR REPLACE FUNCTION service_provider.validate_client_api_key(api_key_input TEXT)
RETURNS TABLE(
    client_id UUID,
    client_code VARCHAR(50),
    service_tier VARCHAR(50),
    features_enabled JSONB,
    daily_limit DECIMAL(20,2),
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.client_code,
        c.service_tier,
        c.features_enabled,
        c.daily_transaction_limit,
        (c.status = 'active')
    FROM service_provider.clients c
    WHERE c.api_key_hash = crypt(api_key_input, c.api_key_hash)
      AND c.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if client can perform operation
CREATE OR REPLACE FUNCTION service_provider.check_client_permission(
    p_client_id UUID,
    p_operation VARCHAR(100),
    p_amount DECIMAL(20,2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    client_record RECORD;
    daily_spent DECIMAL(20,2);
BEGIN
    -- Get client configuration
    SELECT * INTO client_record 
    FROM service_provider.clients 
    WHERE id = p_client_id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check feature permissions
    CASE p_operation
        WHEN 'batch_operations' THEN
            IF NOT (client_record.features_enabled->>'batch_operations')::BOOLEAN THEN
                RETURN FALSE;
            END IF;
        WHEN 'bank_transfers' THEN
            IF NOT (client_record.features_enabled->>'bank_transfers')::BOOLEAN THEN
                RETURN FALSE;
            END IF;
    END CASE;
    
    -- Check transaction limits if amount provided
    IF p_amount IS NOT NULL THEN
        -- Check single transaction limit
        IF p_amount > client_record.single_transaction_limit THEN
            RETURN FALSE;
        END IF;
        
        -- Check daily limit
        SELECT COALESCE(SUM(amount), 0) INTO daily_spent
        FROM wallet.client_transactions 
        WHERE client_id = p_client_id 
          AND DATE(created_at) = CURRENT_DATE
          AND status = 'completed';
          
        IF (daily_spent + p_amount) > client_record.daily_transaction_limit THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert service provider configuration
INSERT INTO wallet.providers (name, display_name, base_url, supported_features) VALUES
('xpress-wallet-service-provider', 'Xpress Wallet Service Provider', 'https://api.xpress-wallet.com/v1', 
 '{"banking": true, "cards": false, "bulk_transfers": true, "multi_tenant": true}'::jsonb);

-- Insert example client (Mega Meal)
INSERT INTO service_provider.clients (
    client_code, business_name, contact_email, api_key_hash,
    service_tier, features_enabled, daily_transaction_limit,
    single_transaction_limit, approval_threshold, transaction_fee_rate
) VALUES (
    'MEGA_MEAL',
    'Mega Meal Limited',
    'admin@megamealworld.com',
    crypt(service_provider.generate_client_api_key(), gen_salt('bf')),
    'PREMIUM',
    '{"batch_operations": true, "bank_transfers": true, "analytics": true}'::jsonb,
    10000000, -- 10M daily limit
    1000000,  -- 1M single transaction limit
    100000,   -- 100K approval threshold
    0.01      -- 1% fee rate
);

-- Insert client wallet configuration
INSERT INTO service_provider.client_wallet_configs (
    client_id, wallet_prefix, kyc_required,
    enable_bank_transfers, enable_batch_operations,
    brand_name, brand_colors
) VALUES (
    (SELECT id FROM service_provider.clients WHERE client_code = 'MEGA_MEAL'),
    'MGM',
    true,
    true,
    true,
    'Mega Meal Wallet',
    '{"primary": "#FF6B35", "secondary": "#004E89"}'::jsonb
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA service_provider IS 'Service provider multi-tenant architecture';
COMMENT ON TABLE service_provider.clients IS 'Service provider clients (Mega Meal, etc.)';
COMMENT ON TABLE wallet.client_customer_wallets IS 'Client-isolated customer wallets';
COMMENT ON TABLE wallet.client_transactions IS 'Client transactions with approval workflow';

-- Grant permissions
GRANT USAGE ON SCHEMA service_provider TO authenticated;
GRANT USAGE ON SCHEMA client_management TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA service_provider TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA client_management TO authenticated;