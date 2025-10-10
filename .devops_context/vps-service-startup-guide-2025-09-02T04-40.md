# 🚀 VPS Service Startup Guide - Current State
**Updated:** 2025-09-02T04:40:00Z  
**Post-Upgrade Status:** All services verified and operational  
**System:** Ubuntu 24.04.3 LTS (Kernel 6.8.0-79-generic)  

---

## 🎯 **CURRENT SERVICE ARCHITECTURE**

### **Active Service Stack**
```
┌─ VPS Services (168.231.74.29:2222) ─────────────────────┐
│                                                         │
│  🟢 PM2 Managed Services                               │
│  ├─ enhanced-mcp-server (ID: 0) - PID varies          │  
│  └─ lanonasis-mcp-server (ID: 1) - Port 3001          │
│                                                         │
│  🟢 System Services                                    │
│  ├─ Nginx - Ports 80, 8080, 8081                      │
│  ├─ Redis - Port 6379 (localhost)                     │
│  └─ SSH - Ports 22, 2222                              │
│                                                         │
│  🔧 Infrastructure                                     │
│  ├─ Monarx Security Agent - Port 65529                │
│  └─ SystemD DNS - Port 53                             │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 **SERVICE STARTUP SEQUENCE**

### **1. System Boot Order**
```bash
# Automatic startup sequence (via systemctl)
1. SystemD Init (PID 1)
2. SSH Services (Ports 22, 2222)  
3. DNS Resolver (Port 53)
4. Redis Server (Port 6379)
5. Nginx (Ports 80, 8080, 8081)
6. Monarx Security Agent
7. PM2 Process Manager → MCP Servers
```

### **2. PM2 Auto-Start Configuration**
```bash
# PM2 is configured to auto-start on boot
systemctl status pm2-root
● pm2-root.service - PM2 process manager
   Loaded: loaded (/etc/systemd/system/pm2-root.service; enabled)
   Active: active (running)

# Services managed by PM2:
pm2 status
┌────┬─────────────────────────┬─────────┬─────────┬───────┬──────┬────────┐
│ id │ name                    │ version │ mode    │ pid   │ ↺    │ status │
├────┼─────────────────────────┼─────────┼─────────┼───────┼──────┼────────┤
│ 0  │ enhanced-mcp-server     │ 1.0.0   │ fork    │ 963   │ 0    │ online │
│ 1  │ lanonasis-mcp-server    │ 1.0.0   │ fork    │ 964   │ 0    │ online │
└────┴─────────────────────────┴─────────┴─────────┴───────┴──────┴────────┘
```

---

## 🛠️ **MANUAL SERVICE MANAGEMENT**

### **Complete Service Restart (Safe Method)**
```bash
# 1. Connect to VPS
ssh vps

# 2. Stop services gracefully
pm2 stop all
systemctl stop nginx
systemctl stop redis-server

# 3. Start services in order
systemctl start redis-server
systemctl start nginx
pm2 start all

# 4. Verify all services
pm2 status
systemctl status nginx redis-server
curl -s http://localhost:3001/health
```

### **Individual Service Management**

#### **MCP Servers (PM2 Managed)**
```bash
# Restart specific MCP server
pm2 restart lanonasis-mcp-server    # Service on port 3001
pm2 restart enhanced-mcp-server     # Background service

# View logs
pm2 logs lanonasis-mcp-server       # Live logs
pm2 logs --lines 50                 # Last 50 lines from all services

# Service health check
curl -s http://localhost:3001/health | jq
# Expected response:
# {
#   "status": "healthy",
#   "service": "Lanonasis MCP Server (Fallback)",
#   "timestamp": "2025-09-02T04:35:41.371Z",
#   "uptime": 128.800896379,
#   "version": "1.0.0-fallback"
# }
```

#### **Nginx (Load Balancer)**
```bash
# Nginx management
systemctl restart nginx
systemctl reload nginx              # Reload config without downtime
nginx -t                           # Test configuration

# Check nginx status
curl -s http://localhost:80         # Basic web check
curl -s http://localhost:8080       # Proxy check (may show 502)
```

#### **Redis (Cache Server)**
```bash
# Redis management  
systemctl restart redis-server
redis-cli ping                     # Should return: PONG

