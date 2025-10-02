# 🗺️ VPS Services Mapping & Deployment Analysis
**Generated:** 2025-10-02T17:29:55Z  
**VPS Server:** 168.231.74.29:2222  
**Analysis Scope:** Complete VPS service inventory and local project comparison  

---

## 📊 EXECUTIVE SUMMARY

**Critical Discovery**: Your VPS contains **EMBEDDED onasis-gateway components** within multiple projects, creating service ambiguity and potential conflicts. This analysis provides a complete map for clean service separation.

### **Service Deployment Status:**
- ✅ **2 Active MCP Servers** running via PM2 (7 days uptime)
- 🔄 **3 Embedded Onasis Components** across different projects  
- ⚠️ **Module Loading Issues** in current MCP servers
- 🔄 **Mixed Architecture** with overlapping functionality

---

## 🏗️ CURRENT VPS ARCHITECTURE MAP

### **🟢 ACTIVE SERVICES (Currently Running)**

#### **1. Lanonasis MCP Server** 
- **Location**: `/opt/mcp-servers/lanonasis-standalone/current/`
- **Status**: ✅ **RUNNING** (PM2 ID: 1, PID: 1012, Port: 3001)
- **Uptime**: 7 days
- **Issues**: ⚠️ Module not found errors in logs
- **Architecture**: Large TypeScript/Node.js project
- **Key Files**:
  - `simple-mcp-server.cjs` (running process)  
  - `unified-mcp-server.ts` (43KB - comprehensive server)
  - `src/` with 10 subdirectories (complete MCP infrastructure)
  - `http-bridge.js`, `index.js`

#### **2. Enhanced MCP Server**
- **Location**: `/opt/mcp-servers/lanonasis-standalone/current/`  
- **Status**: ✅ **RUNNING** (PM2 ID: 0, PID: 1005)
- **Uptime**: 7 days
- **Issues**: ⚠️ Module loading errors
- **Note**: Shares same directory as Lanonasis server

#### **3. Nginx Reverse Proxy**
- **Status**: ✅ **ACTIVE**
- **Ports**: 80, 8080, 8081
- **Function**: Load balancing and routing

#### **4. Redis Server** 
- **Status**: ✅ **ACTIVE**
- **Port**: 6379 (localhost)
- **Function**: Caching and session management

### **📁 EMBEDDED ONASIS COMPONENTS (Discovery)**

#### **🎯 COMPONENT 1: Fixer Initiative - Onasis Gateway**
- **Location**: `/root/fixer-initiative/ecosystem-projects/onasis-gateway/`
- **Status**: 🔄 **DEPLOYED BUT INACTIVE**
- **Structure**:
  ```
  onasis-gateway/
  ├── database/          # Database schemas
  ├── mcp-server/        # MCP server implementation
  │   ├── tools/credit/  # Credit service tools  
  │   └── types/         # TypeScript definitions
  └── services/
      └── credit-as-a-service/  # Service implementation
          ├── client.js
          ├── test.js  
          └── webhooks.js
  ```
- **Integration Plan**: Has detailed integration documentation
- **Overlap**: 🔴 **CONFLICTS** with local onasis-gateway

#### **🎯 COMPONENT 2: Ghost Protocol - API Gateway**
- **Location**: `/root/ghost-protocol/api-gateway-server.js`
- **Status**: 🔄 **DEPLOYED BUT INACTIVE**  
- **Size**: 10KB standalone server
- **Function**: API gateway functionality
- **Overlap**: 🔴 **CONFLICTS** with onasis-gateway API layer

#### **🎯 COMPONENT 3: Ghost Protocol - Enhanced Memory Server**
- **Location**: `/root/ghost-protocol/enhanced-memory-server.js`
- **Status**: 🔄 **DEPLOYED BUT INACTIVE**
- **Size**: 15KB memory management server
- **Function**: Memory-as-a-Service implementation
- **Overlap**: 🔴 **CONFLICTS** with local Onasis-CORE memory services

### **🗂️ SUPPORTING PROJECTS**

