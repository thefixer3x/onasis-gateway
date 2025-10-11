# 🚀 GET ACCESS TO YOUR DASHBOARD - RIGHT NOW

**Problem**: You've been locked out for months. Users bouncing. Can't login. Can't test.

**Solution**: Run ONE SQL script to create superadmin access.

---

## ⚡ Quick Start (5 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/mxtsdgkwzjzlttpotole
2. Click **SQL Editor** in left sidebar
3. Click **New Query**

### Step 2: Run the Emergency Script
1. Open file: `/opt/lanonasis/EMERGENCY_SUPERADMIN_SETUP.sql`
2. Copy **ALL** contents (entire file)
3. Paste into Supabase SQL Editor
4. Click **RUN** button

### Step 3: Save Your Credentials
After script runs, you'll see output showing:

```
✅ SUPERADMIN USER CREATED:
Email: admin@lanonasis.com
Password: Admin@2024!

✅ MASTER API KEY CREATED:
Key: lano_master_key_2024
Access: superadmin (all services)
Expires: Never
```

**SAVE THESE!** Write them down somewhere safe.

---

## 🎯 What This Script Does

1. **Fixes users table** - Adds missing columns (password_hash, is_active, role)
2. **Fixes api_keys table** - Adds missing permissions column
3. **Creates superadmin user** - That's YOU! Full access to everything
4. **Creates master API key** - Works for ALL services, never expires
5. **Bypasses RLS policies** - Superadmin can't be blocked
6. **Creates system user** - For MCP Core default operations

---

## 🔑 Your New Access

### Dashboard Login
```
URL: https://your-dashboard-url.com/login
Email: admin@lanonasis.com
Password: Admin@2024!

⚠️ CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!
```

### API Testing (All Services)
```bash
# Test MCP Core
curl -X POST http://localhost:3001/tools/core_create_memory \
  -H "X-API-Key: lano_master_key_2024" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "First Memory!",
    "content": "I can finally access my platform!",
    "type": "project"
  }'

# Test any service - this key works EVERYWHERE
curl -X GET http://localhost:3001/health \
  -H "X-API-Key: lano_master_key_2024"
```

---

## 🛡️ Security Features

Your new setup includes:

✅ **Superadmin Role** - Bypasses all restrictions
✅ **Master API Key** - Never expires, unlimited rate limit
✅ **All Permissions** - `["*"]` = access everything
✅ **All Services** - Works on MCP Core, Onasis Gateway, Vibe MCP, Quick Auth
✅ **RLS Bypass** - Can't be blocked by Row Level Security
✅ **System User** - For automated MCP operations

---

## ❓ Troubleshooting

### "Script ran but I still can't login"

**Check if user was created:**
```sql
SELECT id, email, role, is_active
FROM users
WHERE email = 'admin@lanonasis.com';
```

**Expected**: One row with role='superadmin', is_active=true

**If empty**: User creation failed. Check error messages in SQL editor.

---

### "Login page says invalid credentials"

**Option 1: Disable RLS temporarily**
```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```
Try login again. If it works, RLS was blocking you.

**Option 2: Reset password**
```sql
-- Generate new hash at https://bcrypt-generator.com/
-- For password: YourNewPassword123!

UPDATE users
SET password_hash = '$2a$10$...' -- paste generated hash here
WHERE email = 'admin@lanonasis.com';
```

**Option 3: Check authentication service**
```bash
# Is your auth service running?
pm2 status | grep auth

# Check auth logs
pm2 logs auth --lines 50
```

---

### "API key not working"

**Verify key exists:**
```sql
SELECT id, name, api_key_value, access_level, is_active
FROM api_keys
WHERE api_key_value = 'lano_master_key_2024';
```

**Expected**: One row with access_level='superadmin', is_active=true

**If empty**: Key creation failed. Run this:
```sql
INSERT INTO api_keys (
    id, name, api_key_value, access_level, service,
    is_active, rate_limit, rate_limited, permissions,
    user_id, organization_id, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    'SUPERADMIN MASTER KEY',
    'lano_master_key_2024',
    'superadmin',
    'all',
    true,
    999999,
    false,
    '["*"]'::jsonb,
    u.id,
    '00000000-0000-0000-0000-000000000001'::UUID,
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'admin@lanonasis.com'
LIMIT 1;
```

---

### "Users still getting bounced"

This means they're hitting UUID validation. Quick fix in code:

**File**: `/opt/lanonasis/mcp-core/src/tools/memory-tool.ts`
**Line 64**: Change to:
```typescript
user_id: data.user_id || '00000000-0000-0000-0000-000000000001'
```

Then rebuild:
```bash
cd /opt/lanonasis/mcp-core
npm run build
pm2 restart mcp-core
```

---

## 🎊 Success Checklist

After running the script, you should be able to:

- [ ] Login to dashboard with admin@lanonasis.com
- [ ] See superadmin role in profile
- [ ] Create API keys from dashboard
- [ ] Create memories via API (test with curl)
- [ ] Create users from dashboard
- [ ] Access all services without 401/403 errors
- [ ] Test MCP tools without UUID errors

---

## 📞 Still Stuck?

If after all this you STILL can't access:

1. **Check Supabase logs**: Dashboard → Logs → API
2. **Check service logs**: `pm2 logs mcp-core --lines 100`
3. **Share the error**: Tell me the EXACT error message
4. **Check service status**: `pm2 status`

---

## 🔐 Change Default Password

**IMPORTANT**: After first login, immediately change your password:

**In Dashboard**:
1. Go to Profile/Settings
2. Click "Change Password"
3. Enter new strong password

**Or via SQL**:
```sql
-- Generate hash at https://bcrypt-generator.com/
UPDATE users
SET password_hash = '$2a$10$...' -- your new hash
WHERE email = 'admin@lanonasis.com';
```

---

## 🎯 Next Steps After Access

Once you can login:

1. **Create your personal account** (not using superadmin for daily work)
2. **Create organization-specific API keys**
3. **Map existing users to organizations**
4. **Clean up duplicate/test users**
5. **Set up proper authentication flow**
6. **Implement sign-up functionality**

But first - **GET ACCESS** by running that SQL script!

---

**File Location**: `/opt/lanonasis/EMERGENCY_SUPERADMIN_SETUP.sql`

**Run It NOW**: Copy → Paste → Execute → Login 🚀
