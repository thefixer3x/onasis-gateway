# 🎯 Service Separation Plan - Onasis Ecosystem
**Generated:** 2025-09-02T04:25:00Z  
**Objective:** Clean separation of overlapping services for optimal performance  
**Timeline:** 2-4 weeks for complete separation  

---

## 🚨 CRITICAL SEPARATION REQUIREMENTS

### **Primary Conflicts to Resolve:**
1. **3 Different Onasis Gateway implementations** (Local + 2 VPS embedded)
2. **Multiple MCP servers** with module loading conflicts
3. **Overlapping memory services** between Onasis-CORE and ghost-protocol
4. **Resource waste** from duplicate functionality

### **✅ Post-Upgrade System Status (Sept 2, 2025):**
- ✅ **System Updated**: Ubuntu 24.04.3 LTS, Kernel 6.8.0-79-generic
- ✅ **Services Stable**: All PM2 and system services operational post-reboot
- ✅ **Resource Optimized**: Memory usage at 14% (554MB/3.8GB)
- ✅ **Security Current**: All security updates applied and active
- ✅ **Documentation Updated**: Current VPS state fully documented

### **Business Impact of Current State:**
- 🔴 **Developer Confusion**: Multiple similar services
- 🔴 **Resource Waste**: Duplicate functionality consuming memory/CPU
- 🔴 **Deployment Complexity**: Mixed architectures across projects
- 🔴 **Maintenance Burden**: Scattered components requiring separate updates

---

## 🏗️ TARGET ARCHITECTURE (Post-Separation)

### **🎯 CLEAN SERVICE ARCHITECTURE**

```
┌─ SEPARATED SERVICES ECOSYSTEM ──────────────────────────────────────┐
│                                                                     │
│  🟢 PRIMARY SERVICES (Port Range: 3001-3010)                       │
│  ├─ 🎯 Unified MCP Hub (3001) - Single source of truth             │
│  ├─ 🎯 Onasis Gateway API (3002) - 24+ service integrations        │
│  ├─ 🎯 Onasis Privacy Core (3003) - Data masking & anonymization   │
│  ├─ 🎯 Payment Processing Hub (3004) - PayStack/SaySwitch          │
│  └─ 🎯 VortexCore Dashboard (3005) - Admin interface               │
│                                                                     │
│  🔄 INFRASTRUCTURE LAYER                                           │
│  ├─ Nginx Load Balancer (80, 8080, 8081)                         │
│  ├─ Redis Cache (6379)                                            │
│  ├─ Health Monitoring                                             │
│  └─ Service Discovery                                             │
│                                                                     │
│  📦 ISOLATED DEPLOYMENTS                                           │
│  ├─ Each service in dedicated directory                           │
│  ├─ Independent configuration management                          │
│  ├─ Separate dependency management                                │
│  └─ Clean service boundaries                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 PHASE-BY-PHASE SEPARATION PLAN

### **🚀 PHASE 1: IMMEDIATE STABILIZATION (Week 1)**

#### **Day 1-2: Service Audit & Backup** ✅ COMPLETED
- ✅ **Create VPS Backup** - Full system snapshot before changes
- ✅ **Document Active Processes** - What's actually running and working
- ✅ **Test Current Services** - Verify functionality of active services
- ✅ **Map Dependencies** - Document service interconnections

```bash
# ✅ Commands executed successfully:
ssh vps "pm2 save"                          # ✅ PM2 configuration saved
ssh vps "tar -czf full-backup-$(date +%Y%m%d).tar.gz /root /opt" # ✅ Full backup created
ssh vps "curl http://localhost:3001/health" # ✅ MCP server responding
ssh vps "netstat -tlnp | grep LISTEN"       # ✅ Active ports documented

