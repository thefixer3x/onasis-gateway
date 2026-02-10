/**
 * Operation Registry
 *
 * In-memory index of all operations from loaded adapters.
 * Canonical truth is the live adapter catalog - registry is a searchable view.
 */

class OperationRegistry {
    constructor() {
        // Main operation index: tool_id -> operation metadata
        this.operations = new Map();

        // Adapter metadata: adapter_id -> adapter info
        this.adapters = new Map();

        // Indexes for fast lookup
        this.byTag = new Map();        // tag -> Set<tool_id>
        this.byCategory = new Map();   // category -> Set<tool_id>
        this.byAdapter = new Map();    // adapter -> Set<tool_id>

        this.schemaVersion = '1.0.0';
        this.builtAt = null;
    }

    /**
     * Build registry from gateway's loaded adapters
     */
    async buildFromAdapters(adaptersMap, servicesMap) {
        console.log('📦 Building operation registry from adapters...');

        this.operations.clear();
        this.adapters.clear();
        this.byTag.clear();
        this.byCategory.clear();
        this.byAdapter.clear();

        // Process each adapter
        for (const [adapterId, adapter] of adaptersMap.entries()) {
            await this.indexAdapter(adapterId, adapter);
        }

        // Also index API services if available
        if (servicesMap) {
            for (const [serviceName, service] of servicesMap.entries()) {
                this.indexService(serviceName, service);
            }
        }

        this.builtAt = new Date().toISOString();
        console.log(`✅ Registry built: ${this.operations.size} operations, ${this.adapters.size} adapters`);
    }

    /**
     * Index a single adapter and its tools
     */
    async indexAdapter(adapterId, adapter) {
        // Get adapter metadata
        const adapterMeta = this.extractAdapterMeta(adapterId, adapter);
        this.adapters.set(adapterId, adapterMeta);

        // Get tools from adapter
        let tools = [];
        if (adapter.tools && Array.isArray(adapter.tools)) {
            tools = adapter.tools;
        } else if (adapter.listTools && typeof adapter.listTools === 'function') {
            try {
                tools = await adapter.listTools();
            } catch (err) {
                console.warn(`⚠️ Failed to list tools for ${adapterId}: ${err.message}`);
            }
        } else if (typeof adapter.tools === 'number') {
            // Mock adapter with just a count - generate placeholder operations
            const count = adapter.tools;
            for (let i = 1; i <= count; i++) {
                const toolId = `${adapterId}:tool-${i}`;
                const operation = {
                    tool_id: toolId,
                    adapter: adapterId,
                    tool: `tool-${i}`,
                    name: `Tool ${i}`,
                    description: `Operation ${i} from ${adapterId}`,
                    tags: this.inferTags(adapterId, `tool-${i}`),
                    method: 'POST',
                    risk_level: 'medium',
                    category: adapterMeta.category || 'general',
                    is_mock: true,
                    input_schema: null,
                    required_params: [],
                    optional_params: []
                };
                this.addOperation(operation);
            }
            return;
        }

        // Index each tool
        for (const tool of tools) {
            const toolId = `${adapterId}:${tool.name}`;
            const operation = {
                tool_id: toolId,
                adapter: adapterId,
                tool: tool.name,
                name: this.toTitleCase(tool.name),
                description: tool.description || '',
                tags: this.inferTags(adapterId, tool.name, tool.description),
                method: tool.metadata?.method || 'POST',
                risk_level: this.inferRiskLevel(tool.name, tool.description),
                category: tool.metadata?.category || adapterMeta.category || 'general',
                is_mock: false,
                input_schema: tool.inputSchema || null,
                required_params: tool.inputSchema?.required || [],
                optional_params: this.extractOptionalParams(tool.inputSchema)
            };
            this.addOperation(operation);
        }
    }

    /**
     * Index an API service
     */
    indexService(serviceName, service) {
        const serviceMeta = {
            id: serviceName,
            name: service.info?.name || service.name || serviceName,
            description: service.info?.description || service.description || '',
            category: service.category || 'api-service',
            baseUrl: service.servers?.[0]?.url || service.base_url || '',
            version: service.info?.version || service.version || '1.0.0'
        };

        // Store as a special adapter type
        this.adapters.set(`service:${serviceName}`, serviceMeta);
    }

