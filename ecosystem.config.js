module.exports = {
  apps: [
    {
      name: 'central-gateway',
      script: 'server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CORS_ORIGIN: '*',
        HEALTH_AUTH_URL: 'http://127.0.0.1:4000/health',
        HEALTH_MCP_CORE_URL: 'http://127.0.0.1:3001/health',
        HEALTH_ENTERPRISE_MCP_URL: 'http://127.0.0.1:3001/health',
        HEALTH_TIMEOUT_MS: 4000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        CORS_ORIGIN: 'https://api.connectionpoint.tech',
        HEALTH_AUTH_URL: 'http://127.0.0.1:4000/health',
        HEALTH_MCP_CORE_URL: 'http://127.0.0.1:3001/health',
        HEALTH_ENTERPRISE_MCP_URL: 'http://127.0.0.1:3001/health',
        HEALTH_TIMEOUT_MS: 4000
      },
      // PM2 configuration
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/central-gateway-error.log',
      out_file: './logs/central-gateway-out.log',
      log_file: './logs/central-gateway-combined.log',
      time: true,
      
      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/api-integration-baseline.git',
      path: '/var/www/mcp-server',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
