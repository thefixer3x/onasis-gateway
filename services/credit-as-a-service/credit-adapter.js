/**
 * Credit-as-a-Service Adapter (Phase 4)
 * Runnable MCP adapter for internal credit workflows.
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

    this.toolToMethod = new Map();
  }

  async initialize() {
    const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];

    this.tools = endpoints.map((endpoint) => {
      const methodName = endpoint.name;
      const toolName = toKebab(methodName);
      this.toolToMethod.set(toolName, methodName);

      return {
        name: toolName,
        description: endpoint.description || methodName,
        inputSchema: endpoint.input_schema || { type: 'object', properties: {} },
      };
    });

    // Explicit operational probe
    this.tools.push({
      name: 'credit-health-check',
      description: 'Check credit service and database health',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    });

    this.toolToMethod.set('credit-health-check', 'healthCheck');
    this._initialized = true;
  }

  async callTool(toolName, args = {}, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      const methodName = this.toolToMethod.get(toolName);
      if (!methodName) {
        throw new Error(`Unknown tool '${toolName}' in adapter '${this.id}'`);
      }

      const fn = this.client[methodName];
      if (typeof fn !== 'function') {
        throw new Error(`Client method '${methodName}' is not available`);
      }

      return await fn.call(this.client, args, context);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = CreditAsAServiceAdapter;

