import fs from 'fs';
import path from 'path';
import { 
  PostmanCollection, 
  PostmanItem, 
  MCPAdapter, 
  MCPTool, 
  GeneratedAdapter,
  AdapterConfig,
  AdapterStatus 
} from '../types/mcp.js';

export class AdapterGenerator {
  private collectionsDir: string;
  private outputDir: string;

  constructor(collectionsDir: string, outputDir: string) {
    this.collectionsDir = collectionsDir;
    this.outputDir = outputDir;
  }

  async generateAllAdapters(): Promise<GeneratedAdapter[]> {
    const collectionFiles = fs.readdirSync(this.collectionsDir)
      .filter(file => file.endsWith('.json'));

    const adapters: GeneratedAdapter[] = [];

    for (const file of collectionFiles) {
      try {
        const adapter = await this.generateAdapter(file);
        adapters.push(adapter);
        console.log(`✅ Generated adapter: ${adapter.name}`);
      } catch (error) {
        console.error(`❌ Failed to generate adapter for ${file}:`, error);
      }
    }

    return adapters;
  }

  async generateAdapter(collectionFile: string): Promise<GeneratedAdapter> {
    const collectionPath = path.join(this.collectionsDir, collectionFile);
    const collection: PostmanCollection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

    const adapterName = this.sanitizeName(collection.info.name);
    const className = this.toPascalCase(adapterName);
    
    const tools = this.extractTools(collection);
    const authType = this.detectAuthType(collection);
    const baseUrl = this.extractBaseUrl(collection);
    const dependencies = this.extractDependencies(collection);

    const adapterCode = this.generateAdapterCode({
      name: adapterName,
      className,
      collection,
      tools,
      authType,
      baseUrl,
      dependencies
    });

    // Ensure output directory exists
    const outputPath = path.join(this.outputDir, 'generated');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const filePath = path.join(outputPath, `${adapterName}.ts`);
    fs.writeFileSync(filePath, adapterCode);

    return {
      name: adapterName,
      className,
      filePath,
      tools,
      dependencies,
      authType,
      baseUrl
    };
  }

  private extractTools(collection: PostmanCollection): MCPTool[] {
    const tools: MCPTool[] = [];

    const processItems = (items: PostmanItem[], prefix = '') => {
      items.forEach(item => {
        if (item.request) {
          const toolName = this.sanitizeName(`${prefix}${item.name}`);
          const tool: MCPTool = {
            name: toolName,
            description: item.description || `${item.request.method} ${item.name}`,
            inputSchema: this.generateInputSchema(item)
          };
          tools.push(tool);
        }
      });
    };

    processItems(collection.item);
    return tools;
  }

  private generateInputSchema(item: PostmanItem): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract URL parameters
    if (typeof item.request.url === 'object' && item.request.url.query) {
      item.request.url.query.forEach(param => {
        properties[param.key] = {
          type: 'string',
          description: `Query parameter: ${param.key}`
        };
      });
    }

    // Extract path parameters
    if (typeof item.request.url === 'object' && item.request.url.path) {
      item.request.url.path.forEach(segment => {
        if (segment.startsWith(':') || segment.includes('{{')) {
          const paramName = segment.replace(/[:{}\s]/g, '');
          properties[paramName] = {
            type: 'string',
            description: `Path parameter: ${paramName}`
          };
          required.push(paramName);
        }
      });
    }