#### **Fixer Initiative** (Payment Hub)
- **Location**: `/root/fixer-initiative/`
- **Status**: 🟢 **COMPREHENSIVE DEPLOYMENT**
- **Size**: Large project with 11 ecosystem projects
- **Key Components**:
  - PayStack integration and analysis
  - SaySwitch authentication systems  
  - Production webhook handlers
  - Database schemas for payment services
  - **Contains**: Embedded onasis-gateway integration

#### **VortexCore Dashboard** (Frontend)
- **Location**: `/root/vortexcore-dashboard/`  
- **Status**: 🟡 **DEPLOYED, NOT ACTIVE**
- **Type**: React/TypeScript frontend
- **Function**: Admin dashboard interface
- **Components**: Standard React structure with admin/client dirs

#### **Legacy Agent Banks** (Archived)
- **Location**: `/root/agent-banks-placeholder/`, `agent-banks-backup-*.tar.gz`
- **Status**: 🔴 **ARCHIVED/DEPRECATED**
- **Note**: Referenced in old aliases we removed

---

## 🔍 LOCAL VS VPS PROJECT COMPARISON

### **🏠 LOCAL WORKSPACE STRUCTURE**
```
Local Machine:
├── /Users/seyederick/onasis-gateway/           # 🆕 PRIMARY API WAREHOUSE
│   ├── 24+ API service integrations           
│   ├── .devops_context/ (just created)       
│   ├── Comprehensive MCP server              
│   ├── 49,812 lines of TypeScript/JavaScript
│   └── Production-ready but deployment blocked
│
├── /Users/seyederick/DevOps/_project_folders/Onasis-CORE/  # 🆕 PRIVACY PLATFORM  
│   ├── Privacy-first infrastructure
│   ├── Multi-service architecture
│   ├── unified-router.js
│   └── Supabase integration
│
└── /Users/seyederick/CascadeProjects/sd-ghost-protocol/    # 🔄 ACTIVE PROJECT
    └── (Contents to be explored)
```

### **☁️ VPS DEPLOYED STRUCTURE**  
```
VPS Server (168.231.74.29):
├── /opt/mcp-servers/lanonasis-standalone/      # 🟢 ACTIVE MCP HUB
│   ├── 2 running MCP servers
│   ├── 43KB unified-mcp-server.ts  
│   ├── Module loading issues
│   └── Port 3001 active
│
├── /root/fixer-initiative/                     # 🟢 PAYMENT ECOSYSTEM
│   ├── ecosystem-projects/onasis-gateway/      # 🔴 EMBEDDED COMPONENT
│   ├── PayStack + SaySwitch integrations
│   ├── Production webhook handlers
│   └── 11 ecosystem projects
│
├── /root/ghost-protocol/                       # 🟡 GHOST PROTOCOL SERVICES  
│   ├── api-gateway-server.js                  # 🔴 EMBEDDED COMPONENT
│   ├── enhanced-memory-server.js              # 🔴 EMBEDDED COMPONENT  
│   ├── Multiple test and integration files
│   └── 248 node_modules (substantial project)
│
└── /root/vortexcore-dashboard/                 # 🟡 FRONTEND INTERFACE
    ├── React/TypeScript dashboard
    ├── Admin and client interfaces
    └── Configuration files
```

---

## 🚨 CRITICAL SERVICE CONFLICTS IDENTIFIED

### **🔴 CONFLICT 1: Multiple Onasis Gateway Implementations**

| Location | Type | Status | Functionality |
|----------|------|---------|---------------|
| **Local** `/onasis-gateway/` | Full Implementation | Development | 24+ API services, MCP server, comprehensive |
| **VPS** `/fixer-initiative/.../onasis-gateway/` | Embedded Component | Inactive | Credit services, basic MCP tools |
| **VPS** `/ghost-protocol/api-gateway-server.js` | Standalone Server | Inactive | Basic API gateway |

**Impact**: 🔴 **CRITICAL** - Multiple gateway implementations cause confusion and resource conflicts

