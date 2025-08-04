# 🧠 Lanonasis Ecosystem Relationship Graph

## Overview

This document provides a comprehensive relationship graph of the entire Lanonasis ecosystem, showing how different components interact, data flows, authentication paths, and service dependencies. This serves as the master reference for understanding the complete architecture.

## 🏗️ **High-Level Architecture**

```mermaid
graph TB
    subgraph "Frontend Layer"
        VSCode[VSCode Extension]
        CLI[CLI Tool @lanonasis/cli]
        Frontend[vibe-frontend Dashboard]
        Docs[docs.lanonasis.com]
    end
    
    subgraph "Gateway Layer"
        Gateway[Onasis Gateway<br/>api.lanonasis.com]
        SSE[SSE Endpoint<br/>/api/sse]
        Webhooks[Webhook Handler<br/>/api/webhooks/*]
    end
    
    subgraph "Memory Service"
        MemoryAPI[Memory API<br/>Vibe-Memory Service]
        VectorDB[Supabase PostgreSQL<br/>+ pgvector]
        OpenAI[OpenAI Embeddings<br/>text-embedding-ada-002]
    end
    
    subgraph "MCP Integration"
        MCPServer[MCP Server]
        MemoryTools[Memory MCP Tools]
        CreditTools[Credit MCP Tools]
        PaymentTools[Payment MCP Tools]
    end
    
    subgraph "Payment Services"
        Stripe[Stripe API]
        PayStack[PayStack API]
        Wise[Wise Multicurrency]
        BAP[BAP Nigerian Payments]
    end
    
    subgraph "Infrastructure"
        Hostinger[Hostinger VPS API]
        Netlify[Netlify Deployment]
        Supabase[Supabase Auth + DB]
    end
    
    %% Frontend to Gateway connections
    VSCode --> Gateway
    CLI --> Gateway
    Frontend --> Gateway
    Docs --> Gateway
    
    %% Gateway to Services
    Gateway --> MemoryAPI
    Gateway --> MCPServer
    Gateway --> SSE
    Webhooks <--> Gateway
    
    %% Memory Service connections
    MemoryAPI --> VectorDB
    MemoryAPI --> OpenAI
    MemoryAPI --> Supabase
    
    %% MCP Tools
    MCPServer --> MemoryTools
    MCPServer --> CreditTools
    MCPServer --> PaymentTools
    
    %% Payment integrations
    PaymentTools --> Stripe
    PaymentTools --> PayStack
    PaymentTools --> Wise
    PaymentTools --> BAP
    
    %% Infrastructure connections
    Gateway --> Hostinger
    Frontend --> Netlify
    MemoryAPI --> Supabase
```

## 🔐 **Authentication Flow**

```mermaid
sequenceDiagram
    participant C as Client (VSCode/CLI/Frontend)
    participant G as Onasis Gateway
    participant S as Supabase Auth
    participant M as Memory Service
    participant SSE as SSE Endpoint
    
    Note over C,SSE: Authentication & Authorization Flow
    
    C->>G: 1. Request with API Key/JWT
    G->>G: 2. Validate API Key Format
    
    alt API Key Valid
        G->>S: 3. Verify JWT (if provided)
        S-->>G: 4. User info + permissions
        G->>M: 5. Forward request with auth context
        M-->>G: 6. Service response
        G-->>C: 7. Authenticated response
        
        Note over G,SSE: Real-time notifications
        G->>SSE: 8. Broadcast auth success
        SSE-->>C: 9. SSE: auth_success event
    else API Key Invalid
        G-->>C: 401 Unauthorized
    end
```

## 📊 **Data Flow Architecture**

