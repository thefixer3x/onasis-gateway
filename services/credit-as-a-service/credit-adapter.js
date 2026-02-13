/**
 * Credit-as-a-Service Adapter (Phase 4)
 * Runnable MCP adapter for internal credit workflows.
 *
 * Contract alignment:
 * - Exposes SDK/API-style tools (credit-*) based on the
 *   credit-as-a-service-platform contract.
 * - Keeps legacy tools from credit-as-a-service.json for backward compatibility.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const CreditAsAServiceClient = require('./client');
const serviceSpec = require('./credit-as-a-service.json');

const toKebab = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/_/g, '-')
  .toLowerCase();

class CreditAsAServiceAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const client = config.client || new CreditAsAServiceClient(config.clientOptions || {});

    super({
      id: 'credit-as-a-service',
      name: 'Credit as a Service',
      description: 'Comprehensive credit management and lending platform',
      category: 'financial',
      capabilities: ['credit_applications', 'providers', 'transactions', 'credit_checks', 'analytics'],
      client,
      ...config,
    });

    this.toolExecutors = new Map();
  }

  addTool(tools, tool, executor) {
    tools.push(tool);
    this.toolExecutors.set(tool.name, executor);
  }

  async executeClientMethod(methodName, args, context) {
    const fn = this.client[methodName];
    if (typeof fn !== 'function') {
      throw new Error(`Client method '${methodName}' is not available`);
    }
    return fn.call(this.client, args, context);
  }

  toCreditApplicationType(purpose, explicitType) {
    if (explicitType) return explicitType;
    if (purpose === 'business') return 'business';
    if (purpose === 'auto' || purpose === 'home') return 'asset_finance';
    return 'personal';
  }

  normalizeCreateApplicationArgs(args = {}) {
    const purpose = args.purpose || args.loan_purpose || args.application_type || 'personal';
    const requestedAmount = args.requestedAmount ?? args.requested_amount ?? args.amount;
    const applicantIncome = args.annualIncome
      ?? args.applicant_income
      ?? args.employmentInfo?.annualIncome
      ?? (typeof args.financialInfo?.monthlyIncome === 'number'
        ? args.financialInfo.monthlyIncome * 12
        : undefined);

    return {
      application_type: this.toCreditApplicationType(purpose, args.applicationType || args.application_type),
      requested_amount: requestedAmount,
      currency: args.currency || 'NGN',
      loan_purpose: purpose,
      applicant_income: applicantIncome,
      user_id: args.userId || args.user_id,
      request_id: args.requestId || args.request_id,
    };
  }

  normalizeListArgs(args = {}) {
    return {
      status: args.status,
      user_id: args.userId || args.user_id,
      page: args.page,
      limit: args.limit,
    };
  }

  normalizeUpdateStatusArgs(args = {}) {
    const decision = args.decision || args.action;
    const mappedStatus = decision === 'approve'
      ? 'approved'
      : (decision === 'reject' ? 'rejected' : undefined);

    return {
      applicationId: args.applicationId || args.application_id || args.id,
      status: args.status || mappedStatus || 'under_review',
      notes: args.notes || args.reason || args.adminNotes,
    };
  }

  async initialize() {
    const tools = [];

    // -------------------------
    // 1) Contract-aligned tools
    // -------------------------
    this.addTool(tools, {
      name: 'credit-create-application',
      description: 'Create a credit application (aligned to /credit/applications)',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
          requestedAmount: { type: 'number', description: 'Requested amount' },
          purpose: { type: 'string', description: 'Loan purpose' },
          annualIncome: { type: 'number', description: 'Annual income' },
          applicationType: { type: 'string', description: 'Optional explicit application type' },
        },
        required: ['userId', 'requestedAmount', 'purpose'],
      },
    }, async (args, context) => this.executeClientMethod(
      'submitCreditApplication',
      this.normalizeCreateApplicationArgs(args),
      context
    ));

    this.addTool(tools, {
      name: 'credit-get-application',
      description: 'Get a credit application by ID',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Application ID' },
          id: { type: 'string', description: 'Alias for applicationId' },
        },
        required: ['applicationId'],
      },
    }, async (args, context) => this.executeClientMethod(
      'getCreditApplication',
      { applicationId: args.applicationId || args.id },
      context
    ));

    this.addTool(tools, {
      name: 'credit-list-applications',
      description: 'List credit applications with filters',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          userId: { type: 'string' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
    }, async (args, context) => this.executeClientMethod(
      'getCreditApplications',
      this.normalizeListArgs(args),
      context
    ));

    this.addTool(tools, {
      name: 'credit-update-application',
      description: 'Update credit application status/decision',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string' },
          status: { type: 'string' },
          decision: { type: 'string', enum: ['approve', 'reject'] },
          notes: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['applicationId'],
      },
    }, async (args, context) => this.executeClientMethod(
      'updateApplicationStatus',
      this.normalizeUpdateStatusArgs(args),
      context
    ));

    this.addTool(tools, {
      name: 'credit-submit-application',
      description: 'Submit an application into review workflow',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['applicationId'],
      },
    }, async (args, context) => this.executeClientMethod(
      'updateApplicationStatus',
      {
        applicationId: args.applicationId,
        status: 'under_review',
        notes: args.notes,
      },
      context
    ));

    this.addTool(tools, {
      name: 'credit-make-decision',
      description: 'Approve/reject application decision',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string' },
          decision: { type: 'string', enum: ['approve', 'reject'] },
          reason: { type: 'string' },
        },
        required: ['applicationId', 'decision'],
      },
    }, async (args, context) => this.executeClientMethod(
      'updateApplicationStatus',
      this.normalizeUpdateStatusArgs(args),
      context
    ));

    this.addTool(tools, {
      name: 'credit-get-applications-by-user',
      description: 'List applications for a specific user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          status: { type: 'string' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
        required: ['userId'],
      },
    }, async (args, context) => this.executeClientMethod(
      'getCreditApplications',
      this.normalizeListArgs(args),
      context
    ));

    this.addTool(tools, {
      name: 'credit-get-application-analytics',
      description: 'Get credit application analytics',
      inputSchema: {
        type: 'object',
        properties: {
          metricType: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
    }, async (args, context) => this.executeClientMethod(
      'getCreditAnalytics',
      {
        metric_type: args.metricType || args.metric_type || 'daily',
        start_date: args.startDate || args.start_date,
        end_date: args.endDate || args.end_date,
      },
      context
    ));

    this.addTool(tools, {
      name: 'credit-perform-check',
      description: 'Perform credit check',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          checkType: { type: 'string' },
        },
        required: ['userId'],
      },
    }, async (args, context) => this.executeClientMethod(
      'performCreditCheck',
      {
        user_id: args.userId || args.user_id,
        check_type: args.checkType || args.check_type || 'basic',
      },
      context
    ));

    // ------------------------------
    // 2) Legacy tools (compat layer)
    // ------------------------------
    const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];
    endpoints.forEach((endpoint) => {
      const methodName = endpoint.name;
      const toolName = toKebab(methodName);

      if (this.toolExecutors.has(toolName)) return;

      this.addTool(tools, {
        name: toolName,
        description: `${endpoint.description || methodName} (legacy tool name)`,
        inputSchema: endpoint.input_schema || { type: 'object', properties: {} },
      }, async (args, context) => this.executeClientMethod(methodName, args, context));
    });

    this.addTool(tools, {
      name: 'credit-health-check',
      description: 'Check credit service and database health',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    }, async (args, context) => this.executeClientMethod('healthCheck', args, context));

    this.tools = tools;
    this._initialized = true;
  }

  async callTool(toolName, args = {}, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      const executor = this.toolExecutors.get(toolName);
      if (typeof executor !== 'function') {
        throw new Error(`Unknown tool '${toolName}' in adapter '${this.id}'`);
      }
      return await executor(args || {}, context || {});
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = CreditAsAServiceAdapter;
