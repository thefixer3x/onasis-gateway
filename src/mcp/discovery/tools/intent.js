/**
 * gateway-intent - Natural Language to Action
 *
 * Transforms natural language intent into structured, executable action options.
 * Returns everything needed to execute - no follow-up schema lookups required.
 */

class GatewayIntent {
    constructor(registry, search) {
        this.registry = registry;
        this.search = search;
    }

    async handle(args) {
        const { query, adapter, context, limit = 3 } = args;

        if (!query || typeof query !== 'string') {
            return {
                error: {
                    code: 'INVALID_QUERY',
                    message: 'Query string is required'
                }
            };
        }

        // Search for matching operations
        const searchResult = this.search.search(query, { adapter, context, limit });

        if (searchResult.results.length === 0) {
            return {
                error: {
                    code: 'NO_MATCHES',
                    message: 'No operations match your query',
                    suggestions: [
                        'Try different keywords',
                        'Use gateway-adapters to see available services',
                        'Use gateway-tools with a specific adapter to browse operations'
                    ]
                },
                search_context: searchResult
            };
        }

        // Build recommended operation
        const top = searchResult.results[0];
        const recommended = {
            adapter: top.adapter,
            tool: top.tool,
            tool_id: top.tool_id,
            confidence: top.confidence,
            why: top.why
        };

        // Build ready-to-execute payload
        const readyToExecute = this.buildReadyToExecute(top);

        // Build alternatives
        const alternatives = searchResult.results.slice(1).map(r => ({
            adapter: r.adapter,
            tool: r.tool,
            tool_id: r.tool_id,
            confidence: r.confidence,
            why: r.why
        }));

        // Determine missing inputs if schema is available
        const missingInputs = [];
        if (top.input_schema && top.required_params) {
            for (const param of top.required_params) {
                missingInputs.push({
                    field: param,
                    question: `What is the ${this.formatFieldName(param)}?`
                });
            }
        }

        // Determine next step
        let nextStep;
        if (searchResult.needs_selection) {
            nextStep = 'Multiple good matches found. Review alternatives and select the best fit, then call gateway-execute.';
        } else if (missingInputs.length > 0) {
            nextStep = `Gather required params (${top.required_params.join(', ')}), then call gateway-execute with tool_id and params.`;
        } else {
            nextStep = 'Call gateway-execute with tool_id and params.';
        }

        return {
            recommended,
            ready_to_execute: readyToExecute,
            missing_inputs: searchResult.needs_selection ? [] : missingInputs,
            next_step: nextStep,
            alternatives,
            search_context: {
                mode: searchResult.mode,
                matched_adapters: [...new Set(searchResult.results.map(r => r.adapter))],
                query_interpreted: searchResult.query_interpreted
            }
        };
    }

    /**
     * Build the ready_to_execute payload with schema info
     */
    buildReadyToExecute(operation) {
        const result = {
            tool_id: operation.tool_id,
            required_params: operation.required_params || [],
            optional_params: operation.optional_params || []
        };

        // Extract param schemas if available
        if (operation.input_schema && operation.input_schema.properties) {
            result.param_schemas = {};
            for (const [key, schema] of Object.entries(operation.input_schema.properties)) {
                result.param_schemas[key] = {
                    type: schema.type,
                    description: schema.description || `The ${this.formatFieldName(key)}`
                };
                if (schema.enum) {
                    result.param_schemas[key].enum = schema.enum;
                }
                if (schema.format) {
                    result.param_schemas[key].format = schema.format;
                }
            }
        }

        // Add example if we can generate one
        result.example = this.generateExample(operation);

        // Add constraints
        result.constraints = {
            risk_level: operation.risk_level || 'medium',
            requires_idempotency: operation.risk_level === 'high',
            requires_confirmation: operation.risk_level === 'high' &&
                (operation.name.toLowerCase().includes('delete') ||
                 operation.name.toLowerCase().includes('cancel'))
        };

        return result;
    }

    /**
     * Generate an example request
     */
    generateExample(operation) {
        const example = {};

        if (!operation.input_schema || !operation.input_schema.properties) {
            return example;
        }

        for (const [key, schema] of Object.entries(operation.input_schema.properties)) {
            // Skip nested objects unless they're simple
            if (schema.type === 'object' && !schema.properties) {
                example[key] = {};
                continue;
            }

            // Generate example value based on type and field name
            example[key] = this.generateExampleValue(key, schema);
        }

        return example;
    }

    /**
     * Generate example value for a field
     */
    generateExampleValue(fieldName, schema) {
        const name = fieldName.toLowerCase();

        // Use enum if available
        if (schema.enum && schema.enum.length > 0) {
            return schema.enum[0];
        }

        // Common field patterns
        if (name.includes('email')) return 'customer@example.com';
        if (name.includes('amount')) return 500000; // 5000.00 in minor units
        if (name.includes('currency')) return 'NGN';
        if (name.includes('reference')) return `ref_${Date.now()}`;
        if (name.includes('phone')) return '+2348012345678';
        if (name.includes('url')) return 'https://example.com/callback';
        if (name.includes('description') || name.includes('name')) return 'Example value';
        if (name.includes('id')) return 'id_123456';

        // Type-based fallbacks
        switch (schema.type) {
            case 'string': return 'example_value';
            case 'number':
            case 'integer': return 100;
            case 'boolean': return true;
            case 'array': return [];
            case 'object': return {};
            default: return null;
        }
    }

    /**
     * Format field name for display
     */
    formatFieldName(fieldName) {
        return fieldName
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase();
    }
}

module.exports = GatewayIntent;