# ✅ Current verified services:
# - lanonasis-mcp-server: Port 3001, PID 964, Status: healthy
# - enhanced-mcp-server: Background service, PID 963, Status: online
# - nginx: Ports 80,8080,8081, Status: active
# - redis-server: Port 6379, Status: active, PONG response confirmed
```

#### **Day 3-5: Conflict Resolution Planning**
- [ ] **Identify Safe-to-Stop Services** - Mark inactive/duplicate services
- [ ] **Plan Port Allocation** - Assign unique ports for each service
- [ ] **Design Migration Strategy** - Step-by-step service movement plan
- [ ] **Create Rollback Plan** - Safety measures for quick recovery

#### **Week 1 Deliverables:**
- ✅ Complete service inventory with status
- ✅ Backup strategy and recovery plan
- ✅ Detailed migration roadmap
- ✅ Port allocation and service naming conventions

### **🔧 PHASE 2: SERVICE EXTRACTION (Week 2)**

#### **Priority 1: Extract Embedded Onasis Gateway**
```bash
# Current Location: /root/fixer-initiative/ecosystem-projects/onasis-gateway/
# Target: Standalone deployment at /opt/onasis-services/gateway/

STEPS:
1. Create dedicated directory structure
2. Extract onasis-gateway components
3. Resolve dependencies and configurations  
4. Test standalone functionality
5. Update service registry
```

**Migration Commands:**

#### **Priority 2: Consolidate MCP Servers**
```bash  
# Current: Multiple MCP implementations with conflicts
# Target: Single unified MCP server at /opt/onasis-services/mcp-hub/

STEPS:
1. Merge MCP server implementations
2. Resolve module loading issues
3. Create unified tool registry
4. Test all MCP tools functionality
5. Update PM2 configuration
```

#### **Priority 3: Separate Memory Services**
```bash
# Current: Enhanced memory server in ghost-protocol
# Target: Integrate with Onasis-CORE privacy platform

STEPS:
1. Extract memory service functionality  
2. Deploy as Onasis Privacy Core
3. Integrate with local Onasis-CORE development
4. Test memory operations
5. Configure privacy-first operations
```

#### **Week 2 Deliverables:**
- ✅ Standalone Onasis Gateway deployment
- ✅ Consolidated MCP server (single source of truth)
- ✅ Separated memory/privacy services
- ✅ Updated PM2 configurations

### **🎯 PHASE 3: SERVICE OPTIMIZATION (Week 3)**

#### **Performance Optimization**
- [ ] **Resource Allocation** - Optimize memory/CPU usage per service
- [ ] **Caching Strategy** - Redis optimization for each service
- [ ] **Load Balancing** - Nginx configuration for traffic distribution
- [ ] **Health Monitoring** - Service health checks and auto-recovery

#### **Configuration Management**
- [ ] **Environment Variables** - Centralized .env management
- [ ] **Service Discovery** - Automatic service registration
- [ ] **Configuration Validation** - Ensure all services properly configured
- [ ] **Secret Management** - Secure API key and token storage

#### **Testing & Validation**
- [ ] **Service Integration Tests** - Verify inter-service communication
- [ ] **Performance Testing** - Load testing for each service
- [ ] **Failover Testing** - Service recovery and resilience
- [ ] **Security Audit** - Service isolation and security validation

#### **Week 3 Deliverables:**
- ✅ Optimized service performance
- ✅ Centralized configuration management  
- ✅ Comprehensive testing suite
- ✅ Security and reliability validation

### **🚀 PHASE 4: PRODUCTION DEPLOYMENT (Week 4)**

#### **Final Deployment**
- [ ] **Production Configuration** - Final service configurations
- [ ] **Monitoring Setup** - Service health dashboards  
- [ ] **Documentation** - Complete service documentation
- [ ] **Automated Deployment** - CI/CD pipelines for each service

#### **Service Launch Sequence**
1. **🎯 Unified MCP Hub** - Core service (Port 3001)
2. **🎯 Onasis Gateway API** - API service warehouse (Port 3002)  
3. **🎯 Payment Processing Hub** - Financial services (Port 3004)
4. **🎯 Onasis Privacy Core** - Privacy platform (Port 3003)
5. **🎯 VortexCore Dashboard** - Admin interface (Port 3005)

#### **Week 4 Deliverables:**
- ✅ All services running in clean, separated architecture
- ✅ Comprehensive monitoring and health checks
- ✅ Complete documentation and runbooks
- ✅ Automated deployment and recovery procedures

---

## 🛠️ TECHNICAL IMPLEMENTATION DETAILS

### **🎯 SERVICE 1: Unified MCP Hub (Port 3001)**

**Purpose:** Single source of truth for all MCP operations
**Migration Path:**
```bash
# Current: /opt/mcp-servers/lanonasis-standalone/current/
# Target: /opt/onasis-services/mcp-hub/

