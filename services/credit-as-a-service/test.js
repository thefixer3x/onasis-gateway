/**
 * Credit-as-a-Service Test Suite
 * Comprehensive tests for the CaaS client and operations
 */

const CreditAsAServiceClient = require('./client');
const CreditWebhookHandler = require('./webhooks');

class CreditServiceTests {
    constructor() {
        this.client = new CreditAsAServiceClient({
            auth: {
                api_key: 'test_key_123',
                user_id: 'test_user_456'
            }
        });
        
        this.webhookHandler = new CreditWebhookHandler({
            secretKey: 'test_webhook_secret_789'
        });
        
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🚀 Starting Credit-as-a-Service Test Suite...\n');

        const tests = [
            // Client Tests
            { name: 'Health Check', method: 'testHealthCheck' },
            { name: 'Submit Credit Application', method: 'testSubmitApplication' },
            { name: 'Get Credit Applications', method: 'testGetApplications' },
            { name: 'Get Single Application', method: 'testGetApplication' },
            { name: 'Register Credit Provider', method: 'testRegisterProvider' },
            { name: 'Get Credit Providers', method: 'testGetProviders' },
            { name: 'Process Credit Transaction', method: 'testProcessTransaction' },
            { name: 'Perform Credit Check', method: 'testCreditCheck' },
            { name: 'Get Analytics', method: 'testGetAnalytics' },
            
            // Webhook Tests
            { name: 'Webhook Signature Verification', method: 'testWebhookSignature' },
            { name: 'Provider Bid Webhook', method: 'testProviderBidWebhook' },
            { name: 'Application Decision Webhook', method: 'testApplicationDecisionWebhook' }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.method);
        }

