/**
 * gateway-reference - Documentation and Guides
 *
 * Get documentation, examples, and usage guides for adapters and tools.
 * Keeps content thin and gateway-specific - links to provider docs for details.
 */

class GatewayReference {
    constructor(registry) {
        this.registry = registry;

        // Provider documentation URLs
        this.providerDocs = {
            'paystack': 'https://paystack.com/docs/api',
            'stripe': 'https://docs.stripe.com/api',
            'flutterwave': 'https://developer.flutterwave.com/reference',
            'ngrok': 'https://ngrok.com/docs/api',
            'wise': 'https://docs.wise.com/api-docs',
            'hostinger': 'https://developers.hostinger.com',
            'supabase-edge-functions': 'https://supabase.com/docs/guides/functions',
            'google-analytics': 'https://developers.google.com/analytics'
        };

        // Auth configuration by adapter
        this.authConfig = {
            'paystack': {
                type: 'bearer',
                header: 'Authorization: Bearer sk_live_xxxxx',
                env_var: 'PAYSTACK_SECRET_KEY',
                note: 'Use sk_test_xxxxx for testing'
            },
            'stripe': {
                type: 'bearer',
                header: 'Authorization: Bearer sk_xxxxx',
                env_var: 'STRIPE_SECRET_KEY',
                note: 'Use sk_test_xxxxx for testing'
            },
            'flutterwave': {
                type: 'bearer',
                header: 'Authorization: Bearer FLWSECK_xxxxx',
                env_var: 'FLUTTERWAVE_SECRET_KEY'
            },
            'ngrok': {
                type: 'bearer',
                header: 'Authorization: Bearer xxxxx',
                env_var: 'NGROK_API_KEY'
            },
            'supabase-edge-functions': {
                type: 'bearer',
                header: 'Authorization: Bearer token',
                secondary: 'apikey: anon_key',
                env_var: 'SUPABASE_ANON_KEY'
            }
        };
    }

    async handle(args) {
        const { topic, section = 'all' } = args;

        if (!topic) {
            return {
                error: {
                    code: 'TOPIC_REQUIRED',
                    message: 'topic parameter is required',
                    examples: ['paystack', 'stripe:create-payment-intent', 'authentication']
                }
            };
        }

        // Check if topic is a tool_id (adapter:tool format)
        if (topic.includes(':')) {
            return this.getToolReference(topic, section);
        }

        // Check if topic is an adapter
        const adapter = this.registry.getAdapter(topic);
        if (adapter) {
            return this.getAdapterReference(topic, adapter, section);
        }

        // Check if topic is a concept
        const conceptRef = this.getConceptReference(topic, section);
        if (conceptRef) {
            return conceptRef;
        }

        // Topic not found
        return {
            error: {
                code: 'TOPIC_NOT_FOUND',
                message: `Topic '${topic}' not found`,
                suggestions: [
                    'Use an adapter name (e.g., paystack, stripe)',
                    'Use a tool_id (e.g., paystack:initialize-transaction)',
                    'Use a concept (e.g., authentication, idempotency)'
                ]
            }
        };
    }

    /**
     * Get reference for an adapter
     */
    getAdapterReference(adapterId, adapter, section) {
        const result = {
            topic: adapterId,
            type: 'adapter'
        };

        const authConfig = this.authConfig[adapterId] || {
            type: adapter.auth_type || 'bearer',
            header: `Authorization: Bearer your_${adapterId}_key`,
            env_var: `${adapterId.toUpperCase().replace(/-/g, '_')}_API_KEY`
        };

        const allSections = {
            overview: {
                name: adapter.name,
                description: adapter.description,
                category: adapter.category,
                tool_count: adapter.tool_count,
                capabilities: adapter.capabilities,
                supported_countries: adapter.supported_countries,
                documentation: this.providerDocs[adapterId] || null,
                is_mock: adapter.is_mock
            },
            authentication: authConfig,
            examples: this.getAdapterExamples(adapterId),
            errors: this.getCommonErrors(adapterId),
            best_practices: this.getBestPractices(adapterId)
        };

        if (section === 'all') {
            Object.assign(result, allSections);
        } else if (allSections[section]) {
            result[section] = allSections[section];
        } else {
            result.error = {
                code: 'INVALID_SECTION',
                message: `Section '${section}' not found`,
                available: Object.keys(allSections)
            };
        }

        return result;
    }

    /**
     * Get reference for a specific tool
     */
    getToolReference(toolId, section) {
        const operation = this.registry.getOperation(toolId);

        if (!operation) {
            return {
                error: {
                    code: 'TOOL_NOT_FOUND',
                    message: `Tool '${toolId}' not found`
                }
            };
        }

        const [adapterId] = toolId.split(':');
        const authConfig = this.authConfig[adapterId] || {
            type: 'bearer',
            header: 'Authorization: Bearer your_api_key'
        };

        return {
            topic: toolId,
            type: 'tool',
            overview: {
                name: operation.name,
                description: operation.description,
                adapter: operation.adapter,
                category: operation.category,
                risk_level: operation.risk_level,
                method: operation.method
            },
            authentication: authConfig,
            parameters: {
                required: operation.required_params,
                optional: operation.optional_params,
                schema: operation.input_schema || null
            },
            constraints: {
                risk_level: operation.risk_level,
                requires_idempotency: operation.risk_level === 'high',
                requires_confirmation: operation.name.toLowerCase().includes('delete') ||
                                       operation.name.toLowerCase().includes('cancel')
            },
            usage: {
                via_gateway: `gateway-execute({ tool_id: "${toolId}", params: {...} })`,
                documentation: this.providerDocs[adapterId] || null
            }
        };
    }