1. Consolidate multiple MCP implementations
2. Resolve module loading issues (current error logs show MODULE_NOT_FOUND)
3. Create unified tool registry
4. Implement service discovery
5. Add comprehensive health checks
```

**Key Features Post-Migration:**
- ✅ All MCP tools in single registry
- ✅ Service discovery and registration  
- ✅ Health monitoring endpoints
- ✅ Comprehensive error handling
- ✅ Performance metrics collection

### **🎯 SERVICE 2: Onasis Gateway API (Port 3002)**

**Purpose:** Comprehensive API service warehouse with 24+ integrations
**Migration Path:**
```bash
# Source: Local /Users/seyederick/onasis-gateway/ (49,812 lines)
# Extract: VPS /root/fixer-initiative/.../onasis-gateway/ (embedded components)
# Target: /opt/onasis-services/gateway/

1. Deploy local comprehensive onasis-gateway to VPS
2. Extract embedded credit-as-a-service from fixer-initiative
3. Merge service registries and configurations
4. Resolve database connection issues
5. Configure all 24+ API service integrations
```

**Key Features Post-Migration:**
- ✅ 24+ API service integrations (Stripe, PayStack, Flutterwave, etc.)
- ✅ Comprehensive authentication (Bearer, API Key, HMAC, OAuth2)
- ✅ Rate limiting and circuit breakers
- ✅ Database audit logging
- ✅ Service health monitoring

### **🎯 SERVICE 3: Payment Processing Hub (Port 3004)**

**Purpose:** Specialized payment and financial services
**Migration Path:**
```bash
# Source: /root/fixer-initiative/ (PayStack, SaySwitch integrations)
# Target: /opt/onasis-services/payments/

1. Extract payment-specific functionality from fixer-initiative
2. Consolidate PayStack and SaySwitch implementations
3. Implement webhook handlers and callback systems  
4. Configure payment routing and reconciliation
5. Add fraud detection and compliance features
```

**Key Features Post-Migration:**
- ✅ PayStack comprehensive integration
- ✅ SaySwitch authentication patterns
- ✅ Production webhook handlers
- ✅ Payment routing optimization
- ✅ Compliance and fraud detection

### **🎯 SERVICE 4: Onasis Privacy Core (Port 3003)**

**Purpose:** Privacy-first infrastructure and data masking
**Migration Path:**
```bash
# Source: Local /Users/seyederick/DevOps/_project_folders/Onasis-CORE/
# Extract: /root/ghost-protocol/enhanced-memory-server.js  
# Target: /opt/onasis-services/privacy-core/

1. Deploy local Onasis-CORE to VPS
2. Extract memory service from ghost-protocol
3. Integrate privacy-first architecture
4. Configure data masking and anonymization
5. Implement identity protection systems
```

**Key Features Post-Migration:**
- ✅ Privacy-first infrastructure
- ✅ Data masking and tokenization
- ✅ Identity protection and anonymization
- ✅ PII detection and removal
- ✅ Compliance-ready architecture

### **🎯 SERVICE 5: VortexCore Dashboard (Port 3005)**

**Purpose:** Admin interface and service monitoring
**Migration Path:**
```bash
# Source: /root/vortexcore-dashboard/
# Target: /opt/onasis-services/dashboard/

