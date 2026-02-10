/**
 * MCP (Model Context Protocol) compatible types for service adapters
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPAdapter {
  name: string;
  version: string;
  description: string;
  tools: MCPTool[];
  resources?: MCPResource[];
  
  // Core methods
  initialize(_config: AdapterConfig): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  callTool(_name: string, _args: unknown): Promise<unknown>;
  listResources?(): Promise<MCPResource[]>;
  readResource?(_uri: string): Promise<string>;
  
  // Health and status
  isHealthy(): Promise<boolean>;
  getStatus(): Promise<AdapterStatus>;
}

export interface AdapterConfig {
  apiKey?: string;
  secretKey?: string;
  publicKey?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  credentials?: Record<string, unknown>;
  environment?: 'development' | 'staging' | 'production';
  
  // Service provider configuration
  serviceProvider?: {
    enabled: boolean;
    clientId?: string;
    branding?: Record<string, unknown>;
  };
  
  // Database configuration (for services like Xpress Wallet)
  databaseUrl?: string;
  
  // Additional service-specific configs
  merchantId?: string;
  webhookSecret?: string;
}

export interface AdapterStatus {
  name: string;
  healthy: boolean;
  lastChecked: Date;
  version: string;
  uptime: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  metadata?: Record<string, unknown>;
}

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    version?: string;
  };
  item: PostmanItem[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
}

export interface PostmanItem {
  name: string;
  description?: string;
  request: PostmanRequest;
  response?: PostmanResponse[];
}

export interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  url: string | PostmanUrl;
  body?: PostmanBody;
  auth?: PostmanAuth;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanQuery[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode: 'raw' | 'formdata' | 'urlencoded';
  raw?: string;
  formdata?: PostmanFormData[];
  urlencoded?: PostmanUrlEncoded[];
}

export interface PostmanFormData {
  key: string;
  value: string;
  type?: 'text' | 'file';
}

export interface PostmanUrlEncoded {
  key: string;
  value: string;
}

export interface PostmanQuery {
  key: string;
  value: string;
}

export interface PostmanAuth {
  type: string;
  [key: string]: unknown;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanResponse {
  name: string;
  status: string;
  code: number;
  body: string;
  header: PostmanHeader[];
}

export interface GeneratedAdapter {
  name: string;
  className: string;
  filePath: string;
  tools: MCPTool[];
  dependencies: string[];
  authType: string;
  baseUrl: string;
}