```mermaid
flowchart LR
    subgraph "Data Sources"
        User[User Input]
        Code[Code Selection]
        File[File Content]
        Search[Search Query]
    end
    
    subgraph "Processing Layer"
        Validate[Input Validation<br/>Zod Schemas]
        Embed[OpenAI Embedding<br/>text-embedding-ada-002]
        Store[Vector Storage<br/>PostgreSQL + pgvector]
    end
    
    subgraph "Retrieval Layer"
        SemSearch[Semantic Search<br/>Cosine Similarity]
        Filter[Filtering<br/>Type, Tags, Metadata]
        Rank[Ranking<br/>Similarity Score]
    end
    
    subgraph "Output Layer"
        API[REST API Response]
        SSE_Event[SSE Real-time Event]
        WebHook[Webhook Notification]
    end
    
    %% Data flow
    User --> Validate
    Code --> Validate
    File --> Validate
    Search --> Validate
    
    Validate --> Embed
    Embed --> Store
    
    Search --> SemSearch
    SemSearch --> Filter
    Filter --> Rank
    
    Store --> API
    Store --> SSE_Event
    Store --> WebHook
    
    Rank --> API
```

## 🚀 **Service Integration Map**

```mermaid
graph TB
    subgraph "Lanonasis Core Services"
        Memory[Memory as a Service<br/>📝 Vector Memory Management]
        Credit[Credit as a Service<br/>💳 Credit Processing Platform]
        Gateway[Onasis Gateway<br/>🌐 API Service Warehouse]
    end
    
    subgraph "18+ Integrated APIs"
        Payment1[Stripe API<br/>💰 Payment Processing]
        Payment2[PayStack API<br/>🏦 African Payments]
        Payment3[Wise MCA<br/>💱 Multi-currency]
        Payment4[BAP API<br/>🇳🇬 Nigerian Payments]
        
        Infra1[Hostinger API<br/>🖥️ VPS Management]
        Infra2[Google Analytics<br/>📊 Analytics]
        Infra3[Shutterstock API<br/>🖼️ Images]
        
        Dev1[GitHub API<br/>⚡ Repository Management]
        Dev2[NGrok API<br/>🔗 Tunneling]
        Dev3[API Testing<br/>🧪 Testing Tools]
        
        Other[... 9 more services<br/>📦 Business APIs]
    end
    
    subgraph "Development Tools"
        VSCode2[VSCode Extension<br/>🔧 IDE Integration]
        CLI2[CLI Tool<br/>⌨️ Command Line]
        SDK[TypeScript SDK<br/>📚 @lanonasis/memory-client]
    end
    
    subgraph "Frontend Interfaces"
        Dashboard[vibe-frontend<br/>🎨 Next.js Dashboard]
        Docs2[Documentation<br/>📖 docs.lanonasis.com]
        API_Explorer[API Explorer<br/>🔍 Interactive Testing]
    end
    
    %% Core service connections
    Gateway <--> Memory
    Gateway <--> Credit
    
    %% API integrations
    Gateway <--> Payment1
    Gateway <--> Payment2
    Gateway <--> Payment3
    Gateway <--> Payment4
    Gateway <--> Infra1
    Gateway <--> Infra2
    Gateway <--> Infra3
    Gateway <--> Dev1
    Gateway <--> Dev2
    Gateway <--> Dev3
    Gateway <--> Other
    
    %% Development tools
    VSCode2 <--> Gateway
    CLI2 <--> Gateway
    SDK <--> Gateway
    
    %% Frontend interfaces
    Dashboard <--> Gateway
    Docs2 <--> Gateway
    API_Explorer <--> Gateway
```

## 🔄 **Memory Service Lifecycle**

```mermaid
stateDiagram-v2
    [*] --> Draft
    
    Draft --> Active: Create Memory
    Draft --> Deleted: Delete Draft
    
    Active --> Updated: Update Content
    Updated --> Active: Save Changes
    
    Active --> Archived: Archive Memory
    Archived --> Active: Restore Memory
    
    Active --> Deleted: Delete Memory
    Archived --> Deleted: Delete Archived
    
    Updated --> Versioned: Create Version
    Versioned --> Active: Current Version
    
    Deleted --> [*]: Permanent Deletion
    
    note right of Active
        Memory is searchable
        Generates embeddings
        Triggers webhooks
        Updates statistics
    end note
    
    note right of Deleted
        GDPR compliant deletion
        Audit trail maintained
        Webhook notifications sent
        Statistics updated
    end note
```

## 📡 **Real-time Communication Flow**

