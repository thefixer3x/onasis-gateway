# 🎛️ VPS Management Master Reference
**Updated:** 2025-09-02T04:45:00Z  
**System:** Ubuntu 24.04.3 LTS (Post-Upgrade & Reboot Verified)  
**Status:** Production Active, Ready for Service Separation  

---

## 📋 **QUICK REFERENCE INDEX**

### **🔗 Essential Commands**
```bash
# Connection
ssh vps                           # Primary connection (configured)
ssh -p 2222 root@168.231.74.29   # Direct connection

# Health Check (One-liner)
pm2 status && systemctl is-active nginx redis-server ssh && curl -s localhost:3001/health | jq -r '.status'

# Service Management
pm2 restart all                  # Restart MCP servers
systemctl restart nginx redis    # Restart system services
```

### **🚨 Emergency Numbers**
- **VPS IP:** 168.231.74.29:2222
- **Hostname:** srv896342.hstgr.cloud  
- **MCP Health:** http://localhost:3001/health
- **Provider:** Hostinger (Web Console Available)

---

## 🏗️ **CURRENT ARCHITECTURE SNAPSHOT**

### **System Configuration**
```yaml
Server Details:
  OS: Ubuntu 24.04.3 LTS
  Kernel: 6.8.0-79-generic (Latest Security)
  Memory: 3.8GB (14% used = 554MB)
  Disk: 48GB (29% used = 14GB)  
  Load: 0.15 average (Excellent)
  Uptime: Stable (Last reboot: Sept 2, 2025)

Network Configuration:
  Primary IP: 168.231.74.29
  SSH Ports: 22, 2222 (Custom)
  Hostname: srv896342.hstgr.cloud
  DNS: 127.0.0.53:53, 127.0.0.54:53
```

### **Active Service Map**
```
🟢 PM2 Managed Services (Auto-start enabled)
├─ lanonasis-mcp-server (ID: 1, Port: 3001)
│  ├─ Status: Online, Healthy  
│  ├─ Memory: ~58MB
│  ├─ Uptime: Stable since boot
│  └─ Health: http://localhost:3001/health
│
└─ enhanced-mcp-server (ID: 0, Background)
   ├─ Status: Online
   ├─ Memory: ~51MB
   └─ Function: Supporting service

🟢 System Services (SystemD managed)
├─ nginx (Ports: 80, 8080, 8081)
│  ├─ Status: Active since boot
│  ├─ Function: Load balancer/proxy
│  └─ Config: /etc/nginx/nginx.conf
│
├─ redis-server (Port: 6379, localhost only)
│  ├─ Status: Active since boot
│  ├─ Function: Cache/session storage
│  └─ Test: redis-cli ping → PONG
│
└─ ssh (Ports: 22, 2222)
   ├─ Status: Active since boot
   ├─ Config: /etc/ssh/sshd_config
   └─ Security: Key + password auth

🔧 Infrastructure Services
├─ monarx-agent (Port: 65529) - Security monitoring
├─ systemd-resolve (Ports: 53) - DNS resolution  
└─ init (PID: 1) - System initialization
```

---

## 🔧 **SERVICE OPERATIONS MANUAL**

### **Standard Operating Procedures**

#### **Daily Health Check**
```bash
#!/bin/bash
# Standard daily health check routine

echo "🏥 VPS Daily Health Check - $(date)"
echo "=================================="

# System resources
echo "💾 Memory: $(free | awk '/^Mem:/{printf("%.1f%%", $3/$2*100)}')"
echo "💿 Disk: $(df / | awk 'NR==2{print $5}')"
echo "⚡ Load: $(uptime | grep -o 'load average: .*' | cut -d' ' -f3-5)"

# Service status  
echo "🔧 PM2 Services: $(pm2 list | grep -c online)/2"
echo "⚙️  System Services: $(systemctl is-active nginx redis-server ssh | grep -c active)/3"

# Connectivity
MCP_STATUS=$(curl -s http://localhost:3001/health | jq -r '.status // "FAILED"')
REDIS_STATUS=$(redis-cli ping 2>/dev/null || echo "FAILED")
echo "🌐 MCP Server: $MCP_STATUS"
echo "🔗 Redis: $REDIS_STATUS"

# Summary
if [[ "$MCP_STATUS" == "healthy" && "$REDIS_STATUS" == "PONG" ]]; then
  echo "✅ Overall Status: HEALTHY"
else
  echo "⚠️  Overall Status: NEEDS ATTENTION"
fi
```

