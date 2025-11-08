/**
 * Credit-as-a-Service Webhook Handler
 * Manages incoming webhooks from credit providers and outgoing webhook notifications
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class CreditWebhookHandler extends EventEmitter {
    constructor(options = {}) {
        super();
        this.config = {
            secretKey: options.secretKey || process.env.CAAS_WEBHOOK_SECRET,
            signatureHeader: 'x-caas-signature',
            toleranceSeconds: 300, // 5 minutes
            ...options
        };
    }

    /**
     * Handle incoming webhook from credit providers
     */
    async handleProviderWebhook(req, res) {
        try {
            // Verify webhook signature
            const signature = req.headers[this.config.signatureHeader];
            if (!this.verifySignature(req.body, signature)) {
                return res.status(401).json({ error: 'Invalid signature' });
            }

            const { event_type, data, provider_id, timestamp } = req.body;

            // Check timestamp to prevent replay attacks
            if (!this.isTimestampValid(timestamp)) {
                return res.status(400).json({ error: 'Request timestamp too old' });
            }

            // Process webhook based on event type
            await this.processProviderWebhook(event_type, data, provider_id);

            res.status(200).json({ success: true, message: 'Webhook processed successfully' });
        } catch (error) {
            console.error('Webhook processing error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Process provider webhook events
     */
    async processProviderWebhook(eventType, data, providerId) {
        switch (eventType) {
            case 'bid.submitted':
                await this.handleBidSubmitted(data, providerId);
                break;
            
            case 'application.decision':
                await this.handleApplicationDecision(data, providerId);
                break;
            
            case 'loan.disbursed':
                await this.handleLoanDisbursed(data, providerId);
                break;
            
            case 'payment.received':
                await this.handlePaymentReceived(data, providerId);
                break;
            
            case 'provider.status_update':
                await this.handleProviderStatusUpdate(data, providerId);
                break;
            
            default:
                console.warn(`Unknown webhook event type: ${eventType}`);
        }

        // Emit event for other parts of the system
        this.emit('webhook-processed', {
            eventType,
            data,
            providerId,
            timestamp: new Date()
        });
    }

    /**
     * Handle bid submission from provider
     */
    async handleBidSubmitted(data, providerId) {
        const {
            application_reference,
            offered_amount,
            interest_rate,
            loan_term_months,
            conditions
        } = data;

        // Update database with new bid
        const db = require('../../core/database');
        
        const query = `
            INSERT INTO credit.provider_bids (
                application_id, provider_id, offered_amount, interest_rate,
                loan_term_months, conditions, bid_status, bid_submitted_at
            ) 
            SELECT a.id, $2, $3, $4, $5, $6, 'submitted', NOW()
            FROM credit.applications a 
            WHERE a.reference_id = $1
            RETURNING *
        `;

        const result = await db.query(query, [
            application_reference, providerId, offered_amount, 
            interest_rate, loan_term_months, JSON.stringify(conditions)
        ]);

        if (result.rows.length > 0) {
            // Notify client about new bid
            await this.sendClientNotification('bid_received', {
                application_reference,
                provider_id: providerId,
                bid_details: result.rows[0]
            });
        }
    }

    /**
     * Handle application decision from provider
     */
    async handleApplicationDecision(data, providerId) {
        const {
            application_reference,
            decision, // 'approved' or 'rejected'
            reason,
            approved_amount,
            conditions
        } = data;

        const db = require('../../core/database');
        
        // Update application status
        const query = `
            UPDATE credit.applications 
            SET status = $2, approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
                assigned_provider_id = $3
            WHERE reference_id = $1
            RETURNING *
        `;

        const result = await db.query(query, [
            application_reference, 
            decision === 'approved' ? 'approved' : 'rejected',
            providerId
        ]);

        if (result.rows.length > 0) {
            // Send notification to client
            await this.sendClientNotification('application_decision', {
                application_reference,
                decision,
                reason,
                approved_amount,
                provider_id: providerId
            });
        }
    }

    /**
     * Handle loan disbursement notification
     */
    async handleLoanDisbursed(data, providerId) {
        const {
            application_reference,
            disbursed_amount,
            transaction_reference,
            disbursement_method
        } = data;

        const db = require('../../core/database');
        
        // Record disbursement transaction
        const transactionQuery = `
            INSERT INTO credit.transactions (
                application_id, provider_id, transaction_type, amount,
                payment_reference, transaction_status, completed_at
            )
            SELECT a.id, $2, 'disbursement', $3, $4, 'completed', NOW()
            FROM credit.applications a 
            WHERE a.reference_id = $1
            RETURNING *
        `;

        await db.query(transactionQuery, [
            application_reference, providerId, disbursed_amount, transaction_reference
        ]);

        // Update application status to disbursed
        const statusQuery = `
            UPDATE credit.applications 
            SET status = 'disbursed', disbursed_at = NOW()
            WHERE reference_id = $1
        `;

        await db.query(statusQuery, [application_reference]);

        // Notify client
        await this.sendClientNotification('loan_disbursed', {
            application_reference,
            disbursed_amount,
            transaction_reference,
            disbursement_method
        });
    }

    /**
     * Handle payment received notification
     */
    async handlePaymentReceived(data, providerId) {
        const {
            application_reference,
            payment_amount,
            payment_reference,
            payment_date
        } = data;

        const db = require('../../core/database');
        
        // Record repayment transaction
        const query = `
            INSERT INTO credit.transactions (
                application_id, provider_id, transaction_type, amount,
                payment_reference, transaction_status, completed_at
            )
            SELECT a.id, $2, 'repayment', $3, $4, 'completed', $5
            FROM credit.applications a 
            WHERE a.reference_id = $1
            RETURNING *
        `;

        await db.query(query, [
            application_reference, providerId, payment_amount, 
            payment_reference, payment_date
        ]);

        // Notify client
        await this.sendClientNotification('payment_received', {
            application_reference,
            payment_amount,
            payment_reference,
            payment_date
        });
    }

    /**
     * Send notification to client application
     */
    async sendClientNotification(eventType, data) {
        // This would integrate with the Onasis Gateway notification system
        // For now, we'll emit an event that can be caught by other services
        this.emit('client-notification', {
            event_type: eventType,
            data,
            timestamp: new Date().toISOString()
        });

        // Log notification for audit purposes
        console.log(`Client notification sent: ${eventType}`, data);
    }

    /**
     * Send webhook to external clients
     */
    async sendOutgoingWebhook(webhookUrl, eventType, data, signature) {
        const axios = require('axios');
        
        const payload = {
            event_type: eventType,
            data,
            timestamp: new Date().toISOString(),
            signature
        };

        try {
            const response = await axios.post(webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CaaS-Event': eventType,
                    'X-CaaS-Signature': signature
                },
                timeout: 10000
            });

            return {
                success: true,
                status: response.status,
                response: response.data
            };
        } catch (error) {
            console.error(`Webhook delivery failed to ${webhookUrl}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify webhook signature
     */
    verifySignature(payload, signature) {
        if (!signature || !this.config.secretKey) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.config.secretKey)
            .update(JSON.stringify(payload))
            .digest('hex');

        const receivedSignature = signature.replace('sha256=', '');

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(receivedSignature, 'hex')
        );
    }

    /**
     * Check if timestamp is within tolerance
     */
    isTimestampValid(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const eventTime = Math.floor(new Date(timestamp).getTime() / 1000);
        
        return Math.abs(now - eventTime) <= this.config.toleranceSeconds;
    }

    /**
     * Generate signature for outgoing webhooks
     */
    generateSignature(payload) {
        return crypto
            .createHmac('sha256', this.config.secretKey)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    /**
     * Register webhook endpoints
     */
    registerWebhookRoutes(app) {
        // Incoming webhook from providers
        app.post('/webhooks/credit/providers/:providerId', async (req, res) => {
            req.params.providerId = req.params.providerId;
            await this.handleProviderWebhook(req, res);
        });

        // Webhook management endpoints
        app.get('/webhooks/credit/events', (req, res) => {
            res.json({
                supported_events: [
                    'application.submitted',
                    'application.approved', 
                    'application.rejected',
                    'loan.disbursed',
                    'payment.received',
                    'provider.bid_received',
                    'credit_check.completed'
                ]
            });
        });

        // Test webhook endpoint
        app.post('/webhooks/credit/test', (req, res) => {
            res.json({
                success: true,
                message: 'Webhook test successful',
                received_data: req.body,
                timestamp: new Date().toISOString()
            });
        });
    }
}

module.exports = CreditWebhookHandler;