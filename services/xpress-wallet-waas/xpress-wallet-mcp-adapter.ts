/**
 * Enhanced MCP Adapter for Xpress Wallet with WaaS Features
 * Full implementation with all banking operations
 */

import { MCPAdapter, MCPTool, AdapterConfig, AdapterStatus } from '../../src/adapters/types/mcp.js';
import XpressWalletService from './xpress-wallet-service.js';
import { Pool } from 'pg';

export class XpressWalletWaaSAdapter implements MCPAdapter {
  name = 'xpress-wallet-waas';
  version = '2.0.0';
  description = 'Enhanced Xpress Wallet adapter with full Wallet-as-a-Service features';
  
  private service: XpressWalletService;
  private config: AdapterConfig;
  private db: Pool;
  private stats = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    startTime: Date.now()
  };

  tools: MCPTool[] = [
    // Wallet Management Tools
    {
      name: "create-customer-wallet",
      description: "Create a new customer wallet with full KYC",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string", description: "User ID" },
          customerName: { type: "string", description: "Customer full name" },
          phoneNumber: { type: "string", description: "Phone number" },
          email: { type: "string", format: "email", description: "Email address" },
          bvn: { type: "string", description: "Bank Verification Number (optional)" },
          walletType: { 
            type: "string", 
            enum: ["personal", "business", "savings", "group"],
            description: "Type of wallet"
          },
          metadata: { type: "object", description: "Additional metadata" }
        },
        required: ["userId", "customerName", "phoneNumber", "email"]
      }
    },
    {
      name: "get-wallet-balance",
      description: "Get wallet balance with optional force sync",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" },
          forceSync: { type: "boolean", description: "Force sync with provider", default: false }
        },
        required: ["walletId"]
      }
    },
    {
      name: "get-wallet-details",
      description: "Get comprehensive wallet information",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" }
        },
        required: ["walletId"]
      }
    },
    {
      name: "freeze-wallet",
      description: "Freeze a customer wallet",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" },
          reason: { type: "string", description: "Reason for freezing" }
        },
        required: ["walletId", "reason"]
      }
    },
    {
      name: "unfreeze-wallet",
      description: "Unfreeze a customer wallet",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" },
          notes: { type: "string", description: "Unfreezing notes" }
        },
        required: ["walletId"]
      }
    },

    // Transaction Tools
    {
      name: "credit-wallet",
      description: "Credit a wallet with enhanced transaction labeling",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" },
          amount: { type: "number", minimum: 0, description: "Amount to credit" },
          narration: { type: "string", description: "Transaction description" },
          reference: { type: "string", description: "Unique reference (optional)" },
          category: { 
            type: "string",
            enum: ["TOP_UP", "SAVINGS", "REFUND"],
            description: "Transaction category"
          },
          metadata: { type: "object", description: "Additional metadata" }
        },
        required: ["walletId", "amount", "narration"]
      }
    },
    {
      name: "debit-wallet",
      description: "Debit a wallet with balance validation",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" },
          amount: { type: "number", minimum: 0, description: "Amount to debit" },
          narration: { type: "string", description: "Transaction description" },
          reference: { type: "string", description: "Unique reference (optional)" },
          category: { 
            type: "string",
            enum: ["WITHDRAWAL", "TRANSFER", "PAYMENT"],
            description: "Transaction category"
          },
          metadata: { type: "object", description: "Additional metadata" }
        },
        required: ["walletId", "amount", "narration"]
      }
    },
    {
      name: "wallet-to-wallet-transfer",
      description: "Transfer between wallets",
      inputSchema: {
        type: "object",
        properties: {
          fromWalletId: { type: "string", description: "Source wallet ID" },
          toWalletId: { type: "string", description: "Destination wallet ID" },
          amount: { type: "number", minimum: 0, description: "Transfer amount" },
          narration: { type: "string", description: "Transfer description" },
          reference: { type: "string", description: "Unique reference (optional)" }
        },
        required: ["fromWalletId", "toWalletId", "amount", "narration"]
      }
    },

    // Banking Tools
    {
      name: "bank-transfer",
      description: "Transfer to bank account",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Source wallet ID" },
          bankCode: { type: "string", description: "Bank code" },
          accountNumber: { type: "string", description: "Account number" },
          amount: { type: "number", minimum: 0, description: "Transfer amount" },
          narration: { type: "string", description: "Transfer description" },
          reference: { type: "string", description: "Unique reference (optional)" }
        },
        required: ["walletId", "bankCode", "accountNumber", "amount", "narration"]
      }
    },
    {
      name: "validate-bank-account",
      description: "Validate bank account details",
      inputSchema: {
        type: "object",
        properties: {
          bankCode: { type: "string", description: "Bank code" },
          accountNumber: { type: "string", description: "Account number" }
        },
        required: ["bankCode", "accountNumber"]
      }
    },
    {
      name: "get-bank-list",
      description: "Get list of supported banks",
      inputSchema: {
        type: "object",
        properties: {
          country: { type: "string", default: "NG", description: "Country code" }
        }
      }
    },

    // Batch Operations
    {
      name: "batch-credit-wallets",
      description: "Credit multiple wallets in batch",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                walletId: { type: "string" },
                amount: { type: "number" },
                narration: { type: "string" }
              },
              required: ["walletId", "amount", "narration"]
            },
            description: "Array of credit operations"
          }
        },
        required: ["items"]
      }
    },
    {
      name: "batch-debit-wallets",
      description: "Debit multiple wallets in batch",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                walletId: { type: "string" },
                amount: { type: "number" },
                narration: { type: "string" }
              },
              required: ["walletId", "amount", "narration"]
            },
            description: "Array of debit operations"
          }
        },
        required: ["items"]
      }
    },
    {
      name: "batch-bank-transfers",
      description: "Multiple bank transfers in batch",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                walletId: { type: "string" },
                bankCode: { type: "string" },
                accountNumber: { type: "string" },
                amount: { type: "number" },
                narration: { type: "string" }
              },
              required: ["walletId", "bankCode", "accountNumber", "amount", "narration"]
            },
            description: "Array of bank transfers"
          }
        },
        required: ["items"]
      }
    },

    // Transaction History
    {
      name: "get-wallet-transactions",
      description: "Get wallet transaction history",
      inputSchema: {
        type: "object",
        properties: {
          walletId: { type: "string", description: "Wallet ID" },
          startDate: { type: "string", format: "date", description: "Start date" },
          endDate: { type: "string", format: "date", description: "End date" },
          type: { type: "string", enum: ["credit", "debit", "all"], default: "all" },
          status: { type: "string", enum: ["pending", "completed", "failed", "all"], default: "all" },
          limit: { type: "number", default: 50, maximum: 100 },
          offset: { type: "number", default: 0 }
        },
        required: ["walletId"]
      }
    },
    {
      name: "get-transaction-details",
      description: "Get detailed transaction information",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "Transaction ID" }
        },
        required: ["transactionId"]
      }
    },

    // Reconciliation Tools
    {
      name: "run-daily-reconciliation",
      description: "Run daily reconciliation process",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", format: "date", description: "Date to reconcile" }
        },
        required: ["date"]
      }
    },
    {
      name: "get-reconciliation-report",
      description: "Get reconciliation report",
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          groupBy: { type: "string", enum: ["day", "week", "month"], default: "day" }
        },
        required: ["startDate", "endDate"]
      }
    },
    {
      name: "check-balance-discrepancies",
      description: "Check for balance discrepancies",
      inputSchema: {
        type: "object",
        properties: {
          walletIds: {
            type: "array",
            items: { type: "string" },
            description: "Specific wallet IDs to check (optional)"
          }
        }
      }
    },

    // Admin Tools
    {
      name: "get-revenue-analytics",
      description: "Get revenue analytics data",
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          businessUnit: { 
            type: "string", 
            enum: ["SAVINGS", "PAYMENTS", "REFERRALS", "GROUPS", "ALL"],
            default: "ALL"
          }
        },
        required: ["startDate", "endDate"]
      }
    },
    {
      name: "get-wallet-performance",
      description: "Get wallet performance metrics",
      inputSchema: {
        type: "object",
        properties: {
          walletType: { 
            type: "string", 
            enum: ["personal", "business", "savings", "group", "all"],
            default: "all"
          },
          limit: { type: "number", default: 100 }
        }
      }
    },
    {
      name: "process-webhook",
      description: "Process incoming webhook from Xpress",
      inputSchema: {
        type: "object",
        properties: {
          signature: { type: "string", description: "Webhook signature" },
          payload: { type: "object", description: "Webhook payload" }
        },
        required: ["signature", "payload"]
      }
    }
  ];

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    
    // Initialize database connection
    this.db = new Pool({
      connectionString: config.databaseUrl || process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize Xpress Wallet service
    this.service = new XpressWalletService({
      apiKey: config.apiKey || process.env.XPRESS_API_KEY || '',
      secretKey: config.secretKey || process.env.XPRESS_SECRET_KEY || '',
      merchantId: config.merchantId || process.env.XPRESS_MERCHANT_ID || '',
      baseUrl: config.baseUrl || 'https://api.xpress-wallet.com/v1',
      webhookSecret: config.webhookSecret || process.env.XPRESS_WEBHOOK_SECRET || '',
      environment: (config.environment || 'production') as 'sandbox' | 'production'
    }, this.db);

    // Test database connection
    await this.db.query('SELECT NOW()');
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.stats.requestCount++;
      
      const result = await this.executeTool(name, args);
      
      this.stats.totalResponseTime += Date.now() - startTime;
      return result;
    } catch (error) {
      this.stats.errorCount++;
      this.stats.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  private async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      // Wallet Management
      case 'create-customer-wallet':
        return await this.service.createWallet(args);
      
      case 'get-wallet-balance':
        return await this.service.getWalletBalance(args.walletId, args.forceSync);
      
      case 'get-wallet-details':
        const wallet = await this.db.query(
          'SELECT * FROM wallet.customer_wallets WHERE id = $1',
          [args.walletId]
        );
        return wallet.rows[0];
      
      case 'freeze-wallet':
        await this.db.query(
          'UPDATE wallet.customer_wallets SET status = $1, metadata = metadata || $2 WHERE id = $3',
          ['frozen', JSON.stringify({ freezeReason: args.reason, freezeDate: new Date() }), args.walletId]
        );
        return { success: true, message: 'Wallet frozen successfully' };
      
      case 'unfreeze-wallet':
        await this.db.query(
          'UPDATE wallet.customer_wallets SET status = $1, metadata = metadata || $2 WHERE id = $3',
          ['active', JSON.stringify({ unfreezeNotes: args.notes, unfreezeDate: new Date() }), args.walletId]
        );
        return { success: true, message: 'Wallet unfrozen successfully' };

      // Transactions
      case 'credit-wallet':
        return await this.service.creditWallet({
          walletId: args.walletId,
          amount: args.amount,
          reference: args.reference,
          narration: args.narration,
          metadata: args.metadata,
          label: {
            category: args.category || 'TOP_UP',
            sub_category: 'wallet_funding',
            business_unit: 'PAYMENTS',
            revenue_type: 'TRANSACTION_FEE',
            tax_applicable: false,
            user_segment: 'INDIVIDUAL',
            acquisition_channel: 'DIRECT'
          }
        });
      
      case 'debit-wallet':
        return await this.service.debitWallet({
          walletId: args.walletId,
          amount: args.amount,
          reference: args.reference,
          narration: args.narration,
          metadata: args.metadata,
          label: {
            category: args.category || 'WITHDRAWAL',
            sub_category: 'wallet_debit',
            business_unit: 'PAYMENTS',
            revenue_type: 'TRANSACTION_FEE',
            tax_applicable: false,
            user_segment: 'INDIVIDUAL',
            acquisition_channel: 'DIRECT'
          }
        });
      
      case 'wallet-to-wallet-transfer':
        // Implement wallet to wallet transfer
        const debitResult = await this.service.debitWallet({
          walletId: args.fromWalletId,
          amount: args.amount,
          reference: args.reference,
          narration: `Transfer to wallet: ${args.narration}`,
          label: { category: 'TRANSFER', sub_category: 'inter_wallet_out' }
        });
        
        const creditResult = await this.service.creditWallet({
          walletId: args.toWalletId,
          amount: args.amount,
          reference: args.reference,
          narration: `Transfer from wallet: ${args.narration}`,
          label: { category: 'TRANSFER', sub_category: 'inter_wallet_in' }
        });
        
        return { debitTransaction: debitResult, creditTransaction: creditResult };

      // Banking
      case 'bank-transfer':
        return await this.service.bankTransfer(args);
      
      case 'validate-bank-account':
        const response = await this.service['validateBankAccount'](args.bankCode, args.accountNumber);
        return response;
      
      case 'get-bank-list':
        const banks = await this.db.query(
          'SELECT * FROM wallet.supported_banks WHERE country_code = $1 ORDER BY bank_name',
          [args.country || 'NG']
        );
        return banks.rows;

      // Batch Operations
      case 'batch-credit-wallets':
        return await this.service.batchCreditWallets(args.items);
      
      case 'batch-debit-wallets':
        // Similar implementation to batch credit
        const batchDebitResults = [];
        for (const item of args.items) {
          try {
            const result = await this.service.debitWallet(item);
            batchDebitResults.push({ success: true, ...result });
          } catch (error) {
            batchDebitResults.push({ success: false, error: error.message, item });
          }
        }
        return batchDebitResults;
      
      case 'batch-bank-transfers':
        const batchTransferResults = [];
        for (const item of args.items) {
          try {
            const result = await this.service.bankTransfer(item);
            batchTransferResults.push({ success: true, ...result });
          } catch (error) {
            batchTransferResults.push({ success: false, error: error.message, item });
          }
        }
        return batchTransferResults;

      // Transaction History
      case 'get-wallet-transactions':
        const txQuery = `
          SELECT * FROM wallet.transactions 
          WHERE wallet_id = $1
          ${args.startDate ? 'AND created_at >= $2' : ''}
          ${args.endDate ? 'AND created_at <= $3' : ''}
          ${args.type !== 'all' ? 'AND type = $4' : ''}
          ${args.status !== 'all' ? 'AND status = $5' : ''}
          ORDER BY created_at DESC
          LIMIT $6 OFFSET $7`;
        
        const txParams = [args.walletId];
        let paramIndex = 2;
        if (args.startDate) txParams.push(args.startDate);
        if (args.endDate) txParams.push(args.endDate);
        if (args.type !== 'all') txParams.push(args.type);
        if (args.status !== 'all') txParams.push(args.status);
        txParams.push(args.limit || 50);
        txParams.push(args.offset || 0);
        
        const transactions = await this.db.query(txQuery, txParams);
        return transactions.rows;
      
      case 'get-transaction-details':
        const txDetail = await this.db.query(
          'SELECT * FROM wallet.transactions WHERE id = $1',
          [args.transactionId]
        );
        return txDetail.rows[0];

      // Reconciliation
      case 'run-daily-reconciliation':
        return await this.service.runDailyReconciliation(new Date(args.date));
      
      case 'get-reconciliation-report':
        const reportQuery = `
          SELECT * FROM wallet.daily_reconciliation 
          WHERE reconciliation_date BETWEEN $1 AND $2
          ORDER BY reconciliation_date DESC`;
        const report = await this.db.query(reportQuery, [args.startDate, args.endDate]);
        return report.rows;
      
      case 'check-balance-discrepancies':
        return await this.service.checkReconciliationDiscrepancies();

      // Admin Tools
      case 'get-revenue-analytics':
        const revenueQuery = `
          SELECT * FROM wallet.revenue_analytics 
          WHERE month BETWEEN $1 AND $2
          ${args.businessUnit !== 'ALL' ? 'AND business_unit = $3' : ''}
          ORDER BY month DESC`;
        const revenueParams = [args.startDate, args.endDate];
        if (args.businessUnit !== 'ALL') revenueParams.push(args.businessUnit);
        const revenue = await this.db.query(revenueQuery, revenueParams);
        return revenue.rows;
      
      case 'get-wallet-performance':
        const perfQuery = `
          SELECT * FROM wallet.wallet_performance 
          ${args.walletType !== 'all' ? 'WHERE wallet_type = $1' : ''}
          ORDER BY transaction_count DESC
          LIMIT $${args.walletType !== 'all' ? '2' : '1'}`;
        const perfParams = args.walletType !== 'all' ? [args.walletType, args.limit] : [args.limit];
        const performance = await this.db.query(perfQuery, perfParams);
        return performance.rows;

      // Webhook
      case 'process-webhook':
        return await this.service.processWebhook(args.signature, args.payload);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check database connection
      await this.db.query('SELECT 1');
      
      // Check if we can access Xpress API
      const testWallet = await this.db.query(
        'SELECT external_wallet_id FROM wallet.customer_wallets LIMIT 1'
      );
      
      if (testWallet.rows[0]) {
        await this.service['getXpressWalletBalance'](testWallet.rows[0].external_wallet_id);
      }
      
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async getStatus(): Promise<AdapterStatus> {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime = this.stats.requestCount > 0 
      ? this.stats.totalResponseTime / this.stats.requestCount 
      : 0;

    // Get additional metrics
    const walletCount = await this.db.query('SELECT COUNT(*) FROM wallet.customer_wallets');
    const txCount = await this.db.query('SELECT COUNT(*) FROM wallet.transactions WHERE created_at > NOW() - INTERVAL \'24 hours\'');

    return {
      name: this.name,
      healthy: await this.isHealthy(),
      lastChecked: new Date(),
      version: this.version,
      uptime,
      requestCount: this.stats.requestCount,
      errorCount: this.stats.errorCount,
      averageResponseTime: avgResponseTime,
      metadata: {
        totalWallets: parseInt(walletCount.rows[0].count),
        dailyTransactions: parseInt(txCount.rows[0].count)
      }
    };
  }

  async cleanup(): Promise<void> {
    await this.db.end();
  }
}

export default XpressWalletWaaSAdapter;