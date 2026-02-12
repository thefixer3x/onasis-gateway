#!/usr/bin/env node

/**
 * VPS Inspection Script using Hostinger MCP Adapter
 * Inspects VPS status, resources, and configuration
 */

const axios = require('axios');

class VPSInspector {
  constructor() {
    this.baseURL = 'https://api.hostinger.com/v1';
    this.apiToken = process.env.HOSTINGER_API_TOKEN;
    
    if (!this.apiToken) {
      console.error('❌ HOSTINGER_API_TOKEN environment variable is required');
      process.exit(1);
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async inspectVPS() {
    console.log('🔍 Starting VPS inspection...\n');
    
    try {
      // Get all VPS instances
      const vpsInstances = await this.getVPSList();
      
      if (!vpsInstances || vpsInstances.length === 0) {
        console.log('❌ No VPS instances found');
        return;
      }
      
      console.log(`📊 Found ${vpsInstances.length} VPS instance(s)\n`);
      
      // Inspect each VPS
      for (const vps of vpsInstances) {
        await this.inspectSingleVPS(vps);
      }
      
    } catch (error) {
      console.error('❌ VPS inspection failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }

  async getVPSList() {
    console.log('📋 Fetching VPS list...');
    try {
      const response = await this.client.get('/vps/virtual-machines');
      return response.data.data || response.data;
    } catch (error) {
      console.error('Failed to fetch VPS list:', error.message);
      throw error;
    }
  }

  async inspectSingleVPS(vps) {
    const vpsId = vps.id || vps.virtualMachineId;
    console.log(`🖥️  Inspecting VPS ID: ${vpsId}`);
    console.log(`📍 IP: ${vps.ip || 'N/A'}`);
    console.log(`🏷️  Name: ${vps.name || 'N/A'}`);
    console.log(`📊 Status: ${vps.status || 'N/A'}`);
    console.log(`💾 RAM: ${vps.ram || 'N/A'}`);
    console.log(`💽 Storage: ${vps.storage || 'N/A'}`);
    console.log(`⚡ CPU: ${vps.cpu || 'N/A'}`);
    console.log('─'.repeat(50));

    try {
      // Get detailed VPS info
      const details = await this.getVPSDetails(vpsId);
      console.log('📋 Detailed Information:');
      console.log(`  OS: ${details.os || 'N/A'}`);
      console.log(`  Hostname: ${details.hostname || 'N/A'}`);
      console.log(`  Created: ${details.created_at || 'N/A'}`);
      console.log(`  Location: ${details.location || 'N/A'}`);
      
      // Get VPS metrics
      await this.getVPSMetrics(vpsId);
      
      // Get VPS actions
      await this.getVPSActions(vpsId);
      
      // Check firewall status
      await this.checkFirewallStatus(vpsId);
      
    } catch (error) {
      console.log(`⚠️  Could not get detailed info: ${error.message}`);
    }
    
    console.log('\n');
  }

  async getVPSDetails(vpsId) {
    try {
      const response = await this.client.get(`/vps/virtual-machines/${vpsId}`);
      return response.data.data || response.data;
    } catch (error) {
      throw new Error(`Failed to get VPS details: ${error.message}`);
    }
  }

  async getVPSMetrics(vpsId) {
    try {
      console.log('📊 Fetching metrics...');
      const response = await this.client.get(`/vps/virtual-machines/${vpsId}/metrics`, {
        params: {
          date_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          date_to: new Date().toISOString().split('T')[0]
        }
      });
      
      const metrics = response.data.data || response.data;
      if (metrics) {
        console.log('  📈 Recent Metrics:');
        console.log(`    CPU Usage: ${metrics.cpu_usage || 'N/A'}`);
        console.log(`    Memory Usage: ${metrics.memory_usage || 'N/A'}`);
        console.log(`    Disk Usage: ${metrics.disk_usage || 'N/A'}`);
        console.log(`    Network In: ${metrics.network_in || 'N/A'}`);
        console.log(`    Network Out: ${metrics.network_out || 'N/A'}`);
      }
    } catch (error) {
      console.log(`  ⚠️  Metrics unavailable: ${error.message}`);
    }
  }

  async getVPSActions(vpsId) {
    try {
      console.log('📜 Recent actions...');
      const response = await this.client.get(`/vps/virtual-machines/${vpsId}/actions`);
      const actions = response.data.data || response.data;
      
      if (actions && actions.length > 0) {
        console.log('  🔄 Last 3 actions:');
        actions.slice(0, 3).forEach(action => {
          console.log(`    ${action.action || 'N/A'} - ${action.status || 'N/A'} (${action.created_at || 'N/A'})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠️  Actions unavailable: ${error.message}`);
    }
  }

  async checkFirewallStatus(vpsId) {
    try {
      console.log('🔥 Checking firewall...');
      const response = await this.client.get('/vps/firewalls');
      const firewalls = response.data.data || response.data;
      
      if (firewalls && firewalls.length > 0) {
        console.log(`  🛡️  Found ${firewalls.length} firewall(s)`);
        firewalls.forEach(fw => {
          console.log(`    ${fw.name || 'N/A'} - ${fw.status || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`  ⚠️  Firewall info unavailable: ${error.message}`);
    }
  }

  async checkVPSHealth() {
    console.log('🏥 Running VPS health check...\n');
    
    try {
      // Check if we can reach the VPS via SSH (basic connectivity)
      const vpsInstances = await this.getVPSList();
      
      for (const vps of vpsInstances) {
        const vpsId = vps.id || vps.virtualMachineId;
        const ip = vps.ip;
        
        console.log(`🔍 Health check for VPS ${vpsId} (${ip}):`);
        
        // Check VPS status
        if (vps.status === 'running') {
          console.log('  ✅ VPS Status: Running');
        } else {
          console.log(`  ❌ VPS Status: ${vps.status}`);
        }
        
        // Check if ports are likely open (we can't actually test from here)
        console.log('  🔌 Common ports to check:');
        console.log('    - SSH (22): Check manually');
        console.log('    - HTTP (80): Check manually');
        console.log('    - HTTPS (443): Check manually');
        console.log('    - Custom (3001): For MCP server');
        
        console.log('');
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  const inspector = new VPSInspector();
  
  const command = process.argv[2] || 'inspect';
  
  switch (command) {
    case 'inspect':
      await inspector.inspectVPS();
      break;
    case 'health':
      await inspector.checkVPSHealth();
      break;
    case 'list':
      const vpsInstances = await inspector.getVPSList();
      console.log('📋 VPS Instances:');
      vpsInstances.forEach(vps => {
        console.log(`  ${vps.id || vps.virtualMachineId}: ${vps.name || 'N/A'} (${vps.ip || 'N/A'}) - ${vps.status || 'N/A'}`);
      });
      break;
    default:
      console.log('Usage: node inspect-vps.js [inspect|health|list]');
      console.log('  inspect: Full VPS inspection (default)');
      console.log('  health:  Basic health check');
      console.log('  list:    List all VPS instances');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = VPSInspector;
