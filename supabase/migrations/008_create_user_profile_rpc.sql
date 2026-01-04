-- Migration: Create user profile function (bypasses RLS)
-- This function is called during registration to create the user profile

CREATE OR REPLACE FUNCTION create_user_profile(
    p_user_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'cliente'
) RETURNS JSONB AS $$
DECLARE
    v_kyc_status kyc_status;
BEGIN
    -- Set KYC status based on role
    v_kyc_status := CASE 
        WHEN p_role = 'cliente' THEN 'approved'::kyc_status
        ELSE 'pending'::kyc_status
    END;

    -- Insert user profile
    INSERT INTO users (id, email, full_name, phone, role, kyc_status)
    VALUES (
        p_user_id,
        p_email,
        p_full_name,
        p_phone,
        p_role::role_type,
        v_kyc_status
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