1. Update React/TypeScript dashboard
2. Configure service monitoring interfaces
3. Implement admin functionality
4. Add service health visualizations
5. Configure user management and permissions
```

**Key Features Post-Migration:**
- ✅ Service health monitoring dashboard
- ✅ Admin interface for all services
- ✅ User management and permissions
- ✅ Configuration management interface  
- ✅ Performance metrics visualization

---

## 📊 RESOURCE ALLOCATION PLAN

### **Port Allocation Strategy**
```
3001 - Unified MCP Hub           (Primary service)
3002 - Onasis Gateway API        (API warehouse)
3003 - Onasis Privacy Core       (Privacy platform)
3004 - Payment Processing Hub    (Financial services)
3005 - VortexCore Dashboard      (Admin interface)
3006-3010 - Reserved for expansion
```

### **Directory Structure (Post-Separation)**
```
/opt/onasis-services/
├── mcp-hub/                     # Unified MCP server
│   ├── src/
│   ├── config/
│   ├── logs/
│   └── package.json
├── gateway/                     # Onasis Gateway API
│   ├── src/adapters/
│   ├── services/
│   ├── database/
│   └── package.json  
├── privacy-core/                # Privacy platform
│   ├── services/
│   ├── data-masking/
│   ├── identity-protection/
│   └── package.json
├── payments/                    # Payment processing
│   ├── paystack/
│   ├── sayswitch/
│   ├── webhooks/
│   └── package.json
└── dashboard/                   # Admin dashboard
    ├── admin/
    ├── client/
    ├── monitoring/
    └── package.json
