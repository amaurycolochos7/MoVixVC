-- ============================================================
-- MoVix User Sync Migration
-- Version: 009_sync_auth_users
-- Description: 
--   1. Creates trigger to auto-create user profile on signup
--   2. Syncs existing auth.users that don't have profiles
-- ============================================================

-- ============================================================
-- 1. CREATE TRIGGER FUNCTION
-- This runs automatically when a new user signs up
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        kyc_status,
        is_active,
        is_available
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'),
        'pending',
        TRUE,
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. CREATE TRIGGER ON auth.users
-- ============================================================

-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. SYNC EXISTING USERS
-- Insert profiles for any auth.users that don't have one
-- ============================================================

INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    kyc_status,
    is_active,
    is_available
)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    COALESCE((au.raw_user_meta_data->>'role')::role_type, 'cliente'),
    'pending',
    TRUE,
    FALSE
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. GRANT PERMISSIONS
-- ============================================================

-- Allow authenticated users to execute the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
