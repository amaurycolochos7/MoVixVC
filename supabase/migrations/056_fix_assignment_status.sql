-- ============================================================
-- Fix Assignment Status Check
-- Description: Allow assignment when status is 'pending' OR 'negotiating'
-- The issue was that when a driver sends an offer, the status changes to 
-- 'negotiating', but the assign function only accepted 'pending' status.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_driver_to_request(
    p_request_id UUID,
    p_driver_id UUID,
    p_offer_id UUID,
    p_expected_version INT
) RETURNS JSONB AS $$
DECLARE
    v_current_version INT;
    v_current_status request_status;
    v_final_price DECIMAL(10,2);
    v_commission DECIMAL(10,2);
    v_service_type service_type;
    v_offered_price DECIMAL(10,2);
BEGIN
    -- Get current version and status for optimistic locking
    SELECT version, status, service_type INTO v_current_version, v_current_status, v_service_type
    FROM service_requests
    WHERE id = p_request_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND');
    END IF;
    
    -- Check version matches (prevent race conditions)
    IF v_current_version != p_expected_version THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'VERSION_CONFLICT', 'current_version', v_current_version);
    END IF;
    
    -- Check status is pending OR negotiating (FIXED: now accepts both)
    IF v_current_status NOT IN ('pending', 'negotiating') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_STATUS', 'current_status', v_current_status);
    END IF;
    
    -- Get offered price from the offer if available
    SELECT offered_price INTO v_offered_price
    FROM offers 
    WHERE id = p_offer_id;
    
    -- Set pricing based on service type (use offered price if available)
    IF v_offered_price IS NOT NULL AND v_offered_price > 0 THEN
        v_final_price := v_offered_price;
        -- Calculate commission based on service type
        IF v_service_type = 'taxi' THEN
            v_commission := 5.00;
        ELSIF v_service_type = 'mandadito' THEN
            v_commission := 3.00;
        ELSIF v_service_type = 'moto_ride' THEN
            v_commission := 5.00;
        ELSE
            v_commission := 5.00; -- Default
        END IF;
    ELSE
        -- Default pricing if no offer price
        IF v_service_type = 'taxi' THEN
            v_final_price := 35.00;
            v_commission := 5.00;
        ELSIF v_service_type = 'mandadito' THEN
            v_final_price := 22.00;
            v_commission := 3.00;
        ELSIF v_service_type = 'moto_ride' THEN
            v_final_price := 15.00;
            v_commission := 5.00;
        ELSE
            v_final_price := 35.00; -- Default fallback
            v_commission := 5.00;
        END IF;
    END IF;
    
    -- Update request
    UPDATE service_requests SET
        status = 'assigned',
        assigned_driver_id = p_driver_id,
        assigned_at = NOW(),
        final_price = v_final_price,
        commission_amount = v_commission,
        version = v_current_version + 1,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Accept the specific offer
    UPDATE offers SET
        status = 'accepted',
        responded_at = NOW()
    WHERE id = p_offer_id;
    
    -- Reject all other pending offers for this request
    UPDATE offers SET
        status = 'rejected',
        responded_at = NOW()
    WHERE request_id = p_request_id 
    AND id != p_offer_id 
    AND status = 'pending';
    
    -- Mark driver as unavailable (busy with this request)
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