```mermaid
sequenceDiagram
    participant V as VSCode Extension
    participant F as Frontend Dashboard
    participant G as Onasis Gateway
    participant SSE as SSE Endpoint
    participant M as Memory Service
    participant W as Webhook Handler
    
    Note over V,W: Real-time Notification System
    
    %% SSE Connection Setup
    V->>SSE: Connect to /api/sse
    F->>SSE: Connect to /api/sse
    SSE-->>V: Connection established
    SSE-->>F: Connection established
    
    %% Memory Operation
    V->>G: Create memory (API call)
    G->>M: Forward to Memory Service
    M-->>G: Memory created response
    G-->>V: Success response
    
    %% Webhook & SSE Notification
    M->>W: Send webhook: memory.created
    W->>G: POST /api/webhooks/memory
    G->>SSE: Broadcast to user's SSE clients
    SSE-->>V: SSE: memory.created event
    SSE-->>F: SSE: memory.created event
    
    %% Dashboard Update
    F->>F: Update memory list in real-time
    V->>V: Refresh tree view
    
    Note over V,W: User sees updates instantly across all interfaces
```

## 🛡️ **Security & Compliance Architecture**

```mermaid
graph TB
    subgraph "Authentication Layer"
        APIKey[API Key Validation<br/>onasis_[base64]]
        JWT[JWT Token Validation<br/>Supabase Auth]
        HMAC[HMAC Signature<br/>Financial Operations]
    end
    
    subgraph "Authorization Layer"
        RLS[Row Level Security<br/>PostgreSQL RLS Policies]
        RBAC[Role-Based Access<br/>Admin/User/Viewer]
        Plans[Plan-Based Features<br/>Free/Pro/Enterprise]
    end
    
    subgraph "Data Protection"
        Encrypt[Encryption at Rest<br/>AES-256 via Supabase]
        TLS[TLS 1.3 in Transit<br/>Perfect Forward Secrecy]
        PII[PII Detection & Masking<br/>Automatic Privacy Protection]
    end
    
    subgraph "Compliance Frameworks"
        GDPR[GDPR Compliance<br/>EU Data Protection]
        HIPAA[HIPAA Framework<br/>Healthcare Data]
        SOC2[SOC 2 Type II<br/>Security Controls]
        ISO[ISO 27001/27002<br/>Security Management]
    end
    
    subgraph "Monitoring & Auditing"
        Logs[Structured Logging<br/>Winston + JSON Format]
        Metrics[Prometheus Metrics<br/>Performance & Usage]
        Audit[Audit Trails<br/>Immutable Event Logs]
        SIEM[SIEM Integration<br/>Splunk/ELK Compatible]
    end
    
    %% Security flow
    APIKey --> RLS
    JWT --> RBAC
    HMAC --> Plans
    
    RLS --> Encrypt
    RBAC --> TLS
    Plans --> PII
    
    Encrypt --> GDPR
    TLS --> HIPAA
    PII --> SOC2
    
    GDPR --> Logs
    HIPAA --> Metrics
    SOC2 --> Audit
    ISO --> SIEM
```

## 💾 **Database Schema Relationships**