### **🔴 CONFLICT 2: MCP Server Architecture Overlap**

| Component | Location | Status | Functionality |
|-----------|----------|--------|---------------|
| **VPS Active** `lanonasis-mcp-server` | `/opt/mcp-servers/` | Running | Unified MCP server (43KB) |
| **Local** `onasis-gateway MCP` | `/onasis-gateway/mcp-server/` | Development | 24+ service adapters |
| **VPS Embedded** `onasis-gateway MCP` | `/fixer-initiative/.../` | Inactive | Credit service tools |

**Impact**: 🔴 **HIGH** - MCP server conflicts and module loading issues

### **🔴 CONFLICT 3: Memory Service Duplication**

| Implementation | Location | Status | Functionality |
|----------------|----------|--------|---------------|
| **Local** `Onasis-CORE` | `/Onasis-CORE/` | Development | Privacy-first memory platform |
| **VPS** `enhanced-memory-server.js` | `/ghost-protocol/` | Inactive | Memory-as-a-Service |
| **VPS** `lanonasis-mcp-server` | `/opt/mcp-servers/` | Running | Memory tools integrated |

**Impact**: 🟡 **MEDIUM** - Feature duplication and unclear service boundaries

---

## 📈 RESOURCE UTILIZATION ANALYSIS

### **VPS Resource Usage**
- **CPU**: 0.15 load (very light, room for more services)
- **Memory**: 23% (healthy, room for expansion)  
- **Disk**: 29% of 48GB (plenty of space)
- **Network**: Ports 3001, 8080-8081, 80 active

### **Service Performance**
- **Lanonasis MCP**: 55.7MB memory, stable 7-day uptime  
- **Enhanced MCP**: 66.4MB memory, stable 7-day uptime
- **Issue**: Module loading errors suggest configuration problems

### **Deployment Efficiency**
- ✅ **PM2 Management**: Professional process management
- ✅ **Nginx Load Balancing**: Proper reverse proxy setup
- ✅ **Redis Caching**: Performance optimization in place
- ⚠️ **Service Overlap**: Resource waste from duplicate functionality

---

## 🎯 SERVICE SEPARATION STRATEGY

### **🔥 IMMEDIATE PRIORITIES**

#### **Phase 1: Service Identification (This Week)**
1. **Audit Active Services** - Understand what's actually running
2. **Map Dependencies** - Document service interconnections  
3. **Identify Conflicts** - Mark overlapping functionality
4. **Plan Migration** - Design clean separation strategy

#### **Phase 2: Clean Separation (Week 2)**
1. **Consolidate MCP Servers** - Single unified MCP implementation
2. **Separate Gateway Functions** - Distinct API gateway service
3. **Isolate Memory Services** - Dedicated memory/privacy platform  
4. **Archive Legacy** - Clean up deprecated components

#### **Phase 3: Optimized Deployment (Week 3-4)**
1. **Deploy Separated Services** - Clean, isolated deployments
2. **Performance Optimization** - Resource efficiency improvements
3. **Monitoring Setup** - Service health and performance tracking
4. **Documentation** - Complete service documentation

### **🎯 RECOMMENDED ARCHITECTURE**

```
CLEAN SEPARATED ARCHITECTURE:

┌─ VPS Services (168.231.74.29) ─────────────────────────┐
│                                                        │
│  🟢 Lanonasis MCP Hub (Port 3001)                     │
│     ├─ Unified MCP server                             │
│     ├─ Service discovery                              │
│     └─ Tool registry                                  │
│                                                        │
│  🟢 Onasis Gateway (Port 3002)                        │
│     ├─ 24+ API service integrations                   │
│     ├─ Authentication & rate limiting                 │
│     └─ Service proxying                               │
│                                                        │
│  🟢 Onasis Privacy Core (Port 3003)                   │
│     ├─ Privacy-first infrastructure                   │
│     ├─ Data masking & anonymization                   │
│     └─ Identity protection                            │
│                                                        │
│  🟢 Payment Hub (Port 3004)                           │
│     ├─ PayStack & SaySwitch integrations             │
│     ├─ Webhook handlers                               │
│     └─ Payment routing                                │
│                                                        │
│  🟢 VortexCore Dashboard (Port 3005)                  │
│     ├─ Admin interface                                │
│     ├─ Service monitoring                             │
│     └─ Configuration management                       │
│                                                        │
└────────────────────────────────────────────────────────┘

🔄 Load Balancer (Nginx) - Ports 80, 8080, 8081
🔄 Redis Cache - Port 6379  
🔄 Monitoring & Health Checks
```

