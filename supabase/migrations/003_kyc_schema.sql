-- ============================================================
-- MoVix Database Migration - Phase 3: KYC
-- Version: 003_kyc_schema
-- Description: Adds KYC verification system for drivers
-- ============================================================

-- ============================================================
-- NEW ENUM: kyc_status
-- ============================================================

CREATE TYPE kyc_status AS ENUM (
    'not_submitted',  -- No ha enviado documentos (default)
    'pending',        -- Enviado, esperando revisión admin
    'approved',       -- Aprobado por admin
    'rejected'        -- Rechazado por admin (puede re-enviar)
);

-- ============================================================
-- ALTER TABLE: users - Add KYC fields
-- ============================================================

ALTER TABLE users 
ADD COLUMN kyc_status kyc_status NOT NULL DEFAULT 'not_submitted',
ADD COLUMN kyc_rejection_reason TEXT,
ADD COLUMN kyc_submitted_at TIMESTAMPTZ,
ADD COLUMN kyc_reviewed_at TIMESTAMPTZ,
ADD COLUMN kyc_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for filtering by KYC status
CREATE INDEX idx_users_kyc_status ON users(kyc_status) 
    WHERE role IN ('taxi', 'mandadito');

-- Index for admin dashboard (pending KYC)
CREATE INDEX idx_users_kyc_pending ON users(kyc_submitted_at) 
    WHERE kyc_status = 'pending';

-- ============================================================
-- UPDATE CONSTRAINT: Driver can only be available if KYC approved
-- ============================================================

-- Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_driver_availability;

-- New constraint: drivers must have KYC approved to be available
ALTER TABLE users ADD CONSTRAINT users_driver_kyc_required CHECK (
    -- Non-drivers: no restrictions on availability check here
    (role NOT IN ('taxi', 'mandadito')) OR
    -- Drivers: if available, must be KYC approved
    (is_available = FALSE) OR
    (is_available = TRUE AND kyc_status = 'approved')
);

-- ============================================================
-- NEW TABLE: kyc_submissions
-- Stores Google Drive file references for each KYC submission
-- ============================================================

CREATE TABLE kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Google Drive folder info
    drive_folder_id TEXT NOT NULL,
    drive_folder_url TEXT NOT NULL,
    
    -- INE Frente
    ine_front_file_id TEXT NOT NULL,
    ine_front_url TEXT NOT NULL,
    
    -- INE Atrás
    ine_back_file_id TEXT NOT NULL,
    ine_back_url TEXT NOT NULL,
    
    -- Selfie
    selfie_file_id TEXT NOT NULL,
    selfie_url TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Each user can only have one KYC submission at a time
    CONSTRAINT kyc_one_per_user UNIQUE (user_id)
);

-- Index for user lookup
CREATE INDEX idx_kyc_user ON kyc_submissions(user_id);

-- ============================================================
-- FUNCTION: Admin approve KYC
-- ============================================================

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
    
    IF v_current_status != 'pending' THEN
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

-- ============================================================
-- FUNCTION: Admin reject KYC
-- ============================================================

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
    
    IF v_current_status != 'pending' THEN
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
    
    -- Delete the KYC submission so user can re-submit
    DELETE FROM kyc_submissions WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'new_status', 'rejected',
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Reset KYC for re-submission (after rejection)
-- ============================================================

CREATE OR REPLACE FUNCTION reset_kyc_for_resubmit(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_current_status kyc_status;
BEGIN
    -- Get current status
    SELECT kyc_status INTO v_current_status
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_NOT_FOUND');
    END IF;
    
    -- Only allow reset if rejected
    IF v_current_status != 'rejected' THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'message', 'Can only reset KYC if status is rejected'
        );
    END IF;

    -- Reset to not_submitted
    UPDATE users SET
        kyc_status = 'not_submitted',
        kyc_rejection_reason = NULL,
        kyc_submitted_at = NULL,
        kyc_reviewed_at = NULL,
        kyc_reviewed_by = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', TRUE, 'new_status', 'not_submitted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: updated_at for kyc changes
-- (uses existing update_updated_at_column function)
-- ============================================================

-- Trigger already exists for users table from 001_initial_schema.sql