# Redis health check
redis-cli info server | grep uptime_in_seconds
redis-cli info memory | grep used_memory_human
```

---

## 🔍 **SERVICE HEALTH MONITORING**

### **Automated Health Check Script**
```bash
#!/bin/bash
# Save as: /root/health-check.sh

echo "=== VPS SERVICE HEALTH CHECK ===" 
echo "Timestamp: $(date)"
echo

echo "🖥️  System Resources:"
uptime
free -h | head -2
df -h | head -3
echo

echo "🔧 PM2 Services:"
pm2 status
echo

echo "⚙️  System Services:"  
systemctl is-active nginx redis-server ssh
echo

echo "🌐 Service Connectivity:"
curl -s http://localhost:3001/health | jq -r '.status // "FAILED"'
redis-cli ping 2>/dev/null || echo "Redis: FAILED"
curl -s -I http://localhost:80 | head -1 || echo "Nginx: FAILED"
echo

echo "🔗 Network Ports:"
netstat -tlnp | grep LISTEN | grep -E ':(3001|8080|8081|6379|2222)' | wc -l | xargs echo "Active ports:"
```

### **Service Status Dashboard**
```bash
# Quick status check (one-liner)
echo "Services: $(pm2 list | grep online | wc -l)/2 PM2, $(systemctl is-active nginx redis-server ssh | grep -c active)/3 System"

# Detailed status
watch -n 5 'pm2 status; echo "---"; systemctl status nginx redis-server --no-pager -l'
```

---

## 🚨 **TROUBLESHOOTING PROCEDURES**

### **Common Issues & Solutions**

#### **Problem: PM2 Services Not Starting**
```bash
# Diagnosis
pm2 status                         # Check current status
pm2 logs --error                   # View error logs

# Solution
pm2 kill                          # Kill all PM2 processes
pm2 resurrect                     # Restore from saved dump
pm2 startup                       # Re-enable auto-start
pm2 save                          # Save current state

# Verify fix
pm2 status
curl -s http://localhost:3001/health
```

#### **Problem: "Module Not Found" Errors**
```bash
# Diagnosis
pm2 logs lanonasis-mcp-server | grep MODULE_NOT_FOUND

# Solution (if in fallback mode)
cd /opt/mcp-servers/lanonasis-standalone/current/
npm install                       # Reinstall dependencies
pm2 restart all

# Alternative: Use fallback server
# (Current services are running in fallback mode - this is expected)
```

#### **Problem: Port Conflicts**
```bash
# Diagnosis
netstat -tlnp | grep :3001        # Check what's using port 3001
lsof -i :3001                     # Alternative port check

# Solution
pm2 stop all                      # Stop conflicting services
kill -9 $(lsof -t -i:3001)       # Force kill port users
pm2 start all                     # Restart services
```

#### **Problem: Nginx 502 Bad Gateway**
```bash
# Diagnosis  
curl -I http://localhost:8080     # Check specific proxy port
nginx -t                          # Test nginx configuration
systemctl status nginx

# This is EXPECTED on port 8080/8081 - no backend services configured
# Port 80 should work for basic nginx functionality
```

---

## 📊 **PERFORMANCE MONITORING**

### **Resource Usage Monitoring**
```bash
# Real-time monitoring
htop                              # Interactive system monitor
pm2 monit                         # PM2 service monitoring

# Automated monitoring
echo "Memory: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk: $(df / | tail -1 | awk '{print $5}')"
echo "Load: $(uptime | awk -F'load average:' '{print $2}')"
```

### **Service Response Time**
```bash
# MCP Server response time
time curl -s http://localhost:3001/health > /dev/null

# Redis response time  
time redis-cli ping > /dev/null

# Nginx response time
time curl -s http://localhost:80 > /dev/null
```

---

## 🔄 **BACKUP & RECOVERY**

### **Pre-Startup Backup**
```bash
# Create service backup before major changes
tar -czf service-backup-$(date +%Y%m%d-%H%M).tar.gz \
  /opt/mcp-servers/ \
  ~/.pm2/ \
  /etc/nginx/ \
  /etc/systemd/system/pm2-root.service

# PM2 configuration backup
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.backup-$(date +%Y%m%d)
```

### **Service Recovery**
```bash
# Full service recovery procedure
systemctl reboot                  # Clean reboot (if needed)

