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
            transactionId: { type: 'string', required: true }
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
                // Keep amount in major unit; live edge/client layers handle provider conversion.
                amount: input.amount,
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
              transform: (input) => ({
                // Support both common keys while contracts are being normalized.
                transaction_id: input.reference,
                tx_ref: input.reference
              })
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
                txn_id: input.transactionId
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
              tool: 'validate-account-number',
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

    // Authentication Abstraction
    this.registerAbstraction('auth', {
      client: {
        login: {
          schema: {
            email: { type: 'string', required: true },
            password: { type: 'string', required: true },
            project_scope: { type: 'string', required: false },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web' }
          }
        },
        exchangeSupabaseToken: {
          schema: {
            project_scope: { type: 'string', required: false },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web' }
          }
        },
        logout: {
          schema: {}
        },
        getSession: {
          schema: {}
        },
        verifyToken: {
          schema: {
            token: { type: 'string', required: false }
          }
        },
        listSessions: {
          schema: {}
        },
        initiateOAuth: {
          schema: {
            provider: { type: 'string', required: true },
            redirect_uri: { type: 'string', required: true },
            project_scope: { type: 'string', required: false },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web' }
          }
        },
        requestMagicLink: {
          schema: {
            email: { type: 'string', required: true },
            redirect_uri: { type: 'string', required: false },
            project_scope: { type: 'string', required: false },
            platform: { type: 'string', enum: ['mcp', 'cli', 'web', 'api'], default: 'web' }
          }
        },
        verifyAPIKey: {
          schema: {
            api_key: { type: 'string', required: true }
          }
        },
        createAPIKey: {
          schema: {
            name: { type: 'string', required: true },
            description: { type: 'string', required: false },
            access_level: { type: 'string', enum: ['public', 'authenticated', 'team', 'admin', 'enterprise'], default: 'authenticated' },
            expires_in_days: { type: 'integer', default: 365 }
          }
        },
        listAPIKeys: {
          schema: {
            active_only: { type: 'boolean', default: true },
            project_id: { type: 'string', required: false }
          }
        },
        getAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        rotateAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        revokeAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        deleteAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        }
      },
      vendors: {
        'auth-gateway': {
          adapter: 'auth-gateway',
          mappings: {
            login: {
              tool: 'login',
              transform: (input) => input
            },
            exchangeSupabaseToken: {
              tool: 'exchange-supabase-token',
              transform: (input) => input
            },
            logout: {
              tool: 'logout',
              transform: (input) => input
            },
            getSession: {
              tool: 'get-session',
              transform: (input) => input
            },
            verifyToken: {
              tool: 'verify-token',
              transform: (input) => input
            },
            listSessions: {
              tool: 'list-sessions',
              transform: (input) => input
            },
            initiateOAuth: {
              tool: 'initiate-oauth',
              transform: (input) => input
            },
            requestMagicLink: {
              tool: 'request-magic-link',
              transform: (input) => input
            },
            verifyAPIKey: {
              tool: 'verify-api-key',
              transform: (input) => input
            },
            createAPIKey: {
              tool: 'create-api-key',
              transform: (input) => input
            },
            listAPIKeys: {
              tool: 'list-api-keys',
              transform: (input) => input
            },
            getAPIKey: {
              tool: 'get-api-key',
              transform: (input) => input
            },
            rotateAPIKey: {
              tool: 'rotate-api-key',
              transform: (input) => input
            },
            revokeAPIKey: {
              tool: 'revoke-api-key',
              transform: (input) => input
            },
            deleteAPIKey: {
              tool: 'delete-api-key',
              transform: (input) => input
            }
          }
        }
      }
    });

    // AI Services Abstraction
    this.registerAbstraction('ai', {
      client: {
        chat: {
          schema: {
            messages: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                  content: { type: 'string' }
                },
                required: ['role', 'content']
              }
            },
            provider: { type: 'string', required: false },
            model: { type: 'string', default: 'qwen2:1.5b' },
            temperature: { type: 'number', default: 0.7 },
            max_tokens: { type: 'integer', required: false },
            system_prompt: { type: 'string', required: false }
          }
        },
        ollama: {
          schema: {
            model: { type: 'string', required: true },
            messages: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                  content: { type: 'string' }
                },
                required: ['role', 'content']
              }
            },
            stream: { type: 'boolean', default: false }
          }
        },
        embedding: {
          schema: {
            input: { type: 'string', required: true },
            model: { type: 'string', required: false }
          }
        },
        listServices: {
          schema: {}
        },
        listModels: {
          schema: {}
        },
        health: {
          schema: {}
        }
      },
      vendors: {
        'ai-router': {
          adapter: 'ai-router',
          mappings: {
            chat: {
              tool: 'ai-chat',
              transform: (input) => input
            },
            ollama: {
              tool: 'ollama',
              transform: (input) => input
            },
            embedding: {
              tool: 'embedding',
              transform: (input) => input
            },
            listServices: {
              tool: 'list-ai-services',
              transform: (input) => input
            },
            listModels: {
              tool: 'list-models',
              transform: (input) => input
            },
            health: {
              tool: 'ai-health',
              transform: (input) => input
            }
          }
        }
      }
    });

    // Memory Services Abstraction
    this.registerAbstraction('memory', {
      client: {
        create: {
          schema: {
            title: { type: 'string', required: true },
            content: { type: 'string', required: true },
            memory_type: { type: 'string', enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'], default: 'context' },
            tags: { type: 'array', items: { type: 'string' }, required: false },
            metadata: { type: 'object', required: false }
          }
        },
        get: {
          schema: {
            id: { type: 'string', required: true }
          }
        },
        update: {
          schema: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: false },
            content: { type: 'string', required: false },
            memory_type: { type: 'string', enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'] },
            tags: { type: 'array', items: { type: 'string' }, required: false },
            metadata: { type: 'object', required: false }
          }
        },
        delete: {
          schema: {
            id: { type: 'string', required: true }
          }
        },
        list: {
          schema: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            type: { type: 'string', enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'] },
            tags: { type: 'string', required: false }
          }
        },
        search: {
          schema: {
            query: { type: 'string', required: true },
            type: { type: 'string', enum: ['context', 'project', 'knowledge', 'reference', 'personal', 'workflow'] },
            threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.8 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            tags: { type: 'string', required: false }
          }
        },
        stats: {
          schema: {}
        },
        bulkDelete: {
          schema: {
            ids: { 
              type: 'array', 
              required: true,
              items: { type: 'string' },
              minItems: 1,
              maxItems: 100
            }
          }
        },
        searchDocumentation: {
          schema: {
            query: { type: 'string', required: true },
            section: { type: 'string', enum: ['all', 'api', 'guides', 'sdks'], default: 'all' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
          }
        }
      },
      vendors: {
        'memory-service': {
          adapter: 'memory-service',
          mappings: {
            create: {
              tool: 'create-memory',
              transform: (input) => input
            },
            get: {
              tool: 'get-memory',
              transform: (input) => input
            },
            update: {
              tool: 'update-memory',
              transform: (input) => input
            },
            delete: {
              tool: 'delete-memory',
              transform: (input) => input
            },
            list: {
              tool: 'list-memories',
              transform: (input) => input
            },
            search: {
              tool: 'search-memories',
              transform: (input) => input
            },
            stats: {
              tool: 'memory-stats',
              transform: (input) => input
            },
            bulkDelete: {
              tool: 'bulk-delete-memories',
              transform: (input) => input
            },
            searchDocumentation: {
              tool: 'search-documentation',
              transform: (input) => input
            }
          }
        }
      }
    });

    // Intelligence Services Abstraction
    this.registerAbstraction('intelligence', {
      client: {
        analyzePatterns: {
          schema: {
            time_range_days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
            include_insights: { type: 'boolean', default: true }
          }
        },
        suggestTags: {
          schema: {
            memory_id: { type: 'string', required: false },
            content: { type: 'string', required: false },
            title: { type: 'string', required: false },
            existing_tags: { type: 'array', items: { type: 'string' }, required: false },
            max_suggestions: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
          }
        },
        findRelated: {
          schema: {
            memory_id: { type: 'string', required: false },
            query: { type: 'string', required: false },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
            similarity_threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 }
          }
        },
        detectDuplicates: {
          schema: {
            similarity_threshold: { type: 'number', minimum: 0.8, maximum: 0.99, default: 0.85 },
            include_archived: { type: 'boolean', default: false }
          }
        },
        extractInsights: {
          schema: {
            memory_ids: { type: 'array', items: { type: 'string' }, required: false },
            topic: { type: 'string', required: false },
            time_range_days: { type: 'integer', minimum: 1, maximum: 365, default: 30 }
          }
        },
        healthCheck: {
          schema: {
            include_recommendations: { type: 'boolean', default: true }
          }
        },
        behaviorRecord: {
          schema: {
            pattern_name: { type: 'string', required: true },
            description: { type: 'string', required: true },
            context: { type: 'string', required: false },
            steps: { type: 'array', items: { type: 'string' }, required: false },
            tags: { type: 'array', items: { type: 'string' }, required: false }
          }
        },
        behaviorRecall: {
          schema: {
            query: { type: 'string', required: true },
            context: { type: 'string', required: false },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
          }
        },
        behaviorSuggest: {
          schema: {
            current_context: { type: 'string', required: false },
            previous_actions: { type: 'array', items: { type: 'string' }, required: false },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
          }
        }
      },
      vendors: {
        'intelligence-api': {
          adapter: 'intelligence-api',
          mappings: {
            analyzePatterns: {
              tool: 'intelligence-analyze-patterns',
              transform: (input) => input
            },
            suggestTags: {
              tool: 'intelligence-suggest-tags',
              transform: (input) => input
            },
            findRelated: {
              tool: 'intelligence-find-related',
              transform: (input) => input
            },
            detectDuplicates: {
              tool: 'intelligence-detect-duplicates',
              transform: (input) => input
            },
            extractInsights: {
              tool: 'intelligence-extract-insights',
              transform: (input) => input
            },
            healthCheck: {
              tool: 'intelligence-health-check',
              transform: (input) => input
            },
            behaviorRecord: {
              tool: 'intelligence-behavior-record',
              transform: (input) => input
            },
            behaviorRecall: {
              tool: 'intelligence-behavior-recall',
              transform: (input) => input
            },
            behaviorSuggest: {
              tool: 'intelligence-behavior-suggest',
              transform: (input) => input
            }
          }
        }
      }
    });

    // Security Services Abstraction
    this.registerAbstraction('security', {
      client: {
        createAPIKey: {
          schema: {
            name: { type: 'string', required: true },
            description: { type: 'string', required: false },
            access_level: { type: 'string', enum: ['public', 'authenticated', 'team', 'admin', 'enterprise'], default: 'authenticated' },
            expires_in_days: { type: 'integer', default: 365 }
          }
        },
        deleteAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        rotateAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        revokeAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        listAPIKeys: {
          schema: {
            active_only: { type: 'boolean', default: true },
            project_id: { type: 'string', required: false }
          }
        },
        getAPIKey: {
          schema: {
            key_id: { type: 'string', required: true }
          }
        },
        verifyAPIKey: {
          schema: {
            api_key: { type: 'string', required: true }
          }
        },
        verifyToken: {
          schema: {
            token: { type: 'string', required: true }
          }
        }
      },
      vendors: {
        'security-service': {
          adapter: 'security-service',
          mappings: {
            createAPIKey: {
              tool: 'create-api-key',
              transform: (input) => input
            },
            deleteAPIKey: {
              tool: 'delete-api-key',
              transform: (input) => input
            },
            rotateAPIKey: {
              tool: 'rotate-api-key',
              transform: (input) => input
            },
            revokeAPIKey: {
              tool: 'revoke-api-key',
              transform: (input) => input
            },
            listAPIKeys: {
              tool: 'list-api-keys',
              transform: (input) => input
            },
            getAPIKey: {
              tool: 'get-api-key',
              transform: (input) => input
            },
            verifyAPIKey: {
              tool: 'verify-api-key',
              transform: (input) => input
            },
            verifyToken: {
              tool: 'verify-token',
              transform: (input) => input
            }
          }
        }
      }
    });

    // Verification Services Abstraction
    this.registerAbstraction('verification', {
      client: {
        verifyNIN: {
          schema: {
            nin: { type: 'string', required: true },
            firstName: { type: 'string', required: true },
            lastName: { type: 'string', required: true },
            dateOfBirth: { type: 'string', required: false }
          }
        },
        verifyBVN: {
          schema: {
            bvn: { type: 'string', required: true },
            firstName: { type: 'string', required: true },
            lastName: { type: 'string', required: true },
            dateOfBirth: { type: 'string', required: false }
          }
        },
        verifyPassport: {
          schema: {
            passportNumber: { type: 'string', required: true },
            firstName: { type: 'string', required: true },
            lastName: { type: 'string', required: true },
            dateOfBirth: { type: 'string', required: true },
            nationality: { type: 'string', required: false }
          }
        },
        verifyDocument: {
          schema: {
            documentType: { type: 'string', required: true },
            documentNumber: { type: 'string', required: true },
            firstName: { type: 'string', required: true },
            lastName: { type: 'string', required: true },
            dateOfBirth: { type: 'string', required: false }
          }
        },
        getHistory: {
          schema: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            type: { type: 'string', required: false }
          }
        },
        verifyIdentityDocument: {
          schema: {
            document_type: { type: 'string', required: true },
            document_number: { type: 'string', required: true },
            customer_id: { type: 'string', required: true },
            country: { type: 'string', required: false }
          }
        },
        verifyPhoneEmail: {
          schema: {
            customer_id: { type: 'string', required: true },
            phone_number: { type: 'string', required: false },
            email: { type: 'string', required: false },
            send_otp: { type: 'boolean', required: false },
            otp_code: { type: 'string', required: false }
          }
        },
        verifyAddress: {
          schema: {
            address: { type: 'string', required: true },
            proof_document: { type: 'string', required: true },
            customer_id: { type: 'string', required: true }
          }
        },
        verifyBusinessRegistration: {
          schema: {
            business_name: { type: 'string', required: true },
            registration_number: { type: 'string', required: true },
            country: { type: 'string', required: false }
          }
        },
        verifyTaxIdentification: {
          schema: {
            tax_id: { type: 'string', required: true },
            business_name: { type: 'string', required: true },
            country: { type: 'string', required: false }
          }
        },
        verifyBankAccount: {
          schema: {
            account_number: { type: 'string', required: true },
            bank_code: { type: 'string', required: true },
            business_name: { type: 'string', required: true }
          }
        },
        facialRecognition: {
          schema: {
            image1: { type: 'string', required: true },
            image2: { type: 'string', required: true }
          }
        },
        livenessDetection: {
          schema: {
            image: { type: 'string', required: true },
            check_type: { type: 'string', required: false }
          }
        },
        ageGenderDetection: {
          schema: {
            image: { type: 'string', required: true }
          }
        },
        sanctionsScreening: {
          schema: {
            full_name: { type: 'string', required: true },
            country: { type: 'string', required: false }
          }
        },
        pepScreening: {
          schema: {
            full_name: { type: 'string', required: true },
            country: { type: 'string', required: true }
          }
        },
        adverseMediaScreening: {
          schema: {
            full_name: { type: 'string', required: true },
            business_name: { type: 'string', required: false }
          }
        },
        criminalBackgroundCheck: {
          schema: {
            full_name: { type: 'string', required: true },
            date_of_birth: { type: 'string', required: true }
          }
        },
        employmentHistoryCheck: {
          schema: {
            full_name: { type: 'string', required: true },
            employers: { type: 'object', required: false }
          }
        },
        getVerificationStatus: {
          schema: {
            verification_id: { type: 'string', required: false },
            reference: { type: 'string', required: false }
          }
        },
        listSupportedCountries: {
          schema: {
            service_type: { type: 'string', required: false }
          }
        },
        getVerificationProviders: {
          schema: {
            service_type: { type: 'string', required: false },
            country: { type: 'string', required: false }
          }
        }
      },
      vendors: {
        prembly: {
          adapter: 'verification-service',
          mappings: {
            verifyNIN: {
              tool: 'verify-nin',
              transform: (input) => input
            },
            verifyBVN: {
              tool: 'verify-bvn',
              transform: (input) => input
            },
            verifyPassport: {
              tool: 'verify-passport',
              transform: (input) => input
            },
            verifyDocument: {
              tool: 'verify-document',
              transform: (input) => input
            },
            getHistory: {
              tool: 'get-verification-history',
              transform: (input) => input
            },
            verifyIdentityDocument: {
              tool: 'verify-identity-document',
              transform: (input) => input
            },
            verifyPhoneEmail: {
              tool: 'verify-phone-email',
              transform: (input) => input
            },
            verifyAddress: {
              tool: 'verify-address',
              transform: (input) => input
            },
            verifyBusinessRegistration: {
              tool: 'verify-business-registration',
              transform: (input) => input
            },
            verifyTaxIdentification: {
              tool: 'verify-tax-identification',
              transform: (input) => input
            },
            verifyBankAccount: {
              tool: 'verify-bank-account',
              transform: (input) => input
            },
            facialRecognition: {
              tool: 'facial-recognition',
              transform: (input) => input
            },
            livenessDetection: {
              tool: 'liveness-detection',
              transform: (input) => input
            },
            ageGenderDetection: {
              tool: 'age-gender-detection',
              transform: (input) => input
            },
            sanctionsScreening: {
              tool: 'sanctions-screening',
              transform: (input) => input
            },
            pepScreening: {
              tool: 'pep-screening',
              transform: (input) => input
            },
            adverseMediaScreening: {
              tool: 'adverse-media-screening',
              transform: (input) => input
            },
            criminalBackgroundCheck: {
              tool: 'criminal-background-check',
              transform: (input) => input
            },
            employmentHistoryCheck: {
              tool: 'employment-history-check',
              transform: (input) => input
            },
            getVerificationStatus: {
              tool: 'get-verification-status',
              transform: (input) => input
            },
            listSupportedCountries: {
              tool: 'list-supported-countries',
              transform: (input) => input
            },
            getVerificationProviders: {
              tool: 'get-verification-providers',
              transform: (input) => input
            }
          }
        },
        sourceid: {
          adapter: 'verification-service',
          mappings: {
            verifyNIN: {
              tool: 'verify-identity-document',
              transform: (input) => ({
                ...input,
                document_type: 'nin',
                document_number: input.nin || input.document_number,
                customer_id: input.customer_id || input.nin || input.document_number || 'sourceid-nin'
              })
            },
            verifyBVN: {
              tool: 'verify-identity-document',
              transform: (input) => ({
                ...input,
                document_type: 'bvn',
                document_number: input.bvn || input.document_number,
                customer_id: input.customer_id || input.bvn || input.document_number || 'sourceid-bvn'
              })
            },
            verifyPassport: {
              tool: 'verify-identity-document',
              transform: (input) => ({
                ...input,
                document_type: 'passport',
                document_number: input.passportNumber || input.document_number,
                customer_id: input.customer_id || input.passportNumber || input.document_number || 'sourceid-passport'
              })
            },
            verifyDocument: {
              tool: 'verify-identity-document',
              transform: (input) => ({
                ...input,
                document_type: input.documentType || input.document_type || 'national_id',
                document_number: input.documentNumber || input.document_number,
                customer_id: input.customer_id || input.documentNumber || input.document_number || 'sourceid-document'
              })
            },
            verifyIdentityDocument: {
              tool: 'verify-identity-document',
              transform: (input) => input
            },
            verifyPhoneEmail: {
              tool: 'verify-phone-email',
              transform: (input) => input
            },
            verifyAddress: {
              tool: 'verify-address',
              transform: (input) => input
            },
            verifyBusinessRegistration: {
              tool: 'verify-business-registration',
              transform: (input) => input
            },
            verifyTaxIdentification: {
              tool: 'verify-tax-identification',
              transform: (input) => input
            },
            verifyBankAccount: {
              tool: 'verify-bank-account',
              transform: (input) => input
            },
            facialRecognition: {
              tool: 'facial-recognition',
              transform: (input) => input
            },
            livenessDetection: {
              tool: 'liveness-detection',
              transform: (input) => input
            },
            ageGenderDetection: {
              tool: 'age-gender-detection',
              transform: (input) => input
            },
            sanctionsScreening: {
              tool: 'sanctions-screening',
              transform: (input) => input
            },
            pepScreening: {
              tool: 'pep-screening',
              transform: (input) => input
            },
            adverseMediaScreening: {
              tool: 'adverse-media-screening',
              transform: (input) => input
            },
            criminalBackgroundCheck: {
              tool: 'criminal-background-check',
              transform: (input) => input
            },
            employmentHistoryCheck: {
              tool: 'employment-history-check',
              transform: (input) => input
            },
            getVerificationStatus: {
              tool: 'get-verification-status',
              transform: (input) => input
            },
            listSupportedCountries: {
              tool: 'list-supported-countries',
              transform: (input) => input
            },
            getVerificationProviders: {
              tool: 'get-verification-providers',
              transform: (input) => input
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
        const value = input[field];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (rules.type === 'array') {
          if (!Array.isArray(value)) {
            throw new Error(`Invalid type for field ${field}: expected array, got ${actualType}`);
          }

          if (rules.items && rules.items.type) {
            value.forEach((item, index) => {
              const itemType = Array.isArray(item) ? 'array' : typeof item;
              if (itemType !== rules.items.type) {
                throw new Error(
                  `Invalid type for field ${field}[${index}]: expected ${rules.items.type}, got ${itemType}`
                );
              }

              if (rules.items.type === 'object' && rules.items.required && Array.isArray(rules.items.required)) {
                for (const requiredProp of rules.items.required) {
                  if (item[requiredProp] === undefined || item[requiredProp] === null) {
                    throw new Error(`Required field missing: ${field}[${index}].${requiredProp}`);
                  }
                }
              }
            });
          }
        } else if (rules.type === 'object') {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`Invalid type for field ${field}: expected object, got ${actualType}`);
          }
        } else if (actualType !== rules.type) {
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
