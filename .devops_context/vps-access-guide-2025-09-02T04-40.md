# 🔧 VPS Access Guide - Updated Post-Upgrade
**Updated:** 2025-09-02T04:40:00Z  
**Server:** 168.231.74.29:2222  
**System:** Ubuntu 24.04.3 LTS (Kernel 6.8.0-79-generic)  

---

## 🚀 **QUICK ACCESS**

### **Simple SSH Connection**
```bash
# Primary connection method (configured in ~/.ssh/config)
ssh vps

# Direct connection (backup method)
ssh -p 2222 root@168.231.74.29
```

### **Connection Details**
- **IP Address:** 168.231.74.29
- **SSH Port:** 2222 (custom, not default 22)
- **User:** root
- **Key:** ~/.ssh/id_rsa_vps.backup
- **Hostname:** srv896342.hstgr.cloud (alternative)

---

## 📋 **CURRENT SYSTEM STATUS (Post-Sept 2 Upgrade)**

### **System Information**
```bash
# System specs (updated after reboot)
OS: Ubuntu 24.04.3 LTS
Kernel: 6.8.0-79-generic (latest security kernel)
Memory: 3.8GB total, ~14% usage (554MB used)
Disk: 48GB total, 29% used (14GB used)
Load: 0.15 average (very healthy)
```

### **Active Services**
```bash
# PM2 managed services
pm2 status
┌─────────────────────────────────┬───────┬──────┬─────────────┐
│ Name                           │ ID    │ Mode │ Status      │
├─────────────────────────────────┼───────┼──────┼─────────────┤
│ enhanced-mcp-server            │ 0     │ fork │ online      │
│ lanonasis-mcp-server           │ 1     │ fork │ online      │
└─────────────────────────────────┴───────┴──────┴─────────────┘

# System services
systemctl status nginx redis-server ssh
● nginx.service - active (running)
● redis-server.service - active (running)  
● ssh.service - active (running)
```

---

## 🔧 **SERVICE MANAGEMENT**

### **MCP Servers (Primary Services)**
```bash
# Check MCP server health
curl -s http://localhost:3001/health | jq

# PM2 management
pm2 restart all          # Restart all services
pm2 logs                 # View live logs
pm2 monit                # Real-time monitoring
pm2 save                 # Save current configuration
```

### **System Services**
```bash
# Nginx (Load Balancer)
systemctl status nginx
systemctl restart nginx

# Redis (Cache)
systemctl status redis-server
redis-cli ping           # Should return PONG

# SSH Service
systemctl status ssh
```

### **Port Status Check**
```bash
# Check all listening ports
netstat -tlnp | grep LISTEN

# Key ports:
# 3001 - Lanonasis MCP Server
# 8080/8081 - Nginx proxy
# 80 - Nginx web
# 6379 - Redis (localhost only)
# 2222 - SSH (custom port)
# 22 - SSH (default port)
```

---

## 🚨 **TROUBLESHOOTING**

### **SSH Connection Issues**
```bash
# If connection fails:
ssh-keygen -R 168.231.74.29              # Remove old host keys
ssh-keygen -R [168.231.74.29]:2222       # Remove port-specific keys
ssh vps                                   # Reconnect (accept new key)

# Alternative connection methods:
ssh -i ~/.ssh/id_rsa_vps.backup -p 2222 root@168.231.74.29
ssh -p 2222 root@srv896342.hstgr.cloud
```

### **Service Recovery**
```bash
# PM2 service issues
pm2 kill                 # Kill all PM2 processes
pm2 resurrect            # Restore from saved configuration
pm2 start all            # Start all services

# System service issues  
systemctl restart nginx redis-server
```

### **System Health Check**
```bash
# One-liner health check
echo "=== VPS HEALTH CHECK ===" && \
uptime && \
free -h && \
df -h | head -3 && \
pm2 status && \
systemctl is-active nginx redis-server ssh
```

---

## 📊 **MONITORING & LOGS**

### **Service Logs**
```bash
# PM2 logs
pm2 logs --lines 20      # Last 20 lines from all services
pm2 logs lanonasis-mcp-server  # Specific service logs

# System logs
journalctl -u nginx -n 20         # Nginx logs
journalctl -u redis-server -n 20  # Redis logs
journalctl -u ssh -n 20           # SSH logs

# Live monitoring
pm2 monit                # Real-time PM2 monitoring
htop                     # System resource monitoring
```

### **Performance Monitoring**
```bash
# System performance
uptime                   # Load average
free -h                  # Memory usage
df -h                    # Disk usage
iostat                   # I/O statistics

# Service-specific
curl -s http://localhost:3001/health  # MCP server health
redis-cli info stats     # Redis statistics
```

---

## 🔄 **MAINTENANCE TASKS**

