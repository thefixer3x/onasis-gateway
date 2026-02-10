/**
 * gateway.adapters - List Available Adapters
 *
 * List available service adapters and their capabilities.
 * Supports filtering by category, capability, and country.
 */

class GatewayAdapters {
    constructor(registry) {
        this.registry = registry;
    }

    async handle(args = {}) {
        const { category, capability, country } = args;

        // Get all adapters from registry
        let adapters = this.registry.getAllAdapters();

        // Apply filters
        if (category && category !== 'all') {
            adapters = adapters.filter(a => a.category === category);
        }

        if (capability) {
            adapters = adapters.filter(a =>
                a.capabilities && a.capabilities.some(c =>
                    c.toLowerCase().includes(capability.toLowerCase())
                )
            );
        }

        if (country) {
            adapters = adapters.filter(a =>
                a.supported_countries &&
                (a.supported_countries.includes(country.toUpperCase()) ||
                 a.supported_countries.includes('GLOBAL'))
            );
        }

        // Build response
        const filtersApplied = {};
        if (category && category !== 'all') filtersApplied.category = category;
        if (capability) filtersApplied.capability = capability;
        if (country) filtersApplied.country = country;

        // Format adapter responses
        const formattedAdapters = adapters.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            category: a.category,
            capabilities: a.capabilities || [],
            supported_countries: a.supported_countries || [],
            supported_currencies: a.supported_currencies || [],
            tool_count: a.tool_count,
            tool_categories: this.getToolCategories(a.id),
            auth_type: a.auth_type,
            status: a.status,
            is_mock: a.is_mock,
            common_operations: this.getCommonOperations(a.id)
        }));

        return {
            total: formattedAdapters.length,
            filters_applied: Object.keys(filtersApplied).length > 0 ? filtersApplied : null,
            adapters: formattedAdapters,
            categories: this.getAvailableCategories(),
            next_step: 'Use gateway.intent with your task, or gateway.tools to explore an adapter'
        };
    }

    /**
     * Get tool categories for an adapter
     */
    getToolCategories(adapterId) {
        const operations = this.registry.getAdapterOperations(adapterId);
        const categories = {};

        for (const op of operations) {
            const cat = op.category || 'general';
            categories[cat] = (categories[cat] || 0) + 1;
        }

        return categories;
    }

    /**
     * Get common operations for an adapter
     */
    getCommonOperations(adapterId) {
        const operations = this.registry.getAdapterOperations(adapterId);

        // Prioritize common patterns
        const common = operations
            .filter(op => {
                const name = op.name.toLowerCase();
                return name.includes('list') ||
                       name.includes('get') ||
                       name.includes('create') ||
                       name.includes('initialize') ||
                       name.includes('verify');
            })
            .slice(0, 3)
            .map(op => op.tool_id);

        return common;
    }

    /**
     * Get available categories
     */
    getAvailableCategories() {
        const adapters = this.registry.getAllAdapters();
        const categories = new Set();

        for (const adapter of adapters) {
            if (adapter.category) {
                categories.add(adapter.category);
            }
        }

        return Array.from(categories);
    }
}

module.exports = GatewayAdapters;
