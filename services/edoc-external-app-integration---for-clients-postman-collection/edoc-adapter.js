/**
 * EDOC External App Integration Adapter
 *
 * Implements the 6-tool "FOR CLIENTS" contract from the published Postman collection.
 * Routing preference is Supabase wrapper functions, with safe fallbacks where useful.
 */

'use strict';

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

const getConsentId = (args = {}) => args.consent_id || args.consentId || args.id;

const shouldFallback = (error) => {
  const status = error && error.response && error.response.status;
  const message =
    (error && error.response && error.response.data && (error.response.data.message || error.response.data.error)) ||
    (error && error.message) ||
    '';

  if (status === 401 || status === 403) return false;
  if (status >= 500) return false;
  if (status === 404) return true;
  if (status === 400 && /not found|unknown action|invalid action/i.test(String(message))) return true;
  if (!status && /not found|unknown action|function/i.test(String(message))) return true;
  return false;
};

class EdocAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const client = config.client || new UniversalSupabaseClient({
      serviceName: 'edoc'
    });

    super({
      id: 'edoc-external-app-integration-for-clients',
      name: 'EDOC External App Integration',
      description: 'Client-facing EDOC consent and dashboard operations',
      category: 'documents',
      capabilities: ['consent', 'dashboard', 'webhooks'],
      client,
      ...config
    });
  }

  async initialize() {
    this.tools = [
      {
        name: 'fetch-user-consents',
        description: 'Fetch user consents by email',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' }
          },
          required: ['email']
        }
      },
      {
        name: 'initialize-consent',
        description: 'Initialize a consent flow for a user',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            redirection_url: { type: 'string', format: 'uri' }
          },
          required: ['email']
        }
      },
      {
        name: 'fetch-consent',
        description: 'Fetch consent details by consent ID',
        inputSchema: {
          type: 'object',
          properties: {
            consent_id: { type: 'string' },
            consentId: { type: 'string' },
            id: { type: 'string' }
          }
        }
      },
      {
        name: 'delete-consent',
        description: 'Delete a consent by consent ID',
        inputSchema: {
          type: 'object',
          properties: {
            consent_id: { type: 'string' },
            consentId: { type: 'string' },
            id: { type: 'string' }
          }
        }
      },
      {
        name: 'get-dashboard',
        description: 'Get dashboard data for a consent',
        inputSchema: {
          type: 'object',
          properties: {
            consent_id: { type: 'string' },
            consentId: { type: 'string' },
            id: { type: 'string' }
          }
        }
      },
      {
        name: 'webhook-sample-request',
        description: 'Send a sample webhook payload to EDOC webhook processor',
        inputSchema: {
          type: 'object',
          properties: {
            event: { type: 'string' },
            data: { type: 'object' },
            signature: { type: 'string', description: 'Optional signature value' }
          },
          required: ['event', 'data']
        }
      }
    ];

    this._initialized = true;
  }

  async callWithFallback(steps = [], context = {}) {
    let lastError = null;

    for (const step of steps) {
      try {
        return await this.client.call(
          step.functionName,
          step.payload || {},
          {
            ...context,
            method: step.method || 'POST',
            params: step.params
          }
        );
      } catch (error) {
        lastError = error;
        if (!shouldFallback(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error('EDOC call failed (no fallback candidates succeeded)');
  }

  async callTool(toolName, args = {}, context = {}) {
    const tool = (this.tools || []).find((t) => t && t.name === toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in adapter '${this.id}'`);
    }

    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();

    try {
      const consentId = getConsentId(args);

      switch (toolName) {
        case 'fetch-user-consents': {
          if (!args.email) throw new Error('email is required');
          return await this.callWithFallback([
            {
              functionName: 'edoc-consent',
              method: 'POST',
              payload: { action: 'fetch_user_consents', email: args.email }
            },
            {
              functionName: 'edoc',
              method: 'POST',
              payload: { action: 'fetch_user_consents', email: args.email }
            }
          ], context);
        }

        case 'initialize-consent': {
          if (!args.email) throw new Error('email is required');
          return await this.callWithFallback([
            {
              functionName: 'init-consent',
              method: 'POST',
              payload: {
                email: args.email,
                redirection_url: args.redirection_url || ''
              }
            },
            {
              functionName: 'edoc-consent',
              method: 'POST',
              payload: {
                action: 'initialize_consent',
                email: args.email,
                redirection_url: args.redirection_url || ''
              }
            },
            {
              functionName: 'edoc',
              method: 'POST',
              payload: {
                action: 'initialize_consent',
                email: args.email,
                redirection_url: args.redirection_url || ''
              }
            }
          ], context);
        }

        case 'fetch-consent': {
          if (!consentId) throw new Error('consent_id (or consentId/id) is required');
          return await this.callWithFallback([
            {
              functionName: 'consent-status',
              method: 'GET',
              params: { id: consentId, consentId }
            },
            {
              functionName: 'edoc-consent',
              method: 'POST',
              payload: { action: 'fetch_consent', id: consentId, consentId }
            },
            {
              functionName: 'edoc',
              method: 'POST',
              payload: { action: 'fetch_consent', id: consentId, consentId }
            }
          ], context);
        }

        case 'delete-consent': {
          if (!consentId) throw new Error('consent_id (or consentId/id) is required');
          return await this.callWithFallback([
            {
              functionName: 'delete-consent',
              method: 'DELETE',
              params: { id: consentId, consentId },
              payload: { id: consentId, consentId }
            },
            {
              functionName: 'edoc-consent',
              method: 'POST',
              payload: { action: 'delete_consent', id: consentId, consentId }
            },
            {
              functionName: 'edoc',
              method: 'POST',
              payload: { action: 'delete_consent', id: consentId, consentId }
            }
          ], context);
        }

        case 'get-dashboard': {
          if (!consentId) throw new Error('consent_id (or consentId/id) is required');
          return await this.callWithFallback([
            {
              functionName: 'edoc-dashboard',
              method: 'GET',
              params: { consentId, id: consentId }
            },
            {
              functionName: 'edoc-consent',
              method: 'POST',
              payload: { action: 'get_dashboard', consentId, id: consentId }
            },
            {
              functionName: 'edoc',
              method: 'POST',
              payload: { action: 'get_dashboard', consentId, id: consentId }
            }
          ], context);
        }

        case 'webhook-sample-request': {
          const payload = {
            event: args.event,
            data: args.data
          };

          const ctx = {
            ...context,
            headers: {
              ...(context.headers || {}),
              ...(args.signature ? { 'x-signature': args.signature } : {})
            }
          };

          return await this.callWithFallback([
            {
              functionName: 'edoc-webhook',
              method: 'POST',
              payload
            },
            {
              functionName: 'edocWebhook',
              method: 'POST',
              payload
            }
          ], ctx);
        }

        default:
          throw new Error(`Unsupported EDOC tool: ${toolName}`);
      }
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = EdocAdapter;