```mermaid
erDiagram
    ORGANIZATIONS {
        uuid id PK
        string name
        string plan
        jsonb settings
        timestamp created_at
        timestamp updated_at
    }
    
    USERS {
        uuid id PK
        uuid organization_id FK
        string email
        string role
        jsonb metadata
        timestamp created_at
    }
    
    API_KEYS {
        uuid id PK
        uuid user_id FK
        string key_hash
        string name
        jsonb permissions
        integer rate_limit
        timestamp expires_at
        timestamp created_at
    }
    
    MEMORY_ENTRIES {
        uuid id PK
        uuid user_id FK
        uuid topic_id FK
        string title
        text content
        string memory_type
        string status
        string[] tags
        jsonb metadata
        vector embedding
        float relevance_score
        integer access_count
        timestamp last_accessed
        timestamp created_at
        timestamp updated_at
    }
    
    MEMORY_TOPICS {
        uuid id PK
        uuid user_id FK
        uuid parent_topic_id FK
        string name
        text description
        string color
        string icon
        boolean is_system
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
    
    MEMORY_VERSIONS {
        uuid id PK
        uuid memory_id FK
        uuid user_id FK
        text content_diff
        jsonb metadata_diff
        string change_type
        string change_reason
        timestamp created_at
    }
    
    USAGE_ANALYTICS {
        uuid id PK
        uuid user_id FK
        string event_type
        jsonb event_data
        string ip_address
        string user_agent
        timestamp created_at
    }
    
    %% Relationships
    ORGANIZATIONS ||--o{ USERS : "has many"
    USERS ||--o{ API_KEYS : "owns"
    USERS ||--o{ MEMORY_ENTRIES : "creates"
    USERS ||--o{ MEMORY_TOPICS : "organizes"
    MEMORY_ENTRIES ||--o{ MEMORY_VERSIONS : "has versions"
    MEMORY_TOPICS ||--o{ MEMORY_ENTRIES : "categorizes"
    MEMORY_TOPICS ||--o{ MEMORY_TOPICS : "nested hierarchy"
    USERS ||--o{ USAGE_ANALYTICS : "generates"
```

## 🔧 **MCP Tool Integration**

```mermaid
graph LR
    subgraph "MCP Server Tools"
        MemoryMCP[Memory MCP Tools<br/>12 tools available]
        CreditMCP[Credit MCP Tools<br/>15 tools available]
        PaymentMCP[Payment MCP Tools<br/>50+ tools available]
    end
    
    subgraph "Memory Tools"
        M1[memory_create_memory]
        M2[memory_search_memories]
        M3[memory_get_memory]
        M4[memory_update_memory]
        M5[memory_delete_memory]
        M6[memory_list_memories]
        M7[memory_create_topic]
        M8[memory_get_topics]
        M9[memory_get_stats]
        M10[memory_bulk_delete]
        M11[memory_health_check]
        M12[memory_test_connection]
    end
    
    subgraph "AI Agents"
        Claude[Claude Code]
        ChatGPT[ChatGPT]
        Custom[Custom AI Agents]
    end
    
    subgraph "Integration Clients"
        VSCode3[VSCode Extensions]
        WebApps[Web Applications]
        CLITools[CLI Applications]
        Scripts[Automation Scripts]
    end
    
    %% MCP connections
    MemoryMCP --> M1
    MemoryMCP --> M2
    MemoryMCP --> M3
    MemoryMCP --> M4
    MemoryMCP --> M5
    MemoryMCP --> M6
    MemoryMCP --> M7
    MemoryMCP --> M8
    MemoryMCP --> M9
    MemoryMCP --> M10
    MemoryMCP --> M11
    MemoryMCP --> M12
    
    %% AI Agent integration
    Claude <--> MemoryMCP
    ChatGPT <--> MemoryMCP
    Custom <--> MemoryMCP
    
    %% Client integration
    VSCode3 <--> MemoryMCP
    WebApps <--> MemoryMCP
    CLITools <--> MemoryMCP
    Scripts <--> MemoryMCP
```

## 🌐 **Deployment Architecture**

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer<br/>Netlify/Vercel]
        CDN[CDN<br/>Global Distribution]
    end
    
    subgraph "Application Layer"
        Gateway2[Onasis Gateway<br/>Node.js + Express]
        Memory2[Memory Service<br/>TypeScript + Supabase]
        Frontend2[vibe-frontend<br/>Next.js]
    end
    
    subgraph "Database Layer"
        Primary[Primary Database<br/>Supabase PostgreSQL]
        Vector[Vector Storage<br/>pgvector extension]
        Cache[Redis Cache<br/>Optional]
    end
    
    subgraph "External Services"
        OpenAI2[OpenAI API<br/>Embeddings]
        Stripe2[Stripe API<br/>Payments]
        Auth[Supabase Auth<br/>Authentication]
    end
    
    subgraph "Monitoring"
        Logs2[Structured Logs<br/>Winston]
        Metrics2[Prometheus<br/>Metrics]
        Health[Health Checks<br/>Kubernetes Ready]
    end
    
    %% Traffic flow
    LB --> CDN
    CDN --> Gateway2
    CDN --> Frontend2
    
    Gateway2 --> Memory2
    Memory2 --> Primary
    Primary <--> Vector
    Memory2 -.-> Cache
    
    Memory2 --> OpenAI2
    Gateway2 --> Stripe2
    Memory2 --> Auth
    
    Gateway2 --> Logs2
    Memory2 --> Metrics2
    Gateway2 --> Health
