/**
 * Supabase Edge Functions Auto-Discovery Adapter
 *
 * Automatically discovers and registers all deployed Supabase Edge Functions
 * as MCP tools in the Onasis Gateway.
 *
 * Features:
 * - Auto-discovery of Supabase functions
 * - Optional discovery from DIRECT_API_ROUTES.md
 * - Caching with configurable timeout
 * - UAI authentication passthrough
 * - Health checks and monitoring
 * - Fallback mechanisms
 */

const fs = require('fs');

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;

  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const deriveSupabaseUrlFromTokens = () => {
  const candidates = [
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY
  ].filter(Boolean);

  for (const token of candidates) {
    const payload = decodeJwtPayload(token);
    const ref = payload && payload.ref;
    if (ref && typeof ref === 'string') {
      return `https://${ref}.supabase.co`;
    }
  }
  return null;
};

class SupabaseEdgeFunctionsAdapter {
  constructor() {
    // Public properties
    this.name = 'supabase-edge-functions';
    this.version = '1.0.0';
    this.description = 'Auto-discovery adapter for Supabase Edge Functions with UAI authentication';
    this.tools = [];
    // Explicit legacy call signature marker for AdapterRegistry.
    this.callToolVersion = 'v1';
    this.legacyCallTool = true;

    // Private properties
    this.config = null;
    this.functionCache = new Map();
    this.metadataCache = new Map();
    this.lastDiscovery = 0;
    this.isInitialized = false;
    this.startedAt = null;
    this.healthState = {
      healthy: null,
      checkedAt: 0,
      latencyMs: null,
      error: null
    };

    // Default configuration
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
      routesFilePath: process.env.SUPABASE_DIRECT_ROUTES_PATH || '',
      discoveryMode: 'auto',
      cacheTimeout: 300, // 5 minutes
      excludePatterns: ['_*', 'test-*', '*-test', 'experimental-*'],
      includedServices: ['*'], // Include all by default
      authPassthrough: true,
      timeout: 30000,
      healthCheckTimeoutMs: Number(process.env.SUPABASE_HEALTH_TIMEOUT_MS || 5000),
      healthCacheTtlMs: Number(process.env.SUPABASE_HEALTH_CACHE_TTL_MS || 30000),
      retryAttempts: 2,
      environment: 'production',
      uaiIntegration: {
        enabled: true,
        tokenHeader: 'Authorization',
        validateTokens: false
      }
    };
  }

  async initialize(config) {
    // Merge provided config with defaults
    this.config = {
      ...this.config,
      ...config,
      uaiIntegration: {
        ...this.config.uaiIntegration,
        ...(config.uaiIntegration || {})
      }
    };

    // If SUPABASE_URL isn't explicitly set, try deriving it from the Supabase JWT (ref -> https://{ref}.supabase.co).
    if (!this.config.supabaseUrl) {
      const derived = deriveSupabaseUrlFromTokens();
      if (derived) {
        this.config.supabaseUrl = derived;
      }
    }

    if (!this.config.supabaseUrl) {
      throw new Error('SUPABASE_URL is required for Supabase adapter');
    }

    if (!this.startedAt) {
      this.startedAt = Date.now();
    }

    console.log(`🚀 Initializing Supabase Edge Functions Adapter`);
    console.log(`   URL: ${this.config.supabaseUrl}`);
    console.log(`   Mode: ${this.config.discoveryMode}`);
    console.log(`   UAI Integration: ${this.config.uaiIntegration.enabled ? 'Enabled' : 'Disabled'}`);

    if (this.config.discoveryMode === 'auto' || this.config.discoveryMode === 'hybrid') {
      await this.discoverFunctions();
    }

    this.isInitialized = true;
    console.log(`✅ Supabase adapter initialized with ${this.functionCache.size} functions`);
  }

  /**
   * Discover all Supabase Edge Functions
   */
  async discoverFunctions() {
    // Check cache validity
    const now = Date.now() / 1000;
    if (
      this.functionCache.size > 0 &&
      now - this.lastDiscovery < this.config.cacheTimeout
    ) {
      console.log('✅ Using cached Supabase functions');
      return;
    }

    console.log('🔍 Discovering Supabase Edge Functions...');

    try {
      // For now, use known functions from DIRECT_API_ROUTES.md
      // In production, this would query Supabase Management API
      const functions = await this.fetchKnownFunctions();

      // Filter and map to MCPTools
      const tools = functions
        .filter(fn => this.shouldIncludeFunction(fn.slug))
        .map(fn => this.mapToMCPTool(fn));

      // Update cache
      this.functionCache.clear();
      this.metadataCache.clear();

      tools.forEach(tool => {
        this.functionCache.set(tool.name, tool);
      });

      functions.forEach(fn => {
        this.metadataCache.set(fn.slug, {
          id: fn.slug,
          name: fn.name,
          slug: fn.slug,
          status: fn.status,
          version: fn.version
        });
      });

      this.tools = Array.from(this.functionCache.values());
      this.lastDiscovery = now;

      console.log(`✅ Discovered ${tools.length} Supabase Edge Functions`);
    } catch (error) {
      console.error('❌ Failed to discover Supabase functions:', error);

      // Keep cached functions if available
      if (this.functionCache.size > 0) {
        console.log('⚠️ Using stale cache due to discovery failure');
        this.tools = Array.from(this.functionCache.values());
      }
    }
  }

  /**
   * Fetch known functions based on DIRECT_API_ROUTES.md
   * In production, this would call Supabase Management API
   */
  async fetchKnownFunctions() {
    const routesFiles = (this.config.routesFilePath || '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);

    if (routesFiles.length > 0) {
      const aggregated = [];
      const seen = new Set();

      for (const routesFile of routesFiles) {
        if (!fs.existsSync(routesFile)) continue;
        try {
          const parsed = this.parseDirectRoutesFile(routesFile);
          for (const fn of parsed) {
            if (seen.has(fn.slug)) continue;
            seen.add(fn.slug);
            aggregated.push(fn);
          }
          if (parsed.length > 0) {
            console.log(`✅ Loaded ${parsed.length} Supabase functions from ${routesFile}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to parse routes file (${routesFile}): ${error.message}`);
        }
      }

      if (aggregated.length > 0) {
        return aggregated;
      }
    }

    // Fallback: known functions from deployment
    const knownFunctions = [
      // Memory & MaaS API
      { name: 'Memory Create', slug: 'memory-create', status: 'ACTIVE', version: 1 },
      { name: 'Memory Get', slug: 'memory-get', status: 'ACTIVE', version: 1 },
      { name: 'Memory Update', slug: 'memory-update', status: 'ACTIVE', version: 1 },
      { name: 'Memory Delete', slug: 'memory-delete', status: 'ACTIVE', version: 1 },
      { name: 'Memory List', slug: 'memory-list', status: 'ACTIVE', version: 1 },
      { name: 'Memory Search', slug: 'memory-search', status: 'ACTIVE', version: 1 },
      { name: 'Memory Stats', slug: 'memory-stats', status: 'ACTIVE', version: 1 },
      { name: 'Memory Bulk Delete', slug: 'memory-bulk-delete', status: 'ACTIVE', version: 1 },
      { name: 'System Health', slug: 'system-health', status: 'ACTIVE', version: 1 },

      // Intelligence Services
      { name: 'Intelligence Health Check', slug: 'intelligence-health-check', status: 'ACTIVE', version: 1 },
      { name: 'Intelligence Analyze Patterns', slug: 'intelligence-analyze-patterns', status: 'ACTIVE', version: 1 },
      { name: 'Intelligence Behavior Recall', slug: 'intelligence-behavior-recall', status: 'ACTIVE', version: 1 },
      { name: 'Intelligence Behavior Record', slug: 'intelligence-behavior-record', status: 'ACTIVE', version: 1 },
      { name: 'Intelligence Detect Duplicates', slug: 'intelligence-detect-duplicates', status: 'ACTIVE', version: 1 },
      { name: 'Intelligence Find Related', slug: 'intelligence-find-related', status: 'ACTIVE', version: 1 },
      { name: 'Intelligence Suggest Tags', slug: 'intelligence-suggest-tags', status: 'ACTIVE', version: 1 },

      // API Key Management
      { name: 'API Key Create', slug: 'api-key-create', status: 'ACTIVE', version: 1 },
      { name: 'API Key Delete', slug: 'api-key-delete', status: 'ACTIVE', version: 1 },
      { name: 'API Key Revoke', slug: 'api-key-revoke', status: 'ACTIVE', version: 1 },
      { name: 'API Key Rotate', slug: 'api-key-rotate', status: 'ACTIVE', version: 1 },
      { name: 'API Key List', slug: 'api-key-list', status: 'ACTIVE', version: 1 },

      // Config Management
      { name: 'Config Get', slug: 'config-get', status: 'ACTIVE', version: 1 },
      { name: 'Config Set', slug: 'config-set', status: 'ACTIVE', version: 1 },

      // Project Management
      { name: 'Project Create', slug: 'project-create', status: 'ACTIVE', version: 1 },
      { name: 'Organization Info', slug: 'organization-info', status: 'ACTIVE', version: 1 },

      // Payment Integrations (via Supabase Edge Functions)
      { name: 'Stripe Webhook', slug: 'stripe-webhook', status: 'ACTIVE', version: 1 },
      { name: 'Stripe Subscription', slug: 'stripe-subscription', status: 'ACTIVE', version: 1 },
      { name: 'Stripe Connect', slug: 'stripe-connect', status: 'ACTIVE', version: 1 },
      { name: 'Stripe Issuing', slug: 'stripe-issuing', status: 'ACTIVE', version: 1 },
      { name: 'PayStack Integration', slug: 'paystack-integration', status: 'ACTIVE', version: 1 },
      { name: 'Flutterwave', slug: 'flutterwave', status: 'ACTIVE', version: 1 },
      { name: 'PayPal Payment', slug: 'paypal-payment', status: 'ACTIVE', version: 1 },
    ];

    return knownFunctions;
  }

  /**
   * Parse DIRECT_API_ROUTES.md to discover Supabase functions
   */
  parseDirectRoutesFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const functions = [];
    const seen = new Set();
    let currentCategory = 'general';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        currentCategory = trimmed.replace(/^###\s+/, '').trim();
        continue;
      }

      if (!trimmed.startsWith('|')) continue;
      if (!trimmed.includes('/functions/v1/')) continue;

      const cells = trimmed.split('|').map(cell => cell.trim()).filter(Boolean);
      if (cells.length < 3) continue;

      const rawName = cells[0].replace(/`/g, '');
      const url = cells[2].replace(/`/g, '');
      if (!rawName || !url.includes('/functions/v1/')) continue;

      const slug = rawName;
      if (seen.has(slug)) continue;
      seen.add(slug);

      const authColumn = cells[3] || '';
      const authRequired = authColumn.includes('✅');

      functions.push({
        name: this.toTitleCase(slug),
        slug,
        status: 'ACTIVE',
        version: 1,
        category: currentCategory,
        authRequired
      });
    }

    const regexMatches = this.extractFunctionsFromText(content);
    for (const slug of regexMatches) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      functions.push({
        name: this.toTitleCase(slug),
        slug,
        status: 'ACTIVE',
        version: 1,
        category: currentCategory,
        authRequired: true
      });
    }

    return functions;
  }

  toTitleCase(slug) {
    return slug
      .split(/[/-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  extractFunctionsFromText(content) {
    const matches = new Set();
    const regex = /functions\/v1\/([a-zA-Z0-9_/-]+)/g;
    let match = null;

    while ((match = regex.exec(content)) !== null) {
      if (!match[1]) continue;
      const normalized = this.normalizeSlug(match[1]);
      if (normalized) {
        matches.add(normalized);
      }
    }

    return Array.from(matches.values());
  }

  normalizeSlug(raw) {
    const cleaned = raw
      .split('?')[0]
      .split('#')[0]
      .replace(/\\/g, '/')
      .replace(/`/g, '')
      .replace(/\)/g, '')
      .replace(/"/g, '')
      .replace(/'/g, '')
      .replace(/\/+$/g, '')
      .trim();

    if (!cleaned) return null;
    if (cleaned === 'functions' || cleaned === 'v1') return null;
    return cleaned;
  }

  /**
   * Check if function should be included based on patterns
   */
  shouldIncludeFunction(slug) {
    const { excludePatterns, includedServices } = this.config;

    // Check exclude patterns
    for (const pattern of excludePatterns) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(slug)) {
        return false;
      }
    }

    // Check include patterns
    if (includedServices.includes('*')) {
      return true;
    }

    for (const pattern of includedServices) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(slug)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Map Supabase function to MCP Tool
   */
  mapToMCPTool(fn) {
    return {
      name: fn.slug,
      description: `${fn.name} - Supabase Edge Function`,
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Request payload for the function'
          },
          headers: {
            type: 'object',
            description: 'Additional headers to pass'
          }
        },
        required: []
      },
      metadata: {
        category: fn.category || 'supabase',
        authRequired: fn.authRequired ?? true
      }
    };
  }

  async listTools() {
    if (!this.isInitialized) {
      await this.initialize({});
    }

    // Refresh cache if expired
    const now = Date.now() / 1000;
    if (now - this.lastDiscovery > this.config.cacheTimeout) {
      await this.discoverFunctions();
    }

    return this.tools;
  }

  async callTool(name, args) {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }

    const tool = this.functionCache.get(name);
    if (!tool) {
      throw new Error(`Function ${name} not found`);
    }

    const url = `${this.config.supabaseUrl}/functions/v1/${name}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.config.supabaseAnonKey
    };

    // UAI Authentication passthrough
    if (this.config.uaiIntegration.enabled && args.headers) {
      const authHeader = args.headers[this.config.uaiIntegration.tokenHeader];
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    // Merge additional headers
    if (args.headers) {
      Object.assign(headers, args.headers);
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(args.data || args)
      }, this.config.timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase function ${name} failed: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Error calling Supabase function ${name}:`, error);
      throw error;
    }
  }

  async isHealthy() {
    const now = Date.now();
    const cacheTtl = Number.isFinite(this.config.healthCacheTtlMs)
      ? Math.max(0, this.config.healthCacheTtlMs)
      : 30000;

    if (
      this.healthState.healthy !== null &&
      this.healthState.checkedAt > 0 &&
      now - this.healthState.checkedAt < cacheTtl
    ) {
      return this.healthState.healthy;
    }

    const healthCheckTimeoutMs = Number.isFinite(this.config.healthCheckTimeoutMs)
      ? Math.max(500, this.config.healthCheckTimeoutMs)
      : 5000;

    const startedAt = Date.now();
    try {
      // Check if we can reach Supabase
      const response = await this.fetchWithTimeout(`${this.config.supabaseUrl}/functions/v1/system-health`, {
        method: 'GET',
        headers: {
          'apikey': this.config.supabaseAnonKey
        }
      }, healthCheckTimeoutMs);

      this.healthState = {
        healthy: response.ok,
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        error: null
      };

      return response.ok;
    } catch (error) {
      const errorName = error && error.name ? error.name : 'Error';
      const errorMessage = error && error.message ? error.message : String(error);
      const isTimeoutError = errorName === 'TimeoutError' || errorName === 'AbortError' || /timeout|aborted/i.test(errorMessage);

      // Timeout on remote health probes is common in hosted environments; keep logs actionable but not noisy.
      if (isTimeoutError) {
        console.warn(`Supabase health check timeout after ${healthCheckTimeoutMs}ms`);
      } else {
        console.error('Supabase health check failed:', error);
      }

      this.healthState = {
        healthy: false,
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        error: errorMessage
      };
      return false;
    }
  }

  async getStatus() {
    const healthy = await this.isHealthy();
    const uptime = this.startedAt ? Date.now() - this.startedAt : 0;

    return {
      name: this.name,
      version: this.version,
      healthy,
      lastChecked: new Date(),
      uptime,
      requestCount: 0, // TODO: Track request count
      errorCount: 0, // TODO: Track error count
      averageResponseTime: 0, // TODO: Track average response time
      metadata: {
        toolCount: this.functionCache.size,
        lastDiscovery: new Date(this.lastDiscovery * 1000).toISOString(),
        cacheValid: (Date.now() / 1000 - this.lastDiscovery) < this.config.cacheTimeout,
        supabaseUrl: this.config.supabaseUrl,
        discoveryMode: this.config.discoveryMode,
        uaiEnabled: this.config.uaiIntegration.enabled,
        cachedFunctions: this.functionCache.size,
        health: {
          checkedAt: this.healthState.checkedAt ? new Date(this.healthState.checkedAt).toISOString() : null,
          latencyMs: this.healthState.latencyMs,
          cacheTtlMs: this.config.healthCacheTtlMs,
          error: this.healthState.error
        }
      }
    };
  }

  listFunctions() {
    return Array.from(this.metadataCache.values());
  }

  async fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Manual function registration (for hybrid mode)
   */
  async registerFunction(fn) {
    const tool = this.mapToMCPTool(fn);
    this.functionCache.set(tool.name, tool);
    this.tools = Array.from(this.functionCache.values());
    console.log(`✅ Manually registered function: ${fn.slug}`);
  }

  /**
   * Force cache refresh
   */
  async refreshCache() {
    this.lastDiscovery = 0; // Force refresh
    await this.discoverFunctions();
  }
}

module.exports = SupabaseEdgeFunctionsAdapter;
