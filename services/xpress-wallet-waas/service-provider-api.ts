/**
 * Service Provider API Layer
 * Multi-tenant Xpress Wallet service with client isolation and controlled access
 */

import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import XpressWalletService from './xpress-wallet-service.js';

// Extended interfaces for service provider
interface ClientContext {
  clientId: string;
  clientCode: string;
  serviceTier: string;
  featuresEnabled: Record<string, boolean>;
  dailyLimit: number;
  isActive: boolean;
}

interface ServiceProviderRequest extends Request {
  client?: ClientContext;
  user?: {
    id: string;
    role: string;
    permissions: Record<string, boolean>;
  };
}

export class ServiceProviderAPI {
  private app: express.Application;
  private db: Pool;
  private xpressService: XpressWalletService;

  constructor(dbPool: Pool) {
    this.app = express();
    this.db = dbPool;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));

    // Rate limiting
    const rateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each client to 1000 requests per windowMs
      keyGenerator: (req: ServiceProviderRequest) => {
        return req.client?.clientId || req.ip;
      },
      message: { error: 'Too many requests, please try again later' }
    });
    this.app.use('/api', rateLimiter);

    // Client authentication middleware
    this.app.use('/api/v1/client', this.authenticateClient.bind(this));
    
    // Dashboard authentication middleware
    this.app.use('/api/v1/dashboard', this.authenticateUser.bind(this));
  }

  private async authenticateClient(req: ServiceProviderRequest, res: Response, next: NextFunction) {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      // Validate client API key
      const clientResult = await this.db.query(
        'SELECT * FROM service_provider.validate_client_api_key($1)',
        [apiKey]
      );

      if (clientResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      req.client = clientResult.rows[0];
      next();
    } catch (error) {
      console.error('Client authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  private async authenticateUser(req: ServiceProviderRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Bearer token required' });
      }

      // Validate JWT token and get user context
      const token = authHeader.substring(7);
      // TODO: Implement JWT validation
      
      // Get user's client context and permissions
      const userResult = await this.db.query(`
        SELECT cu.*, c.client_code, c.service_tier 
        FROM service_provider.client_users cu
        JOIN service_provider.clients c ON cu.client_id = c.id
        WHERE cu.user_id = $1 AND c.status = 'active'`,
        [req.user?.id] // This would come from JWT validation
      );

      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      req.user = userResult.rows[0];
      next();
    } catch (error) {
      console.error('User authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  private setupRoutes() {
    // ============================================================================
    // CLIENT API ROUTES (For programmatic access)
    // ============================================================================

    // Wallet Management
    this.app.post('/api/v1/client/wallets', this.createWallet.bind(this));
    this.app.get('/api/v1/client/wallets/:customerId', this.getWallet.bind(this));
    this.app.get('/api/v1/client/wallets/:customerId/balance', this.getWalletBalance.bind(this));
    this.app.post('/api/v1/client/wallets/:customerId/freeze', this.freezeWallet.bind(this));
    this.app.post('/api/v1/client/wallets/:customerId/unfreeze', this.unfreezeWallet.bind(this));

    // Transaction Operations
    this.app.post('/api/v1/client/wallets/:customerId/credit', this.creditWallet.bind(this));
    this.app.post('/api/v1/client/wallets/:customerId/debit', this.debitWallet.bind(this));
    this.app.post('/api/v1/client/transfer/wallet-to-wallet', this.walletToWalletTransfer.bind(this));

    // Bank Operations
    this.app.get('/api/v1/client/banks', this.getBankList.bind(this));
    this.app.post('/api/v1/client/banks/validate', this.validateBankAccount.bind(this));
    this.app.post('/api/v1/client/transfer/bank', this.bankTransfer.bind(this));

    // Batch Operations (Premium feature)
    this.app.post('/api/v1/client/batch/credit', this.batchCredit.bind(this));
    this.app.post('/api/v1/client/batch/debit', this.batchDebit.bind(this));
    this.app.post('/api/v1/client/batch/bank-transfers', this.batchBankTransfers.bind(this));

    // Transaction History
    this.app.get('/api/v1/client/transactions', this.getTransactions.bind(this));
    this.app.get('/api/v1/client/transactions/:transactionId', this.getTransactionDetails.bind(this));

    // ============================================================================
    // DASHBOARD API ROUTES (For client dashboard access)
    // ============================================================================

    // Dashboard Overview
    this.app.get('/api/v1/dashboard/overview', this.getDashboardOverview.bind(this));
    this.app.get('/api/v1/dashboard/analytics', this.getAnalytics.bind(this));

    // Wallet Management Dashboard
    this.app.get('/api/v1/dashboard/wallets', this.getDashboardWallets.bind(this));
    this.app.get('/api/v1/dashboard/wallets/:walletId', this.getDashboardWalletDetails.bind(this));

    // Transaction Management
    this.app.get('/api/v1/dashboard/transactions/pending', this.getPendingTransactions.bind(this));
    this.app.post('/api/v1/dashboard/transactions/:transactionId/approve', this.approveTransaction.bind(this));
    this.app.post('/api/v1/dashboard/transactions/:transactionId/reject', this.rejectTransaction.bind(this));

    // Batch Operations Management
    this.app.get('/api/v1/dashboard/batch-operations', this.getBatchOperations.bind(this));
    this.app.post('/api/v1/dashboard/batch-operations/:batchId/approve', this.approveBatchOperation.bind(this));

    // Reports & Downloads
    this.app.get('/api/v1/dashboard/reports/transactions', this.downloadTransactionReport.bind(this));
    this.app.get('/api/v1/dashboard/reports/reconciliation', this.getReconciliationReport.bind(this));

    // Settings & Configuration
    this.app.get('/api/v1/dashboard/settings', this.getClientSettings.bind(this));
    this.app.put('/api/v1/dashboard/settings', this.updateClientSettings.bind(this));

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });
  }

  // ============================================================================
  // CLIENT API IMPLEMENTATIONS
  // ============================================================================

  private async createWallet(req: ServiceProviderRequest, res: Response) {
    try {
      const client = req.client!;
      const { customerId, customerName, phoneNumber, email, walletType = 'personal' } = req.body;

      // Check if wallet already exists
      const existingWallet = await this.db.query(
        'SELECT id FROM wallet.client_customer_wallets WHERE client_id = $1 AND client_customer_id = $2',
        [client.clientId, customerId]
      );

      if (existingWallet.rows.length > 0) {
        return res.status(409).json({ error: 'Wallet already exists for this customer' });
      }

      // Create wallet in Xpress
      const xpressResult = await this.xpressService.createWallet({
        userId: customerId,
        customerName,
        phoneNumber,
        email,
        walletType,
        metadata: { clientId: client.clientId, clientCode: client.clientCode }
      });

      // Store in client-isolated table
      const walletResult = await this.db.query(`
        INSERT INTO wallet.client_customer_wallets (
          client_id, client_customer_id, provider_id, external_wallet_id,
          account_number, account_name, wallet_type, metadata
        ) VALUES ($1, $2, 
          (SELECT id FROM wallet.providers WHERE name = 'xpress-wallet-service-provider'),
          $3, $4, $5, $6, $7
        ) RETURNING *`,
        [
          client.clientId,
          customerId,
          xpressResult.xpressWallet.walletId,
          xpressResult.xpressWallet.accountNumber,
          customerName,
          walletType,
          JSON.stringify({ source: 'client_api' })
        ]
      );

      res.status(201).json({
        success: true,
        wallet: {
          id: walletResult.rows[0].id,
          customerId: customerId,
          accountNumber: walletResult.rows[0].account_number,
          accountName: walletResult.rows[0].account_name,
          walletType: walletResult.rows[0].wallet_type,
          balance: 0,
          status: 'active'
        }
      });

    } catch (error) {
      console.error('Create wallet error:', error);
      res.status(500).json({ error: 'Failed to create wallet' });
    }
  }

  private async creditWallet(req: ServiceProviderRequest, res: Response) {
    try {
      const client = req.client!;
      const { customerId } = req.params;
      const { amount, narration, reference, metadata } = req.body;

      // Validate permissions and limits
      const canPerform = await this.checkClientPermission(client.clientId, 'credit_wallet', amount);
      if (!canPerform) {
        return res.status(403).json({ error: 'Operation not permitted' });
      }

      // Get wallet
      const walletResult = await this.db.query(
        'SELECT * FROM wallet.client_customer_wallets WHERE client_id = $1 AND client_customer_id = $2',
        [client.clientId, customerId]
      );

      if (walletResult.rows.length === 0) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const wallet = walletResult.rows[0];

      // Calculate fees
      const fees = this.calculateClientFees(client, amount, 'credit');

      // Create transaction (pending approval if needed)
      const requiresApproval = amount > (await this.getApprovalThreshold(client.clientId));
      const transactionResult = await this.db.query(`
        INSERT INTO wallet.client_transactions (
          client_id, wallet_id, reference, type, amount,
          description, narration, initiated_by, status,
          approval_status, client_fee, service_provider_fee,
          client_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          client.clientId,
          wallet.id,
          reference || this.generateReference('CREDIT'),
          'credit',
          amount,
          `Credit wallet for customer ${customerId}`,
          narration,
          'client_api',
          requiresApproval ? 'pending' : 'processing',
          requiresApproval ? 'pending_approval' : 'auto_approved',
          fees.clientFee,
          fees.serviceProviderFee,
          JSON.stringify(metadata || {})
        ]
      );

      const transaction = transactionResult.rows[0];

      // If auto-approved, process immediately
      if (!requiresApproval) {
        await this.processTransaction(transaction.id);
      }

      res.json({
        success: true,
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount,
          status: transaction.status,
          requiresApproval: requiresApproval,
          fees: fees
        }
      });

    } catch (error) {
      console.error('Credit wallet error:', error);
      res.status(500).json({ error: 'Failed to process credit' });
    }
  }

  private async batchCredit(req: ServiceProviderRequest, res: Response) {
    try {
      const client = req.client!;
      const { items } = req.body;

      // Check batch operations permission
      if (!client.featuresEnabled.batch_operations) {
        return res.status(403).json({ error: 'Batch operations not enabled for your plan' });
      }

      // Validate total amount against limits
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.amount, 0);
      const canPerform = await this.checkClientPermission(client.clientId, 'batch_operations', totalAmount);
      
      if (!canPerform) {
        return res.status(403).json({ error: 'Batch operation exceeds limits' });
      }

      // Create batch operation record
      const batchResult = await this.db.query(`
        INSERT INTO wallet.client_batch_operations (
          client_id, batch_reference, operation_type, total_count,
          total_amount, items, initiated_by, approval_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          client.clientId,
          this.generateReference('BATCH_CREDIT'),
          'credit',
          items.length,
          totalAmount,
          JSON.stringify(items),
          req.user?.id, // From JWT
          'pending_approval' // Batch operations always require approval
        ]
      );

      res.json({
        success: true,
        batch: {
          id: batchResult.rows[0].id,
          reference: batchResult.rows[0].batch_reference,
          status: 'pending_approval',
          totalItems: items.length,
          totalAmount: totalAmount
        }
      });

    } catch (error) {
      console.error('Batch credit error:', error);
      res.status(500).json({ error: 'Failed to create batch operation' });
    }
  }

  // ============================================================================
  // DASHBOARD API IMPLEMENTATIONS
  // ============================================================================

  private async getDashboardOverview(req: ServiceProviderRequest, res: Response) {
    try {
      const user = req.user!;
      const clientId = user.client_id;

      // Get today's summary
      const todayResult = await this.db.query(`
        SELECT 
          COALESCE(total_transactions, 0) as transactions_today,
          COALESCE(total_volume, 0) as volume_today,
          COALESCE(pending_approvals, 0) as pending_approvals
        FROM service_provider.client_daily_summaries 
        WHERE client_id = $1 AND summary_date = CURRENT_DATE`,
        [clientId]
      );

      // Get wallet counts
      const walletStats = await this.db.query(`
        SELECT 
          COUNT(*) as total_wallets,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_wallets,
          SUM(balance) as total_balance
        FROM wallet.client_customer_wallets 
        WHERE client_id = $1`,
        [clientId]
      );

      // Get recent transactions requiring approval
      const pendingApprovals = await this.db.query(`
        SELECT id, reference, amount, narration, created_at
        FROM wallet.client_transactions 
        WHERE client_id = $1 AND approval_status = 'pending_approval'
        ORDER BY created_at DESC LIMIT 5`,
        [clientId]
      );

      res.json({
        summary: todayResult.rows[0] || { transactions_today: 0, volume_today: 0, pending_approvals: 0 },
        wallets: walletStats.rows[0],
        pendingApprovals: pendingApprovals.rows
      });

    } catch (error) {
      console.error('Dashboard overview error:', error);
      res.status(500).json({ error: 'Failed to load dashboard overview' });
    }
  }

  private async approveTransaction(req: ServiceProviderRequest, res: Response) {
    try {
      const user = req.user!;
      const { transactionId } = req.params;
      const { notes } = req.body;

      // Check permission to approve transactions
      if (!user.permissions?.approve_transactions) {
        return res.status(403).json({ error: 'Not authorized to approve transactions' });
      }

      // Update transaction approval
      const result = await this.db.query(`
        UPDATE wallet.client_transactions 
        SET approval_status = 'approved',
            approved_by = $1,
            approval_notes = $2,
            approved_at = NOW(),
            status = 'processing'
        WHERE id = $3 AND client_id = $4 AND approval_status = 'pending_approval'
        RETURNING *`,
        [user.id, notes, transactionId, user.client_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found or already processed' });
      }

      // Process the approved transaction
      await this.processTransaction(transactionId);

      res.json({
        success: true,
        message: 'Transaction approved and processed'
      });

    } catch (error) {
      console.error('Approve transaction error:', error);
      res.status(500).json({ error: 'Failed to approve transaction' });
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async checkClientPermission(clientId: string, operation: string, amount?: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT service_provider.check_client_permission($1, $2, $3)',
      [clientId, operation, amount]
    );
    return result.rows[0]?.check_client_permission || false;
  }

  private calculateClientFees(client: ClientContext, amount: number, operation: string) {
    // This would be based on client's fee structure
    const rate = 0.015; // 1.5%
    const fixedFee = 50;
    const totalFee = (amount * rate) + fixedFee;
    
    return {
      clientFee: totalFee,
      serviceProviderFee: totalFee * 0.3, // 30% commission
      totalFee
    };
  }

  private async getApprovalThreshold(clientId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT approval_threshold FROM service_provider.clients WHERE id = $1',
      [clientId]
    );
    return result.rows[0]?.approval_threshold || 100000; // Default 100K
  }

  private generateReference(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`.toUpperCase();
  }

  private async processTransaction(transactionId: string) {
    // This would integrate with the actual Xpress Wallet service
    // Implementation would depend on the specific transaction type
    console.log(`Processing transaction: ${transactionId}`);
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number = 3000) {
    return new Promise((resolve) => {
      const server = this.app.listen(port, () => {
        console.log(`🚀 Service Provider API running on port ${port}`);
        resolve(server);
      });
    });
  }
}

export default ServiceProviderAPI;