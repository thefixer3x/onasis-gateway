# 🤖 Agent-Banks VPS Complete Guide

```
╔══════════════════════════════════════════════════════════════╗
║                 🤖 Agent-Banks VPS Enhanced                  ║
║           Personal AI Assistant Manager + SSH Tools          ║
╚══════════════════════════════════════════════════════════════╝
```

## 🚀 Quick Start

```bash
vps help        # Show this beautiful help system
vps test        # Test connection with auto-fix (start here!)
vps status      # Check if Agent-Banks is running
vps ssh         # Connect to your VPS
```

---

## 🔧 QUICK FIXES
*Use these when SSH acts up or you need immediate diagnostics*

### `vps test`
**What it does**: Tests VPS connection and automatically fixes common SSH issues
**When to use**: 
- First command to run when having connection problems
- Daily connectivity check
- After changing SSH settings
**Example**: 
```bash
vps test
# ✅ Network reachable
# ✅ SSH connection working
```

### `vps ssh-fix`
**What it does**: Runs comprehensive SSH setup with fallback connections
**When to use**:
- SSH completely broken
- After VPS restart or reinstall
- Setting up SSH for the first time
**What it fixes**:
- SSH key permissions
- Host key verification
- Connection timeouts
- Creates backup connection methods
**Example**:
```bash
vps ssh-fix
# 📦 Creating SSH setup...
# ✅ SSH connection fixed!
```

### `vps ssh-backup`
**What it does**: Backs up all SSH configurations and creates quick access aliases
**When to use**:
- Before making SSH changes
- Weekly maintenance
- Before VPS updates
**Creates**:
- Timestamped backups in `~/.ssh/backups/`
- Shell aliases: `vps`, `vps-test`, `vps-copy`
**Example**:
```bash
vps ssh-backup
# ✅ Backed up: ~/.ssh/config
# ✅ SSH aliases activated
```

### `vps ssh-info`
**What it does**: Shows all available SSH connection methods and troubleshooting commands
**When to use**:
- Learning available connection options
- Need quick reference for manual SSH
- Sharing connection details with others
**Shows**:
- Primary connection: `ssh ghost-vps`
- Backup methods with different ports
- Quick fix commands
**Example**:
```bash
vps ssh-info
# 📋 SSH Connection Information:
#   Primary: ssh ghost-vps
#   Backup:  ssh -p 22 root@168.231.74.29
```

---

## 🚀 DEPLOYMENT COMMANDS
*For managing your Agent-Banks AI assistant*

### `vps deploy`
**What it does**: Complete deployment of Agent-Banks from local code to running service
**When to use**:
- First-time setup
- After major code changes
- Full system refresh
**Process**:
1. Creates deployment package
2. Uploads to VPS
3. Installs dependencies
4. Starts service
**Example**:
```bash
vps deploy
# 📦 Creating package...
# ⬆️  Uploading to VPS...
# 🚀 Agent-Banks deployed!
```

### `vps package`
**What it does**: Creates deployment package locally without uploading
**When to use**:
- Testing packaging process
- Creating backup before deployment
- Preparing for manual upload
**Creates**: Timestamped package in `/tmp/`
**Example**:
```bash
vps package
# 📦 Package created: /tmp/agent-banks-20250712_215500
```

---

## ⚙️ SYSTEM COMMANDS
*Control the Agent-Banks service on your VPS*

### `vps start`
**What it does**: Starts the Agent-Banks service in background
**When to use**:
- After stopping service for maintenance
- After VPS reboot
- Initial service startup
**Runs**: `python3 unified_frontend.py` in background with logging
**Example**:
```bash
vps start
# 🚀 Starting Agent-Banks...
# ✅ Service started
```

### `vps stop`
**What it does**: Gracefully stops the Agent-Banks service
**When to use**:
- Before deployment updates
- System maintenance
- Troubleshooting service issues
**Process**: Finds and kills `unified_frontend.py` process
**Example**:
```bash
vps stop
# 🛑 Stopping Agent-Banks...
# ✅ Stopped
```

### `vps restart`
**What it does**: Stops and starts the service (with 2-second pause)
**When to use**:
- After configuration changes
- Service acting sluggish
- Memory cleanup
**Process**: `stop` → wait 2 seconds → `start`
**Example**:
```bash
vps restart
# 🛑 Stopping Agent-Banks...
# ⏸️  Waiting...
# 🚀 Starting Agent-Banks...
```