    // Extract body parameters
    if (item.request.body?.mode === 'raw') {
      try {
        const bodyData = JSON.parse(item.request.body.raw || '{}');
        Object.keys(bodyData).forEach(key => {
          properties[key] = {
            type: typeof bodyData[key] === 'number' ? 'number' : 'string',
            description: `Body parameter: ${key}`
          };
        });
      } catch (e) {
        // If body is not JSON, add a generic body parameter
        properties.body = {
          type: 'string',
          description: 'Request body'
        };
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  private detectAuthType(collection: PostmanCollection): string {
    if (collection.auth) {
      return collection.auth.type;
    }
    
    // Check first request for auth
    if (collection.item.length > 0 && collection.item[0].request.auth) {
      return collection.item[0].request.auth.type;
    }

    return 'none';
  }

  private extractBaseUrl(collection: PostmanCollection): string {
    if (collection.variable) {
      const baseUrlVar = collection.variable.find(v => 
        v.key.toLowerCase().includes('baseurl') || 
        v.key.toLowerCase().includes('host')
      );
      if (baseUrlVar) {
        return baseUrlVar.value;
      }
    }

    // Extract from first request
    if (collection.item.length > 0) {
      const firstRequest = collection.item[0].request;
      if (typeof firstRequest.url === 'object') {
        const protocol = firstRequest.url.protocol || 'https';
        const host = Array.isArray(firstRequest.url.host) 
          ? firstRequest.url.host.join('.') 
          : firstRequest.url.host || 'api.example.com';
        return `${protocol}://${host}`;
      }
    }

    return 'https://api.example.com';
  }

  private extractDependencies(collection: PostmanCollection): string[] {
    const deps = ['axios', '@core/shared'];
    
    const authType = this.detectAuthType(collection);
    if (authType === 'oauth2') {
      deps.push('oauth2-client');
    }
    
    return deps;
  }

  private generateAdapterCode(params: {
    name: string;
    className: string;
    collection: PostmanCollection;
    tools: MCPTool[];
    authType: string;
    baseUrl: string;
    dependencies: string[];
  }): string {
    const { name, className, tools, authType, baseUrl, dependencies } = params;

    return `/**
 * Generated MCP Adapter for ${name}
 * Auto-generated from Postman collection
 */

import axios, { AxiosInstance } from 'axios';
import { MCPAdapter, MCPTool, AdapterConfig, AdapterStatus } from '../types/mcp.js';

export class ${className}Adapter implements MCPAdapter {
  name = '${name}';
  version = '1.0.0';
  description = 'MCP adapter for ${name} API';
  
  private client: AxiosInstance;
  private config: AdapterConfig;
  private stats = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    startTime: Date.now()
  };

  tools: MCPTool[] = ${JSON.stringify(tools, null, 2)};

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.baseUrl || '${baseUrl}',
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Adapter/${name}/1.0.0'
      }
    });

    // Setup authentication
    ${this.generateAuthSetup(authType)}

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
    // Tool execution logic will be generated based on Postman requests
    ${this.generateToolExecutions(tools)}
    
    throw new Error(\`Unknown tool: \${name}\`);
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Implement health check logic
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
      averageResponseTime: avgResponseTime
    };
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        console.log(\`[\${this.name}] \${config.method?.toUpperCase()} \${config.url}\`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(\`[\${this.name}] Request failed:\`, error.message);
        return Promise.reject(error);
      }
    );
  }
}

export default ${className}Adapter;`;
  }

  private generateAuthSetup(authType: string): string {
    switch (authType) {
      case 'bearer':
        return `
    if (config.apiKey) {
      this.client.defaults.headers.common['Authorization'] = \`Bearer \${config.apiKey}\`;
    }`;
      
      case 'apikey':
        return `
    if (config.apiKey) {
      this.client.defaults.headers.common['X-API-Key'] = config.apiKey;
    }`;
      
      case 'basic':
        return `
    if (config.credentials?.username && config.credentials?.password) {
      const auth = Buffer.from(\`\${config.credentials.username}:\${config.credentials.password}\`).toString('base64');
      this.client.defaults.headers.common['Authorization'] = \`Basic \${auth}\`;
    }`;
      
      default:
        return '    // No authentication required';
    }
  }

  private generateToolExecutions(tools: MCPTool[]): string {
    return tools.map(tool => `
    if (name === '${tool.name}') {
      // TODO: Implement ${tool.name} execution
      return { message: 'Tool ${tool.name} executed successfully', args };
    }`).join('\n');
  }

  private sanitizeName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toPascalCase(str: string): string {
    return str.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
