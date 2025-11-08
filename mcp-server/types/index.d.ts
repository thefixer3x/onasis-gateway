/**
 * MCP Server Types Index
 * Centralized TypeScript definitions for all MCP tools in the Onasis Gateway
 */

// Credit-as-a-Service Types
export * from './credit';
export { default as CreditMCPTools } from './credit';

// Re-export common MCP types for convenience
export type {
  MCPToolResponse,
  MCPContextInfo,
  MCPToolConfig,
  MCPServer
} from './credit';

// =============================================================================
// Future Service Types (placeholders for expansion)
// =============================================================================

// TODO: Add type definitions for other services as they are integrated
// export * from './stripe';
// export * from './wise'; 
// export * from './bap';
// export * from './hostinger';
// export * from './shutterstock';
// etc.

// =============================================================================
// Unified MCP Tools Interface (for all services)
// =============================================================================

import type { CreditMCPTools } from './credit';

export interface OnasisGatewayMCPTools extends CreditMCPTools {
  // Future service tools will be added here
  // stripe_create_payment: (...) => Promise<...>;
  // wise_transfer_money: (...) => Promise<...>;
  // bap_process_payment: (...) => Promise<...>;
  // etc.
}

export default OnasisGatewayMCPTools;