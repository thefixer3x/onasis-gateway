-- ============================================================================
-- WALLET AS A SERVICE (WaaS) DATABASE SCHEMA
-- Enhanced Xpress Wallet Integration with Full Banking Features
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create wallet schema for organization
CREATE SCHEMA IF NOT EXISTS wallet;

-- ============================================================================
-- CORE WALLET TABLES
-- ============================================================================

-- Wallet Service Providers (Xpress, Flutterwave, etc.)
CREATE TABLE wallet.providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- 'xpress-wallet'
    display_name VARCHAR(100) NOT NULL, -- 'Xpress Wallet'
    is_active BOOLEAN DEFAULT true,
    base_url TEXT NOT NULL,
    webhook_url TEXT,
    supported_features JSONB DEFAULT '{}', -- {"banking": true, "cards": false}
    configuration JSONB DEFAULT '{}', -- Provider-specific config
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Wallets (Mirror of Xpress Wallet)
CREATE TABLE wallet.customer_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES wallet.providers(id),
    external_wallet_id VARCHAR(255) UNIQUE, -- Xpress wallet ID
    account_number VARCHAR(20) UNIQUE,
    account_name VARCHAR(255),
    wallet_type VARCHAR(50) DEFAULT 'personal', -- personal, business, savings, group
    currency VARCHAR(10) DEFAULT 'NGN',
    balance DECIMAL(20,2) DEFAULT 0,
    available_balance DECIMAL(20,2) DEFAULT 0,
    ledger_balance DECIMAL(20,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- active, frozen, suspended, closed
    tier_level INTEGER DEFAULT 1, -- KYC tier level
    daily_limit DECIMAL(20,2),
    monthly_limit DECIMAL(20,2),
    metadata JSONB DEFAULT '{}',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallet Transactions with Enhanced Labeling
CREATE TABLE wallet.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallet.customer_wallets(id),
    external_transaction_id VARCHAR(255) UNIQUE,
    reference VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- credit, debit, transfer_in, transfer_out
    amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    balance_before DECIMAL(20,2),
    balance_after DECIMAL(20,2),
    description TEXT,
    narration TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, reversed
    
    -- Enhanced labeling for reconciliation
    category VARCHAR(50), -- TOP_UP, SAVINGS, WITHDRAWAL, TRANSFER, REFUND
    sub_category VARCHAR(100), -- wallet_funding, savings_contribution, etc.
    business_unit VARCHAR(50), -- SAVINGS, PAYMENTS, REFERRALS, GROUPS
    revenue_type VARCHAR(50), -- TRANSACTION_FEE, INTEREST, SUBSCRIPTION, COMMISSION
    
    -- Reconciliation fields
    settlement_batch VARCHAR(100),
    settlement_date TIMESTAMP WITH TIME ZONE,
    settlement_reference VARCHAR(255),
    accounting_code VARCHAR(50),
    tax_applicable BOOLEAN DEFAULT false,
    fees_charged DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(20,2),
    reconciliation_status VARCHAR(50) DEFAULT 'pending',
    
    -- User context
    user_segment VARCHAR(50), -- INDIVIDUAL, GROUP_LEADER, VIP, BUSINESS
    acquisition_channel VARCHAR(50), -- DIRECT, REFERRAL, GROUP, MARKETING
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    admin_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    reversed_at TIMESTAMP WITH TIME ZONE
);

-- Bank Transfer Records
CREATE TABLE wallet.bank_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallet.customer_wallets(id),
    transaction_id UUID REFERENCES wallet.transactions(id),
    bank_code VARCHAR(10) NOT NULL,
    bank_name VARCHAR(100),
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(255),
    amount DECIMAL(20,2) NOT NULL,
    narration TEXT,
    reference VARCHAR(255) UNIQUE,
    session_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Inter-wallet Transfers
CREATE TABLE wallet.wallet_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_wallet_id UUID REFERENCES wallet.customer_wallets(id),
    to_wallet_id UUID REFERENCES wallet.customer_wallets(id),
    from_transaction_id UUID REFERENCES wallet.transactions(id),
    to_transaction_id UUID REFERENCES wallet.transactions(id),
    amount DECIMAL(20,2) NOT NULL,
    reference VARCHAR(255) UNIQUE,
    narration TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Operations