        this.printResults();
        return this.testResults;
    }

    async runTest(testName, methodName) {
        try {
            console.log(`🧪 Running: ${testName}`);
            const startTime = Date.now();
            
            const result = await this[methodName]();
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'PASSED',
                duration: `${duration}ms`,
                result
            });
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)\n`);
        } catch (error) {
            this.testResults.push({
                name: testName,
                status: 'FAILED',
                error: error.message,
                stack: error.stack
            });
            
            console.log(`❌ ${testName} - FAILED: ${error.message}\n`);
        }
    }

    // Client Tests
    async testHealthCheck() {
        const result = await this.client.healthCheck();
        
        if (!result || typeof result.service !== 'string') {
            throw new Error('Health check did not return expected format');
        }
        
        return result;
    }

    async testSubmitApplication() {
        const applicationData = {
            application_type: 'personal',
            requested_amount: 500000,
            currency: 'NGN',
            loan_purpose: 'Business expansion',
            applicant_income: 150000,
            user_id: 'test-user-123',
            request_id: 'test-request-456'
        };

        // Mock database call for testing
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [{
                        id: 'app-123',
                        reference_id: 'CAAS-TEST-123',
                        status: 'pending',
                        ...applicationData
                    }]
                };
            }
        };

        const result = await this.client.submitCreditApplication(applicationData);
        
        if (!result.success || !result.application) {
            throw new Error('Application submission failed');
        }
        
        return result;
    }

    async testGetApplications() {
        // Mock database call
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [
                        {
                            id: 'app-1',
                            reference_id: 'CAAS-TEST-1',
                            status: 'pending',
                            requested_amount: 500000
                        },
                        {
                            id: 'app-2', 
                            reference_id: 'CAAS-TEST-2',
                            status: 'approved',
                            requested_amount: 750000
                        }
                    ],
                    rowCount: 2
                };
            }
        };

        const result = await this.client.getCreditApplications({
            status: 'pending',
            page: 1,
            limit: 10
        });
        
        if (!result.success || !Array.isArray(result.applications)) {
            throw new Error('Get applications failed');
        }
        
        return result;
    }

    async testGetApplication() {
        // Mock database call
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [{
                        id: params[0],
                        reference_id: 'CAAS-TEST-123',
                        status: 'approved',
                        requested_amount: 500000,
                        provider_name: 'Test Bank'
                    }]
                };
            }
        };

        const result = await this.client.getCreditApplication({
            applicationId: 'test-app-id'
        });
        
        if (!result.success || !result.application) {
            throw new Error('Get application failed');
        }
        
        return result;
    }

    async testRegisterProvider() {
        const providerData = {
            provider_code: 'TEST_BANK',
            company_name: 'Test Bank Ltd',
            provider_type: 'bank',
            api_endpoint: 'https://api.testbank.com',
            min_loan_amount: 100000,
            max_loan_amount: 5000000
        };

        // Mock database call
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [{
                        id: 'provider-123',
                        ...providerData,
                        status: 'active'
                    }]
                };
            }
        };

        const result = await this.client.registerCreditProvider(providerData);
        
        if (!result.success || !result.provider) {
            throw new Error('Provider registration failed');
        }
        
        return result;
    }

    async testGetProviders() {
        // Mock database call
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [
                        {
                            id: 'provider-1',
                            provider_code: 'BANK_A',
                            company_name: 'Bank A',
                            provider_type: 'bank',
                            status: 'active'
                        },
                        {
                            id: 'provider-2',
                            provider_code: 'FINTECH_B', 
                            company_name: 'Fintech B',
                            provider_type: 'fintech',
                            status: 'active'
                        }
                    ],
                    rowCount: 2
                };
            }
        };

        const result = await this.client.getCreditProviders({
            status: 'active',
            page: 1,
            limit: 10
        });
        
        if (!result.success || !Array.isArray(result.providers)) {
            throw new Error('Get providers failed');
        }
        
        return result;
    }

    async testProcessTransaction() {
        const transactionData = {
            application_id: 'app-123',
            transaction_type: 'disbursement',
            amount: 500000,
            gateway_provider: 'stripe'
        };

        // Mock database call
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [{
                        id: 'txn-123',
                        ...transactionData,
                        payment_reference: 'TXN-TEST-123',
                        transaction_status: 'pending'
                    }]
                };
            }
        };

        const result = await this.client.processCreditTransaction(transactionData);
        
        if (!result.success || !result.transaction) {
            throw new Error('Transaction processing failed');
        }
        
        return result;
    }

    async testCreditCheck() {
        const result = await this.client.performCreditCheck({
            user_id: 'test-user-123',
            check_type: 'basic'
        });
        
        if (!result.success || !result.credit_check) {
            throw new Error('Credit check failed');
        }
        
        if (result.credit_check.credit_score < 300 || result.credit_check.credit_score > 850) {
            throw new Error('Credit score out of valid range');
        }
        
        return result;
    }

    async testGetAnalytics() {
        // Mock database call
        this.client.db = {
            query: async (query, params) => {
                return {
                    rows: [
                        {
                            metric_date: '2024-07-20',
                            metric_type: 'daily',
                            applications_submitted: 15,
                            applications_approved: 8,
                            total_amount_approved: 5500000
                        },
                        {
                            metric_date: '2024-07-21',
                            metric_type: 'daily',
                            applications_submitted: 12,
                            applications_approved: 6,
                            total_amount_approved: 4200000
                        }
                    ]
                };
            }
        };

        const result = await this.client.getCreditAnalytics({
            metric_type: 'daily',
            start_date: '2024-07-20',
            end_date: '2024-07-21'
        });
        
        if (!result.success || !Array.isArray(result.analytics)) {
            throw new Error('Get analytics failed');
        }
        
        return result;
    }

    // Webhook Tests
    async testWebhookSignature() {
        const payload = {
            event_type: 'test.event',
            data: { test: 'data' },
            timestamp: new Date().toISOString()
        };

        const signature = this.webhookHandler.generateSignature(payload);
        const isValid = this.webhookHandler.verifySignature(payload, `sha256=${signature}`);
        
        if (!isValid) {
            throw new Error('Webhook signature verification failed');
        }
        
        return { signature_valid: true, signature };
    }

    async testProviderBidWebhook() {
        const webhookData = {
            event_type: 'bid.submitted',
            data: {
                application_reference: 'CAAS-TEST-123',
                offered_amount: 500000,
                interest_rate: 12.5,
                loan_term_months: 12,
                conditions: { collateral_required: false }
            },
            provider_id: 'test-provider-123',
            timestamp: new Date().toISOString()
        };

        let notificationReceived = false;
        
        // Listen for the notification event
        this.webhookHandler.once('client-notification', (data) => {
            notificationReceived = true;
        });

        // Mock database for webhook processing
        const mockDb = require('../../core/database');
        if (mockDb && mockDb.query) {
            // Use existing mock or create one
        } else {
            // Create mock for testing
            require.cache[require.resolve('../../core/database')] = {
                exports: {
                    query: async (query, params) => {
                        return {
                            rows: [{
                                id: 'bid-123',
                                application_id: 'app-123',
                                provider_id: 'test-provider-123',
                                offered_amount: 500000,
                                bid_status: 'submitted'
                            }]
                        };
                    }
                }
            };
        }

        await this.webhookHandler.processProviderWebhook(
            webhookData.event_type,
            webhookData.data,
            webhookData.provider_id
        );
        
        return { webhook_processed: true, notification_sent: notificationReceived };
    }

    async testApplicationDecisionWebhook() {
        const webhookData = {
            event_type: 'application.decision',
            data: {
                application_reference: 'CAAS-TEST-123',
                decision: 'approved',
                reason: 'Credit score acceptable',
                approved_amount: 500000
            },
            provider_id: 'test-provider-123'
        };

        // Mock database
        require.cache[require.resolve('../../core/database')] = {
            exports: {
                query: async (query, params) => {
                    return {
                        rows: [{
                            id: 'app-123',
                            reference_id: 'CAAS-TEST-123',
                            status: 'approved',
                            assigned_provider_id: 'test-provider-123'
                        }]
                    };
                }
            }
        };

        await this.webhookHandler.processProviderWebhook(
            webhookData.event_type,
            webhookData.data,
            webhookData.provider_id
        );
        
        return { decision_processed: true };
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        
        const passed = this.testResults.filter(t => t.status === 'PASSED').length;
        const failed = this.testResults.filter(t => t.status === 'FAILED').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(t => t.status === 'FAILED')
                .forEach(test => {
                    console.log(`   - ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n🎉 Test suite completed!');
    }
}

// Export for use in testing
module.exports = CreditServiceTests;

// Run tests if called directly
if (require.main === module) {
    const testSuite = new CreditServiceTests();
    testSuite.runAllTests().catch(console.error);
}