#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function sanitizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toPascalCase(str) {
  return str.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function extractTools(collection) {
  const tools = [];
  
  function processItems(items, prefix = '') {
    if (!items || !Array.isArray(items)) return;
    
    items.forEach(item => {
      if (item.request && item.name) {
        const toolName = sanitizeName(`${prefix}${item.name}`);
        const tool = {
          name: toolName,
          description: item.description || `${item.request.method || 'GET'} ${item.name}`,
          inputSchema: generateInputSchema(item)
        };
        tools.push(tool);
      }
      
      // Process nested items
      if (item.item && Array.isArray(item.item)) {
        processItems(item.item, `${prefix}${item.name || 'item'}-`);
      }
    });
  }
  
  processItems(collection.item || []);
  return tools;
}

function generateInputSchema(item) {
  const properties = {};
  const required = [];
  
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
  
  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined
  };
}

function detectAuthType(collection) {
  if (collection.auth && collection.auth.type) {
    return collection.auth.type;
  }
  
  if (collection.item && collection.item.length > 0) {
    const firstItem = collection.item[0];
    if (firstItem.request && firstItem.request.auth && firstItem.request.auth.type) {
      return firstItem.request.auth.type;
    }
  }
  
  return 'apikey';
}

function extractBaseUrl(collection) {
  if (collection.variable && Array.isArray(collection.variable)) {
    const baseUrlVar = collection.variable.find(v => 
      v.key && v.key.toLowerCase().includes('baseurl') || 
      v.key && v.key.toLowerCase().includes('host')
    );
    if (baseUrlVar && baseUrlVar.value) {
      return baseUrlVar.value;
    }
  }
  
  if (collection.item && collection.item.length > 0) {
    const firstItem = collection.item[0];
    if (firstItem.request && firstItem.request.url) {
      const url = firstItem.request.url;
      if (typeof url === 'object' && url.protocol && url.host) {
        const protocol = url.protocol || 'https';
        const host = Array.isArray(url.host) 
          ? url.host.join('.') 
          : url.host || 'api.example.com';
        return `${protocol}://${host}`;
      } else if (typeof url === 'string') {
        try {
          const urlObj = new URL(url);
          return `${urlObj.protocol}//${urlObj.host}`;
        } catch (e) {
          // If URL parsing fails, return default
        }
      }
    }
  }
  
  return 'https://api.example.com';
}

function generateAdapterCode(params) {
  const { name, className, tools, authType, baseUrl } = params;
  
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
    ${generateAuthSetup(authType)}

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
    ${generateToolExecutions(tools)}
    
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

function generateAuthSetup(authType) {
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

function generateToolExecutions(tools) {
  return tools.map(tool => `
    if (name === '${tool.name}') {
      // TODO: Implement ${tool.name} execution
      return { message: 'Tool ${tool.name} executed successfully', args };
    }`).join('\n');
}

async function main() {
  console.log('🚀 Generating MCP adapters from Postman collections...\n');

  const collectionsDir = path.join(__dirname, 'postman-collections');
  const adaptersDir = path.join(__dirname, 'src', 'adapters', 'generated');
  
  // Ensure output directory exists
  if (!fs.existsSync(adaptersDir)) {
    fs.mkdirSync(adaptersDir, { recursive: true });
  }

  const collectionFiles = fs.readdirSync(collectionsDir)
    .filter(file => file.endsWith('.json'));

  const adapters = [];

  for (const file of collectionFiles) {
    try {
      console.log(`📦 Processing ${file}...`);
      
      const collectionPath = path.join(collectionsDir, file);
      const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

      const adapterName = sanitizeName(collection.info.name);
      const className = toPascalCase(adapterName);
      
      const tools = extractTools(collection);
      const authType = detectAuthType(collection);
      const baseUrl = extractBaseUrl(collection);

      const adapterCode = generateAdapterCode({
        name: adapterName,
        className,
        tools,
        authType,
        baseUrl
      });

      const filePath = path.join(adaptersDir, `${adapterName}.ts`);
      fs.writeFileSync(filePath, adapterCode);

      adapters.push({
        name: adapterName,
        className,
        filePath,
        tools,
        authType,
        baseUrl
      });

      console.log(`✅ Generated ${adapterName} (${tools.length} tools)`);
    } catch (error) {
      console.error(`❌ Failed to generate adapter for ${file}:`, error.message);
    }
  }

  // Generate registry
  console.log('\n📋 Generating adapter registry...');
  
  const imports = adapters.map(adapter => 
    `import ${adapter.className}Adapter from './generated/${adapter.name}.js';`
  ).join('\n');

  const adapterMap = adapters.map(adapter => 
    `  '${adapter.name}': ${adapter.className}Adapter,`
  ).join('\n');

  const adapterMetadata = adapters.map(adapter => ({
    name: adapter.name,
    className: adapter.className,
    tools: adapter.tools.map(t => t.name),
    authType: adapter.authType,
    baseUrl: adapter.baseUrl
  }));

  const registryCode = `/**
 * Auto-generated MCP Adapter Registry
 * This file is automatically generated - do not edit manually
 */

import { MCPAdapter } from '../types/mcp.js';

${imports}

export interface AdapterConstructor {
  new (): MCPAdapter;
}

export const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
${adapterMap}
};

export const ADAPTER_METADATA = ${JSON.stringify(adapterMetadata, null, 2)};

export function getAdapter(name: string): AdapterConstructor | undefined {
  return ADAPTER_REGISTRY[name];
}

export function listAdapters(): string[] {
  return Object.keys(ADAPTER_REGISTRY);
}

export function getAdapterMetadata(name: string) {
  return ADAPTER_METADATA.find(adapter => adapter.name === name);
}

export function getAllAdapterMetadata() {
  return ADAPTER_METADATA;
}

export async function createAdapterInstance(name: string): Promise<MCPAdapter | null> {
  const AdapterClass = getAdapter(name);
  if (!AdapterClass) {
    return null;
  }
  
  return new AdapterClass();
}

export default {
  ADAPTER_REGISTRY,
  ADAPTER_METADATA,
  getAdapter,
  listAdapters,
  getAdapterMetadata,
  getAllAdapterMetadata,
  createAdapterInstance
};`;

  const registryPath = path.join(__dirname, 'src', 'adapters', 'index.ts');
  fs.writeFileSync(registryPath, registryCode);

  console.log(`✅ Generated adapter registry: ${registryPath}`);
  console.log(`\n🎉 Generated ${adapters.length} adapters successfully!`);
  
  console.log('\nGenerated adapters:');
  adapters.forEach(adapter => {
    console.log(`   • ${adapter.name} (${adapter.tools.length} tools, ${adapter.authType} auth)`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
