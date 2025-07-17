# VPS Emergency Mode Recovery Guide

## Current Status
- **VPS**: 168.231.74.29 (srv896342.hstgr.cloud)
- **Issue**: Stuck in emergency mode
- **SSH Port**: 2222
- **Services Down**: All SefTechHub services (ports 9991-9998, 5000, 9985)

## Emergency Mode Recovery Steps

### Option 1: Hostinger Control Panel Recovery
1. **Login to Hostinger hPanel**
   - Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
   - Navigate to VPS → Manage

2. **Use VPS Console**
   - Click "Open Console" or "VNC Console"
   - This bypasses SSH and connects directly

3. **Emergency Mode Commands**
   ```bash
   # Check what caused emergency mode
   journalctl -xb
   
   # Check filesystem errors
   fsck -f /dev/sda1  # (or your root partition)
   
   # Check disk space
   df -h
   
   # Check mount issues
   mount -a
   
   # Try to continue boot
   systemctl default
   ```

### Option 2: Force Restart
1. **Hard Restart** via Hostinger panel
   - VPS Management → Power → Force Restart
   - This is like pulling the power plug

2. **Check Boot Process**
   - Watch console during boot
   - Note any filesystem errors

### Option 3: If Filesystem is Corrupted
```bash
# Boot from rescue mode (if available in Hostinger)
# Or use emergency shell

# Check filesystem
fsck -y /dev/sda1  # Auto-fix filesystem errors

# Check critical directories
ls -la /
ls -la /var
ls -la /tmp

# Check disk space
df -h

# If /tmp is full, clean it
rm -rf /tmp/*
```

## Common Emergency Mode Causes

### 1. Disk Full (Most Common)
```bash
# Check disk usage
df -h

# Find large files
du -h --max-depth=1 / | sort -hr

# Clean common culprits
rm -rf /tmp/*
rm -rf /var/log/*.log
rm -rf /var/cache/*
```

### 2. Corrupted /etc/fstab
```bash
# Check fstab
cat /etc/fstab

# Fix if corrupted
nano /etc/fstab
```

### 3. Service Failures
```bash
# Check failed services
systemctl --failed

# Reset failed services
systemctl reset-failed
```

## Recovery Commands for SefTechHub Services

### After System Recovery
```bash
# Check if our services are configured
ls -la /etc/systemd/system/seftechub*

# Check service status
systemctl status seftechub-*

# Restart all SefTechHub services
cd /root/agent-banks/
./restart-all-services.sh

# Or manually restart
systemctl restart seftechub-api-gateway
systemctl restart seftechub-admin
systemctl restart seftechub-logistics
systemctl restart seftechub-store-b2b
systemctl restart seftechub-sub-pro
systemctl restart seftechub-retail
systemctl restart seftechub-bank-insight
systemctl restart seftechub-task-manager
systemctl restart seftechub-verification

# Check unified frontend
cd /root/agent-banks/
python3 unified_frontend.py &
```

### Port Check After Recovery
```bash
# Check if services are listening
netstat -tlnp | grep -E ":(2222|5000|998[5-8]|999[1-8])"

# Or with ss
ss -tlnp | grep -E ":(2222|5000|998[5-8]|999[1-8])"
```

## Prevention for Future

### 1. Disk Space Monitoring
```bash
# Add to crontab
echo "0 */6 * * * df -h | grep -E '9[0-9]%' && echo 'Disk usage high' | mail -s 'VPS Alert' your-email@domain.com" | crontab -
```

### 2. Automatic Log Rotation
```bash
# Check logrotate
cat /etc/logrotate.conf

# Add custom logrotate for SefTechHub
cat > /etc/logrotate.d/seftechub << EOF
/root/agent-banks/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
```

### 3. Service Auto-Recovery
```bash
# Add auto-restart to services
for service in seftechub-*; do
    systemctl edit $service --full
    # Add: Restart=always
    # Add: RestartSec=10
done
```

## Quick Recovery Script

Create this script for future emergencies:

```bash
#!/bin/bash
# /root/emergency-recovery.sh

echo "=== SefTechHub Emergency Recovery ==="

# Check disk space
echo "Checking disk space..."
df -h

# Clean temporary files
echo "Cleaning temporary files..."
rm -rf /tmp/*
find /var/log -name "*.log" -mtime +7 -delete

# Check services
echo "Checking services..."
systemctl --failed

# Restart SefTechHub services
echo "Restarting SefTechHub services..."
cd /root/agent-banks/
if [ -f restart-all-services.sh ]; then
    ./restart-all-services.sh
else
    # Manual restart
    for port in 9991 9992 9993 9994 9995 9996 9997 9998 9985; do
        echo "Starting service on port $port..."
        # Add your service start commands here
    done
fi

# Start unified frontend
echo "Starting unified frontend..."
cd /root/agent-banks/
nohup python3 unified_frontend.py > unified_frontend.log 2>&1 &

echo "Recovery complete!"
echo "Checking ports..."
ss -tlnp | grep -E ":(2222|5000|998[5-8]|999[1-8])"
```

## Contact Info
- **Hostinger Support**: If recovery fails, contact Hostinger VPS support
- **Backup Plan**: Services can run serverless via Netlify + Neon for now