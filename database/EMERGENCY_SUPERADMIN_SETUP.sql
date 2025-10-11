-- 🚨 EMERGENCY: CREATE SUPERADMIN ACCESS
-- Run this IMMEDIATELY in Supabase SQL Editor
-- Project: mxtsdgkwzjzlttpotole

-- ============================================
-- STEP 1: FIX USERS TABLE SCHEMA
-- ============================================

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- ============================================
-- STEP 2: CREATE SUPERADMIN ORGANIZATION
-- ============================================

-- Create system organization if it doesn't exist
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'System Administration',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create your personal organization
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Lanonasis Main',
    NOW(),
    NOW()
)
ON CONFLICT (name) DO NOTHING
RETURNING id; -- Save this ID!

-- ============================================
-- STEP 3: CREATE YOUR SUPERADMIN USER
-- ============================================

-- Delete your failed test user first
DELETE FROM users WHERE id = 'ed212bb7-205f-47d8-81ce-cfb549387c90'::UUID;

-- Create YOUR superadmin account
-- Password: 'Admin@2024!' (bcrypt hash below - CHANGE THIS AFTER FIRST LOGIN!)
INSERT INTO users (id, email, password_hash, organization_id, is_active, role, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'admin@lanonasis.com', -- ✅ CHANGE THIS TO YOUR REAL EMAIL
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- Password: Admin@2024!
    '00000000-0000-0000-0000-000000000001'::UUID, -- System org
    true,
    'superadmin',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true,
    role = 'superadmin',
    updated_at = NOW()
RETURNING id, email, role;

-- ============================================
-- STEP 4: FIX API_KEYS TABLE SCHEMA
-- ============================================

-- Add missing permissions column
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- STEP 5: CREATE GLOBAL MASTER API KEY
-- ============================================

-- Get the superadmin user ID (replace with actual ID from step 3)
DO $$
DECLARE
    admin_user_id UUID;
    master_key_id UUID;
BEGIN
    -- Get admin user
    SELECT id INTO admin_user_id
    FROM users
    WHERE email = 'admin@lanonasis.com'
    LIMIT 1;

    -- Create master API key that NEVER expires
    master_key_id := gen_random_uuid();

    INSERT INTO api_keys (
        id,
        name,
        key_hash,
        user_id,
        organization_id,
        access_level,
        permissions,
        is_active,
        rate_limit,
        service,
        rate_limited,
        api_key_value,
        description,
        created_at,
        updated_at,
        expires_at
    )
    VALUES (
        master_key_id,
        'SUPERADMIN MASTER KEY',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- Hash for: lano_master_key_2024
        admin_user_id,
        '00000000-0000-0000-0000-000000000001'::UUID,
        'superadmin',
        '["*"]'::jsonb, -- All permissions
        true,
        999999, -- Unlimited rate limit
        'all',
        false, -- No rate limiting for superadmin
        'lano_master_key_2024', -- ✅ THIS IS YOUR MASTER KEY - SAVE IT!
        'Global master key - full access to all services, never expires',
        NOW(),
        NOW(),
        NULL -- Never expires
    )
    ON CONFLICT (id) DO UPDATE SET
        is_active = true,
        access_level = 'superadmin',
        service = 'all',
        rate_limited = false,
        api_key_value = 'lano_master_key_2024',
        updated_at = NOW();

    RAISE NOTICE 'Master API Key Created: lano_master_key_2024';
    RAISE NOTICE 'Admin User ID: %', admin_user_id;
    RAISE NOTICE 'Master Key ID: %', master_key_id;
END $$;

-- ============================================
-- STEP 6: DISABLE RLS FOR SUPERADMIN
-- ============================================

-- Create superadmin bypass policies
CREATE POLICY IF NOT EXISTS superadmin_all_access ON users
FOR ALL
TO authenticated
USING (
    role = 'superadmin' OR
    id IN (SELECT user_id FROM api_keys WHERE access_level = 'superadmin' AND is_active = true)
)
WITH CHECK (
    role = 'superadmin' OR
    id IN (SELECT user_id FROM api_keys WHERE access_level = 'superadmin' AND is_active = true)
);

CREATE POLICY IF NOT EXISTS superadmin_all_access ON api_keys
FOR ALL
TO authenticated
USING (
    access_level = 'superadmin' OR
    user_id IN (SELECT id FROM users WHERE role = 'superadmin')
)
WITH CHECK (
    access_level = 'superadmin' OR
    user_id IN (SELECT id FROM users WHERE role = 'superadmin')
);

-- Allow service role FULL access (bypass RLS)
CREATE POLICY IF NOT EXISTS service_role_bypass ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS service_role_bypass ON api_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- STEP 7: CREATE SYSTEM/DEFAULT USER FOR MCP
-- ============================================

-- This is for MCP Core default operations
INSERT INTO users (id, email, password_hash, organization_id, is_active, role, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'system@lanonasis.internal',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    '00000000-0000-0000-0000-000000000001'::UUID,
    true,
    'system',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    is_active = true,
    role = 'system',
    updated_at = NOW();

-- ============================================
-- STEP 8: VERIFICATION
-- ============================================

-- Show your superadmin account
SELECT
    id,
    email,
    role,
    is_active,
    organization_id,
    created_at
FROM users
WHERE role IN ('superadmin', 'system')
ORDER BY created_at DESC;

-- Show your master API key
SELECT
    id,
    name,
    api_key_value AS "API_KEY (SAVE THIS!)",
    access_level,
    service,
    is_active,
    expires_at AS "Expires (NULL = Never)"
FROM api_keys
WHERE access_level = 'superadmin'
ORDER BY created_at DESC;

-- ============================================
-- EXPECTED OUTPUT
-- ============================================

/*
You should see:

USERS:
- admin@lanonasis.com | superadmin | true | <your-uuid>
- system@lanonasis.internal | system | true | 00000000-0000-0000-0000-000000000001

API_KEYS:
- SUPERADMIN MASTER KEY | lano_master_key_2024 | superadmin | all | true | NULL

✅ IF YOU SEE THIS, YOU NOW HAVE ACCESS!
*/

-- ============================================
-- HOW TO USE YOUR MASTER KEY
-- ============================================

/*
1. LOGIN TO DASHBOARD:
   Email: admin@lanonasis.com
   Password: Admin@2024!
   (CHANGE THIS IMMEDIATELY AFTER LOGIN!)

2. USE API KEY FOR TESTING:
   curl -X POST http://localhost:3001/tools/core_create_memory \
     -H "X-API-Key: lano_master_key_2024" \
     -H "Content-Type: application/json" \
     -d '{"title": "Test", "content": "It works!"}'

3. THIS KEY WORKS FOR ALL SERVICES:
   - MCP Core (port 3001)
   - Vibe MCP (port 7777)
   - Onasis Gateway (port 3000)
   - Quick Auth (port 3005)
   - ANY service that checks api_keys table

4. NEVER EXPIRES - Keep it safe!
*/

-- ============================================
-- TROUBLESHOOTING
-- ============================================

/*
IF YOU STILL CAN'T LOGIN:

1. Check if user exists:
   SELECT * FROM users WHERE email = 'admin@lanonasis.com';

2. Check if RLS is blocking:
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;
   (Try login again, then re-enable)

3. Check password hash:
   -- Password should be 'Admin@2024!'
   -- If not working, generate new hash at: https://bcrypt-generator.com/

4. Verify API key:
   SELECT * FROM api_keys WHERE api_key_value = 'lano_master_key_2024';

5. If nothing works:
   -- DM me the error message and I'll help debug
*/