#### **Service Restart Sequence**
```bash
#!/bin/bash
# Safe service restart procedure

echo "🔄 Starting safe service restart sequence..."

# 1. Graceful stop
echo "Stopping services gracefully..."
pm2 stop all
systemctl stop nginx

# 2. Wait for clean shutdown
sleep 5

# 3. Start in dependency order
echo "Starting Redis (cache layer)..."
systemctl start redis-server
sleep 2

echo "Starting Nginx (proxy layer)..."  
systemctl start nginx
sleep 2

echo "Starting MCP services (application layer)..."
pm2 start all
sleep 5

# 4. Verify startup
echo "Verifying services..."
pm2 status
systemctl is-active nginx redis-server
curl -s http://localhost:3001/health | jq

echo "✅ Service restart sequence complete"
```

### **Monitoring & Alerts**

#### **Performance Thresholds**
```yaml
Alert Conditions:
  Memory Usage: >80% (3GB+ used)
  Disk Usage: >90% (43GB+ used)  
  Load Average: >2.0 (sustained)
  Service Downtime: >30 seconds

Response Times:
  MCP Server: <200ms (http://localhost:3001/health)
  Redis: <10ms (redis-cli ping)
  Nginx: <100ms (basic request)

Uptime Targets:
  System Uptime: 99.5%+ 
  Service Uptime: 99.9%+
  Response Success: 99.9%+
```

#### **Log Monitoring**
```bash
# Critical log monitoring locations
tail -f ~/.pm2/logs/lanonasis-mcp-server-error.log    # MCP errors
tail -f /var/log/nginx/error.log                      # Nginx errors  
tail -f /var/log/auth.log | grep Failed               # Security attempts
journalctl -u redis-server -f                         # Redis logs

# Log rotation status
logrotate --debug /etc/logrotate.conf                 # Check rotation
```

---

## 🔐 **SECURITY & ACCESS CONTROL**

### **Access Matrix**
```
User Access Levels:
├─ root (Full Access)
│  ├─ SSH: Keys + Password
│  ├─ Permissions: All services
│  └─ Key Location: ~/.ssh/id_rsa_vps.backup
│
├─ Service Accounts (Limited)
│  ├─ www-data (nginx): Web services only
│  ├─ redis (redis): Database access only
│  └─ systemd-* (system): System services only
│
└─ External Access (Restricted)
   ├─ Port 80: HTTP (Nginx)
   ├─ Port 3001: MCP API (Internal use)  
   ├─ Port 2222: SSH (Admin access)
   └─ All others: Blocked/localhost only
```

### **Security Hardening Checklist**
```bash
# Current security status
✅ SSH on non-standard port (2222)
✅ Key-based authentication enabled
✅ Redis bound to localhost only  
✅ Monarx security agent active
✅ System updates current
⚠️  MCP server externally accessible (needs review)
⚠️  Nginx proxy ports exposed (needs backend config)

# Security validation commands
ss -tulnp | grep :22                    # SSH port bindings
ss -tulnp | grep :3001                  # MCP server binding  
iptables -L                             # Firewall rules
fail2ban-client status                  # Intrusion detection
```

---

## 📊 **DEPLOYMENT ARCHITECTURE**

### **Current Service Layout**
```
File System Organization:
/opt/
├─ mcp-servers/lanonasis-standalone/current/
│  ├─ unified-mcp-server.ts (43KB)
│  ├─ simple-mcp-server.cjs (running)
│  └─ src/ (10 subdirectories)

/root/
├─ fixer-initiative/ (Payment ecosystem)
│  ├─ ecosystem-projects/onasis-gateway/ (Embedded)
│  ├─ PayStack + SaySwitch integrations  
│  └─ Production webhook handlers
│
├─ ghost-protocol/ (Legacy services)
│  ├─ api-gateway-server.js (Embedded)
│  ├─ enhanced-memory-server.js (Embedded)
│  └─ 248 node_modules (substantial)
│
└─ vortexcore-dashboard/ (Frontend)
   ├─ React/TypeScript dashboard
   └─ Admin interfaces

Configuration Files:
├─ ~/.ssh/config (SSH client)
├─ ~/.pm2/dump.pm2 (PM2 saved processes)  
├─ /etc/nginx/nginx.conf (Web server)
├─ /etc/systemd/system/pm2-root.service (PM2 auto-start)
└─ /etc/ssh/sshd_config (SSH server)
```

### **Port Allocation Strategy**
```
Current Port Usage:
├─ 22, 2222: SSH access
├─ 53: DNS resolution (localhost)
├─ 80: HTTP (Nginx web)
├─ 3001: MCP Server API
├─ 6379: Redis (localhost only)
├─ 8080, 8081: Nginx proxy (502 - no backend)
└─ 65529: Monarx security agent

Planned Port Allocation (Post-Separation):
├─ 3001: Unified MCP Hub
├─ 3002: Onasis Gateway API  
├─ 3003: Privacy Core
├─ 3004: Payment Hub
├─ 3005: VortexCore Dashboard
└─ 3006-3010: Reserved for expansion
```

