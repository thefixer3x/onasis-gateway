#!/usr/bin/env node

/**
 * Health Check Script
 * Validates all services and system components
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

export default class HealthChecker {
    constructor() {
        this.servicesDir = path.join(repoRoot, 'services');
        this.catalogPath = path.join(this.servicesDir, 'catalog.json');
        this.results = {
            timestamp: new Date().toISOString(),
            overall: 'unknown',
            checks: {
                serviceExtraction: { status: 'unknown', details: {} },
                serviceConfigs: { status: 'unknown', details: {} },
                apiGateway: { status: 'unknown', details: {} },
                mcpServer: { status: 'unknown', details: {} },
                dependencies: { status: 'unknown', details: {} }
            }
        };
    }

    async runAllChecks() {
        console.log('🏥 Starting comprehensive health check...\n');

        try {
            await this.checkServiceExtraction();
            await this.checkServiceConfigs();
            await this.checkDependencies();
            await this.checkApiGateway();
            await this.checkMcpServer();
            
            this.calculateOverallHealth();
            this.displayResults();
            
            return this.results;
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.results.overall = 'critical';
            return this.results;
        }
    }

    async checkServiceExtraction() {
        console.log('📦 Checking service extraction...');
        
        const check = this.results.checks.serviceExtraction;
        
        try {
            // Check if catalog exists
            if (!fs.existsSync(this.catalogPath)) {
                check.status = 'critical';
                check.details.catalog = 'Master catalog not found';
                return;
            }

            // Load and validate catalog
            const catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
            
            check.details.totalServices = catalog.totalServices || 0;
            check.details.catalogServices = catalog.services?.length || 0;
            
            // Check service directories
            const serviceDirs = fs.readdirSync(this.servicesDir)
                .filter(item => {
                    const itemPath = path.join(this.servicesDir, item);
                    return fs.statSync(itemPath).isDirectory();
                });

            check.details.serviceDirectories = serviceDirs.length;
            check.details.expectedServices = 18; // Based on our 18 JSON files
            
            // Validate each service directory
            const validServices = [];
            const invalidServices = [];
            
            for (const serviceDir of serviceDirs) {
                const servicePath = path.join(this.servicesDir, serviceDir);
                
                // Find JSON config files in the service directory
                const files = fs.readdirSync(servicePath);
                const configFiles = files.filter(file => file.endsWith('.json'));
                const clientFile = path.join(servicePath, 'client.js');
                const webhookFile = path.join(servicePath, 'webhooks.js');
                const testFile = path.join(servicePath, 'test.js');
                
                const serviceCheck = {
                    name: serviceDir,
                    config: configFiles.length > 0,
                    client: fs.existsSync(clientFile),
                    webhooks: fs.existsSync(webhookFile),
                    test: fs.existsSync(testFile)
                };
                
                if (serviceCheck.config && serviceCheck.client && serviceCheck.webhooks && serviceCheck.test) {
                    validServices.push(serviceDir);
                } else {
                    invalidServices.push(serviceCheck);
                }
            }
            
            check.details.validServices = validServices.length;
            check.details.invalidServices = invalidServices;
            
            // Determine status
            if (validServices.length >= check.details.expectedServices) {
                check.status = 'healthy';
            } else if (validServices.length > 0) {
                check.status = 'degraded';
            } else {
                check.status = 'critical';
            }
            
            console.log(`   ✅ ${validServices.length}/${check.details.expectedServices} services extracted`);
            
        } catch (error) {
            check.status = 'critical';
            check.details.error = error.message;
            console.log(`   ❌ Service extraction check failed: ${error.message}`);
        }
    }

    async checkServiceConfigs() {
        console.log('⚙️  Checking service configurations...');
        
        const check = this.results.checks.serviceConfigs;
        
        try {
            const catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
            const configChecks = [];
            
            for (const serviceInfo of catalog.services || []) {
                const configPath = path.join(this.servicesDir, serviceInfo.directory, serviceInfo.configFile);
                
                if (!fs.existsSync(configPath)) {
                    configChecks.push({
                        service: serviceInfo.name,
                        status: 'missing',
                        issue: 'Config file not found'
                    });
                    continue;
                }
                
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    
                    const configCheck = {
                        service: serviceInfo.name,
                        status: 'valid',
                        hasName: !!config.name,
                        hasBaseUrl: !!config.baseUrl,
                        hasAuth: !!config.authentication,
                        hasEndpoints: config.endpoints?.length > 0,
                        hasCapabilities: config.capabilities?.length > 0,
                        endpointCount: config.endpoints?.length || 0
                    };
                    
                    // Validate required fields
                    if (!configCheck.hasName || !configCheck.hasEndpoints) {
                        configCheck.status = 'invalid';
                        configCheck.issue = 'Missing required fields';
                    }
                    
                    configChecks.push(configCheck);
                    
                } catch {
                    configChecks.push({
                        service: serviceInfo.name,
                        status: 'invalid',
                        issue: 'Invalid JSON format'
                    });
                }
            }
            
            check.details.configChecks = configChecks;
            check.details.validConfigs = configChecks.filter(c => c.status === 'valid').length;
            check.details.invalidConfigs = configChecks.filter(c => c.status !== 'valid').length;
            
            // Determine status
            if (check.details.invalidConfigs === 0) {
                check.status = 'healthy';
            } else if (check.details.validConfigs > check.details.invalidConfigs) {
                check.status = 'degraded';
            } else {
                check.status = 'critical';
            }
            
            console.log(`   ✅ ${check.details.validConfigs} valid configurations`);
            if (check.details.invalidConfigs > 0) {
                console.log(`   ⚠️  ${check.details.invalidConfigs} invalid configurations`);
            }
            
        } catch (error) {
            check.status = 'critical';
            check.details.error = error.message;
            console.log(`   ❌ Config check failed: ${error.message}`);
        }
    }

    async checkDependencies() {
        console.log('📚 Checking dependencies...');
        
        const check = this.results.checks.dependencies;
        
        try {
            const packageJsonPath = path.join(repoRoot, 'package.json');
            const gatewayPackagePath = path.join(repoRoot, 'api-gateway/package.json');
            const mcpPackagePath = path.join(repoRoot, 'mcp-server/package.json');
            
            const dependencyChecks = [];
            
            // Check main package.json
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const nodeModulesPath = path.join(repoRoot, 'node_modules');
                
                dependencyChecks.push({
                    component: 'main',
                    packageJson: true,
                    nodeModules: fs.existsSync(nodeModulesPath),
                    dependencies: Object.keys(packageJson.dependencies || {}).length,
                    devDependencies: Object.keys(packageJson.devDependencies || {}).length
                });
            }
            
            // Check API Gateway dependencies
            if (fs.existsSync(gatewayPackagePath)) {
                const gatewayPackage = JSON.parse(fs.readFileSync(gatewayPackagePath, 'utf8'));
                const gatewayNodeModules = path.join(repoRoot, 'api-gateway/node_modules');
                
                dependencyChecks.push({
                    component: 'api-gateway',
                    packageJson: true,
                    nodeModules: fs.existsSync(gatewayNodeModules),
                    dependencies: Object.keys(gatewayPackage.dependencies || {}).length,
                    devDependencies: Object.keys(gatewayPackage.devDependencies || {}).length
                });
            }
            
            // Check MCP Server dependencies
            if (fs.existsSync(mcpPackagePath)) {
                const mcpPackage = JSON.parse(fs.readFileSync(mcpPackagePath, 'utf8'));
                const mcpNodeModules = path.join(repoRoot, 'mcp-server/node_modules');
                
                dependencyChecks.push({
                    component: 'mcp-server',
                    packageJson: true,
                    nodeModules: fs.existsSync(mcpNodeModules),
                    dependencies: Object.keys(mcpPackage.dependencies || {}).length,
                    devDependencies: Object.keys(mcpPackage.devDependencies || {}).length
                });
            }
            
            check.details.dependencyChecks = dependencyChecks;
            
            // Determine status
            const allHaveNodeModules = dependencyChecks.every(d => d.nodeModules);
            const allHavePackageJson = dependencyChecks.every(d => d.packageJson);
            
            if (allHaveNodeModules && allHavePackageJson) {
                check.status = 'healthy';
            } else if (allHavePackageJson) {
                check.status = 'degraded';
            } else {
                check.status = 'critical';
            }
            
            console.log(`   ✅ ${dependencyChecks.length} components checked`);
            if (!allHaveNodeModules) {
                console.log(`   ⚠️  Some components missing node_modules`);
            }
            
        } catch (error) {
            check.status = 'critical';
            check.details.error = error.message;
            console.log(`   ❌ Dependency check failed: ${error.message}`);
        }
    }

    async checkApiGateway() {
        console.log('🌐 Checking API Gateway...');
        
        const check = this.results.checks.apiGateway;
        
        try {
            const gatewayPath = path.join(repoRoot, 'api-gateway/index.js');
            const gatewayPackagePath = path.join(repoRoot, 'api-gateway/package.json');
            
            check.details.gatewayFile = fs.existsSync(gatewayPath);
            check.details.packageFile = fs.existsSync(gatewayPackagePath);
            
            // Try to connect to gateway if it's running
            try {
                const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
                check.details.running = true;
                check.details.healthResponse = response.data;
                check.details.responseTime = response.headers['x-response-time'] || 'unknown';
            } catch (connectionError) {
                check.details.running = false;
                check.details.connectionError = connectionError.code || connectionError.message;
            }
            
            // Determine status
            if (check.details.gatewayFile && check.details.packageFile) {
                if (check.details.running) {
                    check.status = 'healthy';
                } else {
                    check.status = 'degraded'; // Files exist but not running
                }
            } else {
                check.status = 'critical';
            }
            
            if (check.details.running) {
                console.log(`   ✅ API Gateway running and responsive`);
            } else {
                console.log(`   ⚠️  API Gateway not running (files exist)`);
            }
            
        } catch (error) {
            check.status = 'critical';
            check.details.error = error.message;
            console.log(`   ❌ API Gateway check failed: ${error.message}`);
        }
    }

    async checkMcpServer() {
        console.log('🤖 Checking MCP Server...');
        
        const check = this.results.checks.mcpServer;
        
        try {
            const mcpPath = path.join(repoRoot, 'mcp-server/index.js');
            const mcpPackagePath = path.join(repoRoot, 'mcp-server/package.json');
            
            check.details.mcpFile = fs.existsSync(mcpPath);
            check.details.packageFile = fs.existsSync(mcpPackagePath);
            
            // Check if MCP server dependencies are available
            if (check.details.packageFile) {
                const mcpPackage = JSON.parse(fs.readFileSync(mcpPackagePath, 'utf8'));
                check.details.hasMcpSdk = !!mcpPackage.dependencies?.['@modelcontextprotocol/sdk'];
            }
            
            // Determine status
            if (check.details.mcpFile && check.details.packageFile && check.details.hasMcpSdk) {
                check.status = 'healthy';
            } else if (check.details.mcpFile && check.details.packageFile) {
                check.status = 'degraded';
            } else {
                check.status = 'critical';
            }
            
            console.log(`   ✅ MCP Server files present`);
            if (!check.details.hasMcpSdk) {
                console.log(`   ⚠️  MCP SDK dependency may be missing`);
            }
            
        } catch (error) {
            check.status = 'critical';
            check.details.error = error.message;
            console.log(`   ❌ MCP Server check failed: ${error.message}`);
        }
    }

    calculateOverallHealth() {
        const checks = Object.values(this.results.checks);
        const healthyCount = checks.filter(c => c.status === 'healthy').length;
        const degradedCount = checks.filter(c => c.status === 'degraded').length;
        const criticalCount = checks.filter(c => c.status === 'critical').length;
        
        if (criticalCount > 0) {
            this.results.overall = 'critical';
        } else if (degradedCount > 0) {
            this.results.overall = 'degraded';
        } else if (healthyCount === checks.length) {
            this.results.overall = 'healthy';
        } else {
            this.results.overall = 'unknown';
        }
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🏥 HEALTH CHECK RESULTS');
        console.log('='.repeat(60));
        
        const statusEmoji = {
            healthy: '✅',
            degraded: '⚠️ ',
            critical: '❌',
            unknown: '❓'
        };
        
        console.log(`Overall Status: ${statusEmoji[this.results.overall]} ${this.results.overall.toUpperCase()}`);
        console.log(`Timestamp: ${this.results.timestamp}\n`);
        
        // Display each check
        for (const [checkName, check] of Object.entries(this.results.checks)) {
            console.log(`${statusEmoji[check.status]} ${checkName}: ${check.status.toUpperCase()}`);
            
            // Show key details
            if (checkName === 'serviceExtraction') {
                console.log(`   Services: ${check.details.validServices}/${check.details.expectedServices}`);
            } else if (checkName === 'serviceConfigs') {
                console.log(`   Valid Configs: ${check.details.validConfigs}`);
                if (check.details.invalidConfigs > 0) {
                    console.log(`   Invalid Configs: ${check.details.invalidConfigs}`);
                }
            } else if (checkName === 'apiGateway') {
                console.log(`   Running: ${check.details.running ? 'Yes' : 'No'}`);
            }
            
            if (check.details.error) {
                console.log(`   Error: ${check.details.error}`);
            }
            console.log();
        }
        
        // Recommendations
        console.log('📋 RECOMMENDATIONS:');
        this.generateRecommendations();
        
        console.log('\n' + '='.repeat(60));
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Service extraction recommendations
        if (this.results.checks.serviceExtraction.status !== 'healthy') {
            recommendations.push('Run: npm run extract');
        }
        
        // Dependency recommendations
        if (this.results.checks.dependencies.status !== 'healthy') {
            recommendations.push('Run: npm install');
            recommendations.push('Run: cd api-gateway && npm install');
            recommendations.push('Run: cd mcp-server && npm install');
        }
        
        // API Gateway recommendations
        if (this.results.checks.apiGateway.status === 'degraded') {
            recommendations.push('Start API Gateway: cd api-gateway && npm start');
        }
        
        // Overall recommendations
        if (this.results.overall === 'critical') {
            recommendations.push('Review error details above and fix critical issues');
        }
        
        if (recommendations.length === 0) {
            console.log('   🎉 All systems healthy! No recommendations.');
        } else {
            recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }
    }

    async saveResults() {
        const logsDir = path.join(repoRoot, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsPath = path.join(logsDir, `health-check-${timestamp}.json`);
        
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Results saved to: ${resultsPath}`);
        
        return resultsPath;
    }
}

// CLI Usage
const isMain = !!(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename));
if (isMain) {
    const checker = new HealthChecker();
    
    checker.runAllChecks()
        .then(async (results) => {
            await checker.saveResults();
            
            // Exit with appropriate code
            if (results.overall === 'critical') {
                process.exit(1);
            } else if (results.overall === 'degraded') {
                process.exit(2);
            } else {
                process.exit(0);
            }
        })
        .catch((error) => {
            console.error('Health check failed:', error);
            process.exit(1);
        });
}
