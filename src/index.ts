/**
 * @core/api-adapters
 * MCP service adapters generated from Postman collections
 */

export * from './types/mcp.js';
export * from './generators/adapter-generator.js';
export * from './generators/registry-generator.js';

// Re-export the adapter registry for easy access
export { 
  ADAPTER_REGISTRY, 
  ADAPTER_METADATA,
  getAdapter,
  listAdapters,
  getAdapterMetadata,
  getAllAdapterMetadata,
  createAdapterInstance
} from './adapters/index.js';

// Export utilities
export { default as HealthChecker } from './utils/health-check.js';