```

## 📈 **Analytics & Monitoring Flow**

```mermaid
graph LR
    subgraph "Data Collection"
        APIReq[API Requests]
        UserAction[User Actions]
        SystemEvent[System Events]
        Errors[Error Events]
    end
    
    subgraph "Processing"
        Logger[Winston Logger<br/>Structured JSON]
        Metrics[Prometheus<br/>Time Series]
        Analytics[Usage Analytics<br/>PostgreSQL]
    end
    
    subgraph "Storage"
        LogFiles[Log Files<br/>Rotated Daily]
        MetricsDB[Metrics Database<br/>Time Series Data]
        AnalyticsDB[Analytics Tables<br/>Partitioned by Date]
    end
    
    subgraph "Visualization"
        Grafana[Grafana Dashboard<br/>Real-time Metrics]
        Dashboard2[Admin Dashboard<br/>Usage Statistics]
        Alerts[Alert Manager<br/>Threshold Monitoring]
    end
    
    %% Data flow
    APIReq --> Logger
    UserAction --> Analytics
    SystemEvent --> Metrics
    Errors --> Logger
    
    Logger --> LogFiles
    Metrics --> MetricsDB
    Analytics --> AnalyticsDB
    
    LogFiles --> Grafana
    MetricsDB --> Dashboard2
    AnalyticsDB --> Alerts
```

## 🔗 **API Endpoint Mapping**

### Memory Service Endpoints
```
Base URL: https://api.lanonasis.com/api/v1

Authentication: X-API-Key: onasis_[base64] | Authorization: Bearer [jwt]

Memory Management:
├── POST   /memory                    → Create memory
├── GET    /memory                    → List memories (paginated)
├── POST   /memory/search             → Semantic search
├── GET    /memory/{id}               → Get specific memory
├── PUT    /memory/{id}               → Update memory
├── DELETE /memory/{id}               → Delete memory
├── POST   /memory/bulk/delete        → Bulk delete (Pro/Enterprise)
└── GET    /memory/stats              → Memory statistics

Topic Management:
├── POST   /topics                    → Create topic
├── GET    /topics                    → List topics
├── GET    /topics/{id}               → Get topic
├── PUT    /topics/{id}               → Update topic
└── DELETE /topics/{id}               → Delete topic

System:
├── GET    /health                    → Health check
└── GET    /user/data-export          → GDPR data export
```

### Onasis Gateway Endpoints
```
Base URL: https://api.lanonasis.com

Gateway Services:
├── GET    /health                    → Gateway health
├── GET    /api/adapters              → List all service adapters
├── GET    /api/tools                 → List all available tools
├── POST   /api/adapters/{service}/tools/{tool} → Execute tool
├── GET    /api/sse                   → Server-Sent Events
├── POST   /api/sse/auth              → SSE authentication
└── POST   /api/webhooks/memory       → Memory service webhooks

Credit as a Service:
├── POST   /api/credit/applications   → Submit credit application
├── GET    /api/credit/applications   → List applications
├── GET    /api/credit/providers      → List credit providers
└── POST   /api/credit/transactions   → Process transactions

