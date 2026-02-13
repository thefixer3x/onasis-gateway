#!/usr/bin/env node

/**
 * Unified Gateway - API Gateway + MCP Server
 * 
 * Runs both services on the same Express app with different route prefixes:
 * - /api/*        → API Gateway (REST API routing, service orchestration)
 * - /mcp          → MCP Server (1604 tools across 18 adapters)
 * - /health       → Health check for both services
 * - /             → Service discovery/documentation
 * 
 * This allows both services to coexist on the same port without conflicts.
 */

require('dotenv').config();

const decodeJwtPayload = (token) => {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    if (!payload) return null;

    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    try {
        const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
};

const deriveSupabaseUrlFromTokens = () => {
    const candidates = [
        process.env.SUPABASE_ANON_KEY,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        process.env.SUPABASE_SERVICE_KEY
    ].filter(Boolean);

    for (const token of candidates) {
        const payload = decodeJwtPayload(token);
        const ref = payload && payload.ref;
        if (ref && typeof ref === 'string') {
            return `https://${ref}.supabase.co`;
        }
    }
    return null;
};

const ensureSupabaseEnv = () => {
    if (!process.env.SUPABASE_URL) {
        const derived = deriveSupabaseUrlFromTokens();
        if (derived) {
            process.env.SUPABASE_URL = derived;
        }
    }

    // Accept SUPABASE_SERVICE_KEY as alias for SUPABASE_SERVICE_ROLE_KEY (common naming).
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;
    }
};

ensureSupabaseEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vpsMonitor = require('./vps/monitor');

const fetch = globalThis.fetch
    ? globalThis.fetch.bind(globalThis)
    : (...args) => import('node-fetch').then((mod) => (mod.default || mod)(...args));

const parseCsv = (value) => (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const getHeaderValue = (headers, key) => {
    if (!headers || typeof headers !== 'object') return '';
    if (key in headers) return headers[key];
    const lower = key.toLowerCase();
    if (lower in headers) return headers[lower];
    const found = Object.keys(headers).find((name) => name.toLowerCase() === lower);
    return found ? headers[found] : '';
};

const allowedOrigins = [
    ...parseCsv(process.env.ALLOWED_ORIGINS),
    ...parseCsv(process.env.CORS_ORIGIN)
];
const allowedOriginSuffixes = parseCsv(process.env.ALLOWED_ORIGIN_SUFFIXES || 'lanonasis.com');
const allowLocalhost = (process.env.CORS_ALLOW_LOCALHOST || 'true') === 'true';

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        if (allowLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) {
            return true;
        }
        if (allowedOrigins.includes(origin)) {
            return true;
        }
        return allowedOriginSuffixes.some((suffix) => (
            hostname === suffix || hostname.endsWith(`.${suffix}`)
        ));
    } catch (error) {
        return false;
    }
};

const corsOriginCallback = (origin, callback) => callback(null, isAllowedOrigin(origin));

const getRateLimitKey = (req) => {
    const sessionId = req.headers['x-session-id'] || '';
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    const apiKey = req.headers['x-api-key'] || '';
    // Get IP from req.ip or x-forwarded-for header
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = req.ip || (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : '') || '';
    const seed = sessionId || token || apiKey || ip || 'anonymous';
    return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 32);
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
};

const DEFAULT_MCP_ADAPTERS = {
    'stripe-api-2024-04-10': { tools: 457, auth: 'bearer' },
    'ngrok-api': { tools: 217, auth: 'bearer' },
    'shutterstock-api': { tools: 109, auth: 'oauth2' },
    'paystack': { tools: 117, auth: 'bearer' },
    'flutterwave-v3': { tools: 108, auth: 'bearer' },
    'bap': { tools: 92, auth: 'apikey' },
    'google-analytics-api-v3': { tools: 88, auth: 'apikey' },
    'hostinger-api': { tools: 85, auth: 'bearer' },
    'open-banking-api': { tools: 58, auth: 'apikey' },
    'business-api': { tools: 52, auth: 'bearer' },
    'merchant-api': { tools: 49, auth: 'apikey' },
    '7-wise-multicurrency-account-mca-platform-api-s': { tools: 47, auth: 'apikey' },
    'sayswitch-api-integration': { tools: 43, auth: 'bearer' },
    'xpress-wallet-for-merchants': { tools: 40, auth: 'bearer' },
    'ngrok-examples': { tools: 19, auth: 'apikey' },
    'multi-currency-account': { tools: 9, auth: 'apikey' },
    'api-testing-basics': { tools: 8, auth: 'apikey' },
    'edoc-external-app-integration-for-clients': { tools: 6, auth: 'apikey' }
};

const buildDefaultMcpCatalog = () => ([
    { id: 'supabase-edge-functions', type: 'supabase', enabled: true },
    ...Object.entries(DEFAULT_MCP_ADAPTERS).map(([name, config]) => ({
        id: name,
        type: 'mock',
        source: 'mock',
        enabled: true,
        toolCount: config.tools,
        auth: config.auth
    }))
]);

// Import components from both servers
const BaseClient = require('./core/base-client');
const VersionManager = require('./core/versioning/version-manager');
const ComplianceManager = require('./core/security/compliance-manager');
const MetricsCollector = require('./core/monitoring/metrics-collector');
const AbstractedAPIEndpoints = require('./api/abstracted-endpoints');
const OnasisAuthBridge = require('./middleware/onasis-auth-bridge');
const MCPDiscoveryLayer = require('./src/mcp/discovery');

/**
 * Unified Gateway - Combines API Gateway + MCP Server
 */
class UnifiedGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;

        // API Gateway components
        this.services = new Map();
        this.clients = new Map();
        this.versionManager = new VersionManager();
        this.complianceManager = new ComplianceManager();
        this.metricsCollector = new MetricsCollector();
        this.routePolicyMode = (process.env.GATEWAY_ROUTE_POLICY_MODE || 'warn').toLowerCase();
        this.centralGatewayBaseUrl = process.env.GATEWAY_PUBLIC_BASE_URL
            || process.env.CENTRAL_GATEWAY_URL
            || 'https://gateway.lanonasis.com';

        // MCP Server components
        this.adapters = new Map();
        this.adapterRegistry = null;
        this.abstractedAPI = new AbstractedAPIEndpoints({
            getAdapterRegistry: () => this.adapterRegistry
        });
        this.authBridge = new OnasisAuthBridge({
            authApiUrl: process.env.AUTH_GATEWAY_URL
                || process.env.ONASIS_AUTH_API_URL
                || 'http://127.0.0.1:4000/v1/auth',
            projectScope: process.env.ONASIS_PROJECT_SCOPE || 'lanonasis-maas'
        });

        this.authGatewayUrl = process.env.AUTH_GATEWAY_URL
            || process.env.ONASIS_AUTH_GATEWAY_URL
            || 'http://127.0.0.1:4000';
        this.projectScope = process.env.ONASIS_PROJECT_SCOPE || 'lanonasis-maas';
        this.vpsMonitorToken = process.env.VPS_MONITOR_TOKEN || null;
        this.aiRouterUrl = process.env.AI_ROUTER_URL || '';
        this.aiRouterTimeoutMs = parseInt(process.env.AI_ROUTER_TIMEOUT_MS || '12000', 10);
        this.authGatewayTimeoutMs = parseInt(process.env.AUTH_GATEWAY_TIMEOUT_MS || '8000', 10);
        this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
        this.supabaseAiChatUrl = process.env.SUPABASE_AI_CHAT_URL
            || (process.env.SUPABASE_URL
                ? `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/ai-chat`
                : '');

        this.startTime = Date.now();
        this.healthTargets = this.parseHealthTargets(process.env.HEALTH_TARGETS);
        this.serviceCatalog = this.loadServiceCatalog();
        this.adaptersReady = null;

        // MCP Discovery Layer configuration
        // lazy = 5 meta-tools only, full = all 1600+ tools (debug mode)
        this.mcpToolMode = process.env.MCP_TOOL_MODE || 'lazy';
        this.discoveryLayer = null;

        console.log('🚀 Initializing Unified Gateway (API + MCP)...');
        console.log(`📋 MCP Tool Mode: ${this.mcpToolMode}`);
        this.setupMiddleware();
        this.loadAPIServices();
        this.adaptersReady = this.loadMCPAdapters();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup middleware for both services
     */
    setupMiddleware() {
        // Security
        this.app.use(helmet());
        this.app.disable('x-powered-by');
        if (process.env.TRUST_PROXY !== undefined) {
            this.app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
        }
        this.app.use(cors({
            origin: corsOriginCallback,
            credentials: true
        }));

        // Performance
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Block dotfile probing early
        this.app.use((req, res, next) => {
            if (req.path && req.path.startsWith('/.')) {
                return res.status(404).json({ error: 'Not Found' });
            }
            next();
        });

        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = crypto.randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Rate limiting - different limits for API vs MCP
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many API requests',
            keyGenerator: getRateLimitKey,
            standardHeaders: true,
            legacyHeaders: false,
            validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false }
        });

        const mcpLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 1000,
            message: 'Too many MCP requests',
            keyGenerator: getRateLimitKey,
            standardHeaders: true,
            legacyHeaders: false,
            validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false }
        });

        this.app.use('/api/', apiLimiter);
        this.app.use('/mcp', mcpLimiter);

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });

        // Metrics middleware
        this.app.use((req, res, next) => {
            const start = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - start;
                const serviceType = req.path.startsWith('/mcp') ? 'mcp' : 'api-gateway';

                this.metricsCollector.recordRequest({
                    service: serviceType,
                    endpoint: req.route?.path || req.path,
                    method: req.method,
                    statusCode: res.statusCode,
                    duration,
                    responseSize: parseInt(res.get('content-length') || '0', 10)
                });
            });

            next();
        });
    }

    /**
     * Load API Gateway services
     */
    loadAPIServices() {
        const servicesDir = path.join(__dirname, 'services');

        if (!fs.existsSync(servicesDir)) {
            console.warn('⚠️  Services directory not found:', servicesDir);
            return;
        }

        const catalogServices = Array.isArray(this.serviceCatalog?.apiServices)
            ? this.serviceCatalog.apiServices.filter(service => service.enabled !== false)
            : [];

        let loadedCount = 0;
        const loadFromConfig = (configPath) => {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const serviceName = config.info?.name || config.name || config.display_name;
            const serviceVersion = config.info?.version || config.version || '1.0.0';
            const baseURL = config.servers?.[0]?.url || config.base_url || config.baseURL || '';

            if (!serviceName) return null;

            this.services.set(serviceName, config);
            const client = new BaseClient({
                baseURL: baseURL,
                version: serviceVersion,
                service: serviceName
            });
            this.clients.set(serviceName, client);
            loadedCount++;
            console.log(`✅ Loaded API service: ${serviceName}`);
            return;
        };

        if (catalogServices.length > 0) {
            for (const service of catalogServices) {
                try {
                    const configPath = service.configPath
                        ? path.isAbsolute(service.configPath)
                            ? service.configPath
                            : path.join(__dirname, service.configPath)
                        : null;

                    if (configPath && fs.existsSync(configPath)) {
                        loadFromConfig(configPath);
                        continue;
                    }

                    if (service.directory) {
                        const servicePath = path.join(servicesDir, service.directory);
                        if (fs.existsSync(servicePath)) {
                            const configFiles = fs.readdirSync(servicePath)
                                .filter(file => file.endsWith('.json') && file !== 'catalog.json');
                            for (const configFile of configFiles) {
                                loadFromConfig(path.join(servicePath, configFile));
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Failed to load service ${service.name || service.directory}:`, error.message);
                }
            }
        } else {
            const serviceDirs = fs.readdirSync(servicesDir)
                .filter(dir => fs.statSync(path.join(servicesDir, dir)).isDirectory());

            for (const serviceDir of serviceDirs) {
                try {
                    const servicePath = path.join(servicesDir, serviceDir);
                    const configFiles = fs.readdirSync(servicePath)
                        .filter(file => file.endsWith('.json') && file !== 'catalog.json');

                    for (const configFile of configFiles) {
                        loadFromConfig(path.join(servicePath, configFile));
                    }
                } catch (error) {
                    console.error(`❌ Failed to load service ${serviceDir}:`, error.message);
                }
            }
        }

        console.log(`📦 Loaded ${loadedCount} API services`);
    }

    /**
     * Load MCP adapters (mock for now)
     */
    async loadMCPAdapters() {
        const AdapterRegistry = require('./src/mcp/adapter-registry');
        this.adapterRegistry = new AdapterRegistry();

        const catalogAdapters = Array.isArray(this.serviceCatalog?.mcpAdapters) && this.serviceCatalog.mcpAdapters.length > 0
            ? this.serviceCatalog.mcpAdapters.filter(adapter => adapter.enabled !== false)
            : buildDefaultMcpCatalog();

        const adapterFactories = {
            'supabase-edge-functions': async ({ gateway }) => {
                const SupabaseAdapter = require('./src/adapters/supabase-edge-functions-adapter.js');
                const supabaseAdapter = new SupabaseAdapter();

                const localDirectRoutes = path.join(__dirname, 'docs/architecture/supabase-api/DIRECT_API_ROUTES.md');
                const localDatabaseGuide = path.join(__dirname, 'docs/architecture/supabase-api/DATABASE_REORGANIZATION_GUIDE.md');
                const monorepoDirectRoutes = path.join(
                    __dirname,
                    '../lan-onasis-monorepo/apps/onasis-core/docs/supabase-api/DIRECT_API_ROUTES.md'
                );
                const monorepoDatabaseGuide = path.join(
                    __dirname,
                    '../lan-onasis-monorepo/apps/onasis-core/docs/supabase-api/DATABASE_REORGANIZATION_GUIDE.md'
                );

                const envRoutes = process.env.SUPABASE_DIRECT_ROUTES_PATH || process.env.SUPABASE_ROUTES_PATHS || '';
                const candidates = [
                    envRoutes,
                    localDirectRoutes,
                    localDatabaseGuide,
                    monorepoDirectRoutes,
                    monorepoDatabaseGuide
                ]
                    .filter(Boolean)
                    .flatMap(entry => entry.split(',').map(part => part.trim()).filter(Boolean));

                const resolved = candidates.filter(candidate => fs.existsSync(candidate));
                const routesFilePath = resolved.join(',');

                await supabaseAdapter.initialize({
                    supabaseUrl: process.env.SUPABASE_URL,
                    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
                    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
                    routesFilePath,
                    discoveryMode: 'auto',
                    cacheTimeout: 300,
                    authPassthrough: true,
                    uaiIntegration: {
                        enabled: true,
                        tokenHeader: 'Authorization'
                    }
                });

                await gateway.adapterRegistry.register(supabaseAdapter, {
                    adapterId: 'supabase-edge-functions',
                    skipInitialize: true
                });

                const catalogEntry = gateway.serviceCatalog?.mcpAdapters?.find(
                    entry => entry.id === 'supabase-edge-functions'
                );
                if (catalogEntry) {
                    catalogEntry.toolCount = supabaseAdapter.tools.length;
                    catalogEntry.functions = supabaseAdapter.listFunctions?.() || [];
                }

                console.log(`✅ Loaded Supabase Edge Functions Adapter (${supabaseAdapter.tools.length} functions discovered)`);
            },
            supabase: async (context) => adapterFactories['supabase-edge-functions'](context)
        };

        for (const adapterEntry of catalogAdapters) {
            if (!adapterEntry || !adapterEntry.id) continue;

            const factory =
                adapterFactories[adapterEntry.id] ||
                (adapterEntry.type && adapterFactories[adapterEntry.type]);

            if (factory) {
                try {
                    await factory({ gateway: this, adapterEntry });
                } catch (error) {
                    console.warn(`⚠️ ${adapterEntry.id} adapter failed to load:`, error.message);
                }
                continue;
            }

            // Real adapter loaded from catalog adapterPath (CommonJS .js module)
            if (adapterEntry.adapterPath) {
                try {
                    const resolvedPath = path.isAbsolute(adapterEntry.adapterPath)
                        ? adapterEntry.adapterPath
                        : path.join(__dirname, adapterEntry.adapterPath);

                    // eslint-disable-next-line import/no-dynamic-require, global-require
                    const mod = require(resolvedPath);

                    let AdapterClass = null;
                    if (adapterEntry.functionName && mod && typeof mod === 'object' && mod[adapterEntry.functionName]) {
                        AdapterClass = mod[adapterEntry.functionName];
                    } else if (typeof mod === 'function') {
                        AdapterClass = mod;
                    } else if (mod && typeof mod === 'object' && typeof mod.default === 'function') {
                        AdapterClass = mod.default;
                    } else if (mod && typeof mod === 'object') {
                        const candidates = Object.values(mod).filter((v) => typeof v === 'function');
                        if (candidates.length === 1) {
                            AdapterClass = candidates[0];
                        }
                    }

                    if (!AdapterClass) {
                        throw new Error(`Adapter module did not export a constructor (${adapterEntry.adapterPath})`);
                    }

                    const adapter = new AdapterClass(adapterEntry);
                    if (typeof adapter.initialize === 'function') {
                        await adapter.initialize(adapterEntry);
                        if (!adapter._initialized) {
                            adapter._initialized = true;
                        }
                    }
                    await this.adapterRegistry.register(adapter, { skipInitialize: true });
                    console.log(`✅ Loaded adapter ${adapterEntry.id} (${Array.isArray(adapter.tools) ? adapter.tools.length : 0} tools)`);
                } catch (error) {
                    console.warn(`⚠️ ${adapterEntry.id} adapter failed to load from adapterPath:`, error.message);
                    this.adapterRegistry.registerMock(adapterEntry);
                }
                continue;
            }

            // Mock adapter placeholder (discoverable but not executable)
            if (adapterEntry.type === 'mock' || adapterEntry.source === 'mock') {
                this.adapterRegistry.registerMock(adapterEntry);
            }
        }

        // Backwards-compat: keep gateway.adapters as the live map of adapters
        this.adapters = this.adapterRegistry.toAdaptersMap();

        const totalTools = this.getTotalTools();
        const stats = this.adapterRegistry.getStats();
        console.log(`⚡ Loaded ${stats.totalAdapters} MCP adapters (${stats.realAdapters} real, ${stats.mockAdapters} mock, ${totalTools} tools)`);

        // Initialize MCP Discovery Layer
        if (this.mcpToolMode === 'lazy') {
            try {
                this.discoveryLayer = new MCPDiscoveryLayer(this, this.adapters);
                console.log(`🔍 MCP Discovery Layer initialized (5 meta-tools active)`);
            } catch (error) {
                console.warn(`⚠️ Failed to initialize Discovery Layer: ${error.message}`);
                console.log(`⚠️ Falling back to full mode (${totalTools} tools)`);
                this.mcpToolMode = 'full';
            }
        }
    }

    buildMcpRequestContext(req) {
        const authorization = req.headers.authorization || req.headers.Authorization || '';
        const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'] || '';
        const clientId = req.headers['client-id'] || req.headers['x-client-id'] || '';
        const projectScope = req.headers['x-project-scope'] || req.headers['X-Project-Scope'] || this.projectScope || '';
        const requestId = req.id || '';
        const sessionId = req.headers['x-session-id'] || req.headers['X-Session-ID'] || '';
        const apikey = req.headers.apikey || req.headers['apikey'] || '';

        const headers = {
            ...(authorization && { Authorization: authorization }),
            ...(apiKey && { 'X-API-Key': apiKey }),
            ...(clientId && { 'client-id': clientId }),
            ...(apikey && { apikey }),
            ...(projectScope && { 'X-Project-Scope': projectScope }),
            ...(requestId && { 'X-Request-ID': requestId }),
            ...(sessionId && { 'X-Session-ID': sessionId })
        };

        return {
            authorization,
            apiKey,
            clientId,
            projectScope,
            requestId,
            sessionId,
            headers
        };
    }

    buildAuthVerifyUrl() {
        const raw = (this.authGatewayUrl || '').replace(/\/+$/, '');
        if (!raw) {
            return null;
        }

        // Strip any existing /v1/auth or /v1 suffix to get the bare host:port
        const base = raw
            .replace(/\/v1\/auth$/, '')
            .replace(/\/v1$/, '');

        // Always append the canonical path exactly once
        return `${base}/v1/auth/verify`;
    }

    resolveSupabaseUrl() {
        const adapter = this.adapters.get('supabase-edge-functions');
        const adapterUrl =
            (adapter && adapter.config && adapter.config.supabaseUrl) ||
            '';
        const envUrl = process.env.SUPABASE_URL || '';
        return (adapterUrl || envUrl || '').replace(/\/+$/, '');
    }

    isValidFunctionSlug(slug) {
        return typeof slug === 'string' && /^[a-zA-Z0-9_-]+$/.test(slug);
    }

    getForwardHeadersForSupabaseProxy(req) {
        const context = this.buildMcpRequestContext(req);
        const headers = {
            ...(context.headers || {})
        };

        if (!headers['X-Request-ID'] && req.id) {
            headers['X-Request-ID'] = req.id;
        }
        if (!headers['X-Project-Scope'] && this.projectScope) {
            headers['X-Project-Scope'] = this.projectScope;
        }

        const anonKey = process.env.SUPABASE_ANON_KEY || '';
        if (!headers.apikey && anonKey) {
            headers.apikey = anonKey;
        }
        if (!headers.Authorization && anonKey) {
            headers.Authorization = `Bearer ${anonKey}`;
        }

        return headers;
    }

    async proxySupabaseFunction(req, res) {
        await this.ensureAdaptersReady();

        const functionName = req.params.functionName;
        if (!this.isValidFunctionSlug(functionName)) {
            return res.status(400).json({
                error: 'Invalid function name',
                requestId: req.id
            });
        }

        const supabaseUrl = this.resolveSupabaseUrl();
        if (!supabaseUrl) {
            return res.status(503).json({
                error: 'SUPABASE_URL is not configured',
                requestId: req.id
            });
        }

        const targetUrl = new URL(`${supabaseUrl}/functions/v1/${functionName}`);
        for (const [key, value] of Object.entries(req.query || {})) {
            if (Array.isArray(value)) {
                for (const item of value) targetUrl.searchParams.append(key, `${item}`);
            } else if (value !== undefined && value !== null) {
                targetUrl.searchParams.set(key, `${value}`);
            }
        }

        const method = (req.method || 'POST').toUpperCase();
        const forwardHeaders = this.getForwardHeadersForSupabaseProxy(req);
        const requestHeaders = {
            ...forwardHeaders,
            'Content-Type': getHeaderValue(req.headers, 'content-type') || 'application/json'
        };
        if (getHeaderValue(req.headers, 'accept')) {
            requestHeaders.Accept = getHeaderValue(req.headers, 'accept');
        }

        const shouldSendBody = !['GET', 'HEAD'].includes(method);
        const hasBody = req.body !== undefined && req.body !== null;
        const body = shouldSendBody
            ? JSON.stringify(hasBody ? req.body : {})
            : undefined;

        try {
            const upstreamResponse = await fetchWithTimeout(targetUrl.toString(), {
                method,
                headers: requestHeaders,
                body
            }, 30000);

            const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
            const text = await upstreamResponse.text();

            res.setHeader('X-Gateway-Route', 'central-supabase-proxy');
            res.setHeader('X-Upstream-Target', 'supabase-edge-function');
            res.setHeader('X-Upstream-Function', functionName);
            res.setHeader('Content-Type', contentType);

            return res.status(upstreamResponse.status).send(text);
        } catch (error) {
            return res.status(502).json({
                error: 'Supabase function proxy failed',
                message: error.message,
                function: functionName,
                requestId: req.id
            });
        }
    }

    async verifyVpsAuth(req, requireAdmin = true) {
        const authHeader = req.headers.authorization || req.headers.Authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { ok: false, status: 401, error: 'Missing authorization token' };
        }

        const token = authHeader.replace('Bearer ', '');

        if (this.vpsMonitorToken && token === this.vpsMonitorToken) {
            return {
                ok: true,
                user: { id: 'monitor', role: 'admin' },
                isAdmin: true,
                method: 'monitor_token'
            };
        }

        const verifyUrl = this.buildAuthVerifyUrl();
        if (!verifyUrl) {
            return { ok: false, status: 500, error: 'Auth gateway URL not configured' };
        }

        try {
            const response = await fetchWithTimeout(verifyUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Project-Scope': this.projectScope
                }
            }, this.authGatewayTimeoutMs);

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                return { ok: false, status: 401, error: data.error || 'Unauthorized' };
            }

            const payload = data.payload || data.user || data;
            const role = payload?.role || payload?.user?.role;
            const permissions = payload?.permissions || payload?.user?.permissions || [];
            const isAdmin = role === 'admin' || permissions.includes('admin');

            if (requireAdmin && !isAdmin) {
                return { ok: false, status: 403, error: 'Admin access required' };
            }

            return { ok: true, user: payload, isAdmin, method: 'auth_gateway' };
        } catch (error) {
            return { ok: false, status: 502, error: 'Auth gateway unavailable' };
        }
    }

    /**
     * Setup routes for both API Gateway and MCP Server
     */
    setupRoutes() {
        // ==================== ROOT & DISCOVERY ====================
        this.app.get('/', async (req, res) => {
            await this.ensureAdaptersReady();
            res.json({
                name: 'Unified Gateway',
                version: '1.0.0',
                services: {
                    api: {
                        description: 'API Gateway - Service orchestration and routing',
                        services: this.services.size,
                        baseUrl: '/api'
                    },
                    mcp: {
                        description: 'MCP Server - Tool aggregation and execution',
                        adapters: this.adapters.size,
                        tools: this.getTotalTools(),
                        baseUrl: '/mcp'
                    }
                },
                endpoints: {
                    health: '/health',
                    apiDocs: '/api/services',
                    mcpTools: '/mcp (POST with JSON-RPC 2.0)'
                }
            });
        });

        // ==================== HEALTH CHECKS ====================
        this.app.get('/health', async (req, res) => {
            await this.ensureAdaptersReady();
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);

            // Get Supabase adapter status
            const supabaseAdapter = this.adapters.get('supabase-edge-functions');
            let supabaseStatus = { available: false };

            if (supabaseAdapter && supabaseAdapter.getStatus) {
                try {
                    supabaseStatus = await supabaseAdapter.getStatus();
                } catch (error) {
                    supabaseStatus = { available: false, error: error.message };
                }
            }

            res.json({
                status: 'healthy',
                uptime,
                timestamp: new Date().toISOString(),
                services: {
                    api: {
                        status: 'online',
                        services: this.services.size
                    },
                    mcp: {
                        status: 'online',
                        adapters: this.adapters.size,
                        tools: this.getTotalTools(),
                        supabase: supabaseStatus
                    }
                },
                version: '1.0.0'
            });
        });

        // ==================== CENTRAL ROUTE POLICY ====================
        this.app.get('/api/v1/gateway/route-policy', async (req, res) => {
            await this.ensureAdaptersReady();
            const supabaseUrl = this.resolveSupabaseUrl();
            res.json({
                mode: this.routePolicyMode,
                centralGatewayBaseUrl: this.centralGatewayBaseUrl,
                proxyRoutes: [
                    '/functions/v1/:functionName',
                    '/api/v1/functions/:functionName',
                    '/mcp (gateway-execute)'
                ],
                sourceOfTruth: 'All client/API traffic must enter via central gateway, then route to adapters/upstreams.',
                upstreams: {
                    supabaseFunctions: supabaseUrl || null
                },
                timestamp: new Date().toISOString()
            });
        });

        // Gateway-owned compatibility routes for clients that previously called
        // Supabase /functions/v1 directly. This keeps central controls in-path.
        this.app.all('/functions/v1/:functionName', async (req, res) => this.proxySupabaseFunction(req, res));
        this.app.all('/api/v1/functions/:functionName', async (req, res) => this.proxySupabaseFunction(req, res));

        // ==================== API GATEWAY ROUTES ====================

        // AI chat (primary: AIServiceRouter, fallback: Supabase edge function)
        this.app.post('/api/v1/ai-chat', async (req, res) => {
            const requestId = req.id || crypto.randomUUID();
            const body = req.body || {};

            const forwardHeaders = {
                'Content-Type': 'application/json',
                ...(req.headers.authorization && { 'Authorization': req.headers.authorization }),
                ...(req.headers['x-api-key'] && { 'X-API-Key': req.headers['x-api-key'] }),
                'X-Request-ID': requestId
            };

            const tryPrimary = async () => {
                if (!this.aiRouterUrl) return null;
                const base = this.aiRouterUrl.replace(/\/+$/, '');
                const url = `${base}/api/v1/ai-chat`;
                const response = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers: forwardHeaders,
                    body: JSON.stringify(body)
                }, this.aiRouterTimeoutMs);
                return response;
            };

            const tryFallback = async () => {
                if (!this.supabaseAiChatUrl) return null;
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestId,
                    ...(this.supabaseAnonKey && {
                        Authorization: `Bearer ${this.supabaseAnonKey}`,
                        apikey: this.supabaseAnonKey
                    })
                };
                const response = await fetchWithTimeout(this.supabaseAiChatUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                }, this.aiRouterTimeoutMs);
                return response;
            };

            const sendResponse = async (response, source) => {
                const contentType = response.headers.get('content-type') || '';
                const rawText = await response.text();
                let payload = rawText;
                if (contentType.includes('application/json')) {
                    try {
                        payload = JSON.parse(rawText);
                    } catch {
                        payload = { error: 'Invalid JSON response', raw: rawText };
                    }
                }
                res.setHeader('X-AI-Route', source);
                return res.status(response.status).send(payload);
            };

            try {
                const primaryResponse = await tryPrimary();
                if (primaryResponse && primaryResponse.ok) {
                    return await sendResponse(primaryResponse, 'ai-router');
                }
            } catch (error) {
                console.warn('AI router unavailable, falling back', error.message);
            }

            try {
                const fallbackResponse = await tryFallback();
                if (fallbackResponse) {
                    return await sendResponse(fallbackResponse, 'supabase');
                }
                return res.status(502).json({
                    error: 'AI router unavailable and no fallback configured',
                    requestId
                });
            } catch (error) {
                return res.status(502).json({
                    error: 'AI router unavailable and fallback failed',
                    message: error.message,
                    requestId
                });
            }
        });

        // List all API services
        this.app.get('/api/services', (req, res) => {
            const services = Array.from(this.services.values()).map(service => ({
                name: service.info?.name || service.name || service.display_name,
                version: service.info?.version || service.version || '1.0.0',
                description: service.info?.description || service.description || '',
                category: service.category || 'general',
                baseUrl: service.servers?.[0]?.url || service.base_url || service.baseURL || ''
            }));
            res.json({ services, count: services.length });
        });

        // Service catalog (source of truth)
        this.app.get('/api/catalog', (req, res) => {
            res.json(this.serviceCatalog || { apiServices: [], mcpAdapters: [] });
        });

        // ==================== VPS MONITORING ROUTES ====================
        this.app.get('/api/vps/health', async (req, res) => {
            const auth = await this.verifyVpsAuth(req, true);
            if (!auth.ok) {
                return res.status(auth.status).json({ error: auth.error });
            }

            try {
                const target = vpsMonitor.resolveTarget(req.query.target || req.query.targetId);
                const targets = vpsMonitor.getTargets();
                const defaultTargetId = vpsMonitor.getDefaultTargetId();

                const health = await vpsMonitor.getHealth(target);

                const response = {
                    success: true,
                    data: health,
                    timestamp: new Date().toISOString(),
                    targets: targets.map((t) => ({
                        id: t.id,
                        name: t.name,
                        mode: t.mode,
                        host: t.host
                    })),
                    defaultTargetId
                };

                return res.json(response);
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to fetch VPS health',
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/api/vps/services', async (req, res) => {
            const auth = await this.verifyVpsAuth(req, true);
            if (!auth.ok) {
                return res.status(auth.status).json({ error: auth.error });
            }

            try {
                const target = vpsMonitor.resolveTarget(req.query.target || req.query.targetId);
                const services = await vpsMonitor.getServices(target);
                return res.json({
                    success: true,
                    data: { services },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to fetch VPS services',
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/vps/services', async (req, res) => {
            const auth = await this.verifyVpsAuth(req, true);
            if (!auth.ok) {
                return res.status(auth.status).json({ error: auth.error });
            }

            try {
                const { action, serviceName, targetId } = req.body || {};
                const target = vpsMonitor.resolveTarget(targetId);
                const data = await vpsMonitor.manageService(target, action, serviceName);

                return res.json({
                    success: true,
                    data,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to manage VPS service',
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/api/vps/logs', async (req, res) => {
            const auth = await this.verifyVpsAuth(req, true);
            if (!auth.ok) {
                return res.status(auth.status).json({ error: auth.error });
            }

            try {
                const target = vpsMonitor.resolveTarget(req.query.target || req.query.targetId);
                const data = await vpsMonitor.getLogs(target, req.query.service, req.query.lines);

                return res.json({
                    success: true,
                    data,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to fetch VPS logs',
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/vps/command', async (req, res) => {
            const auth = await this.verifyVpsAuth(req, true);
            if (!auth.ok) {
                return res.status(auth.status).json({ error: auth.error });
            }

            try {
                const { commandKey, targetId } = req.body || {};
                const target = vpsMonitor.resolveTarget(targetId);
                const data = await vpsMonitor.executeAllowedCommand(target, commandKey);

                return res.json({
                    success: true,
                    data,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to execute VPS command',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get specific service details
        this.app.get('/api/services/:serviceName', (req, res) => {
            const { serviceName } = req.params;
            const service = this.services.get(serviceName);

            if (!service) {
                return res.status(404).json({
                    error: 'Service not found',
                    service: serviceName
                });
            }

            res.json(service);
        });

        // Proxy requests to services
        this.app.use('/api/services/:serviceName', async (req, res) => {
            const { serviceName } = req.params;
            const endpoint = req.path.substring(1); // Remove leading slash

            try {
                const service = this.services.get(serviceName);
                if (!service) {
                    return res.status(404).json({
                        error: 'Service not found',
                        service: serviceName
                    });
                }

                const client = this.clients.get(serviceName);
                if (!client) {
                    return res.status(503).json({
                        error: 'Service client not initialized',
                        service: serviceName
                    });
                }

                const requestData = req.method === 'GET' ? null : req.body;

                const response = await client.request({
                    method: req.method,
                    path: `/${endpoint}`,
                    data: requestData,
                    params: req.query
                });

                res.status(response.status || 200).json(response.data);

            } catch (error) {
                console.error(`API Gateway error for ${serviceName}/${endpoint}:`, error.message);

                res.status(error.response?.status || 500).json({
                    error: 'Service request failed',
                    message: error.message,
                    service: serviceName,
                    endpoint,
                    requestId: req.id
                });
            }
        });

        // ==================== MCP SERVER ROUTES ====================

        // Authentication bridge routes
        this.app.use('/api/auth', (req, res, next) => {
            this.authBridge.proxyAuthRequest(req, res).catch(err => {
                console.error('Auth proxy error:', err);
                next(err);
            });
        });

        // Add abstracted API routes (from existing MCP server)
        this.app.use('/', this.abstractedAPI.getRouter());

        // MCP health check
        this.app.get('/mcp/health', async (req, res) => {
            await this.ensureAdaptersReady();
            res.json({
                status: 'healthy',
                server: 'unified-mcp',
                adapters: this.adapters.size,
                tools: this.getTotalTools(),
                timestamp: new Date().toISOString()
            });
        });

        // MCP SSE endpoint for Streamable HTTP transport
        this.app.get('/mcp', async (req, res) => {
            await this.ensureAdaptersReady();

            // Set SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.flushHeaders();

            // Send initial connection event
            const sessionId = crypto.randomUUID();
            res.write(`event: open\ndata: {"sessionId":"${sessionId}"}\n\n`);

            // Keep connection alive
            const keepAlive = setInterval(() => {
                res.write(': keepalive\n\n');
            }, 30000);

            req.on('close', () => {
                clearInterval(keepAlive);
            });
        });

        // MCP JSON-RPC endpoint
        this.app.post('/mcp', async (req, res) => {
            await this.ensureAdaptersReady();
            const { method, params, jsonrpc, id } = req.body;

            // Handle MCP protocol methods
            if (method === 'initialize') {
                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: { listChanged: false }
                        },
                        serverInfo: {
                            name: 'onasis-gateway',
                            version: '1.0.0'
                        }
                    },
                    id
                });
            }

            if (method === 'notifications/initialized') {
                return res.json({ jsonrpc: '2.0', result: {}, id });
            }

            if (method === 'ping') {
                return res.json({ jsonrpc: '2.0', result: {}, id });
            }

            // ============ LAZY MODE: 5 Meta-Tools ============
            if (this.mcpToolMode === 'lazy' && this.discoveryLayer) {
                if (method === 'tools/list') {
                    const metaTools = this.discoveryLayer.getMetaTools();
                    return res.json({
                        jsonrpc: '2.0',
                        result: { tools: metaTools },
                        id: req.body.id
                    });
                }

                if (method === 'tools/call') {
                    const { name: toolName, arguments: toolArgs } = params || {};

                    if (!toolName) {
                        return res.status(400).json({
                            jsonrpc: '2.0',
                            error: { code: -32602, message: 'Missing tool name' },
                            id: req.body.id
                        });
                    }

                    // Check if it's a meta-tool (gateway-*)
                    if (toolName.startsWith('gateway-')) {
                        try {
                            const context = this.buildMcpRequestContext(req);
                            const result = await this.discoveryLayer.callTool(toolName, toolArgs || {}, context);
                            return res.json({
                                jsonrpc: '2.0',
                                result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
                                id: req.body.id
                            });
                        } catch (error) {
                            return res.status(500).json({
                                jsonrpc: '2.0',
                                error: { code: -32000, message: error.message },
                                id: req.body.id
                            });
                        }
                    }

                    // Tool not found in lazy mode
                    return res.status(404).json({
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Tool '${toolName}' not found. In lazy mode, use gateway-intent to discover tools and gateway-execute to run them.`
                        },
                        id: req.body.id
                    });
                }

                return res.status(400).json({
                    jsonrpc: '2.0',
                    error: { code: -32601, message: 'Method not implemented' },
                    id: req.body.id
                });
            }

            // ============ FULL MODE: All 1600+ Tools ============
            if (method === 'tools/list') {
                const tools = [];

                // Collect tools from all adapters
                for (const [name, adapter] of this.adapters.entries()) {
                    try {
                        if (adapter.listTools && typeof adapter.listTools === 'function') {
                            const adapterTools = await adapter.listTools();
                            tools.push(...adapterTools);
                        } else {
                            // Fallback for mock adapters
                            const count = this.getAdapterToolCount(adapter);
                            for (let i = 0; i < count; i++) {
                                tools.push({
                                    name: `${name}_tool_${i + 1}`,
                                    description: `Tool ${i + 1} from ${name}`,
                                    inputSchema: {
                                        type: 'object',
                                        properties: {},
                                        required: []
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error listing tools from ${name}:`, error.message);
                    }
                }

                return res.json({
                    jsonrpc: '2.0',
                    result: { tools },
                    id: req.body.id
                });
            }

            // Handle tools/call method
            if (method === 'tools/call') {
                const { name: toolName, arguments: toolArgs } = params || {};

                if (!toolName) {
                    return res.status(400).json({
                        jsonrpc: '2.0',
                        error: { code: -32602, message: 'Missing tool name' },
                        id: req.body.id
                    });
                }

                // Find the adapter that has this tool
                for (const [adapterName, adapter] of this.adapters.entries()) {
                    try {
                        if (adapter.callTool && typeof adapter.callTool === 'function') {
                            // Check if this adapter has the tool
                            const tools = adapter.tools || [];
                            const hasTool = Array.isArray(tools)
                                ? tools.some(t => t.name === toolName)
                                : false;

                            if (hasTool || adapterName === 'supabase-edge-functions') {
                                const result = await adapter.callTool(toolName, toolArgs || {});
                                return res.json({
                                    jsonrpc: '2.0',
                                    result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
                                    id: req.body.id
                                });
                            }
                        }
                    } catch (error) {
                        if (error.message && !error.message.includes('not found')) {
                            console.error(`Error calling tool ${toolName} from ${adapterName}:`, error.message);
                            return res.status(500).json({
                                jsonrpc: '2.0',
                                error: { code: -32000, message: error.message },
                                id: req.body.id
                            });
                        }
                    }
                }

                return res.status(404).json({
                    jsonrpc: '2.0',
                    error: { code: -32601, message: `Tool '${toolName}' not found` },
                    id: req.body.id
                });
            }

            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32601,
                    message: 'Method not implemented'
                },
                id: req.body.id
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                path: req.path,
                requestId: req.id
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Global error:', err);
            const expose = (process.env.EXPOSE_ERROR_MESSAGES || 'false') === 'true';

            res.status(err.status || 500).json({
                error: 'Internal Server Error',
                ...(expose && err.message ? { message: err.message } : {}),
                requestId: req.id
            });
        });
    }

    /**
     * Parse health check targets
     */
    parseHealthTargets(targetsStr) {
        if (!targetsStr) return [];
        return targetsStr.split(',').map(t => t.trim()).filter(Boolean);
    }

    /**
     * Start the unified server
     */
    start() {
        this.app.listen(this.port, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 Unified Gateway Started');
            console.log('='.repeat(60));
            console.log(`🔗 Port: ${this.port}`);
            console.log(`📊 API Services: ${this.services.size}`);
            console.log(`⚡ MCP Adapters: ${this.adapters.size}`);
            console.log(`🛠️  Total MCP Tools: ${this.getTotalTools()}`);
            console.log('\n📍 Endpoints:');
            console.log(`   - Health: http://localhost:${this.port}/health`);
            console.log(`   - API Gateway: http://localhost:${this.port}/api/services`);
            console.log(`   - MCP Server: http://localhost:${this.port}/mcp`);
            console.log(`   - Discovery: http://localhost:${this.port}/`);
            console.log('='.repeat(60) + '\n');
        });
    }

    loadServiceCatalog() {
        const catalogPath = path.join(__dirname, 'services', 'catalog.json');
        if (fs.existsSync(catalogPath)) {
            try {
                const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
                if (!catalog.apiServices) catalog.apiServices = [];
                if (!catalog.mcpAdapters) catalog.mcpAdapters = [];
                return catalog;
            } catch (error) {
                console.warn(`⚠️ Failed to read service catalog: ${error.message}`);
            }
        }

        const servicesDir = path.join(__dirname, 'services');
        const apiServices = [];

        if (fs.existsSync(servicesDir)) {
            const serviceDirs = fs.readdirSync(servicesDir)
                .filter(dir => fs.statSync(path.join(servicesDir, dir)).isDirectory());

            for (const serviceDir of serviceDirs) {
                const servicePath = path.join(servicesDir, serviceDir);
                const configFiles = fs.readdirSync(servicePath)
                    .filter(file => file.endsWith('.json') && file !== 'catalog.json');

                for (const configFile of configFiles) {
                    apiServices.push({
                        name: configFile.replace('.json', ''),
                        directory: serviceDir,
                        configPath: path.relative(__dirname, path.join(servicePath, configFile)),
                        enabled: true
                    });
                }
            }
        }

        return {
            version: '1.0.0',
            generated: new Date().toISOString(),
            apiServices,
            mcpAdapters: buildDefaultMcpCatalog()
        };
    }

    getAdapterToolCount(adapter) {
        if (!adapter) return 0;
        if (Array.isArray(adapter.tools)) return adapter.tools.length;
        if (typeof adapter.tools === 'number') return adapter.tools;
        if (typeof adapter.toolCount === 'number') return adapter.toolCount;
        return 0;
    }

    getTotalTools() {
        let total = 0;
        for (const adapter of this.adapters.values()) {
            total += this.getAdapterToolCount(adapter);
        }
        return total;
    }

    async ensureAdaptersReady() {
        if (!this.adaptersReady) return;
        await this.adaptersReady;
    }
}

// Start the server
if (require.main === module) {
    const gateway = new UnifiedGateway();
    gateway.start();
}

module.exports = UnifiedGateway;
