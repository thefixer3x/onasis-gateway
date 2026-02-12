/**
 * Vendor Abstraction Layer
 * Ensures complete separation between client requests and vendor implementations
 */

class VendorAbstractionLayer {
  /**
   * @param {object} [options]
   * @param {object} [options.adapterRegistry] AdapterRegistry instance (preferred)
   * @param {function} [options.getAdapterRegistry] Lazy provider for AdapterRegistry
   */
  constructor(options = {}) {
    this.vendorMappings = new Map();
    this.clientSchemas = new Map();
    this.vendorConfigs = new Map();
    this.adapterRegistry = options.adapterRegistry || null;
    this.getAdapterRegistry = typeof options.getAdapterRegistry === 'function'
      ? options.getAdapterRegistry
      : null;
    this.initializeAbstractions();
  }

  initializeAbstractions() {
    // Payment Processing Abstraction
    this.registerAbstraction('payment', {
      client: {
        initializeTransaction: {
          schema: {
            amount: { type: 'number', required: true },
            currency: { type: 'string', default: 'NGN' },
            email: { type: 'string', required: true },
            reference: { type: 'string', required: false },
            metadata: { type: 'object', required: false }
          }
        },
        verifyTransaction: {
          schema: {
            reference: { type: 'string', required: true }
          }
        },
        createCustomer: {
          schema: {
            email: { type: 'string', required: true },
            firstName: { type: 'string', required: false },
            lastName: { type: 'string', required: false },
            phone: { type: 'string', required: false }
          }
        },
        purchaseAirtime: {
          schema: {
            phone: { type: 'string', required: true },
            amount: { type: 'number', required: true },
            network: { type: 'string', required: true },
            reference: { type: 'string', required: false }
          }
        },
        getTransaction: {
          schema: {
            txn_id: { type: 'string', required: true }
          }
        }
      },
      vendors: {
        'paystack': {
          adapter: 'paystack',
          mappings: {
            initializeTransaction: {
              tool: 'initialize-transaction',
              transform: (input) => ({
                email: input.email,
                amount: input.amount * 100, // Convert to kobo
                currency: input.currency,
                reference: input.reference || `ref_${Date.now()}`,
                callback_url: process.env.CALLBACK_URL
              })
            },
            verifyTransaction: {
              tool: 'verify-transaction',
              transform: (input) => ({ reference: input.reference })
            }
          }
        },
        'flutterwave': {
          adapter: 'flutterwave-v3',
          mappings: {
            initializeTransaction: {
              tool: 'initiate-payment',
              transform: (input) => ({
                amount: input.amount,
                currency: input.currency,
                tx_ref: input.reference || `fw_${Date.now()}`,
                customer: { email: input.email }
              })
            },
            verifyTransaction: {
              tool: 'verify-payment',
              transform: (input) => ({ tx_ref: input.reference })
            }
          }
        },
        'sayswitch': {
          adapter: 'sayswitch-api-integration',
          mappings: {
            purchaseAirtime: {
              tool: 'purchase-airtime',
              transform: (input) => ({
                phone: input.phone,
                amount: input.amount,
                network: input.network,
                reference: input.reference || `ss_${Date.now()}`
              })
            },
            getTransaction: {
              tool: 'get-transaction',
              transform: (input) => ({
                txn_id: input.txn_id
              })
            }
          }
        }
      }
    });

    // Banking Abstraction
    this.registerAbstraction('banking', {
      client: {
        getAccountBalance: {
          schema: {
            accountId: { type: 'string', required: true }
          }
        },
        transferFunds: {
          schema: {
            fromAccount: { type: 'string', required: true },
            toAccount: { type: 'string', required: true },
            amount: { type: 'number', required: true },
            currency: { type: 'string', default: 'NGN' },
            reference: { type: 'string', required: false }
          }
        },
        verifyAccount: {
          schema: {
            accountNumber: { type: 'string', required: true },
            bankCode: { type: 'string', required: true }
          }
        }
      },
      vendors: {
        'wise': {
          adapter: '7-wise-multicurrency-account-mca-platform-api-s',
          mappings: {
            getAccountBalance: {
              tool: 'multi-currency-account-manage-mca-get-multi-currency-account',
              transform: (input) => ({ accountId: input.accountId })
            },
            transferFunds: {
              tool: 'transfers-create-transfer',
              transform: (input) => ({
                sourceAccount: input.fromAccount,
                targetAccount: input.toAccount,
                amount: { value: input.amount, currency: input.currency },
                reference: input.reference || `wise_${Date.now()}`
              })
            }
          }
        },
        'bap': {
          adapter: 'bap',
          mappings: {
            verifyAccount: {
              tool: 'account-name-verify',
              transform: (input) => ({
                account_number: input.accountNumber,
                bank_code: input.bankCode
              })
            }
          }
        }
      }
    });

    // Infrastructure Abstraction
    this.registerAbstraction('infrastructure', {
      client: {
        createTunnel: {
          schema: {
            port: { type: 'number', required: true },
            subdomain: { type: 'string', required: false },
            region: { type: 'string', default: 'us' }
          }
        },
        listTunnels: {
          schema: {}
        }
      },
      vendors: {
        'ngrok': {
          adapter: 'ngrok-api',
          mappings: {
            createTunnel: {
              tool: 'tunnels-start-tunnel',
              transform: (input) => ({
                addr: input.port,
                subdomain: input.subdomain,
                region: input.region
              })
            },
            listTunnels: {
              tool: 'tunnels-list-tunnels',
              transform: () => ({})
            }
          }
        }
      }
    });
  }