Payment Services:
├── POST   /api/payments/stripe       → Stripe integration
├── POST   /api/payments/paystack     → PayStack integration
├── POST   /api/payments/wise         → Wise integration
└── POST   /api/payments/bap          → BAP integration
```

## 🎯 **Future Integration Points**

```mermaid
graph TB
    subgraph "Current State (2025 Q1)"
        Current[18+ Service Integrations<br/>Memory + Credit Services<br/>VSCode + CLI + Frontend]
    end
    
    subgraph "Planned Integrations (2025 Q2)"
        Cursor[Cursor IDE Extension]
        Windsurf[Windsurf Platform]
        Mobile[Mobile App<br/>React Native]
        Slack[Slack Bot Integration]
    end
    
    subgraph "Advanced Features (2025 Q3)"
        Federation[Memory Federation<br/>Cross-instance sync]
        AIOrg[AI-powered Organization<br/>Auto-categorization]
        Analytics[Advanced Analytics<br/>Usage insights]
        Enterprise[Enterprise SSO<br/>SAML/OIDC]
    end
    
    subgraph "Scale & Expansion (2025 Q4)"
        Marketplace[Plugin Marketplace<br/>3rd-party extensions]
        API_Gateway[Advanced API Gateway<br/>Rate limiting + caching]
        Multi_Region[Multi-region Deployment<br/>Global CDN]
        White_Label[White-label Solutions<br/>Custom branding]
    end
    
    Current --> Cursor
    Current --> Windsurf
    Current --> Mobile
    Current --> Slack
    
    Cursor --> Federation
    Windsurf --> AIOrg
    Mobile --> Analytics
    Slack --> Enterprise
    
    Federation --> Marketplace
    AIOrg --> API_Gateway
    Analytics --> Multi_Region
    Enterprise --> White_Label
```

## 📋 **Integration Checklist**

### ✅ Completed Integrations
- **Memory as a Service**: Full vector memory platform
- **VSCode Extension**: IDE integration with tree view, search, create
- **CLI Tool**: Command-line interface (@lanonasis/cli)
- **TypeScript SDK**: Client library (@lanonasis/memory-client)
- **Onasis Gateway**: 18+ API service integrations
- **MCP Server**: AI agent tool integration
- **SSE Support**: Real-time notifications
- **vibe-frontend**: Next.js dashboard
- **Authentication**: JWT + API key system
- **Compliance**: GDPR, HIPAA, SOC 2 frameworks

### 🔄 In Progress
- **Extended Gateway Integration**: Memory service adapter
- **Real-time Dashboard**: SSE-powered live updates
- **Comprehensive Testing**: Integration and E2E tests
- **Documentation**: API documentation site

### ⏳ Planned
- **Cursor IDE**: Extension porting
- **Windsurf Platform**: Integration development
- **Mobile App**: React Native implementation
- **Advanced Analytics**: Usage insights and reporting
- **Plugin Marketplace**: 3rd-party extension ecosystem

---

## 🔧 **Development Reference**

### Key File Locations
```
Lanonasis Ecosystem Structure:
├── vibe-memory/                          # Core Memory Service
│   ├── src/                             # TypeScript source
│   ├── vscode-extension/                # VSCode integration
│   ├── cli/                             # CLI tool
│   └── sdk/                             # TypeScript SDK
├── vibe-frontend/                        # Next.js Dashboard
│   ├── app/                             # App router pages
│   ├── components/                      # UI components
│   └── lib/                             # Utilities
├── onasis-gateway/                       # API Service Warehouse
│   ├── services/                        # Service adapters
│   ├── mcp-server/                      # MCP integration
│   ├── core/                            # Shared utilities
│   └── scripts/                         # Management tools
└── docs/                                # Documentation
    ├── api/                             # API documentation
    ├── guides/                          # User guides
    └── architecture/                    # System design
```

### Environment Variables
```bash
# Memory Service
MEMORY_API_URL=https://api.lanonasis.com
MEMORY_API_KEY=onasis_[your_key]
SUPABASE_URL=https://[project].supabase.co
SUPABASE_KEY=[anon_key]
OPENAI_API_KEY=[openai_key]

# Onasis Gateway
PORT=3001
CORS_ORIGIN=*
MEMORY_WEBHOOK_SECRET=[webhook_secret]

# Authentication
JWT_SECRET=[jwt_secret]
SUPABASE_SERVICE_KEY=[service_key]

# Optional
REDIS_URL=[redis_connection]
LOG_LEVEL=info
ENABLE_METRICS=true
```

This comprehensive relationship graph serves as the master reference for understanding how all components of the Lanonasis ecosystem interact, providing clear guidance for future development and integration efforts.