# VPS Recovery Guide

## 🚨 Current VPS Status
- **IP**: 168.231.74.29
- **SSH**: Port 22 connection refused
- **Web API**: Port 5000 not responding
- **Server**: Online (responds to ping)

## 🔧 Recovery Steps

### 1. Access via Hostinger Panel
1. Go to [hPanel.hostinger.com](https://hpanel.hostinger.com)
2. Login with your credentials
3. Navigate to **VPS** section
4. Find your VPS (168.231.74.29)

### 2. Use Browser Console
In the VPS panel, look for:
- **Console** or **Terminal** button
- **VNC Console** 
- **Emergency Console**
- **Serial Console**

This gives you direct access without SSH.

### 3. Once Connected via Console

#### Check SSH Service:
```bash
# Check if SSH is running
systemctl status sshd
# or
service ssh status

# Start SSH if stopped
systemctl start sshd
# or
service ssh start

# Check SSH port
grep Port /etc/ssh/sshd_config
```

#### Check Firewall:
```bash
# For iptables
iptables -L -n | grep 22

# For ufw
ufw status

# For firewalld
firewall-cmd --list-all
```

#### Enable SSH Access:
```bash
# Allow SSH through firewall
ufw allow 22/tcp
# or
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload
```

#### Check Memory Server:
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs smart-memory-server

# Restart if needed
pm2 restart smart-memory-server

# Check if listening on port 5000
netstat -tlnp | grep 5000
```

### 4. Reset SSH Password (if needed)
```bash
# Set new root password
passwd root
```

### 5. Alternative SSH Ports
Hostinger sometimes uses:
- Port 22 (standard)
- Port 65002 (alternative)
- Port 2222 (backup)

Check in hPanel for the correct SSH port.

## 🌐 API Access Alternative

If the Memory Server is running but SSH is blocked, you can still interact via API:

```bash
# Test endpoints
curl http://168.231.74.29:5000/api/health
curl http://168.231.74.29:5000/api/status
```

## 📞 Contact Hostinger Support
If console access doesn't work:
1. Open support ticket
2. Mention:
   - VPS IP: 168.231.74.29
   - Issue: SSH connection refused
   - Need: Console access or SSH reset

## 🚀 Once Access is Restored

1. **Secure SSH**:
   ```bash
   # Add your SSH key
   mkdir -p ~/.ssh
   echo "your-public-key" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

2. **Deploy Your Apps**:
   - Memory Server (already deployed)
   - Bella AI Assistant
   - VortexCore components

3. **Setup Monitoring**:
   ```bash
   # Install monitoring
   pm2 install pm2-logrotate
   pm2 save
   pm2 startup
   ```

Remember: The VPS is a crucial bridge from Docker to production deployment!