-- ============================================================
-- Function to permanently delete a user
-- ============================================================

-- This function allows an admin to delete a user from auth.users.
-- Because of FK constraints with ON DELETE CASCADE in public tables,
-- this will automatically remove:
-- 1. The user from auth.users
-- 2. The user profile from public.users
-- 3. Any driver_vehicles
-- 4. Any kyc_submissions
-- 5. All other data linked via CASCADE

CREATE OR REPLACE FUNCTION delete_user_permanently(
    p_user_id UUID,
    p_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Verify admin privilege of the requester
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = p_admin_id AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTHORIZED');
    END IF;

    -- Prevent admin from deleting themselves
    IF p_user_id = p_admin_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_DELETE_SELF');
    END IF;

    -- Delete from auth.users 
    -- This requires the function to run as SECURITY DEFINER (superuser privileges usually)
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object('success', TRUE);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION delete_user_permanently TO authenticated;
