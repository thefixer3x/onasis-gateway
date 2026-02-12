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
    '<SET_BCRYPT_HASH>', -- Password: <SET_SECURE_PASSWORD>
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
-- NOTE: Never compare or expose plaintext API keys. Validate against the stored hash.
-- If your environment still stores only api_key_value, migrate to hashed storage and keep only a short prefix for identification.
SELECT id, name, access_level, is_active
FROM api_keys
WHERE key_hash IS NOT NULL
  AND key_hash = crypt('<SET_MASTER_API_KEY>', key_hash);
