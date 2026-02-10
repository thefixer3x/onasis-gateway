import { Adapter, ServiceDefinition, AdapterConfig } from '../types';

interface SupabaseFunction {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  created_at: string;
  updated_at: string;
}

interface SupabaseAdapterConfig extends AdapterConfig {
  supabaseUrl: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  discoveryMode: 'auto' | 'manual';
  cacheTimeout: number; // seconds
  excludePatterns?: string[];
  authPassthrough: boolean;
  uaiIntegration: {
    enabled: boolean;
    tokenHeader: string;
  };
}

export class SupabaseEdgeFunctionsAdapter implements Adapter {
  private config: SupabaseAdapterConfig;
  private functionCache: Map<string, ServiceDefinition> = new Map();
  private lastDiscovery: number = 0;

  constructor(config: SupabaseAdapterConfig) {
    this.config = {
      cacheTimeout: 300, // 5 minutes default
      excludePatterns: ['_*', 'test-*'],
      authPassthrough: true,
      discoveryMode: 'auto',
      ...config,
    };
  }

  /**
   * Auto-discover all Supabase Edge Functions
   */
  async discoverServices(): Promise<ServiceDefinition[]> {
    // Check cache validity
    const now = Date.now() / 1000;
    if (
      this.functionCache.size > 0 &&
      now - this.lastDiscovery < this.config.cacheTimeout
    ) {
      console.log('✅ Using cached Supabase functions');
      return Array.from(this.functionCache.values());
    }

    console.log('🔍 Discovering Supabase Edge Functions...');

    try {
      // Fetch deployed functions from Supabase Management API
      const functions = await this.fetchDeployedFunctions();

      // Filter and map to ServiceDefinitions
      const services = functions
        .filter((fn) => this.shouldIncludeFunction(fn))
        .map((fn) => this.mapToServiceDefinition(fn));

      // Update cache
      this.functionCache.clear();
      services.forEach((service) => {
        this.functionCache.set(service.id, service);
      });
      this.lastDiscovery = now;

      console.log(`✅ Discovered ${services.length} Supabase functions`);
      return services;
    } catch (error) {
      console.error('❌ Failed to discover Supabase functions:', error);
      // Return cached services if available
      if (this.functionCache.size > 0) {
        console.log('⚠️ Returning stale cache due to discovery failure');
        return Array.from(this.functionCache.values());
      }
      throw error;
    }
  }

  /**
   * Fetch deployed functions from Supabase
   * Note: This uses the Supabase Management API
   */
  private async fetchDeployedFunctions(): Promise<SupabaseFunction[]> {
    const { supabaseUrl, supabaseServiceKey } = this.config;

    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_KEY required for function discovery'
      );
    }

    // Method 1: Use Supabase Management API (recommended)
    const response = await fetch(`${supabaseUrl}/functions/v1`, {
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch functions: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Check if function should be included based on exclude patterns
   */
  private shouldIncludeFunction(fn: SupabaseFunction): boolean {
    const { excludePatterns = [] } = this.config;

    for (const pattern of excludePatterns) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(fn.slug)) {
        return false;
      }
    }

    return fn.status === 'ACTIVE';
  }

  /**
   * Map Supabase function to Gateway ServiceDefinition
   */
  private mapToServiceDefinition(fn: SupabaseFunction): ServiceDefinition {
    const { supabaseUrl } = this.config;

    return {
      id: `supabase-${fn.slug}`,
      name: fn.name || fn.slug,
      version: fn.version.toString(),
      description: `Supabase Edge Function: ${fn.slug}`,
      baseUrl: `${supabaseUrl}/functions/v1/${fn.slug}`,
      endpoints: [
        {
          path: '/',
          method: 'POST',
          description: `Main endpoint for ${fn.slug}`,
          requiresAuth: this.config.authPassthrough,
        },
      ],
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 60000, // 1 minute
      },
      metadata: {
        source: 'supabase-edge-functions',
        functionId: fn.id,
        slug: fn.slug,
        createdAt: fn.created_at,
        updatedAt: fn.updated_at,
      },
    };
  }

  /**
   * Proxy request to Supabase Edge Function
   */
  async proxyRequest(
    serviceId: string,
    endpoint: string,
    request: {
      method: string;
      headers: Record<string, string>;
      body?: any;
    }
  ): Promise<Response> {
    const service = this.functionCache.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const url = `${service.baseUrl}${endpoint}`;
    const headers = { ...request.headers };

    // UAI Integration: Pass through authentication if enabled
    if (this.config.uaiIntegration.enabled) {
      const uaiToken = headers[this.config.uaiIntegration.tokenHeader];
      if (uaiToken) {
        headers['Authorization'] = uaiToken;
      }
    }

    // Add Supabase anon key for functions that need it
    if (this.config.supabaseAnonKey) {
      headers['apikey'] = this.config.supabaseAnonKey;
    }

    return fetch(url, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    });
  }

  /**
   * Health check for adapter
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.discoverServices();
      return {
        healthy: true,
        message: `${this.functionCache.size} functions available`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manual service registration (fallback)
   */
  async registerService(service: ServiceDefinition): Promise<void> {
    this.functionCache.set(service.id, service);
    console.log(`✅ Manually registered service: ${service.id}`);
  }

  /**
   * Get specific service definition
   */
  getService(serviceId: string): ServiceDefinition | undefined {
    return this.functionCache.get(serviceId);
  }

  /**
   * List all registered services
   */
  listServices(): ServiceDefinition[] {
    return Array.from(this.functionCache.values());
  }
}

// Export factory function
export function createSupabaseAdapter(
  config: SupabaseAdapterConfig
): SupabaseEdgeFunctionsAdapter {
  return new SupabaseEdgeFunctionsAdapter(config);
}
