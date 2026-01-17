-- ============================================================
-- MIGRATION 032: AUTO-APPROVE WORKFLOW FOR DRIVERS
-- ============================================================
-- Change: When drivers register, set kyc_status to 'pending' automatically
-- so they appear immediately in admin KYC panel for approval

-- Step 1: Update existing drivers with 'not_submitted' to 'pending'
UPDATE users 
SET 
    kyc_status = 'pending',
    kyc_submitted_at = created_at,
    updated_at = NOW()
WHERE 
    role IN ('taxi', 'mandadito') 
    AND kyc_status = 'not_submitted';

-- Step 2: Modify the trigger to set drivers as 'pending' on registration
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
            kyc_status,              -- NEW: Set KYC status
            kyc_submitted_at,        -- NEW: Set submission timestamp
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
            NEW.raw_user_meta_data->>'phone',
            COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type),
            -- If driver, set status to 'pending' so they appear in KYC panel immediately
            CASE 
                WHEN COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type) 
                     IN ('taxi'::role_type, 'mandadito'::role_type)
                THEN 'pending'::kyc_status
                ELSE 'not_submitted'::kyc_status
            END,
            -- Set submission timestamp for drivers
            CASE 
                WHEN COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type) 
                     IN ('taxi'::role_type, 'mandadito'::role_type)
                THEN NEW.created_at
                ELSE NULL
            END,
            NEW.created_at,
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            phone = COALESCE(EXCLUDED.phone, public.users.phone),
            kyc_status = EXCLUDED.kyc_status,
            kyc_submitted_at = EXCLUDED.kyc_submitted_at,
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
                kyc_status,
                kyc_submitted_at,
                created_at,
                updated_at
            )
            VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
                NULL, -- Phone omitted to avoid conflict
                COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type),
                CASE 
                    WHEN COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type) 
                         IN ('taxi'::role_type, 'mandadito'::role_type)
                    THEN 'pending'::kyc_status
                    ELSE 'not_submitted'::kyc_status
                END,
                CASE 
                    WHEN COALESCE((NEW.raw_user_meta_data->>'role')::role_type, 'cliente'::role_type) 
                         IN ('taxi'::role_type, 'mandadito'::role_type)
                    THEN NEW.created_at
                    ELSE NULL
                END,
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

-- Step 3: Modify approve_kyc function to work without requiring 'pending' status
-- This allows admin to approve drivers even if they haven't uploaded documents
CREATE OR REPLACE FUNCTION approve_kyc(
    p_user_id UUID,
    p_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_role role_type;
    v_current_status kyc_status;
BEGIN
    -- Verify admin
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin'
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_ADMIN');
    END IF;

    -- Get user info
    SELECT role, kyc_status INTO v_user_role, v_current_status
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_NOT_FOUND');
    END IF;
    
    IF v_user_role NOT IN ('taxi', 'mandadito') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_ROLE');
    END IF;
    
    -- CHANGED: Allow approval from 'pending' OR 'not_submitted' status
    IF v_current_status NOT IN ('pending', 'not_submitted') THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'current_status', v_current_status
        );
    END IF;

    -- Approve
    UPDATE users SET
        kyc_status = 'approved',
        kyc_reviewed_at = NOW(),
        kyc_reviewed_by = p_admin_id,
        kyc_rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', TRUE, 'new_status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Update reject function similarly
CREATE OR REPLACE FUNCTION reject_kyc(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_role role_type;
    v_current_status kyc_status;
BEGIN
    -- Verify admin
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin'
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_ADMIN');
    END IF;

    -- Get user info
    SELECT role, kyc_status INTO v_user_role, v_current_status
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_NOT_FOUND');
    END IF;
    
    IF v_user_role NOT IN ('taxi', 'mandadito') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_ROLE');
    END IF;
    
    -- CHANGED: Allow rejection from 'pending' OR 'not_submitted' status
    IF v_current_status NOT IN ('pending', 'not_submitted') THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'current_status', v_current_status
        );
    END IF;

    -- Reject
    UPDATE users SET
        kyc_status = 'rejected',
        kyc_reviewed_at = NOW(),
        kyc_reviewed_by = p_admin_id,
        kyc_rejection_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Delete the KYC submission if exists
    DELETE FROM kyc_submissions WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'new_status', 'rejected',
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '✓ Existing drivers updated to pending status';
    RAISE NOTICE '✓ Trigger modified to auto-set drivers as pending';
    RAISE NOTICE '✓ Approve/reject functions updated';
    RAISE NOTICE '';
    RAISE NOTICE 'New drivers will now appear immediately in KYC panel for approval';
END $$;
