/**
 * Base MCP Adapter
 *
 * Provides a consistent lifecycle and execution surface for runnable adapters.
 * Concrete adapters should:
 * 1) extend BaseMCPAdapter
 * 2) implement initialize() to populate this.tools
 * 3) optionally override callTool() for custom routing
 */

'use strict';

class BaseMCPAdapter {
  constructor(config = {}) {
    if (!config.id) {
      throw new Error('BaseMCPAdapter requires config.id');
    }

    this.id = config.id;
    this.name = config.name || config.id;
    this.version = config.version || '1.0.0';
    this.description = config.description || '';

    this.client = config.client;
    this.tools = Array.isArray(config.tools) ? config.tools : [];

    this.metadata = {
      category: config.category || 'general',
      capabilities: config.capabilities || [],
      ...(config.metadata || {})
    };

    // Explicit call signature marker for AdapterRegistry routing.
    // v2 => callTool(toolName, args, context)
    this.callToolVersion = config.callToolVersion || 'v2';
    this.legacyCallTool = config.legacyCallTool === true;

    this._initialized = false;
    this._stats = { calls: 0, errors: 0, lastCall: null };
  }

  /**
   * Initialize the adapter: load tool definitions, verify connectivity.
   * Subclasses MUST override this to populate this.tools.
   */
  async initialize() {
    throw new Error(`${this.id}: initialize() must be implemented by subclass`);
  }

  /**
   * Execute a tool by name.
   *
   * Default implementation:
   * - verifies tool exists in this.tools
   * - delegates to this.client.call(toolName, args, context)
   */
  async callTool(toolName, args, context = {}) {
    const tool = (this.tools || []).find((t) => t && t.name === toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in adapter '${this.id}'`);
    }

    if (!this.client || typeof this.client.call !== 'function') {
      throw new Error(`Adapter '${this.id}' has no client.call() to execute '${toolName}'`);
    }

    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      return await this.client.call(toolName, args, context);
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }

  listTools() {
    return this.tools || [];
  }

  async healthCheck() {
    if (this.client && typeof this.client.healthCheck === 'function') {
      return this.client.healthCheck();
    }
    return { healthy: true, adapter: this.id, note: 'no client health check' };
  }

  getStats() {
    return {
      ...this._stats,
      toolCount: Array.isArray(this.tools) ? this.tools.length : 0,
      initialized: !!this._initialized
    };
  }
}

module.exports = BaseMCPAdapter;
