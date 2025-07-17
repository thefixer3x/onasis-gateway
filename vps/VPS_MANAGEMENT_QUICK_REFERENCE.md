# VPS Management Quick Reference Guide

**Checkpoint Date:** July 10, 2025  
**System Status:** Production Active  
**Services:** Ghost Protocol Memory + Chat APIs  

## Emergency Commands

### 🚨 Service Recovery
```bash
# Quick service restart
sudo systemctl restart ghost-protocol-memory ghost-protocol-chat

# Force kill and restart if hung
sudo pkill -f "enhanced-memory-server.js" && sudo pkill -f "simple-server.js"
sleep 3
sudo systemctl start ghost-protocol-memory ghost-protocol-chat
```

### 📊 Instant Health Check
```bash
# One-liner system check
echo "=== GHOST PROTOCOL STATUS ===" && \
sudo systemctl is-active ghost-protocol-memory ghost-protocol-chat && \
curl -s http://localhost:3000/health && echo && \
curl -s http://localhost:5000/status && echo
```

---

## Daily Operations

### 🔍 Service Status Check
```bash
# Detailed status
sudo systemctl status ghost-protocol-memory ghost-protocol-chat

# Just active/inactive
sudo systemctl is-active ghost-protocol-memory ghost-protocol-chat

# Service uptime
sudo systemctl show ghost-protocol-memory --property=ActiveEnterTimestamp
```

### 📋 Log Monitoring
```bash
# Live logs (last 20 lines + follow)
sudo journalctl -u ghost-protocol-memory -u ghost-protocol-chat -n 20 -f

# Today's errors only
sudo journalctl -u ghost-protocol-memory -u ghost-protocol-chat --since today --priority=err

# Service performance logs
sudo journalctl -u ghost-protocol-memory --since "1 hour ago" | grep -E "(memory|performance|slow)"
```

### 💾 Database Operations
```bash
# Quick database backup
cp /root/ghost-protocol/storage/database.db /root/ghost-protocol/storage/backup-$(date +%Y%m%d-%H%M).db

# Database size check
ls -lh /root/ghost-protocol/storage/database.db

# Database integrity check
sqlite3 /root/ghost-protocol/storage/database.db "PRAGMA integrity_check;"
```

---

## Configuration Management

### 📝 Edit Service Configuration
```bash
# Memory service config
sudo nano /etc/systemd/system/ghost-protocol-memory.service

# Chat service config  
sudo nano /etc/systemd/system/ghost-protocol-chat.service

# Environment variables
sudo nano /root/ghost-protocol/vps_config.env

# Apply changes
sudo systemctl daemon-reload
sudo systemctl restart ghost-protocol-memory ghost-protocol-chat
```

### 🔧 Performance Tuning
```bash
# Check current resource usage
ps aux | grep -E "(enhanced-memory-server|simple-server)" | grep -v grep

# Memory usage
free -h && echo "Ghost Protocol processes:" && \
ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem | grep -E "(enhanced-memory-server|simple-server)"

# Port utilization
ss -tlnp | grep -E ":3000|:5000"
```

---

## Troubleshooting

### 🔧 Common Fixes

#### Port Already in Use
```bash
# Find process using port 3000/5000
sudo lsof -i :3000
sudo lsof -i :5000

# Kill specific process
sudo kill -9 $(lsof -ti:3000)
sudo kill -9 $(lsof -ti:5000)
```

#### Service Won't Start
```bash
# Check for config errors
sudo systemctl status ghost-protocol-memory -l
sudo journalctl -u ghost-protocol-memory -n 50 --no-pager

# Test manual start
cd /root/ghost-protocol
node enhanced-memory-server.js  # Press Ctrl+C to stop
```

#### High Memory Usage
```bash
# Clear Node.js cache and restart
sudo systemctl stop ghost-protocol-memory ghost-protocol-chat
sudo rm -rf /root/ghost-protocol/node_modules/.cache
sudo systemctl start ghost-protocol-memory ghost-protocol-chat
```

#### Database Corruption
```bash
# Backup current database
mv /root/ghost-protocol/storage/database.db /root/ghost-protocol/storage/corrupted-$(date +%Y%m%d).db

# Let service recreate database
sudo systemctl restart ghost-protocol-memory

# Check if working
curl http://localhost:3000/health
```

---

## Network & Security

### 🌐 Network Diagnostics
```bash
# Test external connectivity
curl -I http://your-domain:3000/health
curl -I http://your-domain:5000/status

# Check firewall rules
sudo ufw status numbered

# Network interface status
ip addr show | grep -E "(inet|UP)"
```

### 🔒 Security Checks
```bash
# Check failed login attempts
sudo grep "Failed password" /var/log/auth.log | tail -10

# Active connections to Ghost Protocol ports
sudo netstat -an | grep -E ":3000|:5000" | grep ESTABLISHED

# File permissions check
ls -la /root/ghost-protocol/
ls -la /etc/systemd/system/ghost-protocol-*
```

---

## Deployment & Updates

### 📦 Deploy New Version
```bash
# Stop services
sudo systemctl stop ghost-protocol-memory ghost-protocol-chat

# Backup current version
cd /root
tar -czf ghost-protocol-backup-$(date +%Y%m%d-%H%M).tar.gz ghost-protocol/

# Deploy new files (replace with your deployment method)
# [Your deployment steps here]

# Restart services
sudo systemctl start ghost-protocol-memory ghost-protocol-chat

# Verify deployment
curl http://localhost:3000/health && curl http://localhost:5000/status
```

