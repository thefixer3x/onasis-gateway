-- Credit-as-a-Service Schema Migration for Onasis Gateway
-- This migration adds comprehensive credit services to the existing Onasis Gateway database
-- Integrates with existing onasis, core, and audit schemas

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create dedicated credit schema
CREATE SCHEMA IF NOT EXISTS credit;

-- Set search path to include credit schema
SET search_path TO credit, onasis, core, audit, public;

-- =====================================================
-- CORE CREDIT ENTITIES
-- =====================================================

-- Credit applications (comprehensive tracking)
CREATE TABLE credit.applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reference_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL, -- Links to core.users or external system
    
    -- Application details
    application_type VARCHAR(50) NOT NULL CHECK (application_type IN ('personal', 'business', 'asset_finance')),
    requested_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    loan_purpose TEXT,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'under_review', 'approved', 'rejected', 
        'disbursed', 'active', 'completed', 'defaulted'
    )),
    
    -- Provider assignment
    assigned_provider_id UUID,
    provider_score DECIMAL(5,2),
    competitive_bidding BOOLEAN DEFAULT false,
    
    -- Risk assessment
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 850),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
    risk_factors JSONB,
    
    -- Documents and verification
    documents_submitted JSONB DEFAULT '[]',
    verification_status VARCHAR(50) DEFAULT 'pending',
    kyc_completed BOOLEAN DEFAULT false,
    
    -- Financial details
    applicant_income DECIMAL(15,2),
    debt_to_income_ratio DECIMAL(5,2),
    credit_history_length INTEGER, -- months
    existing_credit_accounts INTEGER,
    
    -- Integration with Onasis Gateway audit
    request_id VARCHAR(100), -- Links to audit.request_logs
    api_key_id UUID, -- Links to core.api_keys
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    disbursed_at TIMESTAMP WITH TIME ZONE
);

-- Credit providers (integrated with Onasis Gateway)
CREATE TABLE credit.providers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    
    -- Provider details
    provider_type VARCHAR(50) CHECK (provider_type IN ('bank', 'fintech', 'microfinance', 'p2p_lending')),
    license_number VARCHAR(100),
    regulatory_body VARCHAR(100),
    
    -- API integration (leverages existing Onasis patterns)
    api_endpoint TEXT,
    webhook_url TEXT,
    integration_type VARCHAR(50) CHECK (integration_type IN ('direct_api', 'webhook', 'manual')),
    api_credentials_encrypted TEXT, -- Encrypted JSON
    
    -- Credit criteria
    min_loan_amount DECIMAL(15,2),
    max_loan_amount DECIMAL(15,2),
    supported_currencies VARCHAR(50)[] DEFAULT '{NGN}',
    min_credit_score INTEGER,
    max_processing_days INTEGER,
    
    -- Performance metrics
    approval_rate DECIMAL(5,2),
    average_processing_time_hours INTEGER,
    default_rate DECIMAL(5,2),
    customer_satisfaction_score DECIMAL(3,2),
    
    -- Business terms
    interest_rate_range NUMRANGE,
    platform_commission_percentage DECIMAL(5,2) DEFAULT 8.5,
    revenue_share_model VARCHAR(50) DEFAULT 'percentage',
    
    -- Geographic coverage
    service_regions VARCHAR(50)[] DEFAULT '{NG}',
    
    -- Status and compliance
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    compliance_verified BOOLEAN DEFAULT false,
    last_compliance_check TIMESTAMP WITH TIME ZONE,
    
    -- Integration with Onasis Gateway
    onboarded_by UUID, -- Admin user ID
    technical_contact_email VARCHAR(255),
    business_contact_email VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provider bidding system
