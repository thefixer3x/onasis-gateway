/**
 * Credit-as-a-Service MCP Tools
 * Registers all CaaS tools with the MCP server for unified client access
 */

const CreditAsAServiceClient = require('../../../services/credit-as-a-service/client');

class CreditMCPTools {
    constructor(mcpServer) {
        this.mcpServer = mcpServer;
        this.creditClient = new CreditAsAServiceClient();
        
        // Register all credit tools
        this.registerCreditTools();
    }

    registerCreditTools() {
        // Credit Application Tools
        this.registerTool('credit_submit_application', {
            description: 'Submit a new credit application',
            inputSchema: {
                type: 'object',
                properties: {
                    application_type: {
                        type: 'string',
                        enum: ['personal', 'business', 'asset_finance'],
                        description: 'Type of credit application'
                    },
                    requested_amount: {
                        type: 'number',
                        minimum: 1000,
                        maximum: 10000000,
                        description: 'Requested loan amount'
                    },
                    currency: {
                        type: 'string',
                        enum: ['NGN', 'USD', 'EUR'],
                        default: 'NGN',
                        description: 'Currency for the loan'
                    },
                    loan_purpose: {
                        type: 'string',
                        description: 'Purpose of the loan'
                    },
                    applicant_income: {
                        type: 'number',
                        minimum: 0,
                        description: 'Monthly income of applicant'
                    },
                    user_id: {
                        type: 'string',
                        description: 'ID of the user applying'
                    }
                },
                required: ['application_type', 'requested_amount', 'user_id']
            },
            handler: async (params) => {
                return await this.creditClient.submitCreditApplication(params);
            }
        });

        this.registerTool('credit_get_applications', {
            description: 'Retrieve credit applications with optional filters',
            inputSchema: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['pending', 'under_review', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted'],
                        description: 'Filter by application status'
                    },
                    user_id: {
                        type: 'string',
                        description: 'Filter by user ID'
                    },
                    page: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                        description: 'Page number for pagination'
                    },
                    limit: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 20,
                        description: 'Number of results per page'
                    }
                }
            },
            handler: async (params) => {
                return await this.creditClient.getCreditApplications(params);
            }
        });

        this.registerTool('credit_get_application', {
            description: 'Get details of a specific credit application',
            inputSchema: {
                type: 'object',
                properties: {
                    applicationId: {
                        type: 'string',
                        description: 'ID of the credit application'
                    }
                },
                required: ['applicationId']
            },
            handler: async (params) => {
                return await this.creditClient.getCreditApplication(params);
            }
        });

        this.registerTool('credit_update_application_status', {
            description: 'Update the status of a credit application',
            inputSchema: {
                type: 'object',
                properties: {
                    applicationId: {
                        type: 'string',
                        description: 'ID of the credit application'
                    },
                    status: {
                        type: 'string',
                        enum: ['pending', 'under_review', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted'],
                        description: 'New status for the application'
                    },
                    notes: {
                        type: 'string',
                        description: 'Optional notes about the status change'
                    }
                },
                required: ['applicationId', 'status']
            },
            handler: async (params) => {
                return await this.creditClient.updateApplicationStatus(params);
            }
        });

        // Credit Provider Tools
        this.registerTool('credit_register_provider', {
            description: 'Register a new credit provider',
            inputSchema: {
                type: 'object',
                properties: {
                    provider_code: {
                        type: 'string',
                        pattern: '^[A-Z0-9_]{3,20}$',
                        description: 'Unique provider code'
                    },
                    company_name: {
                        type: 'string',
                        maxLength: 200,
                        description: 'Company name'
                    },
                    provider_type: {
                        type: 'string',
                        enum: ['bank', 'fintech', 'microfinance', 'p2p_lending'],
                        description: 'Type of credit provider'
                    },
                    api_endpoint: {
                        type: 'string',
                        format: 'uri',
                        description: 'Provider API endpoint'
                    },
                    min_loan_amount: {
                        type: 'number',
                        minimum: 1000,
                        default: 50000,
                        description: 'Minimum loan amount'
                    },
                    max_loan_amount: {
                        type: 'number',
                        minimum: 50000,
                        default: 5000000,
                        description: 'Maximum loan amount'
                    }
                },
                required: ['provider_code', 'company_name', 'provider_type']
            },
            handler: async (params) => {
                return await this.creditClient.registerCreditProvider(params);
            }
        });

        this.registerTool('credit_get_providers', {
            description: 'Get list of credit providers',
            inputSchema: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['active', 'inactive', 'suspended'],
                        default: 'active',
                        description: 'Filter by provider status'
                    },
                    provider_type: {
                        type: 'string',
                        enum: ['bank', 'fintech', 'microfinance', 'p2p_lending'],
                        description: 'Filter by provider type'
                    },
                    page: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                        description: 'Page number'
                    },
                    limit: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 20,
                        description: 'Results per page'
                    }
                }
            },
            handler: async (params) => {
                return await this.creditClient.getCreditProviders(params);
            }
        });

        this.registerTool('credit_submit_provider_bid', {
            description: 'Submit a provider bid for a credit application',
            inputSchema: {
                type: 'object',
                properties: {
                    application_id: {
                        type: 'string',
                        description: 'Credit application ID'
                    },
                    provider_id: {
                        type: 'string',
                        description: 'Credit provider ID'
                    },
                    offered_amount: {
                        type: 'number',
                        minimum: 1000,
                        description: 'Offered loan amount'
                    },
                    interest_rate: {
                        type: 'number',
                        minimum: 0.1,
                        maximum: 50,
                        description: 'Interest rate percentage'
                    },
                    loan_term_months: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 360,
                        description: 'Loan term in months'
                    },
                    conditions: {
                        type: 'object',
                        description: 'Additional conditions for the loan'
                    }
                },
                required: ['application_id', 'provider_id', 'offered_amount', 'interest_rate', 'loan_term_months']
            },
            handler: async (params) => {
                return await this.creditClient.submitProviderBid(params);
            }
        });

        // Credit Transaction Tools
        this.registerTool('credit_process_transaction', {
            description: 'Process a credit transaction (disbursement or repayment)',
            inputSchema: {
                type: 'object',
                properties: {
                    application_id: {
                        type: 'string',
                        description: 'Credit application ID'
                    },
                    transaction_type: {
                        type: 'string',
                        enum: ['disbursement', 'repayment', 'fee', 'penalty'],
                        description: 'Type of transaction'
                    },
                    amount: {
                        type: 'number',
                        minimum: 0.01,
                        description: 'Transaction amount'
                    },
                    gateway_provider: {
                        type: 'string',
                        enum: ['stripe', 'wise', 'bap', 'paystack'],
                        default: 'stripe',
                        description: 'Payment gateway to use'
                    },
                    currency: {
                        type: 'string',
                        enum: ['NGN', 'USD', 'EUR'],
                        default: 'NGN',
                        description: 'Transaction currency'
                    }
                },
                required: ['application_id', 'transaction_type', 'amount']
            },
            handler: async (params) => {
                return await this.creditClient.processCreditTransaction(params);
            }
        });

        // Credit Scoring Tools
        this.registerTool('credit_perform_credit_check', {
            description: 'Perform credit score check for a user',
            inputSchema: {
                type: 'object',
                properties: {
                    user_id: {
                        type: 'string',
                        description: 'User ID to check credit for'
                    },
                    check_type: {
                        type: 'string',
                        enum: ['basic', 'enhanced', 'comprehensive'],
                        default: 'basic',
                        description: 'Type of credit check'
                    }
                },
                required: ['user_id']
            },
            handler: async (params) => {
                return await this.creditClient.performCreditCheck(params);
            }
        });

        // Analytics Tools
        this.registerTool('credit_get_analytics', {
            description: 'Get credit analytics and reports',
            inputSchema: {
                type: 'object',
                properties: {
                    metric_type: {
                        type: 'string',
                        enum: ['daily', 'weekly', 'monthly'],
                        default: 'daily',
                        description: 'Analytics time period'
                    },
                    start_date: {
                        type: 'string',
                        format: 'date',
                        description: 'Start date for analytics (YYYY-MM-DD)'
                    },
                    end_date: {
                        type: 'string',
                        format: 'date',
                        description: 'End date for analytics (YYYY-MM-DD)'
                    }
                }
            },
            handler: async (params) => {
                return await this.creditClient.getCreditAnalytics(params);
            }
        });

        // Provider Management Tools (Admin)
        this.registerTool('credit_provider_performance', {
            description: 'Get provider performance metrics',
            inputSchema: {
                type: 'object',
                properties: {
                    provider_id: {
                        type: 'string',
                        description: 'Provider ID to get metrics for'
                    },
                    period: {
                        type: 'string',
                        enum: ['last_30_days', 'last_90_days', 'last_year'],
                        default: 'last_30_days',
                        description: 'Performance period'
                    }
                }
            },
            handler: async (params) => {
                // This would call a specific provider performance method
                return {
                    success: true,
                    message: 'Provider performance metrics (placeholder)',
                    provider_id: params.provider_id,
                    period: params.period
                };
            }
        });

        // Health Check Tool
        this.registerTool('credit_health_check', {
            description: 'Check the health status of the credit service',
            inputSchema: {
                type: 'object',
                properties: {}
            },
            handler: async () => {
                return await this.creditClient.healthCheck();
            }
        });

        console.log('✅ Credit-as-a-Service MCP tools registered successfully');
    }

    registerTool(name, config) {
        try {
            this.mcpServer.registerTool(name, {
                description: config.description,
                inputSchema: config.inputSchema,
                handler: async (params, context) => {
                    try {
                        // Add context information (user, request ID, etc.)
                        const enrichedParams = {
                            ...params,
                            request_id: context?.requestId,
                            user_id: context?.userId || params.user_id,
                            api_key_id: context?.apiKeyId
                        };

                        // Call the handler with enriched parameters
                        const result = await config.handler(enrichedParams);

                        // Log tool usage for analytics
                        this.logToolUsage(name, enrichedParams, result);

                        return result;
                    } catch (error) {
                        console.error(`Credit tool ${name} error:`, error);
                        return {
                            success: false,
                            error: error.message,
                            tool: name,
                            timestamp: new Date().toISOString()
                        };
                    }
                }
            });
        } catch (error) {
            console.error(`Failed to register credit tool ${name}:`, error);
        }
    }

    logToolUsage(toolName, params, result) {
        // This would integrate with the Onasis Gateway analytics system
        const usage = {
            tool: toolName,
            success: result.success !== false,
            user_id: params.user_id,
            timestamp: new Date().toISOString(),
            execution_time: Date.now() // This would be calculated properly
        };

        // Emit event for analytics collection
        this.creditClient.emit('tool-usage', usage);
    }

    // Method to get all registered credit tools (for documentation/discovery)
    getCreditTools() {
        return [
            'credit_submit_application',
            'credit_get_applications', 
            'credit_get_application',
            'credit_update_application_status',
            'credit_register_provider',
            'credit_get_providers',
            'credit_submit_provider_bid',
            'credit_process_transaction',
            'credit_perform_credit_check',
            'credit_get_analytics',
            'credit_provider_performance',
            'credit_health_check'
        ];
    }
}

module.exports = CreditMCPTools;