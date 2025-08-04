-- 🏗️ Onasis Gateway Database Schema for Supabase
-- This schema supports the MCP server backend and VortexCore integration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS onasis;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- API Keys and Authentication
CREATE TABLE core.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id VARCHAR(50) UNIQUE NOT NULL,
    key_hash TEXT NOT NULL, -- bcrypt hash of the actual key
    name VARCHAR(100) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id VARCHAR(50), -- e.g., 'vortexcore', 'onasis'
    permissions JSONB DEFAULT '{}', -- {"adapters": ["stripe-api"], "rate_limit": 1000}
    rate_limit_per_hour INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Adapters Registry
CREATE TABLE onasis.adapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'stripe-api'
    display_name VARCHAR(100) NOT NULL, -- e.g., 'Stripe API'
    description TEXT,
    category VARCHAR(50), -- 'payment', 'hosting', 'analytics', etc.
    auth_type VARCHAR(20), -- 'Bearer', 'API_Key', 'OAuth2'
    base_url TEXT,
    documentation_url TEXT,
    icon_url TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    configuration JSONB DEFAULT '{}', -- adapter-specific config
    metadata JSONB DEFAULT '{}', -- additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tools within each adapter
CREATE TABLE onasis.tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adapter_id UUID REFERENCES onasis.adapters(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'create-payment-intent'
    display_name VARCHAR(100), -- e.g., 'Create Payment Intent'
    description TEXT,
    method VARCHAR(10) DEFAULT 'POST', -- HTTP method
    endpoint_path TEXT, -- relative path within the adapter
    input_schema JSONB, -- JSON schema for input validation
    output_schema JSONB, -- JSON schema for output
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(adapter_id, name)
);

-- User sessions and authentication
CREATE TABLE core.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    project_id VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AUDIT AND LOGGING
-- ============================================================================

-- Request logs for all API calls
CREATE TABLE audit.request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    api_key_id UUID REFERENCES core.api_keys(id),
    project_id VARCHAR(50),
    adapter_name VARCHAR(100),
    tool_name VARCHAR(100),
    method VARCHAR(10),
    endpoint TEXT,
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_headers JSONB,
    response_body JSONB,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    error_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting tracking
CREATE TABLE audit.rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID REFERENCES core.api_keys(id) ON DELETE CASCADE,
    adapter_name VARCHAR(100),
    tool_name VARCHAR(100),
    window_start TIMESTAMP WITH TIME ZONE,
    window_end TIMESTAMP WITH TIME ZONE,
    request_count INTEGER DEFAULT 0,
    limit_exceeded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(api_key_id, adapter_name, tool_name, window_start)
);

-- System health metrics
CREATE TABLE audit.health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_unit VARCHAR(20),
    adapter_name VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Environment-specific configurations
CREATE TABLE core.configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    environment VARCHAR(20) DEFAULT 'production', -- 'development', 'staging', 'production'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook configurations
CREATE TABLE core.webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- for webhook signature verification
    events TEXT[], -- array of event types to listen for
    adapter_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- API Keys indexes
CREATE INDEX idx_api_keys_key_id ON core.api_keys(key_id);
CREATE INDEX idx_api_keys_user_id ON core.api_keys(user_id);
CREATE INDEX idx_api_keys_project_id ON core.api_keys(project_id);
CREATE INDEX idx_api_keys_active ON core.api_keys(is_active) WHERE is_active = true;

-- Adapters indexes
CREATE INDEX idx_adapters_name ON onasis.adapters(name);
CREATE INDEX idx_adapters_category ON onasis.adapters(category);
CREATE INDEX idx_adapters_active ON onasis.adapters(is_active) WHERE is_active = true;

-- Tools indexes
CREATE INDEX idx_tools_adapter_id ON onasis.tools(adapter_id);
CREATE INDEX idx_tools_name ON onasis.tools(name);
CREATE INDEX idx_tools_active ON onasis.tools(is_active) WHERE is_active = true;

-- Request logs indexes (for analytics and monitoring)
CREATE INDEX idx_request_logs_user_id ON audit.request_logs(user_id);
CREATE INDEX idx_request_logs_api_key_id ON audit.request_logs(api_key_id);
CREATE INDEX idx_request_logs_adapter_name ON audit.request_logs(adapter_name);
CREATE INDEX idx_request_logs_created_at ON audit.request_logs(created_at);
CREATE INDEX idx_request_logs_response_status ON audit.request_logs(response_status);

-- Rate limits indexes
CREATE INDEX idx_rate_limits_api_key_id ON audit.rate_limits(api_key_id);
CREATE INDEX idx_rate_limits_window ON audit.rate_limits(window_start, window_end);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE core.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE onasis.adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE onasis.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.webhooks ENABLE ROW LEVEL SECURITY;

-- API Keys policies
CREATE POLICY "Users can view their own API keys" ON core.api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" ON core.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON core.api_keys
    FOR UPDATE USING (auth.uid() = user_id);

-- Adapters policies (public read, admin write)
CREATE POLICY "Anyone can view active adapters" ON onasis.adapters
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage adapters" ON onasis.adapters
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Tools policies (public read for active tools)
CREATE POLICY "Anyone can view active tools" ON onasis.tools
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage tools" ON onasis.tools
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Request logs policies (users can view their own logs)
CREATE POLICY "Users can view their own request logs" ON audit.request_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can view all logs" ON audit.request_logs
    FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON core.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adapters_updated_at BEFORE UPDATE ON onasis.adapters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON onasis.tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON core.configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'onasis_' || encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(key_input TEXT)
