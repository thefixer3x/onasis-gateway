module.exports = {
    apps: [
        {
            name: 'unified-gateway',
            script: 'unified_gateway.js',
            instances: 1,
            exec_mode: 'cluster',
            cwd: process.env.ONASIS_GATEWAY_DIR || __dirname,
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                CORS_ORIGIN: '*',

                // Supabase Configuration
                SUPABASE_URL: process.env.SUPABASE_URL,
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

                // Health check targets
                HEALTH_AUTH_URL: 'http://127.0.0.1:4000/health',
                HEALTH_MCP_CORE_URL: 'http://127.0.0.1:3001/health',
                HEALTH_ENTERPRISE_MCP_URL: 'http://127.0.0.1:3001/health',
                HEALTH_TIMEOUT_MS: 4000
            },
            // PM2 configuration
            watch: false,
            max_memory_restart: '1G',
            error_file: './logs/unified-gateway-error.log',
            out_file: './logs/unified-gateway-out.log',
            log_file: './logs/unified-gateway-combined.log',
            time: true,

            // Auto restart configuration
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',

            // Health monitoring
            health_check_grace_period: 3000,
            health_check_fatal_exceptions: true,

            // VPS specific settings
            
        }
    ]
};