### **Regular Updates**
```bash
# System updates (run monthly)
apt update && apt upgrade -y
apt autoremove -y

# Reboot after kernel updates
reboot

# PM2 updates (run quarterly)
npm install -g pm2@latest
pm2 update
```

### **Backup Procedures**
```bash
# PM2 configuration backup
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.backup-$(date +%Y%m%d)

# Service configuration backup
tar -czf /root/services-backup-$(date +%Y%m%d).tar.gz \
  /opt/mcp-servers/ \
  /root/fixer-initiative/ \
  /root/ghost-protocol/ \
  ~/.pm2/
```

### **Security Maintenance**
```bash
# Check for security updates
apt list --upgradable | grep security

# Review active connections
ss -tulnp

# Check for unauthorized access attempts
grep "Failed password" /var/log/auth.log | tail -20
```

---

## 🎯 **SERVICE SEPARATION PREPARATION**

### **Current Service Locations**
```bash
# Active MCP servers
/opt/mcp-servers/lanonasis-standalone/current/

# Embedded Onasis Components (to be separated)
/root/fixer-initiative/ecosystem-projects/onasis-gateway/
/root/ghost-protocol/api-gateway-server.js
/root/ghost-protocol/enhanced-memory-server.js

# Supporting projects
/root/vortexcore-dashboard/
/root/fixer-initiative/
```

### **Pre-Separation Checklist**
```bash
# 1. Backup current state
pm2 save
tar -czf pre-separation-backup-$(date +%Y%m%d).tar.gz /root /opt

# 2. Document current configuration
pm2 list > current-pm2-config.txt
systemctl list-units --state=active > current-services.txt
netstat -tlnp | grep LISTEN > current-ports.txt

# 3. Test service functionality
curl -s http://localhost:3001/health
redis-cli ping
systemctl is-active nginx redis-server ssh
```

---

## 🔐 **SECURITY CONFIGURATION**

### **SSH Security**
```bash
# SSH configuration (/etc/ssh/sshd_config)
Port 2222                    # Custom port (not default 22)
PermitRootLogin yes          # Root login enabled
PasswordAuthentication yes   # Password auth enabled
PubkeyAuthentication yes     # Key-based auth enabled
```

### **Firewall Status**
```bash
# Check firewall rules
ufw status
iptables -L

# Key open ports:
# 22, 2222 (SSH)
# 80, 8080, 8081 (HTTP/Nginx)
# 3001 (MCP Server)
# 6379 (Redis - localhost only)
```

### **Access Control**
```bash
# Authorized SSH keys
cat ~/.ssh/authorized_keys

# Active SSH sessions
who
w
```

---

## 📞 **EMERGENCY PROCEDURES**

### **Complete Service Failure**
```bash
# 1. Emergency restart
systemctl reboot

# 2. After reboot, verify services
ssh vps
pm2 status
systemctl status nginx redis-server ssh

# 3. If PM2 services don't start
pm2 resurrect
pm2 start all
```

### **SSH Lockout Recovery**
```bash
# Use VPS provider console (Hostinger)
# 1. Access via web console
# 2. Fix SSH configuration
# 3. Restart SSH service: systemctl restart ssh
```

### **Data Recovery**
```bash
# Restore from backup
tar -xzf services-backup-YYYYMMDD.tar.gz -C /
pm2 resurrect
systemctl restart nginx redis-server
```

---

## 📚 **REFERENCE INFORMATION**

### **Connection Strings**
```bash
# SSH Connections
ssh vps                                    # Primary (using ~/.ssh/config)
ssh -p 2222 root@168.231.74.29           # Direct IP
ssh -p 2222 root@srv896342.hstgr.cloud   # Hostname

# Service URLs
http://168.231.74.29:3001/health          # MCP Health
http://srv896342.hstgr.cloud:8080         # Nginx Proxy
```

### **File Locations**
```bash
# Configuration Files
~/.ssh/config                             # SSH client config
/etc/ssh/sshd_config                      # SSH server config  
~/.pm2/dump.pm2                          # PM2 saved processes
/etc/nginx/nginx.conf                     # Nginx configuration

# Log Files
~/.pm2/logs/                             # PM2 service logs
/var/log/nginx/                          # Nginx logs
/var/log/auth.log                        # SSH authentication logs
```

### **Important Commands**
```bash
# System Info
hostnamectl                              # System information
systemctl --version                      # Systemd version
pm2 --version                           # PM2 version
nginx -v                                 # Nginx version
redis-server --version                   # Redis version

# Network Info
ip addr show                             # Network interfaces
ss -tulnp                               # Socket statistics
```

---

**Last Updated:** September 2, 2025 - Post system upgrade and reboot  
**Next Update:** After service separation completion  
**Maintainer:** DevOps Team  
**Status:** Production Active, Ready for Service Separation