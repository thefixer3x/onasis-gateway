/**
 * Credit-as-a-Service (CaaS) MCP Tools TypeScript Definitions
 * Provides comprehensive type definitions for all CaaS MCP tools in the unified Onasis Gateway
 */

// =============================================================================
// Common Types and Enums
// =============================================================================

export type CreditApplicationType = 'personal' | 'business' | 'asset_finance';
export type CreditApplicationStatus = 
  | 'pending' 
  | 'under_review' 
  | 'approved' 
  | 'rejected' 
  | 'disbursed' 
  | 'active' 
  | 'completed' 
  | 'defaulted';

export type CreditProviderType = 'bank' | 'fintech' | 'microfinance' | 'p2p_lending';
export type CreditProviderStatus = 'active' | 'inactive' | 'suspended';

export type CreditTransactionType = 'disbursement' | 'repayment' | 'fee' | 'penalty';
export type CreditGatewayProvider = 'stripe' | 'wise' | 'bap' | 'paystack';
export type CreditCurrency = 'NGN' | 'USD' | 'EUR';

export type CreditCheckType = 'basic' | 'enhanced' | 'comprehensive';
export type CreditAnalyticsMetric = 'daily' | 'weekly' | 'monthly';
export type CreditPerformancePeriod = 'last_30_days' | 'last_90_days' | 'last_year';

// =============================================================================
// Request/Response Interfaces
// =============================================================================

export interface CreditApplicationRequest {
  application_type: CreditApplicationType;
  requested_amount: number;
  currency?: CreditCurrency;
  loan_purpose?: string;
  applicant_income?: number;
  user_id: string;
}

export interface CreditApplication {
  id: string;
  application_type: CreditApplicationType;
  requested_amount: number;
  currency: CreditCurrency;
  loan_purpose?: string;
  applicant_income?: number;
  user_id: string;
  status: CreditApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface CreditApplicationsQuery {
  status?: CreditApplicationStatus;
  user_id?: string;
  page?: number;
  limit?: number;
}

export interface CreditApplicationsResponse {
  success: boolean;
  data: CreditApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreditApplicationStatusUpdate {
  applicationId: string;
  status: CreditApplicationStatus;
  notes?: string;
}

export interface CreditProviderRequest {
  provider_code: string;
  company_name: string;
  provider_type: CreditProviderType;
  api_endpoint?: string;
  min_loan_amount?: number;
  max_loan_amount?: number;
}

export interface CreditProvider {
  id: string;
  provider_code: string;
  company_name: string;
  provider_type: CreditProviderType;
  api_endpoint?: string;
  min_loan_amount: number;
  max_loan_amount: number;
  status: CreditProviderStatus;
  created_at: string;
  updated_at: string;
}

export interface CreditProvidersQuery {
  status?: CreditProviderStatus;
  provider_type?: CreditProviderType;
  page?: number;
  limit?: number;
}

export interface CreditProvidersResponse {
  success: boolean;
  data: CreditProvider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreditProviderBidRequest {
  application_id: string;
  provider_id: string;
  offered_amount: number;
  interest_rate: number;
  loan_term_months: number;
  conditions?: Record<string, any>;
}

export interface CreditProviderBid {
  id: string;
  application_id: string;
  provider_id: string;
  offered_amount: number;
  interest_rate: number;
  loan_term_months: number;
  conditions?: Record<string, any>;
  status: string;
  created_at: string;
}

export interface CreditTransactionRequest {
  application_id: string;
  transaction_type: CreditTransactionType;
  amount: number;
  gateway_provider?: CreditGatewayProvider;
  currency?: CreditCurrency;
}

export interface CreditTransaction {
  id: string;
  application_id: string;
  transaction_type: CreditTransactionType;
  amount: number;
  gateway_provider: CreditGatewayProvider;
  currency: CreditCurrency;
  status: string;
  reference: string;
  created_at: string;
  processed_at?: string;
}

export interface CreditCheckRequest {
  user_id: string;
  check_type?: CreditCheckType;
}

export interface CreditCheckResult {
  user_id: string;
  check_type: CreditCheckType;
  credit_score: number;
  risk_category: string;
  report_data: Record<string, any>;
  checked_at: string;
}

export interface CreditAnalyticsQuery {
  metric_type?: CreditAnalyticsMetric;
  start_date?: string;
  end_date?: string;
}

export interface CreditAnalytics {
  metric_type: CreditAnalyticsMetric;
  period: {
    start_date: string;
    end_date: string;
  };
  metrics: {
    total_applications: number;
    approved_applications: number;
    disbursed_amount: number;
    default_rate: number;
    average_interest_rate: number;
  };
}

export interface CreditProviderPerformanceQuery {
  provider_id?: string;
  period?: CreditPerformancePeriod;
}

export interface CreditProviderPerformance {
  provider_id: string;
  period: CreditPerformancePeriod;
  metrics: {
    total_bids: number;
    successful_bids: number;
    average_interest_rate: number;
    disbursed_amount: number;
    default_rate: number;
  };
}

export interface CreditHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  database_status: string;
  external_services: Record<string, string>;
  timestamp: string;
}

// =============================================================================
// MCP Tool Response Types
// =============================================================================

export interface MCPToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  tool?: string;
  timestamp?: string;
}

export interface MCPContextInfo {
  requestId?: string;
  userId?: string;
  apiKeyId?: string;
}

// =============================================================================
// Credit MCP Tools Interface
// =============================================================================

export interface CreditMCPTools {
  // Credit Application Tools
  credit_submit_application(params: CreditApplicationRequest & MCPContextInfo): Promise<MCPToolResponse<CreditApplication>>;
  credit_get_applications(params: CreditApplicationsQuery & MCPContextInfo): Promise<MCPToolResponse<CreditApplicationsResponse>>;
  credit_get_application(params: { applicationId: string } & MCPContextInfo): Promise<MCPToolResponse<CreditApplication>>;
  credit_update_application_status(params: CreditApplicationStatusUpdate & MCPContextInfo): Promise<MCPToolResponse<CreditApplication>>;

