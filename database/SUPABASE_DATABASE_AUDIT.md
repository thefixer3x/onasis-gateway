# 🗄️ Supabase Database Audit - Multi-Project Architecture

**Database**: `mxtsdgkwzjzlttpotole.supabase.co`
**Date**: 2025-10-11
**Total Tables**: 68
**Issue**: Multiple projects sharing same database without proper namespacing

---

## 🚨 Critical Problems Identified

1. **No Table Namespacing** - Can't tell which project owns which table
2. **Schema Mismatches** - Code expects different columns than what exists
3. **Unknown Users** - Dashboard shows users but can't identify which project they belong to
4. **Cross-Project Pollution** - Tables from different projects mixing together
5. **Migration Conflicts** - Today's migrations added policies but unclear which project

---

## 📊 Table Inventory by Project (Best Guess)

### 🏦 Agent Banks Project (3 tables)
```
- agent_banks_memories
- agent_banks_memory_search_logs
- agent_banks_sessions
```
**Purpose**: Banking agent with memory system
**Status**: Likely separate project, well-namespaced

### 📄 E-Doc Project (3 tables)
```
- edoc_consents
- edoc_financial_analysis
- edoc_transactions
- edoc_usage_logs
```
**Purpose**: Document management/financial analysis
**Status**: Well-namespaced

### 💳 SaySwitch/Payment Project (3 tables)
```
- say_bills
- say_orders
- say_transfers
```
**Purpose**: SaySwitch payment integration
**Status**: Well-namespaced

### 🧠 Memory-as-a-Service / MCP Core (3 tables)
```
- memory_entries          ⚠️ Used by MCP Core
- memory_access_patterns
- memory_search_analytics
```
**Purpose**: MCP memory management
**Status**: Shared by multiple projects - CONFLICT RISK

### 💬 Chat System (2 tables)
```
- chat_conversations
- chat_messages
```
**Purpose**: Chat/messaging feature
**Status**: Unknown owner

### 🌀 Vortex Project (1 table)
```
- vortex_items
```
**Purpose**: Unknown
**Status**: Possibly abandoned

### 🔐 Authentication & Users (SHARED - HIGH RISK)
```
- users                   ⚠️ SHARED BY ALL PROJECTS
- simple_users
- user_sessions
- user_activity_logs
- user_consents
- user_preferences
- user_product_interactions
- user_roles
- user_tiers
- user_payments
- sessions                ⚠️ SHARED
- oauth_sessions
```
**Purpose**: User management across all projects
**Status**: ⚠️ **CRITICAL** - No way to separate users by project

### 🔑 API Keys (SHARED - HIGH RISK)
```
- api_keys                ⚠️ SHARED BY ALL PROJECTS
- vendor_api_keys
- vendor_key_audit_log
```
**Purpose**: API authentication
**Status**: ⚠️ **CRITICAL** - Schema mismatch with mcp-core code

### 🏢 Organizations & Companies
```
- organizations           ⚠️ Multi-tenant key
- company_endpoints
- company_projects
- company_services
- company_usage_logs
- business_profiles
- business_financial_insights
```
**Purpose**: Multi-tenant organization management
**Status**: Designed for separation but not fully utilized

### 💰 Payments & Financial (Multiple Projects)
```
- beneficiaries
- bulk_payments
- payment_audit
- payment_items
- stripe_connect_accounts
- virtual_cards
- marketplace_transactions
- subscriptions
```
**Purpose**: Payment processing across projects
**Status**: Mixed ownership - needs clarification

### 📦 Products & Orders
```
- products
- product_embeddings
- orders
- order_items
```
**Purpose**: E-commerce/marketplace
**Status**: Unknown owner

### 🔔 Notifications & System
```
- notifications
- notification_settings
- webhook_logs
- system_error_logs
- usage_tracking          ⚠️ Used by MCP Core
```
**Purpose**: System-wide features
**Status**: Shared infrastructure

### 🤖 AI & Analytics
```
- ai_recommendations
- ai_response_cache
- ai_usage_logs
- pricing_insights
- recommendations
- risk_analysis
- query_classifications
- search_history
```
**Purpose**: AI/ML features
**Status**: Unknown owner

### 📊 Other Tables
```
- topics                  ⚠️ Used by MCP Core?
- profiles
- feature_flags
- imported_data
- pg_stat_monitor (PostgreSQL monitoring)
```

---

## 🎯 Schema Mismatch Details

### Issue #1: `api_keys` Table Schema

**What MCP Core Code Expects:**
```sql
CREATE TABLE api_keys (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    access_level VARCHAR(50) DEFAULT 'authenticated',
    permissions JSONB DEFAULT '[]'::jsonb,  -- ❌ Code expects this
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN
);
```

**What Actually Exists in Supabase:**
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    key_hash VARCHAR(255),
    user_id UUID,
    organization_id UUID,            -- ✅ Exists (multi-tenant)
    name VARCHAR(255),
    description TEXT,                -- ✅ Exists
    access_level VARCHAR(50),
    is_active BOOLEAN,
    rate_limit INTEGER,              -- ✅ Exists
    service VARCHAR(50),             -- ✅ Exists (not in mcp-core code)
    rate_limited BOOLEAN,            -- ✅ Exists
    api_key_value TEXT,              -- ✅ Exists
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    -- ❌ NO permissions column
);
```

**Resolution**: Need to either:
1. Add `permissions` column to existing table
2. Update MCP Core code to use `service` instead of `permissions`
3. Create separate `mcp_api_keys` table for MCP Core

---

### Issue #2: `users` Table Schema

**What MCP Core Code Expects:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255),      -- String, not UUID
    is_active BOOLEAN DEFAULT true,    -- ❌ Code expects this
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**What Actually Exists:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    -- ❌ NO is_active column
    -- ❌ NO password_hash column
    -- ❌ NO organization_id column
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
    -- Likely has other columns from onasis-core design
);
```