    /**
     * Add an operation to the registry with indexes
     */
    addOperation(operation) {
        const { tool_id, adapter, tags, category } = operation;

        // Main index
        this.operations.set(tool_id, operation);

        // Adapter index
        if (!this.byAdapter.has(adapter)) {
            this.byAdapter.set(adapter, new Set());
        }
        this.byAdapter.get(adapter).add(tool_id);

        // Tag index
        for (const tag of tags) {
            if (!this.byTag.has(tag)) {
                this.byTag.set(tag, new Set());
            }
            this.byTag.get(tag).add(tool_id);
        }

        // Category index
        if (!this.byCategory.has(category)) {
            this.byCategory.set(category, new Set());
        }
        this.byCategory.get(category).add(tool_id);
    }

    /**
     * Extract adapter metadata
     */
    extractAdapterMeta(adapterId, adapter) {
        const meta = {
            id: adapterId,
            name: adapter.name || this.toTitleCase(adapterId),
            description: adapter.description || `${this.toTitleCase(adapterId)} API adapter`,
            category: this.inferAdapterCategory(adapterId),
            capabilities: this.inferCapabilities(adapterId),
            supported_countries: this.inferCountries(adapterId),
            supported_currencies: this.inferCurrencies(adapterId),
            tool_count: this.getAdapterToolCount(adapter),
            auth_type: adapter.auth || adapter.authType || 'bearer',
            status: 'operational',
            is_mock: typeof adapter.tools === 'number'
        };
        return meta;
    }

    getAdapterToolCount(adapter) {
        if (Array.isArray(adapter.tools)) return adapter.tools.length;
        if (typeof adapter.tools === 'number') return adapter.tools;
        if (typeof adapter.toolCount === 'number') return adapter.toolCount;
        return 0;
    }

    /**
     * Infer category from adapter ID
     */
    inferAdapterCategory(adapterId) {
        const id = adapterId.toLowerCase();

        if (['stripe', 'paystack', 'flutterwave', 'bap', 'wise', 'xpress-wallet', 'merchant-api'].some(p => id.includes(p))) {
            return 'payments';
        }
        if (['ngrok', 'hostinger'].some(p => id.includes(p))) {
            return 'infrastructure';
        }
        if (['google-analytics', 'analytics'].some(p => id.includes(p))) {
            return 'analytics';
        }
        if (['shutterstock'].some(p => id.includes(p))) {
            return 'media';
        }
        if (['supabase', 'memory'].some(p => id.includes(p))) {
            return 'storage';
        }
        if (['open-banking'].some(p => id.includes(p))) {
            return 'banking';
        }

        return 'general';
    }

    /**
     * Infer capabilities from adapter ID
     */
    inferCapabilities(adapterId) {
        const id = adapterId.toLowerCase();
        const caps = [];

        if (id.includes('stripe')) {
            caps.push('card_payments', 'subscriptions', 'invoices', 'transfers', 'connect');
        } else if (id.includes('paystack')) {
            caps.push('card_payments', 'bank_transfers', 'subscriptions', 'split_payments');
        } else if (id.includes('flutterwave')) {
            caps.push('card_payments', 'mobile_money', 'bank_transfers', 'bills');
        } else if (id.includes('ngrok')) {
            caps.push('tunnels', 'domains', 'endpoints', 'edge');
        } else if (id.includes('supabase')) {
            caps.push('memory', 'storage', 'auth', 'database');
        }

        return caps.length ? caps : ['general'];
    }

    /**
     * Infer supported countries
     */
    inferCountries(adapterId) {
        const id = adapterId.toLowerCase();

        if (id.includes('paystack')) return ['NG', 'GH', 'ZA', 'KE'];
        if (id.includes('flutterwave')) return ['NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'RW'];
        if (id.includes('stripe')) return ['US', 'GB', 'EU', 'CA', 'AU', 'GLOBAL'];
        if (id.includes('wise')) return ['GLOBAL'];
        if (id.includes('bap')) return ['NG'];

        return ['GLOBAL'];
    }

    /**
     * Infer supported currencies
     */
    inferCurrencies(adapterId) {
        const id = adapterId.toLowerCase();

        if (id.includes('paystack')) return ['NGN', 'GHS', 'ZAR', 'KES'];
        if (id.includes('flutterwave')) return ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'EUR', 'GBP'];
        if (id.includes('stripe')) return ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
        if (id.includes('wise')) return ['USD', 'EUR', 'GBP', 'NGN'];

        return [];
    }