CREATE TABLE wallet.batch_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_reference VARCHAR(255) UNIQUE NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- credit, debit, transfer
    total_count INTEGER NOT NULL,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_amount DECIMAL(20,2),
    status VARCHAR(50) DEFAULT 'pending',
    initiated_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    items JSONB NOT NULL, -- Array of batch items
    results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Webhook Events
CREATE TABLE wallet.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES wallet.providers(id),
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    payload JSONB NOT NULL,
    signature TEXT,
    signature_valid BOOLEAN,
    processed BOOLEAN DEFAULT false,
    processing_attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Wallet Sync Jobs
CREATE TABLE wallet.sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallet.customer_wallets(id),
    sync_type VARCHAR(50) NOT NULL, -- balance, transactions, full
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- RECONCILIATION TABLES
-- ============================================================================

-- Daily Reconciliation Summary
CREATE TABLE wallet.daily_reconciliation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_date DATE UNIQUE NOT NULL,
    provider_id UUID REFERENCES wallet.providers(id),
    
    -- Transaction counts
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    reversed_transactions INTEGER DEFAULT 0,
    
    -- Amount summaries
    total_credits DECIMAL(20,2) DEFAULT 0,
    total_debits DECIMAL(20,2) DEFAULT 0,
    total_fees DECIMAL(20,2) DEFAULT 0,
    net_amount DECIMAL(20,2) DEFAULT 0,
    
    -- Settlement info
    expected_settlement DECIMAL(20,2) DEFAULT 0,
    actual_settlement DECIMAL(20,2) DEFAULT 0,
    settlement_variance DECIMAL(20,2) DEFAULT 0,
    
    -- Revenue breakdown
    transaction_fee_revenue DECIMAL(20,2) DEFAULT 0,
    interest_revenue DECIMAL(20,2) DEFAULT 0,
    other_revenue DECIMAL(20,2) DEFAULT 0,
    
    -- Status
    reconciliation_status VARCHAR(50) DEFAULT 'pending',
    reconciled_by UUID REFERENCES auth.users(id),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reconciled_at TIMESTAMP WITH TIME ZONE
);

-- Reconciliation Issues
CREATE TABLE wallet.reconciliation_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_date DATE NOT NULL,
    issue_type VARCHAR(100) NOT NULL, -- balance_mismatch, missing_transaction, fee_discrepancy
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    description TEXT NOT NULL,
    affected_wallet_id UUID REFERENCES wallet.customer_wallets(id),
    affected_transaction_id UUID REFERENCES wallet.transactions(id),
    discrepancy_amount DECIMAL(20,2),
    resolution_status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- VIEWS FOR ANALYTICS AND REPORTING
-- ============================================================================

-- Admin Reconciliation Dashboard View
CREATE OR REPLACE VIEW wallet.admin_reconciliation_view AS
SELECT 
    DATE(t.created_at) as transaction_date,
    t.business_unit,
    t.revenue_type,
    t.category,
    t.status,
    COUNT(*) as transaction_count,
    SUM(t.amount) as gross_amount,
    SUM(t.fees_charged) as total_fees,
    SUM(t.net_amount) as net_amount,
    COUNT(CASE WHEN t.reconciliation_status = 'completed' THEN 1 END) as reconciled_count
FROM wallet.transactions t
GROUP BY 
    DATE(t.created_at), 
    t.business_unit, 
    t.revenue_type,
    t.category,
    t.status
ORDER BY transaction_date DESC;

-- Wallet Performance View
CREATE OR REPLACE VIEW wallet.wallet_performance AS
SELECT 
    w.id,
    w.account_number,
    w.account_name,
    w.wallet_type,
    w.status,
    w.balance,
    COUNT(t.id) as transaction_count,
    SUM(CASE WHEN t.type IN ('credit', 'transfer_in') THEN t.amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN t.type IN ('debit', 'transfer_out') THEN t.amount ELSE 0 END) as total_debits,
    MAX(t.created_at) as last_transaction_date
FROM wallet.customer_wallets w
LEFT JOIN wallet.transactions t ON w.id = t.wallet_id
GROUP BY w.id;

-- Revenue Analytics View
CREATE OR REPLACE VIEW wallet.revenue_analytics AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    business_unit,
    revenue_type,
    SUM(fees_charged) as total_fees,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_transaction_amount