### `vps status`
**What it does**: Shows comprehensive status of VPS and Agent-Banks service
**When to use**:
- Daily health check
- Before making changes
- Troubleshooting issues
**Shows**:
- VPS connectivity
- Service running status
- Web interface URL
- File count in deployment
**Example**:
```bash
vps status
# 📊 Agent-Banks Status:
#   VPS: srv896342.hstgr.cloud (168.231.74.29)
#   Web: http://srv896342.hstgr.cloud:5000
#   Status: ✅ RUNNING
```

### `vps logs`
**What it does**: Shows recent service logs (last 20 lines)
**When to use**:
- Debugging service issues
- Checking for errors
- Monitoring activity
**Shows**: Contents of `/root/agent-banks/service.log`
**Example**:
```bash
vps logs
# 📋 Viewing logs...
# [2025-07-12 21:55:00] Starting Agent-Banks...
# [2025-07-12 21:55:01] Server running on port 5000
```

---

## 🌐 CONNECTION COMMANDS
*Direct access to your VPS*

### `vps ssh`
**What it does**: Opens interactive SSH session with automatic fallback
**When to use**:
- Manual VPS administration
- File management
- Advanced troubleshooting
**Features**:
- Tries optimized `ghost-vps` connection first
- Falls back to direct IP if needed
- Inherits all SSH config optimizations
**Example**:
```bash
vps ssh
# Connecting to VPS...
root@srv896342:~# 
```

### `vps web`
**What it does**: Opens Agent-Banks web interface in browser
**When to use**:
- Accessing the AI assistant web UI
- Testing if web service is running
- Daily usage of Agent-Banks
**Opens**: `http://srv896342.hstgr.cloud:5000`
**Example**:
```bash
vps web
# 🌐 Opening web interface...
# Opens: http://srv896342.hstgr.cloud:5000
```

---

## 🔧 ADVANCED TROUBLESHOOTING

### Connection Issues
```bash
# Quick connection test
vps test

# If test fails, run full SSH setup
vps ssh-fix

# For persistent issues, check these manually:
ping -c 4 168.231.74.29              # Network connectivity
ssh -vvv ghost-vps exit              # Verbose SSH debug
ssh -o ControlPath=none ghost-vps    # Bypass connection multiplexing
```

### Service Issues
```bash
# Check service status
vps status

# View recent logs for errors
vps logs

# Full restart cycle
vps stop && sleep 5 && vps start

# Manual service check via SSH
vps ssh
ps aux | grep unified_frontend
```

### Emergency Recovery
```bash
# If all SSH methods fail:
# 1. Use VPS provider's web console
# 2. Run: systemctl restart ssh
# 3. Check: ufw status (firewall)

# If Agent-Banks won't start:
vps ssh
cd /root/agent-banks
python3 unified_frontend.py  # Run manually to see errors
```

---

## 📋 DAILY WORKFLOWS

### Morning Check
```bash
vps status        # Overall health
vps web          # Open AI assistant
```

### Deployment Update
```bash
vps ssh-backup   # Backup configs
vps stop         # Stop service
vps deploy       # Deploy new version
vps status       # Verify success
```

### Troubleshooting Session
```bash
vps test         # Test connectivity
vps logs         # Check for errors
vps ssh          # Manual investigation
```

### Weekly Maintenance
```bash
vps ssh-backup   # Backup SSH configs
vps ssh          # Connect for manual updates
apt update && apt upgrade -y
exit
vps restart      # Restart service
```

---

## 🎯 Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `vps test` | Test & auto-fix SSH | Connection problems |
| `vps status` | Check service health | Daily monitoring |
| `vps ssh` | Connect to VPS | Manual administration |
| `vps start` | Start Agent-Banks | After stop/reboot |
| `vps stop` | Stop Agent-Banks | Before maintenance |
| `vps restart` | Restart service | After config changes |
| `vps logs` | View service logs | Debugging issues |
| `vps web` | Open web interface | Use AI assistant |
| `vps deploy` | Full deployment | Code updates |
| `vps ssh-fix` | Comprehensive SSH setup | SSH completely broken |

---

## 🆘 Emergency Contacts

- **VPS Provider**: Access control panel for web console
- **SSH Not Working**: Run `vps ssh-fix` 
- **Service Not Starting**: Check `vps logs` for errors
- **Web Not Loading**: Verify `vps status` shows RUNNING

---

## 🔗 File Locations

- **SSH Config**: `~/.ssh/config`
- **SSH Key**: `~/.ssh/id_rsa_vps`
- **VPS Service**: `/root/agent-banks/`
- **Service Logs**: `/root/agent-banks/service.log`
- **Backups**: `~/.ssh/backups/`

---

*Last Updated: July 12, 2025*
*Agent-Banks VPS Enhanced v2.0*