-- ============================================================
-- MIGRATION 031: SIMPLIFIED REGISTRATION FIX
-- ============================================================
-- This migration recreates the registration trigger and function
-- without requiring table ownership permissions

-- Step 1: Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Create or replace the robust trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        -- Attempt 1: Insert with all data including phone
        INSERT INTO public.users (
            id, 
            email, 
            full_name, 
            phone, 
            role,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
            NEW.raw_user_meta_data->>'phone',
            COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type),
            NEW.created_at,
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            phone = COALESCE(EXCLUDED.phone, public.users.phone),
            updated_at = NOW();
            
    EXCEPTION 
        WHEN unique_violation THEN
            -- Attempt 2: Retry without phone if phone conflict
            INSERT INTO public.users (
                id, 
                email, 
                full_name, 
                phone, 
                role,
                created_at,
                updated_at
            )
            VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
                NULL, -- Phone omitted to avoid conflict
                COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type),
                NEW.created_at,
                NOW()
            )
            ON CONFLICT (id) DO NOTHING;
            
        WHEN OTHERS THEN
            -- Log any other errors but don't fail the auth signup
            RAISE WARNING 'Error in handle_new_user for %: %', NEW.id, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;

-- Step 3: Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Verify trigger was created
DO $$
DECLARE
    v_trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created';
    
    IF v_trigger_count > 0 THEN
        RAISE NOTICE '✓ Trigger on_auth_user_created created successfully';
    ELSE
        RAISE WARNING '✗ Trigger was not created';
    END IF;
END $$;

