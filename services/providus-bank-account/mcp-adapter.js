"use strict";
/**
 * Providus Bank Account Services MCP Adapter
 * MCP tools adapter for corporate account management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountServiceMCPAdapter = void 0;
exports.createAccountMCPAdapter = createAccountMCPAdapter;
const client_1 = require("./client");
class AccountServiceMCPAdapter {
    constructor(config) {
        this.client = new client_1.ProvidusBankAccountClient(config);
        this.tools = this.defineTools();
        this.callToolVersion = 'v1';
        this.legacyCallTool = true;
    }
    defineTools() {
        return [
            {
                name: 'pb_account_get_balance',
                description: 'Get current balance for corporate account',
                inputSchema: {
                    type: 'object',
                    properties: {
                        accountNumber: {
                            type: 'string',
                            description: 'Account number (optional, uses default if not provided)',
                        },
                    },
                },
            },
            {
                name: 'pb_account_validate',
                description: 'Validate beneficiary account before transfer',
                inputSchema: {
                    type: 'object',
                    properties: {
                        accountNumber: {
                            type: 'string',
                            description: 'Account number to validate',
                        },
                        bankCode: {
                            type: 'string',
                            description: 'Bank code (e.g., 000013 for GTBank)',
                        },
                    },
                    required: ['accountNumber', 'bankCode'],
                },
            },
            {
                name: 'pb_account_transaction_history',
                description: 'Get transaction history for account with pagination',
                inputSchema: {
                    type: 'object',
                    properties: {
                        accountNumber: {
                            type: 'string',
                            description: 'Account number',
                        },
                        startDate: {
                            type: 'string',
                            description: 'Start date (YYYY-MM-DD)',
                        },
                        endDate: {
                            type: 'string',
                            description: 'End date (YYYY-MM-DD)',
                        },
                        page: {
                            type: 'number',
                            description: 'Page number (default: 1)',
                        },
                        limit: {
                            type: 'number',
                            description: 'Items per page (default: 50)',
                        },
                        type: {
                            type: 'string',
                            enum: ['CREDIT', 'DEBIT', 'ALL'],
                            description: 'Transaction type filter',
                        },
                    },
                    required: ['accountNumber', 'startDate', 'endDate'],
                },
            },
            {
                name: 'pb_account_generate_statement',
                description: 'Generate account statement for date range',
                inputSchema: {
                    type: 'object',
                    properties: {
                        accountNumber: {
                            type: 'string',
                            description: 'Account number',
                        },
                        startDate: {
                            type: 'string',
                            description: 'Start date (YYYY-MM-DD)',
                        },
                        endDate: {
                            type: 'string',
                            description: 'End date (YYYY-MM-DD)',
                        },
                        format: {
                            type: 'string',
                            enum: ['PDF', 'CSV', 'JSON'],
                            description: 'Statement format',
                        },
                        email: {
                            type: 'string',
                            description: 'Email address to send statement (optional)',
                        },
                    },
                    required: ['accountNumber', 'startDate', 'endDate', 'format'],
                },
            },
            {
                name: 'pb_account_transaction_status',
                description: 'Check status of specific transaction by reference',
                inputSchema: {
                    type: 'object',
                    properties: {
                        reference: {
                            type: 'string',
                            description: 'Transaction reference number',
                        },
                    },
                    required: ['reference'],
                },
            },
            {
                name: 'pb_account_get_bank_codes',
                description: 'Get list of supported Nigerian bank codes',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'pb_account_health_check',
                description: 'Check service health and connectivity',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
        ];
    }
    async callTool(toolName, args) {
        try {
            switch (toolName) {
                case 'pb_account_get_balance':
                    return await this.getBalance(args);
                case 'pb_account_validate':
                    return await this.validateAccount(args);
                case 'pb_account_transaction_history':
                    return await this.getTransactionHistory(args);
                case 'pb_account_generate_statement':
                    return await this.generateStatement(args);
                case 'pb_account_transaction_status':
                    return await this.getTransactionStatus(args);
                case 'pb_account_get_bank_codes':
                    return await this.getBankCodes(args);
                case 'pb_account_health_check':
                    return await this.healthCheck(args);
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async getBalance(args) {
        try {
            const result = await this.client.getBalance(args.accountNumber);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error getting balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async validateAccount(args) {
        try {
            const result = await this.client.validateAccount({
                accountNumber: args.accountNumber,
                bankCode: args.bankCode,
            });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error validating account: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async getTransactionHistory(args) {
        try {
            const result = await this.client.getTransactionHistory(args);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error getting transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async generateStatement(args) {
        try {
            const result = await this.client.generateStatement(args);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error generating statement: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async getTransactionStatus(args) {
        try {
            const result = await this.client.getTransactionStatus(args.reference);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error getting transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async getBankCodes(args) {
        try {
            const result = this.client.getSupportedBankCodes();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error getting bank codes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    async healthCheck(args) {
        try {
            const result = await this.client.healthCheck();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Error checking health: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    }],
                isError: true,
            };
        }
    }
    getTools() {
        return this.tools;
    }
    getClient() {
        return this.client;
    }
    /**
     * Get service statistics
     */
    getStats() {
        return this.client.getStats();
    }
    /**
     * Check if service is healthy
     */
    async isHealthy() {
        try {
            const health = await this.client.healthCheck();
            return health.status === 'healthy';
        }
        catch (error) {
            return false;
        }
    }
}
exports.AccountServiceMCPAdapter = AccountServiceMCPAdapter;
function createAccountMCPAdapter(config) {
    return new AccountServiceMCPAdapter(config);
}
exports.default = AccountServiceMCPAdapter;
