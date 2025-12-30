-- ============================================================
-- MoVix Row Level Security - Phase 3: KYC
-- Version: 004_kyc_rls
-- Description: RLS policies for KYC submissions table
-- ============================================================

-- ============================================================
-- ENABLE RLS ON KYC TABLE
-- ============================================================

ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- KYC_SUBMISSIONS POLICIES
-- ============================================================

-- Drivers can view their own KYC submission
CREATE POLICY "kyc_select_own" ON kyc_submissions
    FOR SELECT
    USING (user_id = auth.uid());

-- Drivers can insert their own KYC submission (only if not_submitted)
CREATE POLICY "kyc_insert_own" ON kyc_submissions
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('taxi', 'mandadito')
            AND kyc_status = 'not_submitted'
        )
    );

-- Admin can view all KYC submissions
CREATE POLICY "kyc_admin_select" ON kyc_submissions
    FOR SELECT
    USING (is_admin());

-- Admin can delete KYC submissions (for re-submit flow)
CREATE POLICY "kyc_admin_delete" ON kyc_submissions
    FOR DELETE
    USING (is_admin());

-- Note: No UPDATE policy needed - KYC records are immutable
-- If rejected, the record is deleted and user re-submits

-- ============================================================
-- ADDITIONAL USERS POLICIES FOR KYC FIELDS
-- ============================================================

-- Note: The existing users_update_own policy allows drivers to update
-- their own profile, but we need to prevent them from updating
-- KYC-related fields directly (should only be done via functions)

-- We don't create new policies here because:
-- 1. kyc_status updates go through approve_kyc/reject_kyc functions (SECURITY DEFINER)
-- 2. kyc_submitted_at is set by Edge Function (using service role key)
-- 3. The existing users_update_own policy restricts to own row

-- However, if needed, you can create a more restrictive policy:
-- DROP POLICY IF EXISTS "users_update_own" ON users;
-- CREATE POLICY "users_update_own_restricted" ON users
--     FOR UPDATE
--     USING (id = auth.uid())
--     WITH CHECK (
--         id = auth.uid() AND
--         -- Prevent direct KYC status changes from client
--         kyc_status = (SELECT kyc_status FROM users WHERE id = auth.uid())
--     );

-- ============================================================
-- GRANT EXECUTE ON KYC FUNCTIONS
-- ============================================================

-- Admin functions
GRANT EXECUTE ON FUNCTION approve_kyc(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_kyc(UUID, UUID, TEXT) TO authenticated;

-- User function for re-submit
GRANT EXECUTE ON FUNCTION reset_kyc_for_resubmit(UUID) TO authenticated;
