// services/providus-bank/mcp-adapter.ts
import { ProvidusBankClient, createProvidusClient, PBClientConfig } from './client.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export class ProvidusBankMCPAdapter {
  private client: ProvidusBankClient;
  private tools: MCPTool[];

  constructor(config: PBClientConfig) {
    this.client = createProvidusClient(config);
    this.tools = this.defineTools();
  }

  // ================== Tool Definitions ==================

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'pb_authenticate',
        description: 'Authenticate with Providus Bank API and obtain access tokens',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Merchant email address',
            },
            password: {
              type: 'string',
              description: 'Merchant password',
            },
          },
          required: ['email', 'password'],
        },
      },
      {
        name: 'pb_get_user_profile',
        description: 'Get authenticated merchant profile, permissions, and merchant details',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pb_logout',
        description: 'Logout from Providus Bank API and invalidate current session',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pb_nip_transfer',
        description: 'Execute NIP fund transfer to Nigerian bank accounts',
        inputSchema: {
          type: 'object',
          properties: {
            beneficiaryAccountName: {
              type: 'string',
              description: 'Name of the beneficiary account holder',
            },
            beneficiaryAccountNumber: {
              type: 'string',
              description: 'Beneficiary account number',
            },
            beneficiaryBank: {
              type: 'string',
              description: 'Beneficiary bank code (e.g., "000013" for GTBank)',
            },
            sourceAccountName: {
              type: 'string',
              description: 'Name of the source account holder',
            },
            transactionAmount: {
              type: 'string',
              description: 'Amount to transfer (e.g., "1000.00")',
            },
            narration: {
              type: 'string',
              description: 'Transfer narration/description',
            },
            transactionReference: {
              type: 'string',
              description: 'Unique transaction reference (auto-generated if not provided)',
            },
          },
          required: [
            'beneficiaryAccountName',
            'beneficiaryAccountNumber',
            'beneficiaryBank',
            'sourceAccountName',
            'transactionAmount',
            'narration',
          ],
        },
      },
      {
        name: 'pb_multi_debit_transfer',
        description: 'Execute NIP transfer from multiple debit accounts',
        inputSchema: {
          type: 'object',
          properties: {
            beneficiaryAccountName: {
              type: 'string',
              description: 'Name of the beneficiary',
            },
            beneficiaryAccountNumber: {
              type: 'string',
              description: 'Beneficiary account number',
            },
            beneficiaryBank: {
              type: 'string',
              description: 'Beneficiary bank code',
            },
            debitAccount: {
              type: 'string',
              description: 'Source debit account number',
            },
            sourceAccountName: {
              type: 'string',
              description: 'Source account holder name',
            },
            transactionAmount: {
              type: 'string',
              description: 'Amount to transfer',
            },
            narration: {
              type: 'string',
              description: 'Transfer description',
            },
            transactionReference: {
              type: 'string',
              description: 'Unique reference for this transaction',
            },
          },
          required: [
            'beneficiaryAccountName',
            'beneficiaryAccountNumber',
            'beneficiaryBank',
            'debitAccount',
            'sourceAccountName',
            'transactionAmount',
            'narration',
          ],
        },
      },
      {
        name: 'pb_update_password',
        description: 'Update user password',
        inputSchema: {
          type: 'object',
          properties: {
            currentPassword: {
              type: 'string',
              description: 'Current password',
            },
            newPassword: {
              type: 'string',
              description: 'New password',
            },
          },
          required: ['currentPassword', 'newPassword'],
        },
      },
      {
        name: 'pb_health_check',
        description: 'Check if Providus Bank API is accessible and responsive',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  // ================== Tool Execution ==================

  async executeTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      switch (toolName) {
        case 'pb_authenticate':
          return await this.handleAuthenticate(args);
        
        case 'pb_get_user_profile':
          return await this.handleGetUserProfile();
        
        case 'pb_logout':
          return await this.handleLogout();
        
        case 'pb_nip_transfer':
          return await this.handleNIPTransfer(args);
        
        case 'pb_multi_debit_transfer':
          return await this.handleMultiDebitTransfer(args);
        
        case 'pb_update_password':
          return await this.handleUpdatePassword(args);
        
        case 'pb_health_check':
          return await this.handleHealthCheck();
        
        default:
          return this.errorResult(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  // ================== Tool Handlers ==================

  private async handleAuthenticate(args: { email: string; password: string }): Promise<MCPToolResult> {
    const result = await this.client.authenticate(args.email, args.password);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          user: {
            id: result.data.id,
            email: result.data.email,
            name: `${result.data.firstName} ${result.data.lastName}`,
            role: result.data.role,
          },
          merchant: {
            id: result.data.Merchant.id,
            businessName: result.data.Merchant.businessName,
            mode: result.data.Merchant.mode,
          },
          permissions: result.permissions,
          authenticated: true,
        }, null, 2),
      }],
    };
  }

  private async handleGetUserProfile(): Promise<MCPToolResult> {
    const profile = await this.client.getUserProfile();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          profile: profile.data,
          permissions: profile.permissions,
        }, null, 2),
      }],
    };
  }

  private async handleLogout(): Promise<MCPToolResult> {
    await this.client.logout();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Successfully logged out from Providus Bank API',
        }, null, 2),
      }],
    };
  }

  private async handleNIPTransfer(args: any): Promise<MCPToolResult> {
    // Generate transaction reference if not provided
    const transactionReference = args.transactionReference || 
      `PB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await this.client.nipFundTransfer({
      beneficiaryAccountName: args.beneficiaryAccountName,
      beneficiaryAccountNumber: args.beneficiaryAccountNumber,
      beneficiaryBank: args.beneficiaryBank,
      sourceAccountName: args.sourceAccountName,
      transactionAmount: args.transactionAmount,
      narration: args.narration,
      transactionReference,
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          transaction: result,
          reference: transactionReference,
        }, null, 2),
      }],
    };
  }

  private async handleMultiDebitTransfer(args: any): Promise<MCPToolResult> {
    const transactionReference = args.transactionReference || 
      `PBMD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await this.client.nipMultiDebitTransfer({
      ...args,
      transactionReference,
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          transaction: result,
          reference: transactionReference,
        }, null, 2),
      }],
    };
  }

  private async handleUpdatePassword(args: { currentPassword: string; newPassword: string }): Promise<MCPToolResult> {
    const result = await this.client.updatePassword(args.currentPassword, args.newPassword);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: result.message,
        }, null, 2),
      }],
    };
  }

  private async handleHealthCheck(): Promise<MCPToolResult> {
    const isHealthy = await this.client.healthCheck();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          healthy: isHealthy,
          timestamp: new Date().toISOString(),
          mode: this.client.getMode(),
        }, null, 2),
      }],
    };
  }

  // ================== Utility Methods ==================

  private errorResult(message: string): MCPToolResult {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: message,
        }, null, 2),
      }],
      isError: true,
    };
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  getClient(): ProvidusBankClient {
    return this.client;
  }
}

// Factory function
export function createProvidusMCPAdapter(config: PBClientConfig): ProvidusBankMCPAdapter {
  return new ProvidusBankMCPAdapter(config);
}

export type { MCPTool, MCPToolResult };
