/**
 * gateway-execute - Tool Execution with Policy Enforcement
 *
 * Execute any tool with validated parameters and risk management.
 * Deny-by-default stance for high-risk operations.
 */

class GatewayExecute {
    constructor(gateway, registry) {
        this.gateway = gateway;
        this.registry = registry;
    }

    async handle(args, context = {}) {
        const { tool_id, params, options = {} } = args;

        // Validate tool_id format
        if (!tool_id || typeof tool_id !== 'string') {
            return {
                success: false,
                error: {
                    code: 'INVALID_TOOL_ID',
                    message: 'tool_id is required'
                }
            };
        }

        // Parse tool_id
        const parts = tool_id.split(':');
        if (parts.length !== 2) {
            return {
                success: false,
                error: {
                    code: 'INVALID_TOOL_ID_FORMAT',
                    message: "tool_id must be in 'adapter:tool' format",
                    example: 'paystack:initialize-transaction'
                }
            };
        }

        const [adapterId, toolName] = parts;

        // Resolve tool_id via AdapterRegistry (aliases -> canonical)
        let canonicalToolId = tool_id;
        let resolvedAdapterId = adapterId;
        let resolvedToolName = toolName;

        if (this.gateway && this.gateway.adapterRegistry && typeof this.gateway.adapterRegistry.resolveTool === 'function') {
            const resolved = this.gateway.adapterRegistry.resolveTool(tool_id);
            if (resolved) {
                canonicalToolId = resolved.canonicalId;
                resolvedAdapterId = resolved.adapterId;
                resolvedToolName = resolved.tool?.name || toolName;
            }
        }

        // Get operation metadata from registry
        const operation = this.registry.getOperation(canonicalToolId) || this.registry.getOperation(tool_id);
        const operationMeta = operation || {
            risk_level: 'high', // Default to high if unknown
            requires_confirmation: true,
            requires_idempotency: true
        };

        // ============ Policy Enforcement ============

        // 1. Check idempotency requirement for high-risk operations
        if (operationMeta.risk_level === 'high' && !options.idempotency_key) {
            return {
                success: false,
                error: {
                    code: 'IDEMPOTENCY_REQUIRED',
                    message: 'This operation modifies financial data. Provide options.idempotency_key.',
                    risk_level: 'high',
                    suggestion: 'Add { options: { idempotency_key: "unique-key-here" } }'
                }
            };
        }

        // 2. Check confirmation for destructive operations
        const toolNameForPolicy = (resolvedToolName || toolName || '').toLowerCase();
        const isDestructive = toolNameForPolicy.includes('delete') ||
                              toolNameForPolicy.includes('cancel') ||
                              toolNameForPolicy.includes('remove') ||
                              toolNameForPolicy.includes('revoke');

        if (isDestructive && !options.confirmed) {
            return {
                success: false,
                error: {
                    code: 'CONFIRMATION_REQUIRED',
                    message: 'This operation is destructive and cannot be undone.',
                    suggestion: 'Add { options: { confirmed: true } } to proceed'
                }
            };
        }

        // 3. Schema validation if available
        if (operation && operation.input_schema && operation.required_params) {
            const validationError = this.validateParams(params, operation);
            if (validationError) {
                return {
                    success: false,
                    error: validationError
                };
            }
        }

        // 4. Dry run mode
        if (options.dry_run) {
            return {
                success: true,
                dry_run: true,
                tool_id: canonicalToolId,
                ...(canonicalToolId !== tool_id ? { requested_tool_id: tool_id } : {}),
                params,
                validation: 'passed',
                message: 'Dry run successful. Remove dry_run option to execute.',
                operation_meta: {
                    adapter: resolvedAdapterId,
                    tool: resolvedToolName,
                    risk_level: operationMeta.risk_level || 'unknown'
                }
            };
        }

        // ============ Execute the Operation ============

        const startTime = Date.now();

        try {
            let result = null;

            // Prefer AdapterRegistry execution path (canonical tool routing + auth passthrough)
            if (this.gateway.adapterRegistry && typeof this.gateway.adapterRegistry.callTool === 'function') {
                try {
                    result = await this.gateway.adapterRegistry.callTool(canonicalToolId, params, context);
                } catch (error) {
                    // Fallback for legacy behavior if registry cannot resolve the tool.
                    if (!(error && error.message && error.message.startsWith('Tool not found'))) {
                        throw error;
                    }
                }
            }

            // Legacy fallback: direct adapter execution (no registry)
            if (result === null) {
                const adapter = this.gateway.adapters.get(resolvedAdapterId) || this.gateway.adapters.get(adapterId);

                if (!adapter) {
                    return {
                        success: false,
                        error: {
                            code: 'ADAPTER_NOT_FOUND',
                            message: `Adapter '${resolvedAdapterId}' not found`,
                            available_adapters: Array.from(this.gateway.adapters.keys())
                        }
                    };
                }

                // Check if adapter can execute
                if (typeof adapter.callTool !== 'function') {
                    // This is a mock adapter - can't execute
                    if (typeof adapter.tools === 'number' || adapter.is_mock) {
                        return {
                            success: false,
                            error: {
                                code: 'MOCK_ADAPTER',
                                message: `Adapter '${resolvedAdapterId}' is a mock adapter and cannot execute real operations`,
                                suggestion: 'This adapter needs real implementation to execute operations'
                            }
                        };
                    }

                    return {
                        success: false,
                        error: {
                            code: 'ADAPTER_NOT_EXECUTABLE',
                            message: `Adapter '${resolvedAdapterId}' does not support tool execution`
                        }
                    };
                }

                // Execute the tool (legacy)
                result = await adapter.callTool(resolvedToolName, params);
            }

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                tool_id: canonicalToolId,
                ...(canonicalToolId !== tool_id ? { requested_tool_id: tool_id } : {}),
                execution_time_ms: executionTime,
                data: result,
                meta: {
                    adapter: resolvedAdapterId,
                    tool: resolvedToolName,
                    request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString(),
                    operation: {
                        risk_level: operationMeta.risk_level || 'unknown',
                        idempotent: !!options.idempotency_key,
                        category: operationMeta.category || 'general'
                    }
                }
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;

            return {
                success: false,
                tool_id: canonicalToolId,
                ...(canonicalToolId !== tool_id ? { requested_tool_id: tool_id } : {}),
                execution_time_ms: executionTime,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error.message,
                    adapter: resolvedAdapterId,
                    tool: resolvedToolName
                }
            };
        }
    }

    /**
     * Validate params against schema
     */
    validateParams(params, operation) {
        if (!params || typeof params !== 'object') {
            return {
                code: 'INVALID_PARAMS',
                message: 'params must be an object'
            };
        }

        // Check required params
        for (const required of operation.required_params) {
            if (!(required in params)) {
                return {
                    code: 'MISSING_REQUIRED_PARAM',
                    message: `Missing required parameter: ${required}`,
                    required_params: operation.required_params
                };
            }
        }

        // Type validation if schema is available
        if (operation.input_schema && operation.input_schema.properties) {
            for (const [key, value] of Object.entries(params)) {
                const schema = operation.input_schema.properties[key];
                if (schema) {
                    const typeError = this.validateType(key, value, schema);
                    if (typeError) {
                        return typeError;
                    }
                }
            }
        }

        return null; // No error
    }

    /**
     * Validate a value against a schema type
     */
    validateType(key, value, schema) {
        const expectedType = schema.type;

        // Check type
        let actualType = typeof value;
        if (Array.isArray(value)) actualType = 'array';
        if (value === null) actualType = 'null';

        // Integer is a special case
        if (expectedType === 'integer') {
            if (!Number.isInteger(value)) {
                return {
                    code: 'INVALID_PARAM_TYPE',
                    message: `Parameter '${key}' must be an integer`,
                    expected: 'integer',
                    received: actualType
                };
            }
            return null;
        }

        // Map JS types to JSON Schema types
        const typeMap = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'object': 'object',
            'array': 'array'
        };

        if (typeMap[actualType] !== expectedType) {
            return {
                code: 'INVALID_PARAM_TYPE',
                message: `Parameter '${key}' must be of type ${expectedType}`,
                expected: expectedType,
                received: actualType
            };
        }

        // Check enum
        if (schema.enum && !schema.enum.includes(value)) {
            return {
                code: 'INVALID_PARAM_VALUE',
                message: `Parameter '${key}' must be one of: ${schema.enum.join(', ')}`,
                received: value
            };
        }

        return null;
    }
}

module.exports = GatewayExecute;
