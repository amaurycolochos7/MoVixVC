-- ============================================================
-- MoVix Database Migration - Phase 4 Fixes
-- Version: 006_fixes_phase4
-- Description: Tracking Privacy (RLS), Expiration Validation (RPC)
-- ============================================================

-- ============================================================
-- 1. TRACKING PRIVACY (RLS)
-- Tighten users table policies to prevent broad location exposure
-- ============================================================

-- Drop the broad "users_select_public_drivers" policy
DROP POLICY IF EXISTS "users_select_public_drivers" ON users;

-- New Policy 1: Drivers visible to Clients ONLY if they have an active interaction
-- (Active interaction = Sent an offer OR Assigned to request)
CREATE POLICY "users_client_view_relevant_drivers" ON users
    FOR SELECT
    USING (
        role IN ('taxi', 'mandadito') AND (
            -- Case A: Driver sent an offer to client's request
            EXISTS (
                SELECT 1 FROM offers o
                JOIN service_requests sr ON o.request_id = sr.id
                WHERE o.driver_id = users.id
                AND sr.client_id = auth.uid()
                AND sr.status IN ('pending', 'negotiating', 'assigned', 'in_progress')
            )
            OR
            -- Case B: Driver is assigned to client's request
            EXISTS (
                SELECT 1 FROM service_requests sr
                WHERE sr.assigned_driver_id = users.id
                AND sr.client_id = auth.uid()
                AND sr.status IN ('assigned', 'in_progress', 'completed')
            )
        )
    );

-- New Policy 2: Drivers can view Client profile ONLY if assigned
CREATE POLICY "users_driver_view_client" ON users
    FOR SELECT
    USING (
        role = 'cliente' AND (
            EXISTS (
                SELECT 1 FROM service_requests sr
                WHERE sr.client_id = users.id
                AND sr.assigned_driver_id = auth.uid()
                AND sr.status IN ('assigned', 'in_progress')
            )
            OR
            -- Also view client if driver has sent an offer (to see who they are offering to? optional, maybe just generic)
            -- For MVP let's restrict to Assignment for full profile, but Radar usually implies seeing request details not full user profile until accepted.
            -- Actually, Radar needs to see Client Name? Request table has `client_id`.
            -- Let's allow Drivers to see Clients who have PENDING requests matching their service type (for Radar)
            EXISTS (
                SELECT 1 FROM service_requests sr
                WHERE sr.client_id = users.id
                AND sr.status = 'pending'
                AND sr.service_type::text = (SELECT role::text FROM users WHERE id = auth.uid())
            )
        )
    );

-- ============================================================
-- 2. SERVER-SIDE EXPIRATION CHECK
-- Update assign_driver_to_request to validade expiration
-- ============================================================

CREATE OR REPLACE FUNCTION assign_driver_to_request(
    p_request_id UUID,
    p_driver_id UUID,
    p_offer_id UUID,
    p_expected_version INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_current_version INTEGER;
    v_current_status request_status;
    v_expires_at TIMESTAMPTZ;
    v_service_type service_type;
    v_final_price DECIMAL(10,2);
    v_commission DECIMAL(10,2);
    v_driver_balance DECIMAL(10,2);
BEGIN
    -- Lock row
    SELECT version, status, service_type, request_expires_at
    INTO v_current_version, v_current_status, v_service_type, v_expires_at
    FROM service_requests 
    WHERE id = p_request_id
    FOR UPDATE;
    
    -- Not found
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND');
    END IF;
    
    -- Check Expiration (CRITICAL FIX)
    IF v_expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'REQUEST_EXPIRED',
            'message', 'The request has expired'
        );
    END IF;
    
    -- Check optimistic lock
    IF v_current_version != p_expected_version THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'VERSION_CONFLICT',
            'message', 'Request was modified by another process',
            'current_version', v_current_version
        );
    END IF;
    
    -- Check status
    IF v_current_status NOT IN ('pending', 'negotiating') THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'message', 'Request cannot be assigned in current status',
            'current_status', v_current_status
        );
    END IF;
    
    -- Verify driver availability
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_driver_id 
        AND is_active = TRUE 
        AND is_available = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DRIVER_NOT_AVAILABLE');
    END IF;
    
    -- Get offer
    SELECT offered_price INTO v_final_price
    FROM offers 
    WHERE id = p_offer_id 
    AND request_id = p_request_id
    AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'OFFER_NOT_FOUND');
    END IF;
    
    -- Calculate commission
    v_commission := CASE v_service_type 
        WHEN 'taxi' THEN 3.00
        WHEN 'mandadito' THEN 2.50
    END;
    
    -- Update Offer
    UPDATE offers SET
        status = 'accepted',
        responded_at = NOW()
    WHERE id = p_offer_id;
    
    -- Update Request
    UPDATE service_requests SET
        assigned_driver_id = p_driver_id,
        status = 'assigned',
        final_price = v_final_price,
        commission_amount = v_commission,
        assigned_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Reject others
    UPDATE offers SET
        status = 'rejected',
        responded_at = NOW()
    WHERE request_id = p_request_id 
    AND id != p_offer_id 
    AND status = 'pending';
    
    -- Busy Driver
    UPDATE users SET
        is_available = FALSE,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'new_version', v_current_version + 1,
        'final_price', v_final_price,
        'commission', v_commission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