### 🔄 Rollback Procedure
```bash
# Stop current services
sudo systemctl stop ghost-protocol-memory ghost-protocol-chat

# Restore from backup
cd /root
tar -xzf ghost-protocol-backup-YYYYMMDD-HHMM.tar.gz

# Restart services
sudo systemctl start ghost-protocol-memory ghost-protocol-chat

# Verify rollback
sudo systemctl status ghost-protocol-memory ghost-protocol-chat
```

---

## Monitoring & Alerts

### 📈 Performance Metrics
```bash
# CPU and Memory usage over time
top -b -n 1 | grep -E "(ghost-protocol|enhanced-memory|simple-server)"

# Disk I/O for database
sudo iotop -a -o | grep database

# Network connections
sudo ss -tuln | grep -E ":3000|:5000"
```

### ⚠️ Alert Conditions
Monitor these conditions and set up alerts:

```bash
# Service down check
systemctl is-failed ghost-protocol-memory ghost-protocol-chat

# High memory usage (>80%)
ps -o pid,ppid,cmd,%mem --sort=-%mem | awk '$4>80 {print}'

# Database size growth (>1GB)
find /root/ghost-protocol/storage -name "*.db" -size +1G

# Error rate check (>10 errors in last hour)
journalctl -u ghost-protocol-memory --since "1 hour ago" --priority=err | wc -l
```

---

## Backup & Recovery

### 💾 Automated Backup Script
Create `/root/scripts/ghost-protocol-backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/root/backups/ghost-protocol"
DATE=$(date +%Y%m%d-%H%M)

mkdir -p $BACKUP_DIR

# Backup database
cp /root/ghost-protocol/storage/database.db $BACKUP_DIR/database-$DATE.db

# Backup configuration
cp /root/ghost-protocol/vps_config.env $BACKUP_DIR/config-$DATE.env

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.env" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 🔄 Recovery Procedures
```bash
# List available backups
ls -la /root/backups/ghost-protocol/

# Restore database
sudo systemctl stop ghost-protocol-memory
cp /root/backups/ghost-protocol/database-YYYYMMDD-HHMM.db /root/ghost-protocol/storage/database.db
sudo systemctl start ghost-protocol-memory

# Restore configuration
cp /root/backups/ghost-protocol/config-YYYYMMDD-HHMM.env /root/ghost-protocol/vps_config.env
sudo systemctl restart ghost-protocol-memory ghost-protocol-chat
```

---

## Performance Optimization

### ⚡ Quick Performance Boost
```bash
# Optimize database
sqlite3 /root/ghost-protocol/storage/database.db "VACUUM; PRAGMA optimize;"

# Clear old logs
sudo journalctl --vacuum-time=7d

# Restart services for fresh memory
sudo systemctl restart ghost-protocol-memory ghost-protocol-chat
```

### 📊 Resource Monitoring
```bash
# Real-time resource monitoring
watch -n 2 'ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -10'

# Memory usage trend
echo "Memory usage every 5 seconds (Press Ctrl+C to stop):"
while true; do
  date && ps -o pid,cmd,%mem | grep -E "(enhanced-memory|simple-server)" | grep -v grep
  sleep 5
done
```

---

## Emergency Contacts & Escalation

### 📞 Issue Escalation Path
1. **Level 1**: Local troubleshooting (this guide)
2. **Level 2**: Check GitHub repository issues
3. **Level 3**: Contact system administrator
4. **Level 4**: Emergency deployment rollback

### 🆘 Emergency Shutdown
```bash
# Complete shutdown (if needed)
sudo systemctl stop ghost-protocol-memory ghost-protocol-chat
sudo systemctl disable ghost-protocol-memory ghost-protocol-chat

# Emergency process kill
sudo pkill -f "ghost-protocol"
sudo pkill -f "enhanced-memory-server"
sudo pkill -f "simple-server"
```

### ✅ Service Restoration
```bash
# Full service restoration
sudo systemctl enable ghost-protocol-memory ghost-protocol-chat
sudo systemctl start ghost-protocol-memory ghost-protocol-chat
sudo systemctl status ghost-protocol-memory ghost-protocol-chat

# Verify all endpoints
curl http://localhost:3000/health && echo "Memory API: OK"
curl http://localhost:5000/status && echo "Chat API: OK"
```

---

## Maintenance Checklist

### ✅ Daily (Automated)
- [ ] Service health check
- [ ] Error log review
- [ ] Resource usage check
- [ ] Endpoint availability test

### ✅ Weekly (Manual)
- [ ] Full log review
- [ ] Database backup verification
- [ ] Performance metrics analysis
- [ ] Security log review

### ✅ Monthly (Scheduled)
- [ ] System updates
- [ ] Database optimization
- [ ] Log cleanup
- [ ] Backup rotation
- [ ] Security audit

---

**Quick Command Summary:**
```bash
# Status:    sudo systemctl status ghost-protocol-*
# Restart:   sudo systemctl restart ghost-protocol-*
# Logs:      sudo journalctl -u ghost-protocol-* -f
# Health:    curl localhost:3000/health && curl localhost:5000/status
# Backup:    cp /root/ghost-protocol/storage/database.db backup-$(date +%Y%m%d).db
```

**Emergency Phone Tree**: [Your organization's contact information]  
**Last Updated**: July 10, 2025  
**Next Review**: August 10, 2025