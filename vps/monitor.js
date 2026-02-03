const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const MAX_LOG_LINES = 1000;
const MIN_LOG_LINES = 1;
const DEFAULT_TIMEOUT_MS = parseInt(process.env.VPS_COMMAND_TIMEOUT_MS || '30000', 10);
const DEFAULT_BUFFER_MB = parseInt(process.env.VPS_COMMAND_BUFFER_MB || '2', 10);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const ALLOWED_COMMANDS = {
  pm2_list: { label: 'PM2 Status', command: 'pm2 list' },
  nginx_status: { label: 'Nginx Status', command: 'systemctl status nginx' },
  memory: { label: 'Memory Usage', command: 'free -m' },
  disk: { label: 'Disk Usage', command: 'df -h' },
  uptime: { label: 'System Uptime', command: 'uptime' }
};

const VALID_PM2_ACTIONS = new Set(['restart', 'stop', 'start', 'delete']);

function sanitizeServiceName(serviceName) {
  if (!serviceName || typeof serviceName !== 'string') return null;

  const trimmed = serviceName.trim();
  if (!trimmed || trimmed.length > 64) return null;

  const allowed = /^[a-zA-Z0-9_-]+$/;
  if (!allowed.test(trimmed)) return null;

  const dangerousChars = [';', '&', '|', '$', '`', '(', ')', '{', '}', '[', ']', '<', '>', '"', "'", '\\', '\n', '\r'];
  if (dangerousChars.some((char) => trimmed.includes(char))) return null;

  return trimmed;
}

function sanitizeLines(lines) {
  if (lines === null || lines === undefined) return 100;

  const parsed = typeof lines === 'string' ? parseInt(lines, 10) : lines;
  if (Number.isNaN(parsed) || parsed < MIN_LOG_LINES) return MIN_LOG_LINES;
  if (parsed > MAX_LOG_LINES) return MAX_LOG_LINES;
  return Math.floor(parsed);
}

function parseTargetsFromEnv() {
  const raw = process.env.VPS_TARGETS_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((target) => ({
      id: target.id || target.name || 'target',
      name: target.name || target.id || 'Target',
      mode: target.mode || (target.host && !LOCAL_HOSTS.has(target.host) ? 'ssh' : 'local'),
      host: target.host || 'localhost',
      port: target.port || process.env.VPS_PORT || 22,
      user: target.user || process.env.VPS_USER || 'root',
      keyPath: target.keyPath || process.env.VPS_SSH_KEY_PATH || null
    }));
  } catch (error) {
    console.warn('[VPS Monitor] Failed to parse VPS_TARGETS_JSON:', error.message);
    return null;
  }
}

function getDefaultTargets() {
  const host = process.env.VPS_HOST || 'localhost';
  const isLocal = LOCAL_HOSTS.has(host);

  return [
    {
      id: process.env.VPS_DEFAULT_TARGET_ID || 'primary',
      name: process.env.VPS_NAME || 'Primary VPS',
      mode: isLocal ? 'local' : 'ssh',
      host,
      port: process.env.VPS_PORT || 22,
      user: process.env.VPS_USER || 'root',
      keyPath: process.env.VPS_SSH_KEY_PATH || null
    }
  ];
}

function getTargets() {
  return parseTargetsFromEnv() || getDefaultTargets();
}

function getDefaultTargetId() {
  return process.env.VPS_DEFAULT_TARGET_ID || getTargets()[0]?.id || 'primary';
}

function resolveTarget(targetId) {
  const targets = getTargets();
  if (!targetId) return targets[0];
  return targets.find((target) => target.id === targetId) || targets[0];
}

function buildSSHPrefix(target) {
  const sshOptions = [
    `-p ${target.port || 22}`,
    '-o ConnectTimeout=10',
    '-o StrictHostKeyChecking=accept-new',
    '-o BatchMode=yes'
  ];

  if (target.keyPath) {
    sshOptions.push(`-i ${target.keyPath}`);
  }

  return `ssh ${sshOptions.join(' ')} ${target.user}@${target.host}`;
}

async function executeCommand(target, command) {
  const fullCommand = target.mode === 'ssh'
    ? `${buildSSHPrefix(target)} "${command}"`
    : command;

  const result = await execAsync(fullCommand, {
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: DEFAULT_BUFFER_MB * 1024 * 1024
  });

  return result;
}

function parseDiskUsage(output) {
  const parts = output.trim().split(/\s+/);
  if (parts.length < 5) return null;

  return {
    total: parts[1],
    used: parts[2],
    available: parts[3],
    percentage: parseInt(parts[4].replace('%', ''), 10)
  };
}

function parseMemoryUsage(output) {
  const lines = output.split('\n');
  const memLine = lines.find((line) => line.startsWith('Mem:'));
  if (!memLine) return null;

  const parts = memLine.split(/\s+/);
  const total = parseInt(parts[1], 10);
  const used = parseInt(parts[2], 10);
  const free = parseInt(parts[3], 10);

  return {
    total,
    used,
    free,
    percentage: Math.round((used / total) * 100)
  };
}

