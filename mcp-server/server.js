#!/usr/bin/env node

/**
 * MCP Server for API Service Management
 * Provides service discovery, management, and integration capabilities
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Import MCP tool modules
const MemoryMCPTools = require('./tools/memory/index.js');
const CreditMCPTools = require('./tools/credit/index.js');

class APIServiceMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'api-service-warehouse',
        version: '1.0.0',
        description: 'MCP server for API service management and discovery'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.servicesPath = path.join(__dirname, '../services');
    this.gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000';
    this.services = new Map();
    
    // Initialize MCP tool modules
    this.memoryTools = new MemoryMCPTools();
    this.creditTools = new CreditMCPTools();
    
    this.setupHandlers();
    this.loadServices();
  }

  /**
   * Load all services from the services directory
   */
  loadServices() {
    if (!fs.existsSync(this.servicesPath)) {
      console.error('Services directory not found:', this.servicesPath);
      return;
    }

    const serviceDirs = fs.readdirSync(this.servicesPath)
      .filter(dir => fs.statSync(path.join(this.servicesPath, dir)).isDirectory());

    console.log(`📦 Loading services from: ${this.servicesPath}`);
    console.log(`🔍 Found service directories: ${serviceDirs.join(', ')}`);

    for (const serviceDir of serviceDirs) {
      try {
        const servicePath = path.join(this.servicesPath, serviceDir);
        const configFiles = fs.readdirSync(servicePath)
          .filter(file => file.endsWith('.json') && file !== 'catalog.json');

        for (const configFile of configFiles) {
          const configPath = path.join(servicePath, configFile);
          const serviceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          this.services.set(serviceConfig.name, {
            ...serviceConfig,
            configPath,
            directory: servicePath
          });
        }
      } catch (error) {
        console.error(`Failed to load service ${serviceDir}:`, error.message);
      }
    }

    console.log(`Loaded ${this.services.size} services for MCP`);
  }

  /**
   * Setup MCP handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      // Get Memory and Credit tools
      const memoryToolDefs = this.memoryTools.getToolDefinitions();
      const creditToolDefs = this.creditTools.getToolDefinitions();
      
      // Convert tool definitions to MCP format
      const memoryTools = Object.entries(memoryToolDefs).map(([name, def]) => ({
        name,
        description: def.description,
        inputSchema: def.inputSchema
      }));
      
      const creditTools = Object.entries(creditToolDefs).map(([name, def]) => ({
        name,
        description: def.description,
        inputSchema: def.inputSchema
      }));
      
      return {
        tools: [
          // Service management tools
          {
            name: 'list_services',
            description: 'List all available API services',
            inputSchema: {
              type: 'object',
              properties: {
                capability: {
                  type: 'string',
                  description: 'Filter by capability (payment, banking, media, etc.)'
                }
              }
            }
          },
          {
            name: 'get_service_details',
            description: 'Get detailed information about a specific service',
            inputSchema: {
              type: 'object',
              properties: {
                serviceName: {
                  type: 'string',
                  description: 'Name of the service to get details for'
                }
              },
              required: ['serviceName']
            }
          },
          {
            name: 'search_services',
            description: 'Search services by name, capability, or description',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                capability: {
                  type: 'string',
                  description: 'Filter by capability'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_service_endpoints',
            description: 'Get all endpoints for a specific service',
            inputSchema: {
              type: 'object',
              properties: {
                serviceName: {
                  type: 'string',
                  description: 'Name of the service'
                }
              },
              required: ['serviceName']
            }
          },
          {
            name: 'call_service_endpoint',
            description: 'Make a call to a service endpoint through the API Gateway',
            inputSchema: {
              type: 'object',
              properties: {
                serviceName: {
                  type: 'string',
                  description: 'Name of the service'
                },
                endpoint: {
                  type: 'string',
                  description: 'Endpoint path'
                },
                method: {
                  type: 'string',
                  enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                  description: 'HTTP method'
                },
                data: {
                  type: 'object',
                  description: 'Request body data'
                },
                params: {
                  type: 'object',
                  description: 'Query parameters'
                }
              },
              required: ['serviceName', 'endpoint', 'method']
            }
          },
          {
            name: 'activate_service',
            description: 'Activate a service for use',
            inputSchema: {
              type: 'object',
              properties: {
                serviceName: {
                  type: 'string',
                  description: 'Name of the service to activate'
                }
              },
              required: ['serviceName']
            }
          },
          {
            name: 'recommend_services',
            description: 'Get service recommendations based on requirements',
            inputSchema: {
              type: 'object',
              properties: {
                requirements: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of requirements or capabilities needed'
                },
                useCase: {
                  type: 'string',
                  description: 'Description of the use case'
                }
              },
              required: ['requirements']
            }
          },
          // Add Memory and Credit tools
          ...memoryTools,
          ...creditTools
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'list_services':
          return this.listServices(args);
        case 'get_service_details':
          return this.getServiceDetails(args);
        case 'search_services':
          return this.searchServices(args);
        case 'get_service_endpoints':
          return this.getServiceEndpoints(args);
        case 'call_service_endpoint':
          return this.callServiceEndpoint(args);
        case 'activate_service':
          return this.activateService(args);
        case 'recommend_services':
          return this.recommendServices(args);
        default:
          // Check if it's a Memory or Credit tool
          if (name.startsWith('memory_')) {
            return this.memoryTools.executeTool(name, args);
          }
          if (name.startsWith('credit_')) {
            return this.creditTools.executeTool(name, args);
          }
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List available resources
    this.server.setRequestHandler('resources/list', async () => {
      const resources = [];
      
      for (const [serviceName, service] of this.services) {
        resources.push({
          uri: `service://${serviceName}`,
          name: `${service.name} Service Configuration`,
          description: service.metadata?.description || `Configuration for ${service.name}`,
          mimeType: 'application/json'
        });
      }

      return { resources };
    });

    // Handle resource reads
    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      
      if (uri.startsWith('service://')) {
        const serviceName = uri.replace('service://', '');
        const service = this.services.get(serviceName);
        
        if (!service) {
          throw new Error(`Service not found: ${serviceName}`);
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(service, null, 2)
            }
          ]
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  /**
   * List services
   */
  async listServices(args) {
    const { capability } = args || {};
    
    let services = Array.from(this.services.values());
    
    if (capability) {
      services = services.filter(service => 
        service.capabilities && service.capabilities.includes(capability)
      );
    }

    const serviceList = services.map(service => ({
      name: service.name,
      version: service.version,
      capabilities: service.capabilities || [],
      endpoints: service.endpoints?.length || 0,
      authentication: service.authentication?.type || 'none',
      description: service.metadata?.description || ''
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: serviceList.length,
            services: serviceList
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Get service details
   */
  async getServiceDetails(args) {
    const { serviceName } = args;
    const service = this.services.get(serviceName);

    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(service, null, 2)
        }
      ]
    };
  }

  /**
   * Search services
   */
  async searchServices(args) {
    const { query, capability } = args;
    const searchTerm = query.toLowerCase();

    let services = Array.from(this.services.values());

    // Filter by capability if specified
    if (capability) {
      services = services.filter(service => 
        service.capabilities && service.capabilities.includes(capability)
      );
    }

    // Search by name, description, or capabilities
    const matchingServices = services.filter(service => {
      const name = service.name.toLowerCase();
      const description = (service.metadata?.description || '').toLowerCase();
      const capabilities = (service.capabilities || []).join(' ').toLowerCase();
      
      return name.includes(searchTerm) || 
             description.includes(searchTerm) || 
             capabilities.includes(searchTerm);
    });

    const results = matchingServices.map(service => ({
      name: service.name,
      version: service.version,
      capabilities: service.capabilities || [],
      endpoints: service.endpoints?.length || 0,
      authentication: service.authentication?.type || 'none',
      description: service.metadata?.description || '',
      relevance: this.calculateRelevance(service, searchTerm)
    })).sort((a, b) => b.relevance - a.relevance);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            total: results.length,
            results
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Get service endpoints
   */
  async getServiceEndpoints(args) {
    const { serviceName } = args;
    const service = this.services.get(serviceName);

    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            service: serviceName,
            endpoints: service.endpoints || []
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Call service endpoint through API Gateway
   */
  async callServiceEndpoint(args) {
    const { serviceName, endpoint, method, data, params } = args;

    try {
      const url = `${this.gatewayUrl}/api/services/${serviceName}/${endpoint}`;
      
      const response = await axios({
        method: method.toLowerCase(),
        url,
        data,
        params,
        timeout: 30000
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              status: response.status,
              data: response.data
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              status: error.response?.status,
              data: error.response?.data
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Activate service
   */
  async activateService(args) {
    const { serviceName } = args;

    try {
      const response = await axios.post(`${this.gatewayUrl}/api/services/${serviceName}/activate`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Service ${serviceName} activated successfully`,
              data: response.data
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              service: serviceName
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Recommend services based on requirements
   */
  async recommendServices(args) {
    const { requirements, useCase } = args;
    
    const recommendations = [];
    
    for (const [serviceName, service] of this.services) {
      let score = 0;
      const matches = [];
      
      // Check capability matches
      if (service.capabilities) {
        for (const requirement of requirements) {
          const reqLower = requirement.toLowerCase();
          for (const capability of service.capabilities) {
            if (capability.toLowerCase().includes(reqLower) || 
                reqLower.includes(capability.toLowerCase())) {
              score += 10;
              matches.push(`Capability: ${capability}`);
            }
          }
        }
      }
      
      // Check name and description matches
      const serviceName = service.name.toLowerCase();
      const description = (service.metadata?.description || '').toLowerCase();
      
      for (const requirement of requirements) {
        const reqLower = requirement.toLowerCase();
        if (serviceName.includes(reqLower) || description.includes(reqLower)) {
          score += 5;
          matches.push(`Name/Description match: ${requirement}`);
        }
      }
      
      // Use case matching
      if (useCase) {
        const useCaseLower = useCase.toLowerCase();
        if (serviceName.includes(useCaseLower) || description.includes(useCaseLower)) {
          score += 3;
          matches.push(`Use case match: ${useCase}`);
        }
      }
      
      if (score > 0) {
        recommendations.push({
          service: serviceName,
          score,
          matches,
          capabilities: service.capabilities || [],
          endpoints: service.endpoints?.length || 0,
          authentication: service.authentication?.type || 'none',
          description: service.metadata?.description || ''
        });
      }
    }
    
    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            requirements,
            useCase,
            recommendations: recommendations.slice(0, 10) // Top 10
          }, null, 2)
        }
      ]
    };
  }

  /**
   * Calculate relevance score for search
   */
  calculateRelevance(service, searchTerm) {
    let score = 0;
    
    const name = service.name.toLowerCase();
    const description = (service.metadata?.description || '').toLowerCase();
    const capabilities = (service.capabilities || []).join(' ').toLowerCase();
    
    // Exact name match gets highest score
    if (name === searchTerm) score += 100;
    else if (name.includes(searchTerm)) score += 50;
    
    // Description matches
    if (description.includes(searchTerm)) score += 25;
    
    // Capability matches
    if (capabilities.includes(searchTerm)) score += 15;
    
    // Endpoint count bonus
    score += (service.endpoints?.length || 0) * 2;
    
    return score;
  }

  /**
   * Start the MCP server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('MCP Server started and connected');
  }
}

// Start the server
if (require.main === module) {
  const server = new APIServiceMCPServer();
  server.start().catch(console.error);
}

module.exports = APIServiceMCPServer;
