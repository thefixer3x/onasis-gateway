/**
 * Verification Service Adapter
 *
 * Unified verification adapter runtime:
 * - Exposes both legacy and modern verification tools.
 * - Backend keeps provider-routing control (Prembly/SourceID/etc).
 *
 * Notes:
 * - Keeps legacy tools for backwards compatibility.
 * - Exposes modern verification tools in kebab-case.
 * - Supports optional enabled-tool filtering from catalog config.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

const toKebab = (value) => (value || '').toString().trim().replace(/_/g, '-').toLowerCase();

const clone = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object') return {};
  return { ...value };
};

const TOOL_DEFINITIONS = {
  // Modern, provider-agnostic verification surface
  'verify-identity-document': {
    description: 'Verify identity documents (passport, national ID, drivers license, NIN, BVN)',
    method: 'POST',
    path: '/api/v1/identity/verify'
  },
  'verify-phone-email': {
    description: 'Verify phone number and email with OTP',
    method: 'POST',
    path: '/api/v1/identity/phone-email'
  },
  'verify-address': {
    description: 'Verify customer address using proof documents',
    method: 'POST',
    path: '/api/v1/identity/address'
  },
  'verify-business-registration': {
    description: 'Verify business registration details (KYB)',
    method: 'POST',
    path: '/api/v1/business/registration'
  },
  'verify-tax-identification': {
    description: 'Verify tax identification number',
    method: 'POST',
    path: '/api/v1/business/tax-id'
  },
  'verify-bank-account': {
    description: 'Verify bank account ownership',
    method: 'POST',
    path: '/api/v1/business/bank-account'
  },
  'facial-recognition': {
    description: 'Compare facial biometrics between two images',
    method: 'POST',
    path: '/api/v1/biometric/face-match'
  },
  'liveness-detection': {
    description: 'Detect liveness to prevent spoofing',
    method: 'POST',
    path: '/api/v1/biometric/liveness'
  },
  'age-gender-detection': {
    description: 'Detect age and gender from image',
    method: 'POST',
    path: '/api/v1/biometric/age-gender'
  },
  'sanctions-screening': {
    description: 'Screen against sanctions lists',
    method: 'POST',
    path: '/api/v1/compliance/sanctions'
  },
  'pep-screening': {
    description: 'Screen politically exposed persons (PEP)',
    method: 'POST',
    path: '/api/v1/compliance/pep'
  },
  'adverse-media-screening': {
    description: 'Screen for adverse media',
    method: 'POST',
    path: '/api/v1/compliance/adverse-media'
  },
  'criminal-background-check': {
    description: 'Run criminal background checks',
    method: 'POST',
    path: '/api/v1/background/criminal'
  },
  'employment-history-check': {
    description: 'Verify employment history',
    method: 'POST',
    path: '/api/v1/background/employment'
  },
  'get-verification-status': {
    description: 'Get status of a verification request',
    method: 'GET',
    path: '/api/v1/verification/status'
  },
  'list-supported-countries': {
    description: 'List countries supported for verification services',
    method: 'GET',
    path: '/api/v1/countries'
  },
  'get-verification-providers': {
    description: 'Get available verification providers',
    method: 'GET',
    path: '/api/v1/providers'
  },

  // Legacy compatibility tools (Prembly-first path)
  'verify-nin': {
    description: 'Verify Nigerian National Identification Number (NIN)',
    method: 'POST',
    path: '/api/v1/identity/nin'
  },
  'verify-bvn': {
    description: 'Verify Nigerian Bank Verification Number (BVN)',
    method: 'POST',
    path: '/api/v1/identity/bvn'
  },
  'verify-passport': {
    description: 'Verify international passport number',
    method: 'POST',
    path: '/api/v1/identity/passport'
  },
  'verify-document': {
    description: 'Verify identity document (legacy path)',
    method: 'POST',
    path: '/api/v1/identity/document'
  },
  'get-verification-history': {
    description: 'Get verification history records',
    method: 'GET',
    path: '/api/v1/identity/history'
  }
};

class VerificationServiceAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const verificationApiUrl = config.baseUrl || process.env.VERIFICATION_API_URL || 'http://localhost:3400';
    const apiKey = config.apiKey || process.env.VERIFICATION_API_KEY || '';

    super({
      id: config.id || 'verification-service',
      name: config.name || 'Verification Service',
      description: config.description || 'Comprehensive KYC, KYB, AML services (provider routing managed by backend)',
      category: 'identity_verification',
      capabilities: [
        'kyc_verification',
        'kyb_verification',
        'aml_compliance',
        'biometric_verification',
        'document_verification',
        'background_checks'
      ],
      client: config.client || new BaseClient({
        name: config.id || 'verification-service',
        baseUrl: verificationApiUrl,
        timeout: config.timeout || 60000,
        authentication: {
          type: 'apikey',
          config: {
            in: 'header',
            key: 'X-API-Key',
            value: apiKey
          }
        }
      }),
      ...config
    });

    this.provider = config.provider || process.env.VERIFICATION_PROVIDER || 'backend-managed';
    this.enabledToolsConfig = Array.isArray(config.enabledTools) ? config.enabledTools : null;
    this.enabledToolsSet = null;

    this.stats = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      startTime: Date.now()
    };
  }

  loadServiceConfig() {
    const configPath = path.join(__dirname, 'verification-service.json');
    if (!fs.existsSync(configPath)) return {};

    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.warn(`[VerificationServiceAdapter] Failed to parse verification-service.json: ${error.message}`);
      return {};
    }
  }

  resolveEnabledTools(overrides) {
    const explicit = Array.isArray(overrides?.enabledTools)
      ? overrides.enabledTools
      : this.enabledToolsConfig;

    if (Array.isArray(explicit) && explicit.length > 0) {
      return new Set(explicit.map(toKebab));
    }

    // Default to all tools.
    return null;
  }

  buildToolsList() {
    const tools = [];

    for (const [toolName, def] of Object.entries(TOOL_DEFINITIONS)) {
      if (this.enabledToolsSet && !this.enabledToolsSet.has(toolName)) continue;

      tools.push({
        name: toolName,
        description: def.description,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        metadata: {
          provider: this.provider,
          category: 'verification'
        }
      });
    }

    return tools;
  }

  async initialize(overrides = {}) {
    if (overrides && typeof overrides === 'object') {
      if (overrides.provider) {
        this.provider = `${overrides.provider}`.toLowerCase();
      }
      if (overrides.id) {
        this.id = `${overrides.id}`;
      }
      if (overrides.name) {
        this.name = `${overrides.name}`;
      }
      if (Array.isArray(overrides.enabledTools)) {
        this.enabledToolsConfig = overrides.enabledTools;
      }
    }

    this.enabledToolsSet = this.resolveEnabledTools(overrides);
    this.tools = this.buildToolsList();
    this._initialized = true;
  }

  getToolDefinition(name) {
    const normalized = toKebab(name);
    return TOOL_DEFINITIONS[normalized] || null;
  }

  buildRequest(definition, args = {}) {
    let requestPath = definition.path;
    const method = definition.method;
    const input = clone(args);

    // Special path shaping for status endpoint.
    if (requestPath === '/api/v1/verification/status' && input.verification_id) {
      requestPath = `${requestPath}/${input.verification_id}`;
      delete input.verification_id;
    }

    const endpoint = {
      path: requestPath,
      method
    };

    const options = {
      headers: {}
    };

    if (method === 'GET') {
      if (Object.keys(input).length > 0) {
        options.params = input;
      }
      return { endpoint, options };
    }

    options.data = input;

    return { endpoint, options };
  }

  async callTool(name, args = {}, context = {}) {
    const startTime = Date.now();
    this.stats.requestCount += 1;

    try {
      const result = await this.executeTool(name, args, context);
      if (result && result.success === false) {
        this.stats.errorCount += 1;
      }
      return result;
    } catch (error) {
      this.stats.errorCount += 1;
      return {
        success: false,
        tool: toKebab(name),
        provider: this.provider,
        error: {
          message: error.message,
          code: error.code || 'VERIFICATION_ERROR'
        },
        timestamp: new Date().toISOString()
      };
    } finally {
      this.stats.totalResponseTime += Date.now() - startTime;
    }
  }

  async executeTool(name, args, context = {}) {
    const toolName = toKebab(name);
    const definition = this.getToolDefinition(toolName);

    if (!definition) {
      return {
        success: false,
        tool: toolName,
        provider: this.provider,
        error: {
          code: 'UNKNOWN_TOOL',
          message: `Unknown verification tool: ${toolName}`
        },
        timestamp: new Date().toISOString()
      };
    }

    if (this.enabledToolsSet && !this.enabledToolsSet.has(toolName)) {
      return {
        success: false,
        tool: toolName,
        provider: this.provider,
        error: {
          code: 'TOOL_DISABLED',
          message: `Tool '${toolName}' is currently disabled for provider '${this.provider}'`
        },
        timestamp: new Date().toISOString()
      };
    }

    const { endpoint, options } = this.buildRequest(definition, args || {});

    if (context && context.headers && typeof context.headers === 'object') {
      options.headers = {
        ...options.headers,
        ...context.headers
      };
    }

    try {
      const response = await this.client.request(endpoint, options);
      return {
        success: true,
        tool: toolName,
        provider: this.provider,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        tool: toolName,
        provider: this.provider,
        error: {
          message: error.response?.data?.error?.message || error.response?.data?.error || error.message,
          code: error.response?.data?.error?.code || error.response?.data?.code || 'VERIFICATION_ERROR',
          status: error.response?.status,
          details: error.response?.data
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async healthCheck() {
    try {
      const result = await this.client.request(
        { path: '/health', method: 'GET' },
        { headers: {} }
      );
      const healthy = result?.success === true || result?.status === 200 || result?.healthy === true;
      return { healthy: !!healthy, provider: this.provider };
    } catch (error) {
      return { healthy: false, provider: this.provider, error: error.message };
    }
  }

  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime = this.stats.requestCount > 0
      ? this.stats.totalResponseTime / this.stats.requestCount
      : 0;

    return {
      ...super.getStats(),
      name: this.name,
      provider: this.provider,
      uptime,
      requestCount: this.stats.requestCount,
      errorCount: this.stats.errorCount,
      averageResponseTime: avgResponseTime,
      metadata: {
        service_url: process.env.VERIFICATION_API_URL || 'http://localhost:3400',
        enabled_tools: this.tools.map((tool) => tool.name),
        enabled_tool_count: this.tools.length,
        provider_control: 'backend-managed'
      }
    };
  }
}

module.exports = VerificationServiceAdapter;