function parseCpuUsage(output) {
  const usage = parseFloat(output.trim());
  if (Number.isNaN(usage)) return null;
  return Math.round(usage);
}

function calculateOverallHealth(disk, memory, cpu, services, nginx) {
  let score = 100;

  if (disk && disk.percentage > 90) score -= 30;
  else if (disk && disk.percentage > 80) score -= 15;

  if (memory && memory.percentage > 90) score -= 30;
  else if (memory && memory.percentage > 80) score -= 15;

  if (cpu && cpu > 90) score -= 20;
  else if (cpu && cpu > 75) score -= 10;

  const runningServices = services.filter((service) => service.pm2_env.status === 'online').length;
  if (runningServices < services.length) score -= 25;

  if (!nginx) score -= 40;

  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';
  return 'critical';
}

async function getHealth(target) {
  const checks = await Promise.allSettled([
    executeCommand(target, 'uptime'),
    executeCommand(target, 'df -h / | tail -n 1'),
    executeCommand(target, 'free -m'),
    executeCommand(target, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"),
    executeCommand(target, 'pm2 jlist'),
    executeCommand(target, 'systemctl status nginx | grep Active')
  ]);

  const [uptime, disk, memory, cpu, pm2, nginx] = checks;

  const systemUptime = uptime.status === 'fulfilled' ? uptime.value.stdout.trim() : 'Unknown';
  const diskUsage = disk.status === 'fulfilled' ? parseDiskUsage(disk.value.stdout) : null;
  const memoryUsage = memory.status === 'fulfilled' ? parseMemoryUsage(memory.value.stdout) : null;
  const cpuUsage = cpu.status === 'fulfilled' ? parseCpuUsage(cpu.value.stdout) : null;
  const services = pm2.status === 'fulfilled' ? JSON.parse(pm2.value.stdout || '[]') : [];
  const nginxStatus = nginx.status === 'fulfilled' ? nginx.value.stdout.includes('active (running)') : false;

  const data = {
    targetId: target.id,
    vps: {
      host: target.host,
      uptime: systemUptime,
      disk: diskUsage,
      memory: memoryUsage,
      cpu: cpuUsage
    },
    services: {
      nginx: nginxStatus ? 'running' : 'stopped',
      pm2: services.length > 0,
      count: services.length,
      running: services.filter((service) => service.pm2_env.status === 'online').length
    },
    overall: calculateOverallHealth(diskUsage, memoryUsage, cpuUsage, services, nginxStatus)
  };

  return data;
}

async function getServices(target) {
  const { stdout } = await executeCommand(target, 'pm2 jlist');
  const services = JSON.parse(stdout || '[]');

  return services.map((service) => ({
    name: service.name,
    status: service.pm2_env.status,
    cpu: service.monit.cpu,
    memory: service.monit.memory,
    uptime: service.pm2_env.pm_uptime,
    restarts: service.pm2_env.restart_time,
    pid: service.pid
  }));
}

async function manageService(target, action, serviceName) {
  if (!VALID_PM2_ACTIONS.has(action)) {
    throw new Error(`Invalid action. Allowed: ${Array.from(VALID_PM2_ACTIONS).join(', ')}`);
  }

  const sanitizedServiceName = sanitizeServiceName(serviceName);
  if (!sanitizedServiceName) {
    throw new Error('Invalid service name. Must be alphanumeric with hyphens/underscores only.');
  }

  const command = `pm2 ${action} ${sanitizedServiceName} && pm2 save`;
  const { stdout, stderr } = await executeCommand(target, command);

  return {
    action,
    serviceName: sanitizedServiceName,
    output: stdout,
    warnings: stderr || undefined
  };
}

async function getLogs(target, serviceName, lines) {
  const sanitizedServiceName = sanitizeServiceName(serviceName);
  if (!sanitizedServiceName) {
    throw new Error('Invalid or missing service parameter.');
  }

  const safeLines = sanitizeLines(lines);
  const command = sanitizedServiceName === 'all'
    ? `pm2 logs --lines ${safeLines} --nostream`
    : `pm2 logs ${sanitizedServiceName} --lines ${safeLines} --nostream`;

  const { stdout, stderr } = await executeCommand(target, command);

  return {
    serviceName: sanitizedServiceName,
    lines: safeLines,
    logs: stdout,
    errors: stderr || undefined
  };
}

async function executeAllowedCommand(target, commandKey) {
  if (!commandKey || !ALLOWED_COMMANDS[commandKey]) {
    throw new Error('Invalid command. Select one of the allowed commands.');
  }

  const command = ALLOWED_COMMANDS[commandKey].command;
  const { stdout, stderr } = await executeCommand(target, command);

  return {
    commandKey,
    output: stdout,
    warnings: stderr || undefined
  };
}

module.exports = {
  getTargets,
  resolveTarget,
  getDefaultTargetId,
  getHealth,
  getServices,
  manageService,
  getLogs,
  executeAllowedCommand
};
