/**
 * Credit-as-a-Service Client
 * Native Onasis Gateway service for comprehensive credit management
 */

const BaseClient = require('../../core/base-client');
const db = require('../../core/database');

class CreditAsAServiceClient extends BaseClient {
    constructor(options = {}) {
        super({
            name: 'credit-as-a-service',
            baseUrl: null, // Internal service, no external URL
            timeout: 30000,
            retryAttempts: 3,
            authentication: {
                type: 'internal', // Uses Onasis Gateway internal auth
                config: options.auth || {}
            },
            rateLimit: {
                perMinute: 100,
                perHour: 1000
            },
            ...options
        });

        // Initialize database connection for credit operations
        this.db = db;
        
        // Credit-specific configuration
        this.creditConfig = {
            maxLoanAmount: 10000000, // 10M NGN
            minCreditScore: 300,
            defaultCurrency: 'NGN',
            supportedCurrencies: ['NGN', 'USD', 'EUR'],
            processingTimeoutHours: 72
        };

        // Generate credit-specific methods
        this.generateCreditMethods();
    }

    generateCreditMethods() {
        // Define credit endpoints and generate methods
        const creditEndpoints = [
            {
                name: 'submitCreditApplication',
                method: 'POST',
                path: 'applications',
                description: 'Submit a new credit application',
                parameters: {
                    body: ['application_type', 'requested_amount', 'currency', 'loan_purpose', 'applicant_income']
                }
            },
            {
                name: 'getCreditApplications',
                method: 'GET', 
                path: 'applications',
                description: 'Get credit applications with filters',
                parameters: {
                    query: ['status', 'user_id', 'page', 'limit']
                }
            },
            {
                name: 'getCreditApplication',
                method: 'GET',
                path: 'applications/{applicationId}',
                description: 'Get specific credit application',
                parameters: {
                    path: ['applicationId']
                }
            },
            {
                name: 'updateApplicationStatus',
                method: 'PATCH',
                path: 'applications/{applicationId}/status',
                description: 'Update application status',
                parameters: {
                    path: ['applicationId'],
                    body: ['status', 'notes']
                }
            },
            {
                name: 'registerCreditProvider',
                method: 'POST',
                path: 'providers',
                description: 'Register a new credit provider',
                parameters: {
                    body: ['provider_code', 'company_name', 'provider_type', 'api_endpoint']
                }
            },
            {
                name: 'getCreditProviders',
                method: 'GET',
                path: 'providers',
                description: 'Get all credit providers',
                parameters: {
                    query: ['status', 'provider_type', 'page', 'limit']
                }
            },
            {
                name: 'submitProviderBid',
                method: 'POST',
                path: 'bids',
                description: 'Submit provider bid for application',
                parameters: {
                    body: ['application_id', 'provider_id', 'offered_amount', 'interest_rate', 'loan_term_months']
                }
            },
            {
                name: 'processCreditTransaction',
                method: 'POST',
                path: 'transactions',
                description: 'Process credit transaction (disbursement/repayment)',
                parameters: {
                    body: ['application_id', 'transaction_type', 'amount', 'gateway_provider']
                }
            },
            {
                name: 'getCreditAnalytics',
                method: 'GET',
                path: 'analytics',
                description: 'Get credit analytics and reports',
                parameters: {
                    query: ['metric_type', 'start_date', 'end_date']
                }
            },
            {
                name: 'performCreditCheck',
                method: 'POST',
                path: 'credit-check',
                description: 'Perform credit score check',
                parameters: {
                    body: ['user_id', 'check_type']
                }
            }
        ];

        // Generate methods based on endpoints
        creditEndpoints.forEach(endpoint => {
            const methodName = endpoint.name;
            
            this[methodName] = async (params = {}, options = {}) => {
                try {
                    // Log credit operation
                    await this.logCreditActivity(endpoint.name, params);
                    
                    // Route to appropriate handler based on endpoint
                    switch (endpoint.name) {
                        case 'submitCreditApplication':
                            return await this.handleSubmitApplication(params);
                        case 'getCreditApplications':
                            return await this.handleGetApplications(params);
                        case 'getCreditApplication':
                            return await this.handleGetApplication(params);
                        case 'updateApplicationStatus':
                            return await this.handleUpdateApplicationStatus(params);
                        case 'registerCreditProvider':
                            return await this.handleRegisterProvider(params);
                        case 'getCreditProviders':
                            return await this.handleGetProviders(params);
                        case 'submitProviderBid':
                            return await this.handleSubmitBid(params);
                        case 'processCreditTransaction':
                            return await this.handleProcessTransaction(params);
                        case 'getCreditAnalytics':
                            return await this.handleGetAnalytics(params);
                        case 'performCreditCheck':
                            return await this.handleCreditCheck(params);
                        default:
                            throw new Error(`Unknown credit operation: ${endpoint.name}`);
                    }
                } catch (error) {
                    this.logError('Credit Operation Error', error);
                    throw error;
                }
            };
        });
    }