RETURNS TABLE(
    key_id UUID,
    user_id UUID,
    project_id VARCHAR(50),
    permissions JSONB,
    rate_limit_per_hour INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ak.id,
        ak.user_id,
        ak.project_id,
        ak.permissions,
        ak.rate_limit_per_hour
    FROM core.api_keys ak
    WHERE ak.key_id = split_part(key_input, '_', 2)
      AND ak.is_active = true
      AND (ak.expires_at IS NULL OR ak.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default adapters (based on your generated adapters)
INSERT INTO onasis.adapters (name, display_name, description, category, auth_type, version) VALUES
('stripe-api', 'Stripe API', 'Stripe payment processing and financial services', 'payment', 'Bearer', '1.0.0'),
('ngrok-api', 'ngrok API', 'ngrok tunneling and networking services', 'networking', 'Bearer', '1.0.0'),
('shutterstock-api', 'Shutterstock API', 'Shutterstock media and content services', 'media', 'Bearer', '1.0.0'),
('bap-api', 'BAP API', 'Biller Aggregation Portal - Nigerian payment services', 'payment', 'API_Key', '1.0.0'),
('google-analytics-api', 'Google Analytics API', 'Google Analytics reporting and insights', 'analytics', 'OAuth2', '1.0.0'),
('hostinger-api', 'Hostinger API', 'Hostinger VPS and hosting management', 'hosting', 'Bearer', '1.0.0'),
('wise-mca-api', 'Wise MCA API', 'Wise multicurrency account management', 'financial', 'Bearer', '1.0.0'),
('open-banking-api', 'Open Banking API', 'Open banking and financial data services', 'financial', 'OAuth2', '1.0.0'),
('xpress-wallet-api', 'Xpress Wallet API', 'Xpress Wallet merchant services', 'payment', 'API_Key', '1.0.0'),
('seftec-payment-api', 'Seftec Payment API', 'Seftec payment collection services', 'payment', 'Bearer', '1.0.0');

-- Insert default configurations
INSERT INTO core.configurations (key, value, description, environment) VALUES
('gateway_version', '1.0.0', 'Current gateway version', 'production'),
('default_rate_limit', '100', 'Default rate limit per hour for new API keys', 'production'),
('max_request_size', '10485760', 'Maximum request size in bytes (10MB)', 'production'),
('request_timeout', '30000', 'Default request timeout in milliseconds', 'production'),
('enable_logging', 'true', 'Enable request/response logging', 'production'),
('cors_origins', '["https://saas-vortexcore-app.netlify.app"]', 'Allowed CORS origins', 'production');

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- View for adapter usage statistics
CREATE VIEW onasis.adapter_usage_stats AS
SELECT 
    a.name,
    a.display_name,
    a.category,
    COUNT(rl.id) as total_requests,
    COUNT(CASE WHEN rl.response_status >= 200 AND rl.response_status < 300 THEN 1 END) as successful_requests,
    COUNT(CASE WHEN rl.response_status >= 400 THEN 1 END) as failed_requests,
    AVG(rl.response_time_ms) as avg_response_time,
    MAX(rl.created_at) as last_used_at
FROM onasis.adapters a
LEFT JOIN audit.request_logs rl ON a.name = rl.adapter_name
WHERE a.is_active = true
GROUP BY a.id, a.name, a.display_name, a.category;

-- View for user API usage
CREATE VIEW core.user_api_usage AS
SELECT 
    u.id as user_id,
    u.email,
    ak.project_id,
    COUNT(rl.id) as total_requests,
    COUNT(DISTINCT rl.adapter_name) as adapters_used,
    MAX(rl.created_at) as last_request_at,
    ak.rate_limit_per_hour,
    COUNT(CASE WHEN rl.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as requests_last_hour
FROM auth.users u
JOIN core.api_keys ak ON u.id = ak.user_id
LEFT JOIN audit.request_logs rl ON ak.id = rl.api_key_id
WHERE ak.is_active = true
GROUP BY u.id, u.email, ak.project_id, ak.rate_limit_per_hour;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON SCHEMA onasis IS 'Onasis Gateway specific tables for adapters and tools';
COMMENT ON SCHEMA core IS 'Core system tables for authentication and configuration';
COMMENT ON SCHEMA audit IS 'Audit and logging tables for monitoring and compliance';

COMMENT ON TABLE core.api_keys IS 'API keys for authentication and authorization';
COMMENT ON TABLE onasis.adapters IS 'Registry of available API adapters';
COMMENT ON TABLE onasis.tools IS 'Individual tools/endpoints within each adapter';
COMMENT ON TABLE audit.request_logs IS 'Complete log of all API requests and responses';
COMMENT ON TABLE audit.rate_limits IS 'Rate limiting tracking and enforcement';

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA onasis TO authenticated;
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT USAGE ON SCHEMA audit TO authenticated;

GRANT SELECT ON onasis.adapters TO authenticated;
GRANT SELECT ON onasis.tools TO authenticated;
GRANT SELECT ON onasis.adapter_usage_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON core.api_keys TO authenticated;
GRANT SELECT ON core.user_api_usage TO authenticated;