# After reboot, verify auto-start
ssh vps
sleep 30                          # Wait for services to initialize
pm2 status
systemctl status nginx redis-server ssh

# If services don't auto-start
systemctl start pm2-root
pm2 resurrect
systemctl restart nginx redis-server
```

---

## 🎯 **SERVICE SEPARATION READINESS**

### **Current Service Inventory**
```bash
# Active deployments ready for separation
/opt/mcp-servers/lanonasis-standalone/current/     # Unified MCP Server
/root/fixer-initiative/                            # Payment services
/root/ghost-protocol/                              # Legacy services
/root/vortexcore-dashboard/                        # Dashboard interface

# Services that will be consolidated
1. MCP Hub - /opt/mcp-servers/ (currently active)
2. Onasis Gateway - Extract from /root/fixer-initiative/
3. Payment Hub - From /root/fixer-initiative/
4. Privacy Core - From /root/ghost-protocol/
5. Dashboard - /root/vortexcore-dashboard/
```

### **Pre-Separation Checklist**
```bash
# 1. Document current working state
pm2 save
pm2 list > pre-separation-pm2-state.txt
systemctl list-units --state=active > pre-separation-services.txt

# 2. Create full backup
tar -czf pre-separation-full-backup-$(date +%Y%m%d).tar.gz /root /opt

# 3. Test all current functionality
curl -s http://localhost:3001/health              # ✅ Should return healthy
redis-cli ping                                    # ✅ Should return PONG  
systemctl is-active nginx redis-server ssh       # ✅ All should be active

# 4. Document port usage
netstat -tlnp | grep LISTEN > pre-separation-ports.txt
```

---

## 📚 **STARTUP SCRIPT TEMPLATES**

### **Emergency Startup Script**
```bash
#!/bin/bash
# Save as: /root/emergency-startup.sh
# Usage: ./emergency-startup.sh

echo "🚨 EMERGENCY SERVICE STARTUP"
echo "Starting core services in sequence..."

# Start system services
echo "Starting Redis..."
systemctl start redis-server
sleep 2

echo "Starting Nginx..."  
systemctl start nginx
sleep 2

echo "Starting PM2 services..."
pm2 resurrect
sleep 5

echo "Verifying services..."
pm2 status
systemctl status nginx redis-server --no-pager
curl -s http://localhost:3001/health | jq -r '.status // "FAILED"'

echo "✅ Emergency startup complete"
```

### **Maintenance Mode Script**
```bash
#!/bin/bash
# Save as: /root/maintenance-mode.sh
# Usage: ./maintenance-mode.sh [start|stop]

case "$1" in
  start)
    echo "🔧 Entering maintenance mode..."
    pm2 stop all
    systemctl stop nginx
    echo "✅ Services stopped for maintenance"
    ;;
  stop)
    echo "🚀 Exiting maintenance mode..."
    systemctl start nginx
    pm2 start all
    sleep 5
    pm2 status
    echo "✅ Services restored from maintenance"
    ;;
  *)
    echo "Usage: $0 {start|stop}"
    exit 1
    ;;
esac
```

---

## 🔐 **SECURITY CONSIDERATIONS**

### **Service Security**
```bash
# Check service bindings (security)
netstat -tlnp | grep "0.0.0.0"      # Services accessible externally
netstat -tlnp | grep "127.0.0.1"    # Services on localhost only

# Current security status:
# ✅ Redis: localhost only (127.0.0.1:6379)
# ⚠️  MCP Server: external access (0.0.0.0:3001)
# ⚠️  Nginx: external access (0.0.0.0:80,8080,8081)
# ✅ SSH: configured ports only
```

### **Service Isolation**
```bash
# Process isolation check
ps aux | grep -E "(mcp|nginx|redis)" | grep -v grep

# File permission security
ls -la /opt/mcp-servers/                    # Should be root:root
ls -la ~/.pm2/                             # Should be root:root  
ls -la /etc/nginx/                         # Should be root:root
```

---

**Service Architecture Status:** ✅ Operational  
**Auto-Start Status:** ✅ Configured  
**Security Status:** ⚠️  Needs review during separation  
**Ready for Separation:** ✅ Yes, with proper backup procedures  
**Last Verified:** 2025-09-02T04:40:00Z