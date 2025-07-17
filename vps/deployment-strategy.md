# VPS Deployment Strategy - Timeout Workaround

## Current Issue
- Terminal timeouts when connecting to Hostinger VPS (168.231.74.29)
- SSH connection issues blocking deployment
- Need alternative deployment methods

## Deployment Options

### Option 1: Local Development First
Since VPS connection is timing out, let's get the MCP server running locally first:

```bash
# Start local MCP server
pm2 start ecosystem.config.js --env development

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/adapters
```

### Option 2: GitHub Actions Auto-Deploy
The GitHub workflow will handle VPS deployment automatically:

1. **Push to GitHub** - Triggers deployment
2. **GitHub Actions** - Runs on GitHub's infrastructure
3. **Deploy to VPS** - GitHub connects to your VPS
4. **Health Check** - Verifies deployment

### Option 3: VPS Provider Console
Use Hostinger's web console:

1. **Access VPS Console** - Through Hostinger control panel
2. **Upload Files** - Via web interface or file manager
3. **Install Dependencies** - Run commands in web terminal
4. **Start Services** - Launch PM2 from console

### Option 4: Alternative Connection Methods
Try different connection approaches:

```bash
# Different SSH options
ssh -4 ghost-vps                    # Force IPv4
ssh -6 ghost-vps-ipv6              # Force IPv6  
ssh -p 2222 ghost-vps-alt          # Alternate port
ssh -o ConnectTimeout=30 ghost-vps  # Longer timeout
```

## Immediate Action Plan

### Step 1: Local Testing
```bash
# Ensure local server works
cd "/Users/seyederick/api integration json files"
npm install
pm2 start server.js --name mcp-server-local
curl http://localhost:3001/health
```

### Step 2: Prepare for GitHub Deploy
```bash
# Initialize git repo
git init
git add .
git commit -m "Initial MCP server setup"

# Add remote (when ready)
git remote add origin https://github.com/yourusername/api-integration-baseline.git
git push -u origin main
```

### Step 3: VPS Troubleshooting
```bash
# Network diagnostics
ping -c 4 168.231.74.29
traceroute 168.231.74.29
nslookup srv896342.hstgr.cloud

# Port scanning
nmap -p 22,2222,80,443 168.231.74.29
```

## Fallback Strategies

### Manual File Transfer
If SSH fails, use alternative methods:

1. **SFTP Client** - FileZilla, Cyberduck
2. **Web File Manager** - Hostinger control panel
3. **Git Clone** - Clone repo directly on VPS

### VPS Console Commands
Run these in Hostinger web console:

```bash
# Setup directories
mkdir -p /var/www/mcp-server
cd /var/www/mcp-server

# Clone repository
git clone https://github.com/yourusername/api-integration-baseline.git .

# Install dependencies
npm install

# Start PM2
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

## Network Troubleshooting

### Check Local Network
```bash
# Test internet connectivity
ping -c 4 google.com

# Check DNS resolution
nslookup srv896342.hstgr.cloud
dig srv896342.hstgr.cloud

# Test different networks
# Try mobile hotspot if on WiFi
```

### VPS Provider Issues
- **Hostinger Status** - Check service status page
- **Firewall Rules** - Verify SSH port is open
- **IP Changes** - Confirm VPS IP hasn't changed
- **Maintenance** - Check for scheduled maintenance

## Success Metrics

### Local Success
- ✅ MCP server starts on localhost:3001
- ✅ Health endpoint returns 200
- ✅ Adapters endpoint lists all 17 adapters
- ✅ PM2 shows process running

### Deployment Success
- ✅ GitHub Actions workflow completes
- ✅ VPS health check passes
- ✅ Public endpoint accessible
- ✅ SSL certificate valid

## Next Steps

1. **Start Local** - Get MCP server running locally
2. **Test Functionality** - Verify all endpoints work
3. **Prepare Git Repo** - Ready for GitHub deployment
4. **VPS Diagnostics** - Troubleshoot connection issues
5. **Deploy Strategy** - Choose best deployment method

## Emergency Contacts

- **Hostinger Support** - For VPS connectivity issues
- **Network Admin** - For local network problems
- **GitHub Support** - For Actions deployment issues

---

*This strategy ensures we can proceed with development while resolving VPS connectivity issues in parallel.*
