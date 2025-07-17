module.exports = {
  // Hostinger VPS deployment configuration
  environments: {
    staging: {
      name: 'mcp-server-staging',
      host: process.env.HOSTINGER_STAGING_HOST || 'staging.your-domain.com',
      port: 3002,
      path: '/var/www/mcp-server-staging',
      branch: 'develop',
      pm2: {
        name: 'mcp-server-staging',
        instances: 1,
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'staging',
          PORT: 3002
        }
      },
      nginx: {
        server_name: 'staging-api.your-domain.com',
        ssl: true,
        proxy_pass: 'http://localhost:3002'
      }
    },
    
    production: {
      name: 'mcp-server-production',
      host: process.env.HOSTINGER_PRODUCTION_HOST || 'your-domain.com',
      port: 3001,
      path: '/var/www/mcp-server',
      branch: 'main',
      pm2: {
        name: 'mcp-server',
        instances: 2,
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'production',
          PORT: 3001
        }
      },
      nginx: {
        server_name: 'api.your-domain.com',
        ssl: true,
        proxy_pass: 'http://localhost:3001'
      }
    }
  },
  
  // Pre-deployment hooks
  hooks: {
    'pre-deploy': [
      'npm ci --production',
      'npm run build'
    ],
    'post-deploy': [
      'pm2 reload ecosystem.config.js',
      'sleep 5',
      'curl -f http://localhost:$PORT/health'
    ]
  },
  
  // Backup configuration
  backup: {
    enabled: true,
    retention: 3, // Keep last 3 backups
    path: '/var/backups/mcp-server'
  },
  
  // Health check configuration
  healthCheck: {
    enabled: true,
    endpoint: '/health',
    timeout: 30000,
    retries: 3
  }
};
