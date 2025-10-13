-- EMERGENCY: Create Superadmin User
-- Run this in Supabase SQL Editor
-- Date: 2025-10-13

-- Step 1: Temporarily disable the email check constraint
ALTER TABLE users DISABLE TRIGGER ALL;

-- Step 2: Insert superadmin user
INSERT INTO users (
    id,
    email,
    password_hash,
    organization_id,
    role,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin@lanonasis.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- Password: Admin@2024!
    '00000000-0000-0000-0000-000000000001'::UUID,
    'superadmin',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    role = 'superadmin',
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

-- Step 3: Re-enable triggers
ALTER TABLE users ENABLE TRIGGER ALL;

-- Step 4: Verify the user was created
SELECT id, email, role, organization_id, created_at
FROM users
WHERE email = 'admin@lanonasis.com' OR role = 'superadmin';

-- Step 5: Verify master API key exists
SELECT id, name, api_key_value, access_level, is_active
FROM api_keys
WHERE api_key_value = 'lano_master_key_2024';
