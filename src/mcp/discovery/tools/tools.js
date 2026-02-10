/**
 * gateway-tools - List Tools Within an Adapter
 *
 * List available tools within a specific adapter.
 * Supports search and category filtering.
 */

class GatewayTools {
    constructor(registry) {
        this.registry = registry;
    }

    async handle(args) {
        const { adapter, category, search, limit = 20, offset = 0 } = args;

        if (!adapter) {
            return {
                error: {
                    code: 'ADAPTER_REQUIRED',
                    message: 'adapter parameter is required',
                    suggestion: 'Use gateway-adapters to see available adapters'
                }
            };
        }

        // Check if adapter exists
        const adapterMeta = this.registry.getAdapter(adapter);
        if (!adapterMeta) {
            const available = this.registry.getAllAdapters().map(a => a.id);
            return {
                error: {
                    code: 'ADAPTER_NOT_FOUND',
                    message: `Adapter '${adapter}' not found`,
                    available_adapters: available.slice(0, 10),
                    suggestion: 'Use gateway-adapters to see all available adapters'
                }
            };
        }

        // Get all operations for this adapter
        let operations = this.registry.getAdapterOperations(adapter);

        // Apply category filter
        if (category) {
            operations = operations.filter(op =>
                op.category && op.category.toLowerCase().includes(category.toLowerCase())
            );
        }

        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            operations = operations.filter(op => {
                const searchable = `${op.name} ${op.description} ${op.tags?.join(' ') || ''}`.toLowerCase();
                return searchable.includes(searchLower);
            });
        }

        // Get total before pagination
        const total = operations.length;

        // Apply pagination
        const paged = operations.slice(offset, offset + limit);

        // Get available categories
        const allOperations = this.registry.getAdapterOperations(adapter);
        const categories = [...new Set(allOperations.map(op => op.category).filter(Boolean))];

        // Format tool responses
        const tools = paged.map(op => ({
            tool_id: op.tool_id,
            name: op.name,
            description: op.description,
            category: op.category,
            method: op.method || 'POST',
            risk_level: op.risk_level,
            required_params: op.required_params || [],
            optional_param_count: (op.optional_params || []).length,
            is_mock: op.is_mock,
            tags: op.tags?.slice(0, 5) || []
        }));

        return {
            adapter,
            adapter_info: {
                name: adapterMeta.name,
                description: adapterMeta.description,
                category: adapterMeta.category,
                auth_type: adapterMeta.auth_type,
                is_mock: adapterMeta.is_mock
            },
            total_tools: total,
            returned: tools.length,
            offset,
            limit,
            categories,
            tools,
            next_step: 'Use gateway-intent with a specific task for full schema, or gateway-execute to run a tool'
        };
    }
}

module.exports = GatewayTools;