  registerAbstraction(category, config) {
    this.vendorMappings.set(category, config);
    this.clientSchemas.set(category, config.client);
  }

  createError(status, code, message, meta = {}) {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    err.meta = meta;
    return err;
  }

  getRegistry() {
    if (this.getAdapterRegistry) return this.getAdapterRegistry();
    return this.adapterRegistry;
  }

  async executeAbstractedCall(category, operation, input, vendorPreference = null, context = {}) {
    const abstraction = this.vendorMappings.get(category);
    if (!abstraction) {
      throw this.createError(404, 'UNKNOWN_CATEGORY', `Unknown category: ${category}`);
    }

    // Validate client input against schema
    const clientSchema = abstraction.client[operation];
    if (!clientSchema) {
      throw this.createError(404, 'UNKNOWN_OPERATION', `Unknown operation: ${operation} in category: ${category}`);
    }

    // Do not mutate caller input; defaults are applied to a copy.
    const validatedInput = { ...(input && typeof input === 'object' ? input : {}) };
    this.validateInput(validatedInput, clientSchema.schema);

    // Select vendor (use preference or default to first available)
    const vendors = Object.keys(abstraction.vendors);
    const selectedVendor = vendorPreference && vendors.includes(vendorPreference) 
      ? vendorPreference 
      : vendors[0];

    if (!selectedVendor) {
      throw this.createError(503, 'NO_VENDORS', `No vendors available for category: ${category}`);
    }

    const vendorConfig = abstraction.vendors[selectedVendor];
    const mapping = vendorConfig.mappings[operation];

    if (!mapping) {
      throw this.createError(
        501,
        'OPERATION_NOT_SUPPORTED',
        `Operation ${operation} not supported by vendor: ${selectedVendor}`,
        { category, operation, vendor: selectedVendor }
      );
    }

    // Transform client input to vendor format
    const vendorInput = mapping.transform(validatedInput);

    // Execute vendor call through adapter
    return await this.executeVendorCall(
      vendorConfig.adapter,
      mapping.tool,
      vendorInput,
      {
        category,
        operation,
        vendor: selectedVendor,
        clientInput: validatedInput
      },
      context
    );
  }

  validateInput(input, schema) {
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && (input[field] === undefined || input[field] === null)) {
        throw new Error(`Required field missing: ${field}`);
      }

      if (input[field] !== undefined && rules.type) {
        const actualType = typeof input[field];
        if (actualType !== rules.type) {
          throw new Error(`Invalid type for field ${field}: expected ${rules.type}, got ${actualType}`);
        }
      }

      // Apply defaults
      if (input[field] === undefined && rules.default !== undefined) {
        input[field] = rules.default;
      }
    }
  }

  async executeVendorCall(adapterId, toolName, input, metadata, context = {}) {
    const registry = this.getRegistry();
    if (!registry) {
      throw this.createError(
        503,
        'ADAPTER_REGISTRY_NOT_READY',
        'Adapter registry not available yet (gateway still initializing).',
        { adapterId, toolName }
      );
    }

    const toolId = `${adapterId}:${toolName}`;
    try {
      const result = await registry.callTool(toolId, input, context);
      return {
        success: true,
        data: result,
        metadata: {
          category: metadata.category,
          operation: metadata.operation,
          timestamp: new Date().toISOString(),
          abstracted: true
        }
      };
    } catch (err) {
      const code = err && err.code ? err.code : 'VENDOR_CALL_FAILED';
      if (code === 'TOOL_NOT_FOUND') {
        throw this.createError(501, 'TOOL_NOT_FOUND', `Tool not found for abstraction mapping: ${toolId}`, {
          adapterId,
          toolName,
          category: metadata.category,
          operation: metadata.operation
        });
      }

      // Registry will throw non-executable (mock) adapters as a normal Error.
      if (err && typeof err.message === 'string' && err.message.includes('not executable')) {
        throw this.createError(501, 'ADAPTER_NOT_EXECUTABLE', err.message, { adapterId, toolName });
      }

      throw err;
    }
  }

  getAvailableCategories() {
    return Array.from(this.vendorMappings.keys());
  }

  getCategoryOperations(category) {
    const abstraction = this.vendorMappings.get(category);
    return abstraction ? Object.keys(abstraction.client) : [];
  }

  getCategoryVendors(category) {
    const abstraction = this.vendorMappings.get(category);
    return abstraction ? Object.keys(abstraction.vendors) : [];
  }

  getClientSchema(category, operation) {
    const abstraction = this.vendorMappings.get(category);
    return abstraction?.client[operation]?.schema || null;
  }
}

module.exports = VendorAbstractionLayer;
