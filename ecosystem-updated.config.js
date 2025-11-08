// Updated ecosystem.config.js with Providus Bank service
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: 'api-gateway/server.js',
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
        CORS_ORIGIN: 'https://your-domain.com'
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log',
      log_file: './logs/api-gateway-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'mcp-server',
      script: 'mcp-server/server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        CORS_ORIGIN: '*'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        CORS_ORIGIN: 'https://your-domain.com'
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/mcp-server-error.log',
      out_file: './logs/mcp-server-out.log',
      log_file: './logs/mcp-server-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    // Existing services from memory system
    {
      name: 'vibe-gateway',
      script: 'vibe-gateway/server.js',
      env: {
        PORT: 7777,
        DATABASE_TYPE: 'neon'
      }
    },
    {
      name: 'mcp-unified-gateway', 
      script: 'mcp-unified-gateway/server.js',
      env: {
        PORT: 3008
      }
    },
    {
      name: 'mcp-core',
      script: 'mcp-core/server.js',
      env: {
        PORT: 3001,
        DATABASE_TYPE: 'supabase'
      }
    },
    {
      name: 'quick-auth',
      script: 'quick-auth/server.js', 
      env: {
        PORT: 3005
      }
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'git@github.com:thefixer3x/onasis-gateway.git',
      path: '/var/www/onasis-gateway',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};