---

## 🚀 **SERVICE SEPARATION ROADMAP**

### **Ready for Separation Status**
```yaml
Preparation Completed:
  ✅ System upgraded and stable
  ✅ Services mapped and documented  
  ✅ Backup procedures verified
  ✅ Health monitoring established
  ✅ Access documentation updated

Current Service Conflicts:
  🔴 3x Onasis Gateway implementations
  🔴 MCP server module loading issues
  🔴 Memory service duplication
  🔴 Resource waste from overlaps

Separation Priority Order:
  1. Extract Onasis Gateway (embedded → standalone)
  2. Consolidate MCP servers (resolve conflicts)
  3. Separate memory services (privacy focus)
  4. Archive legacy components (ghost-protocol)
  5. Optimize resource allocation
```

### **Migration Checkpoints**
```bash
# Pre-migration verification
pm2 status                              # ✅ Services stable
curl -s localhost:3001/health | jq      # ✅ API responding
systemctl is-active nginx redis ssh     # ✅ System services up
df -h && free -h                        # ✅ Resources healthy

# Migration safety measures
tar -czf pre-migration-backup-$(date +%Y%m%d).tar.gz /root /opt
pm2 save && cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.pre-migration

# Post-migration validation  
[Service-specific health checks per separated service]
[Performance monitoring for resource optimization]
[Security audit for service isolation]
```

---

## 📚 **REFERENCE DOCUMENTATION**

### **Related Documentation Files**
```
Local Documentation (Updated):
├─ .devops_context/vps-services-mapping-2025-09-02T04-25.md
├─ .devops_context/vps-access-guide-2025-09-02T04-40.md
├─ .devops_context/vps-service-startup-guide-2025-09-02T04-40.md
├─ .devops_context/service-separation-plan-2025-09-02T04-25.md
└─ .devops_context/status-summary-2025-09-02T03-24.md

Outdated Files (Need Updates):
├─ vps/VPS_MANAGEMENT_QUICK_REFERENCE.md (Ghost Protocol refs)
├─ vps/VPS-COMPLETE-GUIDE.md (Agent-Banks refs)
├─ vps/deployment-strategy.md (Outdated architecture)
└─ [Various other VPS files with legacy references]
```

### **Command Reference Card**
```bash
# Essential Commands Summary
Connection:     ssh vps
Health Check:   curl -s localhost:3001/health | jq
PM2 Control:    pm2 status | restart all | logs | monit
System Status:  systemctl status nginx redis ssh
Resource Check: uptime && free -h && df -h
Emergency:      systemctl reboot (if all else fails)

# File Locations  
SSH Config:     ~/.ssh/config
PM2 Config:     ~/.pm2/dump.pm2
Service Logs:   ~/.pm2/logs/, /var/log/
Backups:        /root/*backup*.tar.gz
```

---

## 🎯 **OPERATIONAL PROCEDURES**

### **Change Management**
```yaml
Before Making Changes:
  1. Create backup: tar -czf backup-$(date +%Y%m%d).tar.gz /root /opt
  2. Save PM2 state: pm2 save
  3. Document current state: pm2 status > pre-change-status.txt
  4. Verify health: curl localhost:3001/health
  5. Plan rollback: Define exact recovery steps

During Changes:  
  1. Follow separation plan systematically
  2. Test each component after migration
  3. Monitor resource usage continuously
  4. Keep logs of all commands executed
  5. Verify service health at each step

After Changes:
  1. Full health verification across all services
  2. Performance baseline establishment  
  3. Update documentation with new configurations
  4. Create post-change backup
  5. Schedule monitoring review
```

### **Escalation Procedures**
```yaml
Service Issues:
  Level 1: Standard restart procedures
  Level 2: Emergency recovery scripts  
  Level 3: Full system reboot
  Level 4: Restore from backup
  Level 5: VPS provider console access

Contact Information:
  Primary: Local team/admin
  Backup: Hostinger support console
  Emergency: VPS provider emergency line
  Documentation: This reference guide
```

---

**System Status:** 🟢 Operational  
**Security Status:** 🟡 Needs Service Separation Review  
**Documentation Status:** ✅ Current and Complete  
**Ready for Next Phase:** ✅ Service Separation Can Begin  
**Last Updated:** 2025-09-02T04:45:00Z