-- ============================================================
-- QUICK ADMIN USER SETUP
-- Run this in Supabase SQL Editor AFTER creating the auth user
-- ============================================================

-- Step 1: First, create the user in Supabase Dashboard:
-- Go to Authentication → Users → Add User
-- Email: amaury.colochos7@gmail.com  
-- Password: Gordillo94*
-- Auto Confirm: YES

-- Step 2: Then run this SQL to set the role to admin:

-- Find and update the user (replace USER_ID with actual ID from auth.users if needed)
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'amaury.colochos7@gmail.com';

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found in auth.users. Please create user first in Supabase Dashboard.';
    END IF;

    -- Insert or update in users table
    INSERT INTO users (
        id, 
        email, 
        full_name, 
        role, 
        is_active, 
        is_available
    ) VALUES (
        v_user_id,
        'amaury.colochos7@gmail.com',
        'Amaury Colochos (Admin)',
        'admin',
        TRUE,
        FALSE
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        full_name = 'Amaury Colochos (Admin)',
        is_active = TRUE,
        updated_at = NOW();

    RAISE NOTICE 'Admin user configured successfully! User ID: %', v_user_id;
END $$;

-- Verify the user was created correctly
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM users 
WHERE email = 'amaury.colochos7@gmail.com';