    /**
     * Infer tags from tool name and description
     */
    inferTags(adapterId, toolName, description = '') {
        const tags = new Set();
        const text = `${adapterId} ${toolName} ${description}`.toLowerCase();

        // Category tags
        if (text.match(/payment|charge|pay|transaction/)) tags.add('payments');
        if (text.match(/transfer|send|payout/)) tags.add('transfers');
        if (text.match(/customer|user|account/)) tags.add('customers');
        if (text.match(/subscription|recurring|plan/)) tags.add('subscriptions');
        if (text.match(/refund|reverse|cancel/)) tags.add('refunds');
        if (text.match(/webhook|event|notification/)) tags.add('webhooks');
        if (text.match(/verify|validate|check/)) tags.add('verification');
        if (text.match(/list|get|fetch|retrieve/)) tags.add('read');
        if (text.match(/create|initialize|init|new/)) tags.add('create');
        if (text.match(/update|modify|edit/)) tags.add('update');
        if (text.match(/delete|remove|cancel/)) tags.add('delete');
        if (text.match(/card|credit|debit/)) tags.add('cards');
        if (text.match(/bank|account|iban/)) tags.add('bank');
        if (text.match(/mobile|ussd|momo/)) tags.add('mobile');
        if (text.match(/invoice|bill/)) tags.add('invoices');

        // Country/region tags
        if (text.match(/nigeria|naira|ngn/)) tags.add('nigeria');
        if (text.match(/ghana|ghs|cedi/)) tags.add('ghana');
        if (text.match(/kenya|kes|shilling/)) tags.add('kenya');
        if (text.match(/south.?africa|zar|rand/)) tags.add('south-africa');

        // Add adapter as tag
        tags.add(adapterId);

        return Array.from(tags);
    }

    /**
     * Infer risk level from tool name and description
     */
    inferRiskLevel(toolName, description = '') {
        const text = `${toolName} ${description}`.toLowerCase();

        // High risk: money movement, destructive operations
        if (text.match(/charge|pay|transfer|payout|send|withdraw|refund|delete|remove|cancel/)) {
            return 'high';
        }

        // Medium risk: creates or modifies data
        if (text.match(/create|update|modify|edit|set|enable|disable/)) {
            return 'medium';
        }

        // Low risk: read operations
        return 'low';
    }

    /**
     * Extract optional params from input schema
     */
    extractOptionalParams(inputSchema) {
        if (!inputSchema || !inputSchema.properties) return [];

        const required = new Set(inputSchema.required || []);
        return Object.keys(inputSchema.properties).filter(k => !required.has(k));
    }

    /**
     * Convert string to title case
     */
    toTitleCase(str) {
        return str
            .split(/[-_]/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    // ============ Query Methods ============

    /**
     * Get operation by tool_id
     */
    getOperation(toolId) {
        return this.operations.get(toolId);
    }

    /**
     * Get all operations for an adapter
     */
    getAdapterOperations(adapterId) {
        const toolIds = this.byAdapter.get(adapterId);
        if (!toolIds) return [];
        return Array.from(toolIds).map(id => this.operations.get(id));
    }

    /**
     * Get adapter metadata
     */
    getAdapter(adapterId) {
        return this.adapters.get(adapterId);
    }

    /**
     * Get all adapters
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }

    /**
     * Get operations by tag
     */
    getByTag(tag) {
        const toolIds = this.byTag.get(tag);
        if (!toolIds) return [];
        return Array.from(toolIds).map(id => this.operations.get(id));
    }

    /**
     * Get operations by category
     */
    getByCategory(category) {
        const toolIds = this.byCategory.get(category);
        if (!toolIds) return [];
        return Array.from(toolIds).map(id => this.operations.get(id));
    }

    /**
     * Get total operation count
     */
    getOperationCount() {
        return this.operations.size;
    }

    /**
     * Get all tags
     */
    getAllTags() {
        return Array.from(this.byTag.keys());
    }

    /**
     * Get all categories
     */
    getAllCategories() {
        return Array.from(this.byCategory.keys());
    }
}

module.exports = OperationRegistry;
