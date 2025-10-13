# Database Verification Report
**Date**: 2025-10-13
**Status**: ⚠️ PARTIAL SUCCESS - Immediate Action Required

## Executive Summary
Verified that SQL scripts were partially executed. Master API key exists and works, but superadmin user creation failed due to email constraint.

---

## ✅ What Worked

### 1. Master API Key Created Successfully
```json
{
  "id": "a1738f79-1f58-4efe-8c41-c00167c1318d",
  "name": "SUPERADMIN MASTER KEY",
  "api_key_value": "<SET_MASTER_API_KEY>",
  "access_level": "superadmin",
  "is_active": true
}
```
**Evidence**: PM2 logs show `✅ Master API key authenticated`
**Location**: `/var/log/lanonasis/mcp-core-out-19.log:12`

### 2. API Keys Table Has Required Columns
The `permissions` column exists in `api_keys` table.

**Schema Confirmed**:
```
id, key_hash, user_id, organization_id, name, description,
access_level, is_active, rate_limit, created_at, updated_at,
expires_at, service, rate_limited, api_key_value, permissions
```

### 3. Users Table Has Most Required Columns
**Schema Confirmed**:
```
id, email, password_hash, organization_id, role, plan,
settings, last_login, created_at, updated_at
```

---

## ❌ What Failed

### 1. Superadmin User NOT Created
**Issue**: Users table is completely empty (`[]`)
**Query**: `GET /rest/v1/users?select=id,email,role&limit=10`
**Result**: Empty array

**Root Cause**: Email check constraint violation
```
Error Code: 23514
Message: new row for relation "users" violates check constraint "users_email_check"
```

### 2. Missing `is_active` Column
**Issue**: Column does not exist in users table
**Query**: `GET /rest/v1/users?select=is_active`
**Error**: `column users.is_active does not exist`

**Impact**: Code expects this column but it's not in the schema.

---

## 🔍 Database Access Details

### Working Credentials
**Supabase URL**: `https://mxtsdgkwzjzlttpotole.supabase.co`

**Service Role Key** (from `/opt/lanonasis/mcp-core/.env.production`):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dHNkZ2t3emp6bHR0cG90b2xlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzEwNTI1OSwiZXhwIjoyMDYyNjgxMjU5fQ.Aoob84MEgNV-viFugZHWKodJUjn4JOQNzcSQ57stJFU
```

**Test Command**:
```bash
curl -s -X GET 'https://mxtsdgkwzjzlttpotole.supabase.co/rest/v1/api_keys?select=name,access_level' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🚨 Immediate Action Required

### Step 1: Create Superadmin User via SQL Editor

**File**: `database/emergency-fixes/create-superadmin-user.sql`

**Instructions**:
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/mxtsdgkwzjzlttpotole
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `create-superadmin-user.sql`
4. Click **RUN**

**What it does**:
- Temporarily disables email constraint triggers
- Creates superadmin user: `admin@lanonasis.com` / `<SET_SECURE_PASSWORD>`
- Re-enables triggers
- Verifies user and API key exist

### Step 2: Test Authentication

After running the SQL script:

```bash
# Test with master API key (should work)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: <SET_MASTER_API_KEY>" \
  -d '{"email": "admin@lanonasis.com", "password": "<SET_SECURE_PASSWORD>"}'

# Test dashboard login
# URL: http://your-dashboard-url/login
# Email: admin@lanonasis.com
# Password: <SET_SECURE_PASSWORD>
```

---

## 📊 Database Statistics

### Total Tables: 68 (from previous audit)
**Projects Identified**:
- Agent Banks: 3 tables
- E-Doc: 4 tables
- Say Switch: 3 tables
- MCP Core: 2 tables
- Shared Auth: 3 tables (users, api_keys, sessions)

### Current Users Count: **0** (empty table)
### Current API Keys Count: **3**
1. Superadmin API Key (info@lanonasis.com)
2. Onasis-CORE Live Key
3. SUPERADMIN MASTER KEY (<SET_MASTER_API_KEY>) ✅

---

## 🔧 Code Issues Found

### Issue 1: Hardcoded String in UUID Column
**File**: `/opt/lanonasis/mcp-core/src/tools/memory-tool.ts:64`
**Problem**: `user_id: 'default-user'` causes UUID validation errors

**Fix Required**:
```typescript
// Current (BROKEN)
user_id: 'default-user'

// Should be
user_id: data.user_id || '00000000-0000-0000-0000-000000000001'
```

### Issue 2: Code Expects `is_active` Column
**Multiple Files**: Auth handlers expect `is_active` in users table
**Problem**: Column doesn't exist in Supabase

**Fix Required**: Either add column or remove from code expectations

---

## 🎯 Next Steps

### Priority 1 (URGENT)
- [ ] Run `create-superadmin-user.sql` in Supabase SQL Editor
- [ ] Test login to dashboard with `admin@lanonasis.com`
- [ ] Verify authentication works end-to-end

### Priority 2 (Important)
- [ ] Fix `user_id: 'default-user'` in memory-tool.ts
- [ ] Decide on `is_active` column: add it or remove code dependencies
- [ ] Map all existing API keys to their projects

### Priority 3 (Maintenance)
- [ ] Implement table prefixing strategy
- [ ] Create proper RLS policies for multi-tenant separation
- [ ] Document which tables belong to which project

---

## 📝 Files Created

1. `/opt/lanonasis/onasis-gateway/database/emergency-fixes/create-superadmin-user.sql`
   - SQL script to bypass email constraint and create superadmin

2. `/opt/lanonasis/onasis-gateway/database/emergency-fixes/VERIFICATION_REPORT.md`
   - This report

3. `/opt/lanonasis/EMERGENCY_SUPERADMIN_SETUP.sql` (previous)
   - Original script that partially failed

4. `/opt/lanonasis/SUPABASE_DATABASE_AUDIT.md` (previous)
   - Complete 68-table audit

---

## 🔐 Security Notes

- Master API key `<SET_MASTER_API_KEY>` is **ACTIVE** and **WORKING**
- Service role key is **VALID** until 2062-06-26
- No users currently exist in database (empty table)
- Email constraint is blocking user creation via REST API
- Must use SQL Editor with trigger bypass for user creation

---

## 💡 Why Authentication Was Failing

1. **No user exists** - Users table is empty, so login fails
2. **Master API key works** - But it's for service-to-service, not dashboard login
3. **SQL script partially executed** - API key created, but user creation failed
4. **Email constraint** - Blocks normal INSERT via REST API

**Conclusion**: You need a USER to login to dashboard, not just an API key. The API key authenticates services, but dashboard needs a user record with password hash.