FROM wallet.transactions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', created_at), business_unit, revenue_type;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Customer Wallets indexes
CREATE INDEX idx_wallets_user_id ON wallet.customer_wallets(user_id);
CREATE INDEX idx_wallets_account_number ON wallet.customer_wallets(account_number);
CREATE INDEX idx_wallets_external_id ON wallet.customer_wallets(external_wallet_id);
CREATE INDEX idx_wallets_status ON wallet.customer_wallets(status);

-- Transactions indexes
CREATE INDEX idx_transactions_wallet_id ON wallet.transactions(wallet_id);
CREATE INDEX idx_transactions_reference ON wallet.transactions(reference);
CREATE INDEX idx_transactions_external_id ON wallet.transactions(external_transaction_id);
CREATE INDEX idx_transactions_status ON wallet.transactions(status);
CREATE INDEX idx_transactions_created_at ON wallet.transactions(created_at);
CREATE INDEX idx_transactions_business_unit ON wallet.transactions(business_unit);
CREATE INDEX idx_transactions_reconciliation ON wallet.transactions(reconciliation_status);

-- Bank Transfers indexes
CREATE INDEX idx_bank_transfers_wallet_id ON wallet.bank_transfers(wallet_id);
CREATE INDEX idx_bank_transfers_reference ON wallet.bank_transfers(reference);
CREATE INDEX idx_bank_transfers_status ON wallet.bank_transfers(status);

-- Webhook Events indexes
CREATE INDEX idx_webhook_events_processed ON wallet.webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON wallet.webhook_events(created_at);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to calculate net amount after fees
CREATE OR REPLACE FUNCTION wallet.calculate_net_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.net_amount = NEW.amount - COALESCE(NEW.fees_charged, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate net amount
CREATE TRIGGER calculate_net_amount_trigger
BEFORE INSERT OR UPDATE ON wallet.transactions
FOR EACH ROW EXECUTE FUNCTION wallet.calculate_net_amount();

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION wallet.update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.type IN ('credit', 'transfer_in') THEN
            UPDATE wallet.customer_wallets 
            SET balance = balance + NEW.amount,
                available_balance = available_balance + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        ELSIF NEW.type IN ('debit', 'transfer_out') THEN
            UPDATE wallet.customer_wallets 
            SET balance = balance - NEW.amount,
                available_balance = available_balance - NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update wallet balance
CREATE TRIGGER update_wallet_balance_trigger
AFTER UPDATE ON wallet.transactions
FOR EACH ROW EXECUTE FUNCTION wallet.update_wallet_balance();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all wallet tables
ALTER TABLE wallet.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet.wallet_transfers ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view their own wallets" ON wallet.customer_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions" ON wallet.transactions
    FOR SELECT USING (
        wallet_id IN (SELECT id FROM wallet.customer_wallets WHERE user_id = auth.uid())
    );

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert Xpress Wallet provider
INSERT INTO wallet.providers (name, display_name, base_url, supported_features) VALUES
('xpress-wallet', 'Xpress Wallet', 'https://api.xpress-wallet.com/v1', 
 '{"banking": true, "cards": false, "bulk_transfers": true, "inter_wallet": true}'::jsonb);

-- Insert sample transaction categories and labels
INSERT INTO wallet.accounting_codes (code, description, category) VALUES
('REV_TXN_FEE', 'Transaction Fee Revenue', 'revenue'),
('REV_INT_SPREAD', 'Interest Spread Revenue', 'revenue'),
('COST_REF_COMM', 'Referral Commission Cost', 'cost'),
('COST_XPRESS_FEE', 'Xpress Wallet Fees', 'cost');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA wallet IS 'Wallet as a Service schema for managing financial wallets';
COMMENT ON TABLE wallet.customer_wallets IS 'Customer wallet accounts mirroring external provider wallets';
COMMENT ON TABLE wallet.transactions IS 'All wallet transactions with enhanced labeling for reconciliation';
COMMENT ON TABLE wallet.daily_reconciliation IS 'Daily reconciliation summaries for admin management';

-- Grant permissions
GRANT USAGE ON SCHEMA wallet TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA wallet TO authenticated;
GRANT INSERT, UPDATE ON wallet.customer_wallets TO authenticated;
GRANT INSERT ON wallet.transactions TO authenticated;