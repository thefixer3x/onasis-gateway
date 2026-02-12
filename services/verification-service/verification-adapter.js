/**
 * Verification Service Adapter
 * MCP adapter for comprehensive KYC, KYB, and AML verification services
 * Based on the actual verification service implementation from the monorepo
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const BaseClient = require('../../core/base-client');

class VerificationServiceAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    const verificationApiUrl = process.env.VERIFICATION_API_URL 
      || 'http://localhost:3400'; // Default to the verification service port
    
    super({
      id: 'verification-service',
      name: 'Verification Service',
      description: 'Comprehensive KYC, KYB, and AML verification services',
      category: 'identity_verification',
      capabilities: [
        'kyc_verification', 'kyb_verification', 'aml_compliance', 
        'biometric_verification', 'document_verification', 'background_checks'
      ],
      client: new BaseClient({
        name: 'verification-service',
        baseUrl: verificationApiUrl,
        timeout: 60000, // Verification processes can take longer
        authentication: {
          type: 'header',
          config: {
            header: 'X-API-Key',
            value: process.env.VERIFICATION_API_KEY || 'dev-api-key'
          }
        }
      }),
      ...config
    });
    
    this.stats = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      startTime: Date.now()
    };
  }

  async initialize() {
    // Define the tools for the verification service based on actual implementation
    this.tools = [
      // Identity Verification Tools
      {
        name: 'verify-nin',
        description: 'Verify Nigerian National Identification Number (NIN)',
        inputSchema: {
          type: 'object',
          properties: {
            nin: {
              type: 'string',
              pattern: '^\\d{11}$',
              description: '11-digit National Identification Number'
            },
            firstName: {
              type: 'string',
              description: 'First name to verify against NIN record'
            },
            lastName: {
              type: 'string',
              description: 'Last name to verify against NIN record'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Date of birth to verify against NIN record'
            }
          },
          required: ['nin', 'firstName', 'lastName']
        }
      },
      {
        name: 'verify-bvn',
        description: 'Verify Nigerian Bank Verification Number (BVN)',
        inputSchema: {
          type: 'object',
          properties: {
            bvn: {
              type: 'string',
              pattern: '^\\d{11}$',
              description: '11-digit Bank Verification Number'
            },
            firstName: {
              type: 'string',
              description: 'First name to verify against BVN record'
            },
            lastName: {
              type: 'string',
              description: 'Last name to verify against BVN record'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Date of birth to verify against BVN record'
            }
          },
          required: ['bvn', 'firstName', 'lastName']
        }
      },
      {
        name: 'verify-passport',
        description: 'Verify international passport number',
        inputSchema: {
          type: 'object',
          properties: {
            passportNumber: {
              type: 'string',
              pattern: '^[A-Z0-9]{6,9}$',
              description: 'Passport number (6-9 alphanumeric characters)'
            },
            firstName: {
              type: 'string',
              description: 'First name to verify against passport record'
            },
            lastName: {
              type: 'string',
              description: 'Last name to verify against passport record'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Date of birth to verify against passport record'
            },
            nationality: {
              type: 'string',
              description: 'Nationality code (e.g., NG, US, UK)'
            }
          },
          required: ['passportNumber', 'firstName', 'lastName', 'dateOfBirth']
        }
      },
      {
        name: 'verify-document',
        description: 'Verify other identity documents (drivers license, voters card, national ID)',
        inputSchema: {
          type: 'object',
          properties: {
            documentType: {
              type: 'string',
              enum: ['drivers_license', 'voters_card', 'national_id'],
              description: 'Type of document to verify'
            },
            documentNumber: {
              type: 'string',
              description: 'Document number to verify'
            },
            firstName: {
              type: 'string',
              description: 'First name to verify against document record'
            },
            lastName: {
              type: 'string',
              description: 'Last name to verify against document record'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Date of birth to verify against document record'
            }
          },
          required: ['documentType', 'documentNumber', 'firstName', 'lastName']
        }
      },
      {
        name: 'get-verification-history',
        description: 'Get verification history for identity checks',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of records to return'
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0,
              description: 'Offset for pagination'
            },
            type: {
              type: 'string',
              description: 'Filter by verification type'
            }
          }
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(name, args, context = {}) {
    const startTime = Date.now();

    try {
      this.stats.requestCount++;

      const result = await this.executeTool(name, args, context);

      this.stats.totalResponseTime += Date.now() - startTime;
      return result;
    } catch (error) {
      this.stats.errorCount++;
      this.stats.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  async executeTool(name, args, context) {
    try {
      let endpoint = '';
      let method = 'POST';
      let data = args;

      switch (name) {
        // Identity Verification Tools
        case 'verify-nin':
          endpoint = '/api/v1/identity/nin';
          break;

        case 'verify-bvn':
          endpoint = '/api/v1/identity/bvn';
          break;

        case 'verify-passport':
          endpoint = '/api/v1/identity/passport';
          break;

        case 'verify-document':
          endpoint = '/api/v1/identity/document';
          break;

        case 'get-verification-history':
          endpoint = '/api/v1/identity/history';
          method = 'GET';
          data = undefined;
          break;

        default:
          throw new Error(`Unknown verification tool: ${name}`);
      }

      // Prepare request options
      const requestOptions = {
        path: endpoint,
        method: method
      };

      if (method === 'GET') {
        // For GET requests, use query parameters
        if (args) {
          // Convert args to query parameters
          const queryParams = new URLSearchParams();
          for (const [key, value] of Object.entries(args)) {
            if (value !== undefined && value !== null) {
              queryParams.append(key, String(value));
            }
          }
          requestOptions.path += `?${queryParams.toString()}`;
        }
      } else {
        // For POST/PUT/DELETE requests, use request body
        if (data) {
          requestOptions.data = data;
        }
      }

      // Add auth context if available
      if (context.headers) {
        requestOptions.headers = { ...context.headers };
      }

      // Make the API call
      const response = await this.client.request(requestOptions);

      return {
        success: true,
        tool: name,
        data: response,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - startTime
      };

    } catch (error) {
      console.error(`[VerificationService] ${name} error:`, error.message);

      return {
        success: false,
        tool: name,
        error: {
          message: error.response?.data?.error?.message || error.response?.data?.error || error.message,
          code: error.response?.data?.error?.code || 'VERIFICATION_ERROR',
          status: error.response?.status,
          details: error.response?.data
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async healthCheck() {
    try {
      const result = await this.client.request({
        path: '/health',
        method: 'GET'
      });
      return { healthy: result.success === true || result.status === 200 };
    } catch (error) {
      return { healthy: false, error: error.message };
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
      uptime,
      requestCount: this.stats.requestCount,
      errorCount: this.stats.errorCount,
      averageResponseTime: avgResponseTime,
      metadata: {
        service_url: process.env.VERIFICATION_API_URL || 'http://localhost:3400',
        supported_verifications: ['nin', 'bvn', 'passport', 'drivers_license', 'voters_card', 'national_id'],
        verification_providers: ['prembly', 'sourceid', 'mono', 'dojah', 'youverify', 'jumio'],
        compliance_certifications: ['PCI_DSS_Level_1', 'SOC2_Type_II']
      }
    };
  }
}

module.exports = VerificationServiceAdapter;