  // Credit Provider Tools
  credit_register_provider(params: CreditProviderRequest & MCPContextInfo): Promise<MCPToolResponse<CreditProvider>>;
  credit_get_providers(params: CreditProvidersQuery & MCPContextInfo): Promise<MCPToolResponse<CreditProvidersResponse>>;
  credit_submit_provider_bid(params: CreditProviderBidRequest & MCPContextInfo): Promise<MCPToolResponse<CreditProviderBid>>;

  // Credit Transaction Tools
  credit_process_transaction(params: CreditTransactionRequest & MCPContextInfo): Promise<MCPToolResponse<CreditTransaction>>;

  // Credit Scoring Tools
  credit_perform_credit_check(params: CreditCheckRequest & MCPContextInfo): Promise<MCPToolResponse<CreditCheckResult>>;

  // Analytics Tools
  credit_get_analytics(params: CreditAnalyticsQuery & MCPContextInfo): Promise<MCPToolResponse<CreditAnalytics>>;
  credit_provider_performance(params: CreditProviderPerformanceQuery & MCPContextInfo): Promise<MCPToolResponse<CreditProviderPerformance>>;

  // Health Check Tool
  credit_health_check(params: MCPContextInfo): Promise<MCPToolResponse<CreditHealthCheck>>;
}

// =============================================================================
// Credit Client Interface (for internal use)
// =============================================================================

export interface CreditAsAServiceClient {
  submitCreditApplication(params: CreditApplicationRequest): Promise<MCPToolResponse<CreditApplication>>;
  getCreditApplications(params: CreditApplicationsQuery): Promise<MCPToolResponse<CreditApplicationsResponse>>;
  getCreditApplication(params: { applicationId: string }): Promise<MCPToolResponse<CreditApplication>>;
  updateApplicationStatus(params: CreditApplicationStatusUpdate): Promise<MCPToolResponse<CreditApplication>>;
  
  registerCreditProvider(params: CreditProviderRequest): Promise<MCPToolResponse<CreditProvider>>;
  getCreditProviders(params: CreditProvidersQuery): Promise<MCPToolResponse<CreditProvidersResponse>>;
  submitProviderBid(params: CreditProviderBidRequest): Promise<MCPToolResponse<CreditProviderBid>>;
  
  processCreditTransaction(params: CreditTransactionRequest): Promise<MCPToolResponse<CreditTransaction>>;
  performCreditCheck(params: CreditCheckRequest): Promise<MCPToolResponse<CreditCheckResult>>;
  getCreditAnalytics(params: CreditAnalyticsQuery): Promise<MCPToolResponse<CreditAnalytics>>;
  
  healthCheck(): Promise<MCPToolResponse<CreditHealthCheck>>;
  
  // Event emitter methods
  emit(event: string, data: any): boolean;
  on(event: string, listener: (...args: any[]) => void): this;
}

// =============================================================================
// MCP Server Registration Types
// =============================================================================

export interface MCPToolConfig {
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (params: any, context?: MCPContextInfo) => Promise<MCPToolResponse>;
}

export interface MCPServer {
  registerTool(name: string, config: MCPToolConfig): void;
}

// =============================================================================
// Tool Usage Analytics
// =============================================================================

export interface CreditToolUsage {
  tool: string;
  success: boolean;
  user_id?: string;
  timestamp: string;
  execution_time: number;
}

// =============================================================================
// Export all types
// =============================================================================

export {
  CreditMCPTools as default,
  MCPToolResponse,
  MCPContextInfo,
  MCPToolConfig,
  MCPServer,
  CreditAsAServiceClient,
  CreditToolUsage
};

// =============================================================================
// Module Declaration for Node.js environments
// =============================================================================

declare module 'credit-as-a-service-mcp-tools' {
  export * from './credit';
  export { CreditMCPTools as default };
}