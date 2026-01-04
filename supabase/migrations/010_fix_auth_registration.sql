-- ============================================================
-- MoVix Fix Auth Registration
-- Version: 010_fix_auth_registration
-- Description: 
--   Disables the problematic trigger and creates a safer approach
-- ============================================================

-- 1. DROP THE PROBLEMATIC TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. UPDATE THE FUNCTION TO BE SAFER (no-op for now)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Do nothing - profiles will be created on first login
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ENSURE RLS POLICY ALLOWS PROFILE CREATION
-- Add policy for users to insert their own profile
DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 4. Allow update of own profile
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (auth.uid() = id);