    // Credit Application Handlers
    async handleSubmitApplication(params) {
        const {
            application_type,
            requested_amount,
            currency = 'NGN',
            loan_purpose,
            applicant_income,
            user_id,
            request_id
        } = params;

        // Validate input
        if (!application_type || !requested_amount || !user_id) {
            throw new Error('Missing required fields: application_type, requested_amount, user_id');
        }

        if (requested_amount > this.creditConfig.maxLoanAmount) {
            throw new Error(`Requested amount exceeds maximum limit: ${this.creditConfig.maxLoanAmount}`);
        }

        // Generate reference ID
        const reference_id = `CAAS-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;

        // Insert application
        const query = `
            INSERT INTO credit.applications (
                reference_id, user_id, application_type, requested_amount, 
                currency, loan_purpose, applicant_income, request_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
        `;

        const result = await this.db.query(query, [
            reference_id, user_id, application_type, requested_amount,
            currency, loan_purpose, applicant_income, request_id
        ]);

        // Trigger provider matching
        await this.matchProvidersForApplication(result.rows[0].id);

        return {
            success: true,
            application: result.rows[0],
            message: 'Credit application submitted successfully'
        };
    }

    async handleGetApplications(params) {
        const {
            status,
            user_id,
            page = 1,
            limit = 20
        } = params;

        let query = 'SELECT * FROM credit.applications WHERE 1=1';
        const queryParams = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            queryParams.push(status);
        }

        if (user_id) {
            paramCount++;
            query += ` AND user_id = $${paramCount}`;
            queryParams.push(user_id);
        }

        // Add pagination
        const offset = (page - 1) * limit;
        paramCount++;
        query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
        queryParams.push(limit);
        
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        queryParams.push(offset);

        const result = await this.db.query(query, queryParams);

        return {
            success: true,
            applications: result.rows,
            pagination: {
                page,
                limit,
                total: result.rowCount
            }
        };
    }

    async handleGetApplication(params) {
        const { applicationId } = params;

        const query = `
            SELECT a.*, p.company_name as provider_name
            FROM credit.applications a
            LEFT JOIN credit.providers p ON a.assigned_provider_id = p.id
            WHERE a.id = $1
        `;

        const result = await this.db.query(query, [applicationId]);

        if (result.rows.length === 0) {
            throw new Error('Application not found');
        }

        return {
            success: true,
            application: result.rows[0]
        };
    }

    // Provider Management Handlers
    async handleRegisterProvider(params) {
        const {
            provider_code,
            company_name,
            provider_type,
            api_endpoint,
            min_loan_amount = 50000,
            max_loan_amount = 5000000,
            min_credit_score = 300
        } = params;

        const query = `
            INSERT INTO credit.providers (
                provider_code, company_name, provider_type, api_endpoint,
                min_loan_amount, max_loan_amount, min_credit_score, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            RETURNING *
        `;

        const result = await this.db.query(query, [
            provider_code, company_name, provider_type, api_endpoint,
            min_loan_amount, max_loan_amount, min_credit_score
        ]);

        return {
            success: true,
            provider: result.rows[0],
            message: 'Credit provider registered successfully'
        };
    }

    async handleGetProviders(params) {
        const {
            status = 'active',
            provider_type,
            page = 1,
            limit = 20
        } = params;

        let query = 'SELECT * FROM credit.providers WHERE status = $1';
        const queryParams = [status];
        let paramCount = 1;

        if (provider_type) {
            paramCount++;
            query += ` AND provider_type = $${paramCount}`;
            queryParams.push(provider_type);
        }

        // Add pagination
        const offset = (page - 1) * limit;
        paramCount++;
        query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
        queryParams.push(limit);
        
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        queryParams.push(offset);

        const result = await this.db.query(query, queryParams);

        return {
            success: true,
            providers: result.rows,
            pagination: {
                page,
                limit,
                total: result.rowCount
            }
        };
    }

    // Transaction Processing
    async handleProcessTransaction(params) {
        const {
            application_id,
            transaction_type,
            amount,
            gateway_provider = 'stripe'
        } = params;

        // Generate payment reference
        const payment_reference = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;

        const query = `
            INSERT INTO credit.transactions (
                application_id, transaction_type, amount, payment_reference,
                gateway_provider, transaction_status
            ) VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *
        `;

        const result = await this.db.query(query, [
            application_id, transaction_type, amount, payment_reference, gateway_provider
        ]);

        // Here we would integrate with the actual payment gateway
        // For now, we'll simulate the transaction
        return {
            success: true,
            transaction: result.rows[0],
            payment_reference,
            message: 'Transaction initiated successfully'
        };
    }

    // Analytics and Reporting
    async handleGetAnalytics(params) {
        const {
            metric_type = 'daily',
            start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date = new Date().toISOString().split('T')[0]
        } = params;

        const query = `
            SELECT * FROM credit.analytics_metrics
            WHERE metric_type = $1 
            AND metric_date BETWEEN $2 AND $3
            ORDER BY metric_date DESC
        `;

        const result = await this.db.query(query, [metric_type, start_date, end_date]);

        return {
            success: true,
            analytics: result.rows,
            period: {
                start_date,
                end_date,
                metric_type
            }
        };
    }

    // Credit Check Handler
    async handleCreditCheck(params) {
        const { user_id, check_type = 'basic' } = params;

        // This would integrate with credit bureaus or ML scoring
        // For now, we'll simulate a credit check
        const simulatedScore = Math.floor(Math.random() * (850 - 300) + 300);
        
        return {
            success: true,
            credit_check: {
                user_id,
                credit_score: simulatedScore,
                risk_level: simulatedScore > 700 ? 'low' : simulatedScore > 600 ? 'medium' : 'high',
                check_type,
                checked_at: new Date().toISOString()
            }
        };
    }

    // Provider Matching Algorithm
    async matchProvidersForApplication(applicationId) {
        const query = `
            SELECT match_providers_for_application($1, 5) as matches
        `;

        try {
            const result = await this.db.query(query, [applicationId]);
            return result.rows[0]?.matches || [];
        } catch (error) {
            console.warn('Provider matching failed:', error.message);
            return [];
        }
    }

    // Activity Logging
    async logCreditActivity(action, params) {
        const logData = {
            action_type: action,
            resource_type: 'credit_operation',
            user_id: params.user_id || 'system',
            changes: params,
            created_at: new Date()
        };

        // Emit event for audit logging
        this.emit('credit-activity', logData);
    }

    // Health Check for Credit Service
    async healthCheck() {
        try {
            // Check database connectivity
            await this.db.query('SELECT 1');
            
            // Check recent application activity
            const recentApps = await this.db.query(
                'SELECT COUNT(*) as count FROM credit.applications WHERE created_at > NOW() - INTERVAL \'24 hours\''
            );

            return {
                service: 'credit-as-a-service',
                status: 'healthy',
                database: 'connected',
                recent_applications: recentApps.rows[0].count,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                service: 'credit-as-a-service',
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = CreditAsAServiceClient;