**Resolution**: Need to add missing columns or use `simple_users` table instead

---

### Issue #3: `memory_entries` Table

**Status**: Need to verify schema matches MCP Core expectations
**Risk**: High - if multiple projects use this table

---

## 🔧 Recommended Solutions

### Option A: Table Prefixing (Recommended)
Create project-specific tables with prefixes:

```sql
-- MCP Core tables
mcp_api_keys
mcp_users
mcp_sessions
mcp_memory_entries

-- Onasis Core tables (already have organization_id)
onasis_api_keys (current api_keys)
onasis_users (current users)
onasis_organizations (current organizations)

-- Agent Banks tables (already prefixed)
agent_banks_memories
agent_banks_sessions
...

-- Vortex tables
vortex_users
vortex_items
...
```

**Pros**:
- Clear ownership
- No conflicts
- Easy to identify which project owns what
- Can have different schemas per project

**Cons**:
- Requires migration
- Code changes across all projects

---

### Option B: Schema Namespacing
Use PostgreSQL schemas to separate projects:

```sql
-- Create schemas
CREATE SCHEMA mcp_core;
CREATE SCHEMA onasis_core;
CREATE SCHEMA agent_banks;
CREATE SCHEMA edoc;
CREATE SCHEMA vortex;

-- Move tables
ALTER TABLE api_keys SET SCHEMA onasis_core;
CREATE TABLE mcp_core.api_keys (...);
```

**Pros**:
- Clean separation
- Can have duplicate table names
- Better security boundaries

**Cons**:
- Bigger migration effort
- Need to update all connection strings
- Shared tables (like users) still need resolution

---

### Option C: Organization ID Filtering (Current Approach - Needs Fix)
Keep shared tables but strictly enforce organization_id filtering:

```sql
-- Every query must filter by organization_id
SELECT * FROM api_keys WHERE organization_id = 'mcp-core-org';
SELECT * FROM users WHERE organization_id = 'onasis-core-org';
```

**Pros**:
- Minimal migration
- Maintains multi-tenant design

**Cons**:
- Requires disciplined coding
- Easy to forget filters (security risk)
- Schema still needs to match

---

## 🚀 Immediate Action Items

### 1. Document Table Ownership (URGENT)
Create a definitive list of which project owns which table:

```yaml
mcp-core:
  owns:
    - memory_entries (shared?)
    - usage_tracking (shared?)
  needs:
    - mcp_api_keys (new)
    - mcp_users (new)
    - mcp_sessions (new)

onasis-core:
  owns:
    - api_keys (current)
    - users (current)
    - organizations
    - company_*
  design: Multi-tenant with organization_id

agent-banks:
  owns:
    - agent_banks_* (all prefixed)
  status: Clean separation ✅

edoc:
  owns:
    - edoc_* (all prefixed)
  status: Clean separation ✅
```

### 2. Fix Schema Mismatches (HIGH PRIORITY)

**For MCP Core to work NOW:**
```sql
-- Quick fix: Add missing columns to existing tables
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Or create separate MCP tables
CREATE TABLE mcp_api_keys AS SELECT * FROM api_keys WHERE false;
ALTER TABLE mcp_api_keys ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;
```

### 3. Identify Unknown Users (MEDIUM PRIORITY)

Query all users and map to projects:
```sql
SELECT u.id, u.email, u.created_at,
       COALESCE(o.name, 'UNKNOWN') as organization
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
ORDER BY u.created_at DESC;
```

### 4. Create Migration Plan (MEDIUM PRIORITY)

For each project:
1. List tables it needs
2. Define required schema
3. Plan migration path (prefix/schema/multi-tenant)
4. Update code to match
5. Test in staging
6. Deploy

---

## 📋 Questions to Answer

1. **Which project owns `memory_entries`?**
   - MCP Core?
   - Agent Banks?
   - Shared?

2. **What is `vortex_items` for?**
   - Active project?
   - Can be removed?

3. **Should `users` table be shared or separate?**
   - Shared: Need organization_id everywhere
   - Separate: mcp_users, onasis_users, etc.

4. **What are the AI tables for?**
   - ai_recommendations
   - ai_response_cache
   - Shared service or specific project?

5. **Payment tables ownership?**
   - Who manages beneficiaries, bulk_payments?
   - Is virtual_cards for a specific project?

---

## 🎯 Success Criteria

After cleanup:
- [ ] Every table has clear owner documented
- [ ] No schema mismatches between code and database
- [ ] Can identify which user belongs to which project
- [ ] MCP Core tools work (create_memory, create_api_key)
- [ ] No "column does not exist" errors
- [ ] No "bouncing users" from services

---

**Next Step**: Create detailed table ownership map and migration plan

Would you like me to:
1. Query more tables to understand their structure?
2. Create a migration script for Option A (table prefixing)?
3. Map all users to their projects?
4. Something else?