---

## 📋 ACTION PLAN FOR SERVICE SEPARATION

### **🚀 QUICK WINS (1-3 Days)**
- [ ] **Document Current State** - Complete this mapping ✅
- [ ] **Stop Conflicting Services** - Shut down duplicate/inactive services
- [ ] **Backup Critical Data** - Ensure no data loss during separation
- [ ] **Test Active Services** - Verify what's actually working

### **🔧 SEPARATION TASKS (1-2 Weeks)**
- [ ] **Extract Embedded Components** - Move onasis-gateway out of fixer-initiative
- [ ] **Consolidate MCP Servers** - Single unified MCP implementation  
- [ ] **Separate API Gateways** - Distinct gateway service
- [ ] **Archive Legacy Code** - Clean up ghost-protocol embedded components
- [ ] **Deploy Clean Services** - Isolated, purpose-built deployments

### **✅ OPTIMIZATION GOALS (2-4 Weeks)**
- [ ] **Performance Monitoring** - Service health dashboards
- [ ] **Resource Optimization** - Efficient resource utilization
- [ ] **Documentation** - Complete service documentation  
- [ ] **Automated Deployment** - CI/CD pipelines for each service
- [ ] **Service Discovery** - Automatic service registration and discovery

---

## 🎯 SUCCESS METRICS

### **Before Separation (Current State)**
- ❌ **Service Clarity**: Confusing overlaps and conflicts
- ❌ **Resource Efficiency**: Duplicate functionality waste  
- ❌ **Deployment Complexity**: Mixed architectures
- ❌ **Maintenance Burden**: Scattered components

### **After Separation (Target State)**  
- ✅ **Service Clarity**: Each service has clear, distinct purpose
- ✅ **Resource Efficiency**: No duplicate functionality  
- ✅ **Deployment Simplicity**: Clean, isolated deployments
- ✅ **Maintenance Ease**: Well-organized, documented services

### **Business Impact**
- 🎯 **Faster Development**: Clear service boundaries
- 🎯 **Better Reliability**: Isolated failure domains
- 🎯 **Easier Scaling**: Independent service scaling  
- 🎯 **Reduced Complexity**: Simplified architecture
- 🎯 **Improved Performance**: Resource optimization

---

## 🔍 NEXT STEPS RECOMMENDATION

### **IMMEDIATE ACTION (Today)**
1. **Review this mapping** with your team/stakeholders
2. **Identify critical services** that must remain running
3. **Plan downtime windows** for service separation
4. **Backup strategy** for data protection

### **THIS WEEK**
1. **Service audit** - Test what's actually working
2. **Dependency mapping** - Understand service interconnections
3. **Migration planning** - Detailed separation strategy
4. **Resource allocation** - Plan VPS resource distribution

### **NEXT WEEK**  
1. **Begin separation** - Start with least critical services
2. **Progressive migration** - Move services to clean architecture
3. **Testing and validation** - Ensure functionality preservation
4. **Documentation updates** - Keep service docs current

---

**📊 Repository Analysis Stats:**
- **VPS Projects**: 4 main projects, 11 ecosystem sub-projects
- **Active Services**: 2 MCP servers, 1 web server, 1 cache server
- **Service Conflicts**: 3 major overlaps identified  
- **Resource Utilization**: 23% memory, 29% disk (room for growth)
- **Uptime**: 7 days (stable deployment environment)
- **Business Impact**: HIGH - Clean separation will significantly improve development velocity and service reliability
