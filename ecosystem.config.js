// PM2 Ecosystem Configuration for Onasis Gateway
//
// Secrets are injected at runtime by dotenvx from .env.production (AES-256-GCM encrypted).
// Start command: npx dotenvx run -f .env.production -- pm2-runtime start ecosystem.config.js
// Or use: npm run start:pm2
//
module.exports = {
  apps: [
    {
      name: 'central-gateway',
      script: 'server.js',
      instances: 1,
      exec_mode: 'cluster',
      // Non-secret runtime defaults only — all secrets injected by dotenvx at startup
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
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
