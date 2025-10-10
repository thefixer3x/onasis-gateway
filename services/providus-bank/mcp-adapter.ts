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
              description: 'Beneficiary bank account number',
            },
            beneficiaryBank: {
              type: 'string',
              description: 'Beneficiary bank code (e.g., 011 for First Bank)',
            },
            transactionAmount: {
              type: 'string',
              description: 'Amount to transfer (in Naira)',
            },
            narration: {
              type: 'string',
              description: 'Transaction description/narration',
            },
            sourceAccountName: {
              type: 'string', 
              description: 'Name of the source account holder',
            },
            transactionReference: {
              type: 'string',
              description: 'Unique transaction reference (optional - will be generated if not provided)',
            },
          },
          required: ['beneficiaryAccountName', 'beneficiaryAccountNumber', 'beneficiaryBank', 'transactionAmount', 'narration', 'sourceAccountName'],
        },
      },
      {
        name: 'pb_multi_debit_transfer',
        description: 'Execute transfer from multiple debit accounts to a single beneficiary',
        inputSchema: {
          type: 'object',
          properties: {
            beneficiaryAccountName: {
              type: 'string',
              description: 'Name of the beneficiary account holder',
            },
            beneficiaryAccountNumber: {
              type: 'string',
              description: 'Beneficiary bank account number',
            },
            beneficiaryBank: {
              type: 'string',
              description: 'Beneficiary bank code',
            },
            transactionAmount: {
              type: 'string',
              description: 'Amount to transfer',
            },
            narration: {
              type: 'string',
              description: 'Transaction description',
            },
            debitAccount: {
              type: 'string',
              description: 'Source debit account number',
            },
            sourceAccountName: {
              type: 'string',
              description: 'Name of the source account holder',
            },
            transactionReference: {
              type: 'string',
              description: 'Unique transaction reference',
            },
          },
          required: ['beneficiaryAccountName', 'beneficiaryAccountNumber', 'beneficiaryBank', 'transactionAmount', 'narration', 'debitAccount', 'sourceAccountName', 'transactionReference'],
        },
      },
      {
        name: 'pb_update_password',
        description: 'Update user account password',
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
        description: 'Check if Providus Bank API service is healthy and accessible',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  // ================== Tool Execution ==================

  async callTool(toolName: string, args: any): Promise<MCPToolResult> {
    try {
      switch (toolName) {
        case 'pb_authenticate':
          return await this.authenticate(args);
        case 'pb_get_user_profile':
          return await this.getUserProfile();
        case 'pb_logout':
          return await this.logout();
        case 'pb_nip_transfer':
          return await this.nipTransfer(args);
        case 'pb_multi_debit_transfer':
          return await this.multiDebitTransfer(args);
        case 'pb_update_password':
          return await this.updatePassword(args);
        case 'pb_health_check':
          return await this.healthCheck();
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  // ================== Tool Implementations ==================

  private async authenticate(args: { email: string; password: string }): Promise<MCPToolResult> {
    const result = await this.client.authenticate(args.email, args.password);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Authentication successful',
          data: {
            userId: result.data.id,
            email: result.data.email,
            firstName: result.data.firstName,
            lastName: result.data.lastName,
            role: result.data.role,
            merchantId: result.data.MerchantId,
            businessName: result.data.Merchant.businessName,
            mode: result.data.Merchant.mode,
            permissions: result.permissions,
          },
        }, null, 2),
      }],
    };
  }

  private async getUserProfile(): Promise<MCPToolResult> {
    const profile = await this.client.getUserProfile();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          profile: profile.data,
          permissions: profile.permissions,
          isAuthenticated: this.client.isAuthenticated(),
        }, null, 2),
      }],
    };
  }

  private async logout(): Promise<MCPToolResult> {
    await this.client.logout();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Successfully logged out',
          isAuthenticated: this.client.isAuthenticated(),
        }, null, 2),
      }],
    };
  }

  private async nipTransfer(args: any): Promise<MCPToolResult> {
    // Generate transaction reference if not provided
    if (!args.transactionReference) {
      args.transactionReference = `PB${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    }

    const result = await this.client.nipFundTransfer({
      beneficiaryAccountName: args.beneficiaryAccountName,
      transactionAmount: args.transactionAmount,
      currencyCode: 'NGN',
      narration: args.narration,
      sourceAccountName: args.sourceAccountName,
      beneficiaryAccountNumber: args.beneficiaryAccountNumber,
      beneficiaryBank: args.beneficiaryBank,
      transactionReference: args.transactionReference,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'NIP transfer executed',
          transactionReference: args.transactionReference,
          result,
        }, null, 2),
      }],
    };
  }

  private async multiDebitTransfer(args: any): Promise<MCPToolResult> {
    const result = await this.client.nipMultiDebitTransfer(args);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Multi-debit transfer executed',
          result,
        }, null, 2),
      }],
    };
  }

  private async updatePassword(args: { currentPassword: string; newPassword: string }): Promise<MCPToolResult> {
    const result = await this.client.updatePassword(args.currentPassword, args.newPassword);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Password updated successfully',
          result,
        }, null, 2),
      }],
    };
  }

  private async healthCheck(): Promise<MCPToolResult> {
    const isHealthy = await this.client.healthCheck();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          healthy: isHealthy,
          message: isHealthy ? 'Service is healthy' : 'Service is not responding',
          timestamp: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }

  // ================== Public Interface ==================

  getTools(): MCPTool[] {
    return this.tools;
  }

  getClient(): ProvidusBankClient {
    return this.client;
  }

  isAuthenticated(): boolean {
    return this.client.isAuthenticated();
  }
}

// Factory function
export function createProvidusBankMCPAdapter(config: PBClientConfig): ProvidusBankMCPAdapter {
  return new ProvidusBankMCPAdapter(config);
}

export type { MCPTool, MCPToolResult, PBClientConfig };