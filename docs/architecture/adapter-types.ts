/**
 * Core adapter interfaces for Onasis Gateway
 * These define the contract that all adapters must implement
 */

export interface AdapterConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  [key: string]: any;
}

export interface ServiceEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  description?: string;
  requiresAuth?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  timeout?: number;
  retries?: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint: string;
  interval: number; // milliseconds
  timeout?: number;
  failureThreshold?: number;
  successThreshold?: number;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  baseUrl: string;
  endpoints: ServiceEndpoint[];
  healthCheck?: HealthCheckConfig;
  metadata?: Record<string, any>;
  tags?: string[];
  authentication?: {
    type: 'bearer' | 'api-key' | 'oauth2' | 'custom';
    headerName?: string;
    required?: boolean;
  };
}

export interface ProxyRequest {
  method: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  latency?: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  timestamp?: string;
  details?: Record<string, any>;
}

/**
 * Main Adapter interface
 * All adapters (Supabase, PayStack, etc.) must implement this
 */
export interface Adapter {
  /**
   * Discover available services
   * Can be auto-discovery (Supabase) or manual registration
   */
  discoverServices(): Promise<ServiceDefinition[]>;

  /**
   * Proxy a request to the underlying service
   */
  proxyRequest(
    serviceId: string,
    endpoint: string,
    request: ProxyRequest
  ): Promise<Response>;

  /**
   * Health check for the adapter itself
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Manually register a service (optional)
   */
  registerService?(service: ServiceDefinition): Promise<void>;

  /**
   * Get specific service definition
   */
  getService?(serviceId: string): ServiceDefinition | undefined;

  /**
   * List all registered services
   */
  listServices?(): ServiceDefinition[];

  /**
   * Unregister a service (optional)
   */
  unregisterService?(serviceId: string): Promise<void>;
}

/**
 * UAI (Universal Authentication Identifier) Integration
 */
export interface UAIConfig {
  enabled: boolean;
  tokenHeader: string; // Usually "Authorization"
  validateTokens?: boolean;
  requiredScopes?: string[];
  tokenRefreshEndpoint?: string;
}

/**
 * Fallback strategy configuration
 */
export interface FallbackConfig {
  enabled: boolean;
  strategy: 'direct-provider' | 'cached-response' | 'circuit-breaker';
  retryAttempts?: number;
  retryDelay?: number; // milliseconds
  circuitBreakerThreshold?: number;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  trackLatency?: boolean;
  metricsEndpoint?: string;
  alertThresholds?: {
    errorRate?: number; // percentage
    latency?: number; // milliseconds
  };
}

/**
 * Adapter registry for managing multiple adapters
 */
export interface AdapterRegistry {
  /**
   * Register an adapter
   */
  register(id: string, adapter: Adapter): void;

  /**
   * Get an adapter by ID
   */
  get(id: string): Adapter | undefined;

  /**
   * List all registered adapters
   */
  list(): Map<string, Adapter>;

  /**
   * Unregister an adapter
   */
  unregister(id: string): void;

  /**
   * Discover all services across all adapters
   */
  discoverAllServices(): Promise<Map<string, ServiceDefinition[]>>;
}

/**
 * Service routing decision
 */
export interface RoutingDecision {
  adapterId: string;
  serviceId: string;
  endpoint: string;
  strategy: 'direct' | 'proxy' | 'hybrid';
  fallbackAdapterId?: string;
}

/**
 * Gateway metrics
 */
export interface GatewayMetrics {
  totalRequests: number;
  avgLatency: number; // milliseconds
  successRate: number; // percentage
  errorRate: number; // percentage
  cacheHitRate?: number; // percentage
  activeServices: number;
  adapterMetrics: Map<string, AdapterMetrics>;
}

export interface AdapterMetrics {
  adapterId: string;
  totalRequests: number;
  avgLatency: number;
  successRate: number;
  lastHealthCheck?: HealthCheckResult;
  discoveredServices?: number;
}

/**
 * Route configuration
 */
export interface RouteConfig {
  path: string;
  adapterId: string;
  serviceId: string;
  endpoint: string;
  middleware?: string[];
  authentication?: {
    required: boolean;
    scopes?: string[];
  };
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  port: number;
  host: string;
  adapters: AdapterConfig[];
  routes: RouteConfig[];
  uai: UAIConfig;
  monitoring: MonitoringConfig;
  fallback: FallbackConfig;
  cors?: {
    enabled: boolean;
    origins: string[];
  };
  rateLimit?: {
    global: {
      maxRequests: number;
      windowMs: number;
    };
  };
}

/**
 * Discovery result from adapter
 */
export interface DiscoveryResult {
  adapterId: string;
  services: ServiceDefinition[];
  timestamp: string;
  duration: number; // milliseconds
  cached: boolean;
}

/**
 * Export utility types
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export type AuthType = 'bearer' | 'api-key' | 'oauth2' | 'custom' | 'none';
export type RoutingStrategy = 'direct' | 'proxy' | 'hybrid';
export type FallbackStrategy = 'direct-provider' | 'cached-response' | 'circuit-breaker';