```

### **PM2 Configuration (ecosystem.config.js)**
```javascript
module.exports = {
  apps: [
    {
      name: 'onasis-mcp-hub',
module.exports = {
  apps: [
    {
      name: 'onasis-mcp-hub',
      script: '/opt/onasis-services/mcp-hub/src/index.js',
      instances: 1,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/opt/onasis-services/mcp-hub/logs/error.log',
      out_file: '/opt/onasis-services/mcp-hub/logs/out.log',
      env_production: { NODE_ENV: 'production', PORT: 3001 }
    },
    {
      name: 'onasis-gateway-api',
      script: '/opt/onasis-services/gateway/dist/bun-neon-server.js',
      interpreter: 'node',
      instances: 1,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/opt/onasis-services/gateway/logs/error.log',
      out_file: '/opt/onasis-services/gateway/logs/out.log',
      env_production: { NODE_ENV: 'production', PORT: 3002 }
    },
    {
      name: 'onasis-privacy-core',
      script: '/opt/onasis-services/privacy-core/unified-router.js',
      instances: 1,
      port: 3003,
      env_production: { NODE_ENV: 'production', PORT: 3003 }
    },
    {
      name: 'onasis-payments',
      script: '/opt/onasis-services/payments/payment-hub.js',
      instances: 1,
      port: 3004,
      env_production: { NODE_ENV: 'production', PORT: 3004 }
    },
    {
      name: 'vortexcore-dashboard',
      script: '/opt/onasis-services/dashboard/server.js',
      instances: 1,
      port: 3005,
      env_production: { NODE_ENV: 'production', PORT: 3005 }
    }
  ]
}
1. **Service Downtime** - Services offline during migration
2. **Data Loss** - Configuration or data corruption  
3. **Dependency Conflicts** - Module loading issues
4. **Performance Degradation** - Resource allocation problems
5. **Configuration Errors** - Service startup failures

### **Mitigation Strategies**
1. **Full VPS Backup** - Complete system snapshot before changes
2. **Staged Migration** - Migrate one service at a time
3. **Health Monitoring** - Continuous service health checks
4. **Rollback Scripts** - Automated rollback procedures
5. **Testing Protocol** - Comprehensive testing at each phase

### **Rollback Procedures**
```bash
# Emergency rollback commands
ssh vps "pm2 stop all"                                    # Stop all services
ssh vps "tar -xzf full-backup-YYYYMMDD.tar.gz -C /"      # Restore backup
ssh vps "pm2 resurrect"                                   # Restore PM2 config
ssh vps "pm2 start all"                                   # Restart services
```

---

## 📈 SUCCESS METRICS & VALIDATION

### **Technical Success Criteria**
- [ ] **Service Isolation**: Each service runs independently
- [ ] **Resource Efficiency**: No duplicate functionality
- [ ] **Performance**: All services respond < 200ms
- [ ] **Reliability**: 99.9% uptime for all services
- [ ] **Monitoring**: Complete health check coverage

### **Operational Success Criteria**  
- [ ] **Clear Boundaries**: Each service has distinct purpose
- [ ] **Easy Deployment**: Independent service deployments
- [ ] **Simple Maintenance**: Clear service ownership
- [ ] **Effective Monitoring**: Real-time service health visibility
- [ ] **Automated Recovery**: Services auto-restart on failure

### **Business Success Criteria**
- [ ] **Faster Development**: Reduced development complexity
- [ ] **Better Reliability**: Isolated failure domains
- [ ] **Easier Scaling**: Independent service scaling
- [ ] **Reduced Costs**: Optimized resource utilization
- [ ] **Improved Security**: Service boundary protection

---

## 🎯 EXECUTION TIMELINE

### **Week 1: Stabilization & Planning**
- **Monday-Tuesday**: Service audit, backup, and documentation
- **Wednesday-Thursday**: Conflict resolution planning and port allocation
- **Friday**: Migration strategy finalization and team alignment

### **Week 2: Service Extraction**
- **Monday-Tuesday**: Extract Onasis Gateway from embedded locations
- **Wednesday**: Consolidate MCP servers and resolve conflicts  
- **Thursday-Friday**: Separate memory services and test functionality

### **Week 3: Optimization & Testing**
- **Monday-Tuesday**: Performance optimization and resource allocation
- **Wednesday**: Configuration management and service discovery
- **Thursday-Friday**: Comprehensive testing and validation

### **Week 4: Production Deployment**  
- **Monday-Tuesday**: Final configurations and monitoring setup
- **Wednesday**: Staged production deployment
- **Thursday**: Documentation and automated deployment setup
- **Friday**: Final validation and success metric verification

---

## 🔄 POST-SEPARATION MAINTENANCE

### **Ongoing Monitoring**
- **Service Health**: Automated health checks every 30 seconds
- **Performance Metrics**: Response time, memory usage, CPU utilization
- **Error Tracking**: Comprehensive error logging and alerting
- **Security Monitoring**: Service isolation and access control

### **Regular Maintenance Tasks**
- **Weekly**: Service health review and performance optimization
- **Monthly**: Security audit and dependency updates
- **Quarterly**: Architecture review and scaling assessment
- **Annually**: Complete service redesign evaluation

---

## 🎯 IMMEDIATE NEXT STEPS

### **TODAY (High Priority)**
1. **Review this plan** with stakeholders and team members
2. **Schedule downtime windows** for migration phases
3. **Create VPS backup** before any changes
4. **Test current services** to establish baseline functionality

### **THIS WEEK**
1. **Execute Phase 1** - Service audit and backup
2. **Finalize migration strategy** based on service testing results
3. **Prepare development environment** for service extraction
4. **Set up monitoring infrastructure** for migration tracking

### **NEXT WEEK**
1. **Begin Phase 2** - Service extraction and consolidation
2. **Monitor service health** throughout migration
3. **Test each migrated service** before proceeding to next
4. **Update documentation** as services are separated

---

**📊 Separation Plan Summary:**
- **Timeline**: 4 weeks for complete separation
- **Services to Separate**: 5 main services + infrastructure
- **Risk Level**: MEDIUM (with proper backup and rollback procedures)
- **Business Impact**: HIGH POSITIVE (improved development velocity and reliability)
- **Resource Requirement**: MODERATE (mainly time and careful execution)
- **Success Probability**: HIGH (with systematic approach and proper testing)