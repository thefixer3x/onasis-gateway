/**
 * MCP Discovery Layer
 *
 * Replaces 1600+ first-class tools with 5 meta-tools that provide
 * guided discovery and execution.
 *
 * Tools:
 * - gateway.intent    - Natural language → action options
 * - gateway.execute   - Execute a specific tool
 * - gateway.adapters  - List available services
 * - gateway.tools     - List tools within an adapter
 * - gateway.reference - Get docs, examples, guides
 */

const GatewayIntent = require('./tools/intent');
const GatewayExecute = require('./tools/execute');
const GatewayAdapters = require('./tools/adapters');
const GatewayTools = require('./tools/tools');
const GatewayReference = require('./tools/reference');
const OperationRegistry = require('./registry');
const SearchEngine = require('./search');

class MCPDiscoveryLayer {
    constructor(gateway) {
        this.gateway = gateway;
        this.registry = new OperationRegistry();
        this.search = new SearchEngine(this.registry);

        // Initialize tool handlers
        this.intentHandler = new GatewayIntent(this.registry, this.search);
        this.executeHandler = new GatewayExecute(this.gateway, this.registry);
        this.adaptersHandler = new GatewayAdapters(this.registry);
        this.toolsHandler = new GatewayTools(this.registry);
        this.referenceHandler = new GatewayReference(this.registry);

        this.isInitialized = false;
    }

    /**
     * Initialize the discovery layer
     * Builds registry from gateway's loaded adapters
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('🔍 Initializing MCP Discovery Layer...');

        // Build registry from gateway's adapter catalog
        await this.registry.buildFromAdapters(this.gateway.adapters, this.gateway.services);

        this.isInitialized = true;
        console.log(`✅ Discovery Layer initialized (${this.registry.getOperationCount()} operations indexed)`);
    }

    /**
     * Get the 5 meta-tools for lazy mode
     */
    getMetaTools() {
        return [
            {
                name: 'gateway.intent',
                description: 'Find the right tool for your task. Describe what you want to do in natural language. Returns structured, executable action options with full schemas.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: "What you want to accomplish (e.g., 'charge a card in Nigeria', 'create a payment link')"
                        },
                        adapter: {
                            type: 'string',
                            description: 'Optional: Limit search to specific adapter (e.g., paystack, stripe)'
                        },
                        context: {
                            type: 'object',
                            description: 'Optional: Additional context to improve matching',
                            properties: {
                                currency: { type: 'string' },
                                country: { type: 'string' },
                                use_case: {
                                    type: 'string',
                                    enum: ['one-time', 'subscription', 'marketplace', 'transfer']
                                }
                            }
                        },
                        limit: {
                            type: 'integer',
                            default: 3,
                            description: 'Max number of alternatives to return'
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'gateway.execute',
                description: 'Execute a specific tool. Use gateway.intent first to find the right tool_id. Includes risk enforcement and validation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tool_id: {
                            type: 'string',
                            description: "Tool identifier in 'adapter:tool' format (e.g., 'paystack:initialize-transaction')",
                            pattern: '^[a-z0-9-]+:[a-z0-9-]+$'
                        },
                        params: {
                            type: 'object',
                            description: 'Parameters for the tool'
                        },
                        options: {
                            type: 'object',
                            properties: {
                                timeout: { type: 'integer', default: 30000 },
                                idempotency_key: {
                                    type: 'string',
                                    description: 'REQUIRED for high-risk operations'
                                },
                                dry_run: { type: 'boolean', default: false },
                                confirmed: {
                                    type: 'boolean',
                                    default: false,
                                    description: 'REQUIRED for destructive operations'
                                }
                            }
                        }
                    },
                    required: ['tool_id', 'params']
                }
            },
            {
                name: 'gateway.adapters',
                description: 'List available service adapters and their capabilities. Filter by category, capability, or country.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        category: {
                            type: 'string',
                            enum: ['payments', 'infrastructure', 'analytics', 'storage', 'communication', 'all'],
                            description: 'Filter by service category'
                        },
                        capability: {
                            type: 'string',
                            description: 'Filter by capability (e.g., card_payments, transfers)'
                        },
                        country: {
                            type: 'string',
                            description: 'Filter by supported country code (e.g., NG, US, GB)'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'gateway.tools',
                description: 'List available tools within a specific adapter. Search and filter by category.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        adapter: {
                            type: 'string',
                            description: 'Adapter ID (e.g., paystack, stripe, flutterwave)'
                        },
                        category: {
                            type: 'string',
                            description: 'Filter by tool category (e.g., transactions, customers)'
                        },
                        search: {
                            type: 'string',
                            description: 'Search query to filter tools'
                        },
                        limit: { type: 'integer', default: 20, maximum: 50 },
                        offset: { type: 'integer', default: 0 }
                    },
                    required: ['adapter']
                }
            },
            {
                name: 'gateway.reference',
                description: 'Get documentation, examples, and usage guides for adapters and tools.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: {
                            type: 'string',
                            description: 'Adapter name, tool_id, or concept to get reference for'
                        },
                        section: {
                            type: 'string',
                            enum: ['overview', 'authentication', 'examples', 'errors', 'webhooks', 'best_practices', 'all'],
                            default: 'all'
                        }
                    },
                    required: ['topic']
                }
            }
        ];
    }

    /**
     * Handle a meta-tool call
     */
    async callTool(toolName, args) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        switch (toolName) {
            case 'gateway.intent':
                return await this.intentHandler.handle(args);
            case 'gateway.execute':
                return await this.executeHandler.handle(args);
            case 'gateway.adapters':
                return await this.adaptersHandler.handle(args);
            case 'gateway.tools':
                return await this.toolsHandler.handle(args);
            case 'gateway.reference':
                return await this.referenceHandler.handle(args);
            default:
                throw new Error(`Unknown discovery tool: ${toolName}`);
        }
    }

    /**
     * Check if a tool name is a meta-tool
     */
    isMetaTool(toolName) {
        return toolName.startsWith('gateway.');
    }
}

module.exports = MCPDiscoveryLayer;