    /**
     * Get reference for a concept
     */
    getConceptReference(topic, section) {
        const concepts = {
            'authentication': {
                topic: 'authentication',
                type: 'concept',
                overview: {
                    description: 'Gateway authentication supports multiple methods',
                    methods: ['Bearer Token', 'API Key', 'OAuth2']
                },
                details: {
                    bearer: 'Pass token in Authorization header: Bearer your_token',
                    api_key: 'Pass API key in x-api-key header',
                    oauth2: 'Use OAuth2 flow for user-authorized access'
                },
                gateway_auth: {
                    description: 'Gateway itself uses the auth-gateway service',
                    endpoint: 'AUTH_GATEWAY_URL (default: http://127.0.0.1:4000)'
                }
            },
            'idempotency': {
                topic: 'idempotency',
                type: 'concept',
                overview: {
                    description: 'Idempotency ensures operations are safe to retry'
                },
                usage: {
                    when_required: 'High-risk operations (payments, transfers, deletes)',
                    how_to_use: 'Pass unique idempotency_key in options',
                    example: 'gateway-execute({ tool_id: "...", params: {...}, options: { idempotency_key: "unique-key" } })'
                },
                best_practices: [
                    'Use UUIDs or deterministic keys based on operation context',
                    'Store idempotency keys to prevent accidental duplicates',
                    'Keys typically expire after 24 hours'
                ]
            },
            'risk-levels': {
                topic: 'risk-levels',
                type: 'concept',
                overview: {
                    description: 'Operations are classified by risk level'
                },
                levels: {
                    low: 'Read-only operations (list, get, fetch)',
                    medium: 'Create/update operations',
                    high: 'Financial operations (charge, transfer, payout)',
                    destructive: 'Delete/cancel operations that cannot be undone'
                },
                enforcement: {
                    high: 'Requires idempotency_key',
                    destructive: 'Requires confirmed: true in options'
                }
            }
        };

        const conceptKey = topic.toLowerCase().replace(/\s+/g, '-');
        return concepts[conceptKey] || null;
    }

    /**
     * Get example operations for an adapter
     */
    getAdapterExamples(adapterId) {
        const examples = {
            'paystack': [
                {
                    title: 'Initialize a payment',
                    tool_id: 'paystack:initialize-transaction',
                    request: { amount: 500000, email: 'customer@example.com' },
                    response: { status: true, data: { authorization_url: 'https://...' } }
                }
            ],
            'stripe': [
                {
                    title: 'Create a payment intent',
                    tool_id: 'stripe:create-payment-intent',
                    request: { amount: 5000, currency: 'usd' },
                    response: { id: 'pi_xxx', client_secret: 'xxx' }
                }
            ],
            'supabase-edge-functions': [
                {
                    title: 'Create a memory',
                    tool_id: 'supabase-edge-functions:memory-create',
                    request: { title: 'Note', content: 'Content here', type: 'context' },
                    response: { success: true, data: { id: '...' } }
                }
            ]
        };

        return examples[adapterId] || [];
    }

    /**
     * Get common errors for an adapter
     */
    getCommonErrors(adapterId) {
        const common = [
            { code: 'invalid_key', meaning: 'API key is invalid or expired', fix: 'Check environment variable' },
            { code: 'rate_limited', meaning: 'Too many requests', fix: 'Implement backoff' },
            { code: 'unauthorized', meaning: 'Missing or invalid authentication', fix: 'Check auth header' }
        ];

        const adapterSpecific = {
            'paystack': [
                { code: 'insufficient_funds', meaning: 'Card has no funds', fix: 'Ask customer to fund card' }
            ],
            'stripe': [
                { code: 'card_declined', meaning: 'Card was declined', fix: 'Ask customer for different card' }
            ]
        };

        return [...common, ...(adapterSpecific[adapterId] || [])];
    }

    /**
     * Get best practices for an adapter
     */
    getBestPractices(adapterId) {
        const common = [
            'Always verify transactions server-side',
            'Use idempotency keys for financial operations',
            'Handle webhook events for async operations'
        ];

        const adapterSpecific = {
            'paystack': [
                'Verify transactions using the verify endpoint',
                'Use split payments for marketplace scenarios'
            ],
            'stripe': [
                'Use Stripe webhooks for payment confirmation',
                'Store customer IDs for repeat payments'
            ]
        };

        return [...common, ...(adapterSpecific[adapterId] || [])];
    }
}

module.exports = GatewayReference;
