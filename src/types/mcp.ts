/**
 * MCP (Model Context Protocol) compatible types for service adapters
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
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
  initialize(config: AdapterConfig): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: any): Promise<any>;
  listResources?(): Promise<MCPResource[]>;
  readResource?(uri: string): Promise<string>;
  
  // Health and status
  isHealthy(): Promise<boolean>;
  getStatus(): Promise<AdapterStatus>;
}

export interface AdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  credentials?: Record<string, any>;
  environment?: 'development' | 'staging' | 'production';
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
  [key: string]: any;
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
