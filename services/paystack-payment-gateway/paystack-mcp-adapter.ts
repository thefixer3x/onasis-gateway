/**
 * PayStack Payment Gateway MCP Adapter
 * Comprehensive MCP adapter for PayStack payment processing
 */

import axios, { AxiosInstance } from 'axios';
import { MCPAdapter, MCPTool, AdapterConfig, AdapterStatus } from '../../src/types/mcp.js';
import PayStackClient from './paystack-client.js';

export class PayStackMCPAdapter implements MCPAdapter {
  name = 'paystack-payment-gateway';
  version = '1.0.0';
  description = 'MCP adapter for comprehensive PayStack payment processing with African market focus';
  
  private client: PayStackClient;
  private config: AdapterConfig;
  private stats = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    startTime: Date.now()
  };

  tools: MCPTool[] = [
    // ========================================================================
    // PAYMENT PROCESSING TOOLS
    // ========================================================================
    {
      name: "initialize_transaction",
      description: "Initialize payment transaction with PayStack",
      inputSchema: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            minimum: 1,
            description: "Payment amount in major currency unit (e.g., naira, not kobo)"
          },
          email: {
            type: "string",
            format: "email",
            description: "Customer's email address"
          },
          currency: {
            type: "string",
            enum: ["NGN", "GHS", "ZAR", "KES"],
            default: "NGN",
            description: "Payment currency"
          },
          reference: {
            type: "string",
            description: "Unique transaction reference (optional, auto-generated if not provided)"
          },
          callback_url: {
            type: "string",
            format: "uri",
            description: "Success callback URL"
          },
          channels: {
            type: "array",
            items: {
              type: "string",
              enum: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"]
            },
            default: ["card", "bank", "ussd"],
            description: "Payment channels to activate"
          }
        },
        required: ["amount", "email"]
      }
    },
    {
      name: "verify_transaction",
      description: "Verify payment transaction status",
      inputSchema: {
        type: "object",
        properties: {
          reference: {
            type: "string",
            description: "Transaction reference to verify"
          }
        },
        required: ["reference"]
      }
    },
    {
      name: "charge_authorization",
      description: "Charge returning customer with saved authorization",
      inputSchema: {
        type: "object",
        properties: {
          authorization_code: {
            type: "string",
            description: "Authorization code from previous transaction"
          },
          email: {
            type: "string",
            format: "email",
            description: "Customer's email address"
          },
          amount: {
            type: "number",
            minimum: 1,
            description: "Amount to charge in major currency unit"
          },
          currency: {
            type: "string",
            default: "NGN",
            description: "Currency for the charge"
          }
        },
        required: ["authorization_code", "email", "amount"]
      }
    },

    // ========================================================================
    // CUSTOMER MANAGEMENT TOOLS
    // ========================================================================
    {
      name: "create_customer",
      description: "Create customer profile in PayStack",
      inputSchema: {
        type: "object",
        properties: {
          email: {
            type: "string",
            format: "email",
            description: "Customer's email address"
          },
          first_name: {
            type: "string",
            description: "Customer's first name"
          },
          last_name: {
            type: "string",
            description: "Customer's last name"
          },
          phone: {
            type: "string",
            description: "Customer's phone number"
          },
          metadata: {
            type: "object",
            description: "Custom metadata for the customer"
          }
        },
        required: ["email"]
      }
    },
    {
      name: "fetch_customer",
      description: "Fetch customer details by email or code",
      inputSchema: {
        type: "object",
        properties: {
          email_or_code: {
            type: "string",
            description: "Customer email or customer code"
          }
        },
        required: ["email_or_code"]
      }
    },
    {
      name: "list_customers",
      description: "List customers with pagination",
      inputSchema: {
        type: "object",
        properties: {
          perPage: {
            type: "integer",
            default: 50,
            maximum: 100,
            description: "Number of customers per page"
          },
          page: {
            type: "integer",
            default: 1,
            description: "Page number"
          },
          from: {
            type: "string",
            format: "date",
            description: "Start date filter"
          },
          to: {
            type: "string",
            format: "date",
            description: "End date filter"
          }
        }
      }
    },

    // ========================================================================
    // VIRTUAL ACCOUNTS (DEDICATED ACCOUNTS)
    // ========================================================================
    {
      name: "create_dedicated_account",
      description: "Create dedicated virtual account for customer",
      inputSchema: {
        type: "object",
        properties: {
          customer: {
            type: "string",
            description: "Customer ID or code"
          },
          preferred_bank: {
            type: "string",
            enum: ["wema-bank", "titan-paystack"],
            default: "wema-bank",
            description: "Preferred bank for virtual account"
          },
          subaccount: {
            type: "string",
            description: "Subaccount code for split settlement"
          }
        },
        required: ["customer"]
      }
    },
    {
      name: "list_dedicated_accounts",
      description: "List dedicated virtual accounts",
      inputSchema: {
        type: "object",
        properties: {
          active: {
            type: "boolean",
            description: "Filter by active status"
          },
          currency: {
            type: "string",
            default: "NGN",
            description: "Filter by currency"
          },
          perPage: {
            type: "integer",
            default: 50,
            description: "Number of accounts per page"
          },
          page: {
            type: "integer",
            default: 1,
            description: "Page number"
          }
        }
      }
    },

    // ========================================================================
    // SUBSCRIPTION MANAGEMENT
    // ========================================================================
    {
      name: "create_subscription_plan",
      description: "Create subscription plan",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Plan name"
          },
          amount: {
            type: "number",
            minimum: 1,
            description: "Plan amount per billing cycle"
          },
          interval: {
            type: "string",
            enum: ["daily", "weekly", "monthly", "biannually", "annually"],
            description: "Billing interval"
          },
          description: {
            type: "string",
            description: "Plan description"
          },
          currency: {
            type: "string",
            default: "NGN",
            description: "Plan currency"
          }
        },
        required: ["name", "amount", "interval"]
      }
    },
    {
      name: "create_subscription",
      description: "Create subscription for customer",
      inputSchema: {
        type: "object",
        properties: {
          customer: {
            type: "string",
            description: "Customer email or code"
          },
          plan: {
            type: "string",
            description: "Plan code"
          },
          authorization: {
            type: "string",
            description: "Authorization code for charging"
          },
          start_date: {
            type: "string",
            format: "date",
            description: "Subscription start date"
          }
        },
        required: ["customer", "plan"]
      }
    },

    // ========================================================================
    // TRANSFER OPERATIONS
    // ========================================================================
    {
      name: "create_transfer_recipient",
      description: "Create transfer recipient",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["nuban", "mobile_money", "basa"],
            description: "Recipient type"
          },
          name: {
            type: "string",
            description: "Recipient name"
          },
          account_number: {
            type: "string",
            description: "Account number"
          },
          bank_code: {
            type: "string",
            description: "Bank code"
          },
          currency: {
            type: "string",
            default: "NGN",
            description: "Currency"
          },
          description: {
            type: "string",
            description: "Recipient description"
          }
        },
        required: ["type", "name", "account_number", "bank_code"]
      }
    },
    {
      name: "initiate_transfer",
      description: "Initiate money transfer",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            enum: ["balance"],
            default: "balance",
            description: "Transfer source"
          },
          amount: {
            type: "number",
            minimum: 1,
            description: "Transfer amount in major currency unit"
          },
          recipient: {
            type: "string",
            description: "Recipient code"
          },
          reason: {
            type: "string",
            description: "Transfer reason"
          },
          currency: {
            type: "string",
            default: "NGN",
            description: "Transfer currency"
          }
        },
        required: ["amount", "recipient"]
      }
    },

    // ========================================================================
    // SPLIT PAYMENTS
    // ========================================================================
    {
      name: "create_split_payment",
      description: "Create split payment configuration",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Split configuration name"
          },
          type: {
            type: "string",
            enum: ["percentage", "flat"],
            description: "Split type"
          },
          currency: {
            type: "string",
            default: "NGN",
            description: "Currency"
          },
          subaccounts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                subaccount: {
                  type: "string",
                  description: "Subaccount code"
                },
                share: {
                  type: "number",
                  description: "Percentage or flat amount"
                }
              },
              required: ["subaccount", "share"]
            },
            description: "Subaccounts and their shares"
          },
          bearer_type: {
            type: "string",
            enum: ["all", "all-proportional", "account", "subaccount"],
            description: "Who bears transaction charges"
          }
        },
        required: ["name", "type", "subaccounts"]
      }
    },

    // ========================================================================
    // BULK OPERATIONS
    // ========================================================================
    {
      name: "bulk_charge",
      description: "Process bulk charges",
      inputSchema: {
        type: "object",
        properties: {
          charges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                authorization: {
                  type: "string",
                  description: "Authorization code"
                },
                amount: {
                  type: "number",
                  minimum: 1,
                  description: "Amount to charge"
                },
                reference: {
                  type: "string",
                  description: "Unique reference (optional)"
                }
              },
              required: ["authorization", "amount"]
            },
            description: "Array of charges to process"
          }
        },
        required: ["charges"]
      }
    },

    // ========================================================================
    // UTILITY TOOLS
    // ========================================================================
    {
      name: "list_transactions",
      description: "List transactions with filters",
      inputSchema: {
        type: "object",
        properties: {
          perPage: {
            type: "integer",
            default: 50,
            maximum: 100,
            description: "Transactions per page"
          },
          page: {
            type: "integer",
            default: 1,
            description: "Page number"
          },
          from: {
            type: "string",
            format: "date",
            description: "Start date filter"
          },
          to: {
            type: "string",
            format: "date",
            description: "End date filter"
          },
          status: {
            type: "string",
            enum: ["success", "failed", "pending"],
            description: "Transaction status filter"
          },
          customer: {
            type: "string",
            description: "Customer filter"
          }
        }
      }
    },
    {
      name: "paystack_health_check",
      description: "Check PayStack service health and connectivity",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }
  ];

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    
    // Initialize PayStack client
    this.client = new PayStackClient({
      secretKey: config.apiKey || process.env.PAYSTACK_SECRET_KEY,
      publicKey: config.publicKey || process.env.PAYSTACK_PUBLIC_KEY,
      baseURL: config.baseUrl || 'https://api.paystack.co',
      environment: config.environment || 'live',
      serviceProvider: {
        enabled: config.serviceProvider?.enabled || false,
        clientId: config.serviceProvider?.clientId,
        branding: config.serviceProvider?.branding || {}
      }
    });
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
    try {
      let result;

      switch (name) {
        // Payment Processing
        case 'initialize_transaction':
          result = await this.client.initializeTransaction(args);
          break;
        
        case 'verify_transaction':
          result = await this.client.verifyTransaction(args.reference);
          break;
        
        case 'charge_authorization':
          result = await this.client.chargeAuthorization(args);
          break;

        // Customer Management
        case 'create_customer':
          result = await this.client.createCustomer(args);
          break;
        
        case 'fetch_customer':
          result = await this.client.fetchCustomer(args.email_or_code);
          break;
        
        case 'list_customers':
          result = await this.client.listCustomers(args);
          break;

        // Virtual Accounts
        case 'create_dedicated_account':
          result = await this.client.createDedicatedAccount(args);
          break;
        
        case 'list_dedicated_accounts':
          result = await this.client.listDedicatedAccounts(args);
          break;

        // Subscriptions
        case 'create_subscription_plan':
          result = await this.client.createPlan(args);
          break;
        
        case 'create_subscription':
          result = await this.client.createSubscription(args);
          break;

        // Transfers
        case 'create_transfer_recipient':
          result = await this.client.createTransferRecipient(args);
          break;
        
        case 'initiate_transfer':
          result = await this.client.initiateTransfer(args);
          break;

        // Split Payments
        case 'create_split_payment':
          result = await this.client.createSplit(args);
          break;

        // Bulk Operations
        case 'bulk_charge':
          result = await this.client.bulkCharge(args);
          break;

        // Utilities
        case 'list_transactions':
          result = await this.client.listTransactions(args);
          break;
        
        case 'paystack_health_check':
          result = await this.client.healthCheck();
          break;

        default:
          throw new Error(`Unknown PayStack tool: ${name}`);
      }

      return {
        success: true,
        tool: name,
        data: result,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - Date.now()
      };

    } catch (error: any) {
      console.error(`[PayStackMCP] ${name} error:`, error.message);
      
      return {
        success: false,
        tool: name,
        error: {
          message: error.response?.data?.message || error.message,
          code: error.response?.data?.code || 'PAYSTACK_ERROR',
          status: error.response?.status,
          details: error.response?.data
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.healthCheck();
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  async getStatus(): Promise<AdapterStatus> {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime = this.stats.requestCount > 0 
      ? this.stats.totalResponseTime / this.stats.requestCount 
      : 0;

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
        service_url: 'https://api.paystack.co',
        supported_countries: ['NG', 'GH', 'ZA', 'KE'],
        supported_currencies: ['NGN', 'GHS', 'ZAR', 'KES'],
        payment_methods: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
        features: ['payments', 'subscriptions', 'virtual_accounts', 'split_payments', 'bulk_operations']
      }
    };
  }
}

export default PayStackMCPAdapter;