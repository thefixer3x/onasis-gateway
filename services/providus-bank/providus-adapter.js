/**
 * Providus Bank Adapter (Phase 4)
 * Runnable MCP adapter for Providus transfer/auth operations.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const { createProvidusClient } = require('./client');

const createReference = () => `PB${Date.now()}${Math.random().toString(36).slice(2, 11)}`;

class ProvidusAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const client = config.client || createProvidusClient({
      baseUrl: config.baseUrl || process.env.PROVIDUS_BASE_URL || 'https://api.providusbank.com',
      username: config.username || process.env.PROVIDUS_USERNAME || '',
      password: config.password || process.env.PROVIDUS_PASSWORD || '',
      email: config.email || process.env.PROVIDUS_EMAIL || '',
      mode: config.mode || process.env.PROVIDUS_MODE || 'sandbox',
    });

    super({
      id: 'providus-bank',
      name: 'Providus Bank API',
      description: 'Nigerian banking and transfer services',
      category: 'banking',
      capabilities: ['authentication', 'profile', 'nip_transfer', 'multi_debit_transfer', 'health_check'],
      client,
      ...config,
    });
  }

  async initialize() {
    this.tools = [
      {
        name: 'pb-authenticate',
        description: 'Authenticate with Providus Bank API and obtain access tokens',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', description: 'Merchant email address' },
            password: { type: 'string', description: 'Merchant password' },
          },
          required: ['email', 'password'],
        },
      },
      {
        name: 'pb-get-user-profile',
        description: 'Get authenticated merchant profile details',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pb-nip-transfer',
        description: 'Execute NIP fund transfer to a beneficiary account',
        inputSchema: {
          type: 'object',
          properties: {
            beneficiaryAccountName: { type: 'string' },
            beneficiaryAccountNumber: { type: 'string' },
            beneficiaryBank: { type: 'string' },
            transactionAmount: { type: 'string' },
            narration: { type: 'string' },
            sourceAccountName: { type: 'string' },
            transactionReference: { type: 'string' },
          },
          required: [
            'beneficiaryAccountName',
            'beneficiaryAccountNumber',
            'beneficiaryBank',
            'transactionAmount',
            'narration',
            'sourceAccountName',
          ],
        },
      },
      {
        name: 'pb-multi-debit-transfer',
        description: 'Execute transfer from multiple debit accounts to one beneficiary',
        inputSchema: {
          type: 'object',
          properties: {
            beneficiaryAccountName: { type: 'string' },
            beneficiaryAccountNumber: { type: 'string' },
            beneficiaryBank: { type: 'string' },
            transactionAmount: { type: 'string' },
            narration: { type: 'string' },
            debitAccount: { type: 'string' },
            sourceAccountName: { type: 'string' },
            transactionReference: { type: 'string' },
          },
          required: [
            'beneficiaryAccountName',
            'beneficiaryAccountNumber',
            'beneficiaryBank',
            'transactionAmount',
            'narration',
            'debitAccount',
            'sourceAccountName',
            'transactionReference',
          ],
        },
      },
      {
        name: 'pb-health-check',
        description: 'Check if Providus Bank API service is healthy and accessible',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];

    this._initialized = true;
  }

  async callTool(toolName, args = {}, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      switch (toolName) {
        case 'pb-authenticate':
          return this.client.authenticate(args.email, args.password);
        case 'pb-get-user-profile':
          return this.client.getUserProfile();
        case 'pb-nip-transfer': {
          const request = {
            ...args,
            transactionReference: args.transactionReference || createReference(),
          };
          return this.client.nipFundTransfer(request);
        }
        case 'pb-multi-debit-transfer':
          return this.client.nipMultiDebitTransfer(args);
        case 'pb-health-check':
          return this.client.healthCheck();
        default:
          throw new Error(`Unknown tool '${toolName}' in adapter '${this.id}'`);
      }
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = ProvidusAdapter;