CREATE TABLE credit.provider_bids (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    application_id UUID REFERENCES credit.applications(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES credit.providers(id) ON DELETE CASCADE,
    
    -- Bid details
    offered_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    processing_fee DECIMAL(10,2) DEFAULT 0,
    loan_term_months INTEGER NOT NULL,
    
    -- Bid conditions
    conditions JSONB,
    collateral_required BOOLEAN DEFAULT false,
    guarantor_required BOOLEAN DEFAULT false,
    
    -- Bid status
    bid_status VARCHAR(20) DEFAULT 'submitted' CHECK (bid_status IN (
        'submitted', 'reviewed', 'accepted', 'rejected', 'withdrawn'
    )),
    
    -- Auto-scoring
    bid_score DECIMAL(5,2),
    ranking INTEGER,
    
    -- Response times
    bid_submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provider_response_time_minutes INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(application_id, provider_id)
);

-- Credit transactions (integrated with existing payment gateways)
CREATE TABLE credit.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    application_id UUID REFERENCES credit.applications(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES credit.providers(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('disbursement', 'repayment', 'fee', 'penalty')),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    
    -- Integration with existing payment gateways (Stripe, Wise, BAP, etc.)
    payment_reference VARCHAR(100) UNIQUE NOT NULL,
    gateway_provider VARCHAR(50), -- 'stripe', 'wise', 'bap', 'paystack'
    gateway_transaction_id VARCHAR(100),
    
    -- Status
    transaction_status VARCHAR(20) DEFAULT 'pending' CHECK (transaction_status IN (
        'pending', 'processing', 'completed', 'failed', 'reversed'
    )),
    
    -- Platform fees
    platform_fee_amount DECIMAL(10,2),
    platform_fee_percentage DECIMAL(5,2),
    
    -- Reconciliation
    reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    
    -- Onasis Gateway integration
    request_id VARCHAR(100), -- Links to audit.request_logs
    processed_by_tool VARCHAR(100), -- Which Onasis tool processed this
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Credit analytics and reporting
CREATE TABLE credit.analytics_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    
    -- Application metrics
    applications_submitted INTEGER DEFAULT 0,
    applications_approved INTEGER DEFAULT 0,
    applications_rejected INTEGER DEFAULT 0,
    total_amount_requested DECIMAL(15,2) DEFAULT 0,
    total_amount_approved DECIMAL(15,2) DEFAULT 0,
    
    -- Provider metrics
    active_providers INTEGER DEFAULT 0,
    average_approval_rate DECIMAL(5,2),
    average_processing_time_hours DECIMAL(8,2),
    
    -- Financial metrics
    total_disbursed DECIMAL(15,2) DEFAULT 0,
    total_repaid DECIMAL(15,2) DEFAULT 0,
    platform_revenue DECIMAL(12,2) DEFAULT 0,
    
    -- Performance metrics
    default_rate DECIMAL(5,2),
    customer_satisfaction DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(metric_date, metric_type)
);

-- =====================================================
-- INTEGRATION FUNCTIONS
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION credit.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON credit.applications FOR EACH ROW EXECUTE FUNCTION credit.update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON credit.providers FOR EACH ROW EXECUTE FUNCTION credit.update_updated_at_column();
CREATE TRIGGER update_provider_bids_updated_at BEFORE UPDATE ON credit.provider_bids FOR EACH ROW EXECUTE FUNCTION credit.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON credit.transactions FOR EACH ROW EXECUTE FUNCTION credit.update_updated_at_column();

-- Function to sync with Onasis Gateway audit system
CREATE OR REPLACE FUNCTION credit.log_credit_activity(
    p_action_type VARCHAR(50),
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(100),
    p_user_id VARCHAR(100),
    p_changes JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    -- This would integrate with existing audit.request_logs or similar
    -- For now, we'll create a placeholder that can be connected later
    INSERT INTO credit.activity_log (
        action_type, resource_type, resource_id, user_id, changes, created_at
    ) VALUES (
        p_action_type, p_resource_type, p_resource_id, p_user_id, p_changes, NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Simple activity log table (can be integrated with existing audit later)
CREATE TABLE credit.activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    user_id VARCHAR(100),
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Applications indexes
CREATE INDEX idx_credit_applications_status ON credit.applications(status);
CREATE INDEX idx_credit_applications_user_id ON credit.applications(user_id);
CREATE INDEX idx_credit_applications_provider ON credit.applications(assigned_provider_id);
CREATE INDEX idx_credit_applications_reference ON credit.applications(reference_id);
CREATE INDEX idx_credit_applications_created_at ON credit.applications(created_at);

-- Providers indexes
CREATE INDEX idx_credit_providers_status ON credit.providers(status);
CREATE INDEX idx_credit_providers_type ON credit.providers(provider_type);
CREATE INDEX idx_credit_providers_code ON credit.providers(provider_code);

-- Transactions indexes
CREATE INDEX idx_credit_transactions_reference ON credit.transactions(payment_reference);
CREATE INDEX idx_credit_transactions_status ON credit.transactions(transaction_status);
CREATE INDEX idx_credit_transactions_application ON credit.transactions(application_id);
CREATE INDEX idx_credit_transactions_gateway ON credit.transactions(gateway_provider);

-- Analytics indexes
CREATE INDEX idx_credit_analytics_date ON credit.analytics_metrics(metric_date);
CREATE INDEX idx_credit_analytics_type ON credit.analytics_metrics(metric_type);

-- =====================================================
-- REGISTER CAAS ADAPTER IN ONASIS GATEWAY
-- =====================================================

-- Register CaaS as a native Onasis Gateway adapter
INSERT INTO onasis.adapters (
    name,
    display_name,
    description,
    category,
    auth_type,
    base_url,
    version,
    status,
    configuration,
    created_at
) VALUES (
    'credit-as-a-service',
    'Credit-as-a-Service',
    'Comprehensive credit management and lending platform with provider integration',
    'financial',
    'Bearer',
    NULL, -- Internal service, no external URL
    '1.0.0',
    'active',
    '{
        "internal_service": true,
        "requires_kyc": true,
        "supports_webhooks": true,
        "rate_limit_per_minute": 100,
        "supported_currencies": ["NGN", "USD", "EUR"],
        "max_loan_amount": 10000000,
        "min_credit_score": 300
    }'::jsonb,
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    configuration = EXCLUDED.configuration,
    updated_at = NOW();

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA credit TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA credit TO PUBLIC;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA credit TO PUBLIC;

-- Migration completed
SELECT 'Credit Schema Migration Completed Successfully' as status;