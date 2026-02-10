/**
 * Adapter Registry
 *
 * Manages runnable adapters + an O(1) tool index for "adapter:tool" IDs.
 * Also supports non-executable mock adapters that remain discoverable via the
 * OperationRegistry (which generates placeholder operations from numeric tool counts).
 */

'use strict';

const getHeader = (headers, key) => {
  if (!headers || typeof headers !== 'object') return undefined;
  if (key in headers) return headers[key];
  const lower = key.toLowerCase();
  if (lower in headers) return headers[lower];
  const foundKey = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return foundKey ? headers[foundKey] : undefined;
};

const normalizeToolNameForId = (name) => (name || '').toString().trim().replace(/_/g, '-');

const splitToolId = (toolId) => {
  if (!toolId || typeof toolId !== 'string') return null;
  const idx = toolId.indexOf(':');
  if (idx === -1) return null;
  const adapterId = toolId.slice(0, idx).trim();
  const toolName = toolId.slice(idx + 1).trim();
  if (!adapterId || !toolName) return null;
  return { adapterId, toolName };
};

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();  // adapterId -> adapter instance
    this.toolIndex = new Map(); // canonicalToolId -> { adapterId, tool }
    this.aliases = new Map();   // aliasToolId -> canonicalToolId
  }

  /**
   * Register an adapter: optionally initialize it, then index its tools.
   *
   * @param {object} adapter
   * @param {object} [options]
   * @param {string} [options.adapterId]
   * @param {boolean} [options.skipInitialize]
   */
  async register(adapter, options = {}) {
    if (!adapter) {
      throw new Error('AdapterRegistry.register() requires an adapter instance');
    }

    const adapterId = options.adapterId || adapter.id || adapter.name;
    if (!adapterId) {
      throw new Error('AdapterRegistry.register() could not determine adapterId');
    }

    // Ensure the adapter has a stable id field.
    if (!adapter.id) adapter.id = adapterId;

    const isAlreadyInitialized = !!(adapter._initialized || adapter.isInitialized || adapter.initialized);

    if (!options.skipInitialize && typeof adapter.initialize === 'function' && !isAlreadyInitialized) {
      await adapter.initialize();
      adapter._initialized = true;
    }

    this.adapters.set(adapterId, adapter);

    // Index tools (prefer adapter.tools; fall back to listTools()).
    let tools = [];
    if (Array.isArray(adapter.tools)) {
      tools = adapter.tools;
    } else if (typeof adapter.listTools === 'function') {
      try {
        const listed = await adapter.listTools();
        if (Array.isArray(listed)) tools = listed;
      } catch {
        // Ignore and index nothing (adapter may still be executable via custom callTool).
      }
    }

    // Some adapters populate tools lazily; index what we have now.
    for (const tool of tools) {
      if (!tool || typeof tool !== 'object' || !tool.name) continue;

      const canonicalToolName = normalizeToolNameForId(tool.name);
      const canonicalId = `${adapterId}:${canonicalToolName}`;

      // Keep the first tool for a canonical id; collisions should be rare.
      if (!this.toolIndex.has(canonicalId)) {
        this.toolIndex.set(canonicalId, { adapterId, tool });
      }

      // Alias: original tool name as declared by adapter.
      const originalId = `${adapterId}:${tool.name}`;
      if (originalId !== canonicalId) {
        this.aliases.set(originalId, canonicalId);
      }

      // Alias: snake_case <-> kebab-case
      const snakeAlias = `${adapterId}:${canonicalToolName.replace(/-/g, '_')}`;
      const kebabAlias = `${adapterId}:${tool.name.toString().replace(/_/g, '-')}`;
      if (snakeAlias !== canonicalId) this.aliases.set(snakeAlias, canonicalId);
      if (kebabAlias !== canonicalId) this.aliases.set(kebabAlias, canonicalId);

      // Alias: lowercased
      this.aliases.set(originalId.toLowerCase(), canonicalId);
      this.aliases.set(canonicalId.toLowerCase(), canonicalId);
      this.aliases.set(snakeAlias.toLowerCase(), canonicalId);
      this.aliases.set(kebabAlias.toLowerCase(), canonicalId);
    }

    return adapter;
  }

  /**
   * Register a mock (non-executable) adapter placeholder.
   *
   * Important: we store tools as a NUMBER so OperationRegistry can generate
   * placeholder operations from it (it checks typeof adapter.tools === 'number').
   */
  registerMock(entry = {}) {
    if (!entry.id) return;
    const toolCount =
      (typeof entry.toolCount === 'number' ? entry.toolCount : undefined) ??
      (typeof entry.tools === 'number' ? entry.tools : undefined) ??
      0;

    this.adapters.set(entry.id, {
      id: entry.id,
      name: entry.name || entry.id,
      description: entry.description || '',
      tools: toolCount,
      toolCount,
      is_mock: true,
      executable: false,
      auth: entry.auth || entry.authType || 'apikey',
      authType: entry.authType || entry.auth || 'apikey',
      category: entry.category || 'general',
      supportedCountries: entry.supportedCountries || entry.supported_countries,
      supportedCurrencies: entry.supportedCurrencies || entry.supported_currencies
    });
  }

  getAdapter(id) {
    return this.adapters.get(id);
  }

  /**
   * Resolve a tool ID to its canonical ID + tool metadata.
   */
  resolveTool(toolId) {
    if (!toolId || typeof toolId !== 'string') return null;

    // Exact match
    if (this.toolIndex.has(toolId)) {
      const entry = this.toolIndex.get(toolId);
      return { canonicalId: toolId, adapterId: entry.adapterId, tool: entry.tool };
    }

    // Alias lookup (exact, then lowercased)
    const aliasTarget = this.aliases.get(toolId) || this.aliases.get(toolId.toLowerCase());
    if (aliasTarget && this.toolIndex.has(aliasTarget)) {
      const entry = this.toolIndex.get(aliasTarget);
      return { canonicalId: aliasTarget, adapterId: entry.adapterId, tool: entry.tool };
    }

    // Normalized candidate (underscores -> hyphens in tool portion)
    const parts = splitToolId(toolId);
    if (parts) {
      const canonicalCandidate = `${parts.adapterId}:${normalizeToolNameForId(parts.toolName)}`;
      if (this.toolIndex.has(canonicalCandidate)) {
        const entry = this.toolIndex.get(canonicalCandidate);
        return { canonicalId: canonicalCandidate, adapterId: entry.adapterId, tool: entry.tool };
      }

      const candidateAlias = this.aliases.get(canonicalCandidate) || this.aliases.get(canonicalCandidate.toLowerCase());
      if (candidateAlias && this.toolIndex.has(candidateAlias)) {
        const entry = this.toolIndex.get(candidateAlias);
        return { canonicalId: candidateAlias, adapterId: entry.adapterId, tool: entry.tool };
      }
    }

    return null;
  }

  /**
   * Build a safe forwarded header set from a request context.
   */
  buildForwardHeaders(context = {}) {
    const headers = (context && typeof context.headers === 'object' && context.headers) ? context.headers : {};

    const authorization =
      context.authorization ||
      getHeader(headers, 'Authorization') ||
      getHeader(headers, 'authorization');

    const apiKey =
      context.apiKey ||
      getHeader(headers, 'X-API-Key') ||
      getHeader(headers, 'x-api-key');

    const apikey =
      getHeader(headers, 'apikey');

    const projectScope =
      context.projectScope ||
      getHeader(headers, 'X-Project-Scope') ||
      getHeader(headers, 'x-project-scope');

    const requestId =
      context.requestId ||
      getHeader(headers, 'X-Request-ID') ||
      getHeader(headers, 'x-request-id');

    const sessionId =
      context.sessionId ||
      getHeader(headers, 'X-Session-ID') ||
      getHeader(headers, 'x-session-id');

    const forwarded = {};
    if (authorization) forwarded.Authorization = authorization;
    if (apiKey) forwarded['X-API-Key'] = apiKey;
    if (apikey) forwarded.apikey = apikey;
    if (projectScope) forwarded['X-Project-Scope'] = projectScope;
    if (requestId) forwarded['X-Request-ID'] = requestId;
    if (sessionId) forwarded['X-Session-ID'] = sessionId;

    return forwarded;
  }

  /**
   * Execute a tool by canonical or aliased tool ID.
   */
  async callTool(toolId, args, context = {}) {
    const resolved = this.resolveTool(toolId);
    if (!resolved) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const adapter = this.adapters.get(resolved.adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${resolved.adapterId}`);
    }

    if (adapter.is_mock || typeof adapter.callTool !== 'function') {
      throw new Error(`Adapter '${resolved.adapterId}' is not executable (mock)`);
    }

    const forwardedHeaders = this.buildForwardHeaders(context);

    // Legacy adapters accept (toolName, { data, headers }) and do not take a context arg.
    if (adapter.callTool.length < 3) {
      return adapter.callTool(resolved.tool.name, { data: args, headers: forwardedHeaders });
    }

    return adapter.callTool(resolved.tool.name, args, { ...context, headers: forwardedHeaders });
  }

  toAdaptersMap() {
    return this.adapters;
  }

  getStats() {
    const values = [...this.adapters.values()];
    const real = values.filter((a) => a && !a.is_mock).length;
    const mock = values.filter((a) => a && a.is_mock).length;
    return {
      totalAdapters: this.adapters.size,
      realAdapters: real,
      mockAdapters: mock,
      indexedTools: this.toolIndex.size,
      aliases: this.aliases.size
    };
  }
}

module.exports = AdapterRegistry;

