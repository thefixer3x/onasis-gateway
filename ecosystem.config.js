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
        CORS_ORIGIN: '*'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        CORS_ORIGIN: 'https://api.connectionpoint.tech'
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
