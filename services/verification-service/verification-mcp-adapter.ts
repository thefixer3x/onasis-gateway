/**
 * Verification Service MCP Adapter
 * Integration adapter for the standalone Verification Service at verify.seftechub.com:9985
 */

import axios, { AxiosInstance } from 'axios';
import { MCPAdapter, MCPTool, AdapterConfig, AdapterStatus } from '../../src/types/mcp.js';

export class VerificationServiceMCPAdapter implements MCPAdapter {
  name = 'verification-service';
  version = '1.0.0';
  description = 'MCP adapter for comprehensive KYC, KYB, and AML verification services';
  
  private client: AxiosInstance;
  private config: AdapterConfig;
  private stats = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    startTime: Date.now()
  };

  tools: MCPTool[] = [
    // ========================================================================
    // IDENTITY VERIFICATION (KYC) TOOLS
    // ========================================================================
    {
      name: "verify_identity_document",
      description: "Verify identity documents (passport, national ID, driver's license, NIN, BVN)",
      inputSchema: {
        type: "object",
        properties: {
          document_type: {
            type: "string",
            enum: ["passport", "national_id", "drivers_license", "voters_card", "nin", "bvn"],
            description: "Type of identity document to verify"
          },
          document_number: {
            type: "string",
            description: "Document number or identifier"
          },
          document_image: {
            type: "string",
            format: "base64",
            description: "Base64 encoded document image (optional)"
          },
          customer_id: {
            type: "string",
            description: "Unique customer identifier"
          },
          country: {
            type: "string",
            default: "NG",
            enum: ["NG", "KE", "GH", "UG", "ZA"],
            description: "Country code for verification"
          },
          first_name: {
            type: "string",
            description: "Customer's first name"
          },
          last_name: {
            type: "string", 
            description: "Customer's last name"
          },
          date_of_birth: {
            type: "string",
            format: "date",
            description: "Customer's date of birth"
          }
        },
        required: ["document_type", "document_number", "customer_id"]
      }
    },
    {
      name: "verify_phone_email",
      description: "Verify phone number and email address with OTP",
      inputSchema: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "Phone number to verify"
          },
          email: {
            type: "string",
            format: "email",
            description: "Email address to verify"
          },
          customer_id: {
            type: "string",
            description: "Unique customer identifier"
          },
          send_otp: {
            type: "boolean",
            default: true,
            description: "Whether to send OTP for verification"
          },
          otp_code: {
            type: "string",
            description: "OTP code for verification (when validating)"
          }
        },
        required: ["customer_id"]
      }
    },
    {
      name: "verify_address",
      description: "Verify customer address using utility bills or bank statements",
      inputSchema: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Full address to verify"
          },
          proof_document: {
            type: "string",
            format: "base64",
            description: "Base64 encoded proof document"
          },
          document_type: {
            type: "string",
            enum: ["utility_bill", "bank_statement", "rental_agreement"],
            description: "Type of address proof document"
          },
          customer_id: {
            type: "string",
            description: "Unique customer identifier"
          }
        },
        required: ["address", "proof_document", "customer_id"]
      }
    },

    // ========================================================================
    // BUSINESS VERIFICATION (KYB) TOOLS
    // ========================================================================
    {
      name: "verify_business_registration",
      description: "Verify business registration (CAC in Nigeria, equivalent in other countries)",
      inputSchema: {
        type: "object",
        properties: {
          business_name: {
            type: "string",
            description: "Registered business name"
          },
          registration_number: {
            type: "string",
            description: "Business registration number"
          },
          country: {
            type: "string",
            default: "NG",
            enum: ["NG", "KE", "GH", "UG", "ZA"],
            description: "Country of registration"
          },
          registration_type: {
            type: "string",
            enum: ["cac", "business_permit", "incorporation"],
            description: "Type of business registration"
          },
          directors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                position: { type: "string" },
                nationality: { type: "string" }
              }
            },
            description: "List of business directors"
          }
        },
        required: ["business_name", "registration_number"]
      }
    },
    {
      name: "verify_tax_identification",
      description: "Verify business tax identification number (TIN)",
      inputSchema: {
        type: "object",
        properties: {
          tax_id: {
            type: "string",
            description: "Tax identification number"
          },
          business_name: {
            type: "string",
            description: "Registered business name"
          },
          country: {
            type: "string",
            default: "NG",
            description: "Country code"
          }
        },
        required: ["tax_id", "business_name"]
      }
    },
    {
      name: "verify_bank_account",
      description: "Verify business bank account ownership",
      inputSchema: {
        type: "object",
        properties: {
          account_number: {
            type: "string",
            description: "Bank account number"
          },
          bank_code: {
            type: "string",
            description: "Bank identifier code"
          },
          account_name: {
            type: "string",
            description: "Account holder name"
          },
          business_name: {
            type: "string",
            description: "Business name to verify against"
          }
        },
        required: ["account_number", "bank_code", "business_name"]
      }
    },

    // ========================================================================
    // BIOMETRIC VERIFICATION TOOLS
    // ========================================================================
    {
      name: "facial_recognition",
      description: "Compare facial biometrics between two images",
      inputSchema: {
        type: "object",
        properties: {
          image1: {
            type: "string",
            format: "base64",
            description: "First image for comparison"
          },
          image2: {
            type: "string",
            format: "base64", 
            description: "Second image for comparison"
          },
          confidence_threshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.7,
            description: "Minimum confidence level for match"
          }
        },
        required: ["image1", "image2"]
      }
    },
    {
      name: "liveness_detection",
      description: "Detect if facial image is from a live person (anti-spoofing)",
      inputSchema: {
        type: "object",
        properties: {
          image: {
            type: "string",
            format: "base64",
            description: "Base64 encoded facial image"
          },
          check_type: {
            type: "string",
            enum: ["basic", "advanced"],
            default: "basic",
            description: "Type of liveness check"
          }
        },
        required: ["image"]
      }
    },
    {
      name: "age_gender_detection",
      description: "Detect age and gender from facial image",
      inputSchema: {
        type: "object",
        properties: {
          image: {
            type: "string",
            format: "base64",
            description: "Base64 encoded facial image"
          }
        },
        required: ["image"]
      }
    },

    // ========================================================================
    // COMPLIANCE & AML SCREENING TOOLS
    // ========================================================================
    {
      name: "sanctions_screening",
      description: "Screen against global sanctions lists (OFAC, UN, EU)",
      inputSchema: {
        type: "object",
        properties: {
          full_name: {
            type: "string",
            description: "Full name to screen"
          },
          date_of_birth: {
            type: "string",
            format: "date",
            description: "Date of birth"
          },
          nationality: {
            type: "string",
            description: "Nationality"
          },
          screening_lists: {
            type: "array",
            items: { type: "string" },
            default: ["ofac", "un", "eu"],
            description: "Sanctions lists to check against"
          }
        },
        required: ["full_name"]
      }
    },
    {
      name: "pep_screening",
      description: "Screen for Politically Exposed Persons (PEP)",
      inputSchema: {
        type: "object",
        properties: {
          full_name: {
            type: "string",
            description: "Full name to screen"
          },
          country: {
            type: "string",
            description: "Country of interest"
          },
          position: {
            type: "string",
            description: "Known political position (optional)"
          }
        },
        required: ["full_name", "country"]
      }
    },
    {
      name: "adverse_media_screening",
      description: "Screen for negative media mentions",
      inputSchema: {
        type: "object",
        properties: {
          full_name: {
            type: "string",
            description: "Full name to screen"
          },
          business_name: {
            type: "string",
            description: "Business name to screen (optional)"
          },
          search_period_days: {
            type: "integer",
            default: 365,
            description: "Number of days to search back"
          }
        },
        required: ["full_name"]
      }
    },

    // ========================================================================
    // BACKGROUND CHECK TOOLS
    // ========================================================================
    {
      name: "criminal_background_check",
      description: "Check criminal history records",
      inputSchema: {
        type: "object",
        properties: {
          full_name: {
            type: "string",
            description: "Full name of person to check"
          },
          date_of_birth: {
            type: "string",
            format: "date",
            description: "Date of birth"
          },
          address: {
            type: "string",
            description: "Current address"
          },
          country: {
            type: "string",
            default: "NG",
            description: "Country for background check"
          },
          search_scope: {
            type: "string",
            enum: ["local", "national", "international"],
            default: "national",
            description: "Scope of background check"
          }
        },
        required: ["full_name", "date_of_birth"]
      }
    },
    {
      name: "employment_history_check",
      description: "Verify employment history",
      inputSchema: {
        type: "object",
        properties: {
          full_name: {
            type: "string",
            description: "Full name of person"
          },
          employers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company_name: { type: "string" },
                position: { type: "string" },
                start_date: { type: "string", format: "date" },
                end_date: { type: "string", format: "date" }
              }
            },
            description: "List of employers to verify"
          }
        },
        required: ["full_name", "employers"]
      }
    },

    // ========================================================================
    // UTILITY & STATUS TOOLS
    // ========================================================================
    {
      name: "get_verification_status",
      description: "Get status of a verification request",
      inputSchema: {
        type: "object",
        properties: {
          verification_id: {
            type: "string",
            description: "Verification request ID"
          },
          reference: {
            type: "string",
            description: "Verification reference (alternative to ID)"
          }
        }
      }
    },
    {
      name: "list_supported_countries",
      description: "List countries supported for verification services",
      inputSchema: {
        type: "object",
        properties: {
          service_type: {
            type: "string",
            enum: ["kyc", "kyb", "biometric", "compliance"],
            description: "Filter by service type"
          }
        }
      }
    },
    {
      name: "get_verification_providers",
      description: "Get available verification providers for a service",
      inputSchema: {
        type: "object",
        properties: {
          service_type: {
            type: "string",
            enum: ["identity", "business", "biometric", "compliance"],
            description: "Type of verification service"
          },
          country: {
            type: "string",
            description: "Country code to filter providers"
          }
        }
      }
    }
  ];

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://verify.seftechub.com:9985',
      timeout: config.timeout || 60000, // Longer timeout for verification processes
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Adapter/verification-service/1.0.0'
      }
    });

    // Setup authentication
    if (config.apiKey) {
      this.client.defaults.headers.common['X-API-Key'] = config.apiKey;
    }

    // Setup request/response interceptors
    this.setupInterceptors();
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.stats.requestCount++;
      
      const result = await this.executeTool(name, args);
      
      this.stats.totalResponseTime += Date.now() - startTime;
      return result;
    } catch (error) {
      this.stats.errorCount++;
      this.stats.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  private async executeTool(name: string, args: any): Promise<any> {
    try {
      let endpoint = '';
      let method = 'POST';
      let data = args;

      switch (name) {
        // Identity Verification Tools
        case 'verify_identity_document':
          endpoint = '/api/v1/identity/verify';
          break;
        
        case 'verify_phone_email':
          endpoint = '/api/v1/identity/phone-email';
          break;
        
        case 'verify_address':
          endpoint = '/api/v1/identity/address';
          break;

        // Business Verification Tools
        case 'verify_business_registration':
          endpoint = '/api/v1/business/registration';
          break;
        
        case 'verify_tax_identification':
          endpoint = '/api/v1/business/tax-id';
          break;
        
        case 'verify_bank_account':
          endpoint = '/api/v1/business/bank-account';
          break;

        // Biometric Verification Tools
        case 'facial_recognition':
          endpoint = '/api/v1/biometric/face-match';
          break;
        
        case 'liveness_detection':
          endpoint = '/api/v1/biometric/liveness';
          break;
        
        case 'age_gender_detection':
          endpoint = '/api/v1/biometric/age-gender';
          break;

        // Compliance Screening Tools
        case 'sanctions_screening':
          endpoint = '/api/v1/compliance/sanctions';
          break;
        
        case 'pep_screening':
          endpoint = '/api/v1/compliance/pep';
          break;
        
        case 'adverse_media_screening':
          endpoint = '/api/v1/compliance/adverse-media';
          break;

        // Background Check Tools
        case 'criminal_background_check':
          endpoint = '/api/v1/background/criminal';
          break;
        
        case 'employment_history_check':
          endpoint = '/api/v1/background/employment';
          break;

        // Utility Tools
        case 'get_verification_status':
          endpoint = args.verification_id 
            ? `/api/v1/verification/status/${args.verification_id}`
            : `/api/v1/verification/status?reference=${args.reference}`;
          method = 'GET';
          data = undefined;
          break;
        
        case 'list_supported_countries':
          endpoint = '/api/v1/countries';
          method = 'GET';
          data = undefined;
          break;
        
        case 'get_verification_providers':
          endpoint = '/api/v1/providers';
          method = 'GET';
          data = undefined;
          break;

        default:
          throw new Error(`Unknown verification tool: ${name}`);
      }

      // Make the API call
      const response = method === 'GET' 
        ? await this.client.get(endpoint, { params: data })
        : await this.client.post(endpoint, data);

      return {
        success: true,
        tool: name,
        data: response.data,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - Date.now()
      };

    } catch (error: any) {
      console.error(`[VerificationService] ${name} error:`, error.message);
      
      return {
        success: false,
        tool: name,
        error: {
          message: error.response?.data?.message || error.message,
          code: error.response?.data?.code || 'VERIFICATION_ERROR',
          status: error.response?.status,
          details: error.response?.data
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getStatus(): Promise<AdapterStatus> {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime = this.stats.requestCount > 0 
      ? this.stats.totalResponseTime / this.stats.requestCount 
      : 0;

    return {
      name: this.name,
      healthy: await this.isHealthy(),
      lastChecked: new Date(),
      version: this.version,
      uptime,
      requestCount: this.stats.requestCount,
      errorCount: this.stats.errorCount,
      averageResponseTime: avgResponseTime,
      metadata: {
        service_url: 'https://verify.seftechub.com:9985',
        supported_countries: ['NG', 'KE', 'GH', 'UG', 'ZA'],
        verification_providers: ['prembly', 'sourceid', 'mono', 'dojah', 'youverify', 'jumio'],
        compliance_certifications: ['PCI_DSS_Level_1', 'SOC2_Type_II']
      }
    };
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[${this.name}] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(`[${this.name}] Request failed:`, error.message);
        return Promise.reject(error);
      }
    );
  }
}

export default VerificationServiceMCPAdapter;