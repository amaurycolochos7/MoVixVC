-- ============================================================
-- MoVix Database Migration - Fix Mandadito Commission
-- Version: 041_fix_mandadito_commission
-- Description: Actualizar comisión de Mandadito de $2.50 a $3.00
-- ============================================================

-- Actualizar la función assign_driver_to_request para usar comisión correcta
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
    v_service_type service_type;
    v_final_price DECIMAL(10,2);
    v_commission DECIMAL(10,2);
    v_driver_balance DECIMAL(10,2);
BEGIN
    -- Lock the row for update (prevents concurrent modifications)
    SELECT version, status, service_type 
    INTO v_current_version, v_current_status, v_service_type
    FROM service_requests 
    WHERE id = p_request_id
    FOR UPDATE;
    
    -- Check if request exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND');
    END IF;
    
    -- Check optimistic lock version
    IF v_current_version != p_expected_version THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'VERSION_CONFLICT',
            'message', 'Request was modified by another process',
            'current_version', v_current_version
        );
    END IF;
    
    -- Check status allows assignment
    IF v_current_status NOT IN ('pending', 'negotiating') THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'message', 'Request cannot be assigned in current status',
            'current_status', v_current_status
        );
    END IF;
    
    -- Verify driver exists and is available
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_driver_id 
        AND is_active = TRUE 
        AND is_available = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DRIVER_NOT_AVAILABLE');
    END IF;
    
    -- Get the accepted offer price
    SELECT offered_price INTO v_final_price
    FROM offers 
    WHERE id = p_offer_id 
    AND request_id = p_request_id
    AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'OFFER_NOT_FOUND');
    END IF;
    
    -- Calculate commission based on service type
    -- MODIFICADO: Mandadito ahora cobra $3.00 (antes $2.50)
    v_commission := CASE v_service_type 
        WHEN 'taxi' THEN 3.00
        WHEN 'mandadito' THEN 3.00
    END;
    
    -- Update the offer to accepted
    UPDATE offers SET
        status = 'accepted',
        responded_at = NOW()
    WHERE id = p_offer_id;
    
    -- Update request with atomic version increment
    UPDATE service_requests SET
        assigned_driver_id = p_driver_id,
        status = 'assigned',
        final_price = v_final_price,
        commission_amount = v_commission,
        assigned_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_request_id;
    
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

COMMENT ON FUNCTION assign_driver_to_request(UUID, UUID, UUID, INTEGER) IS 'Asigna conductor a solicitud con comisión uniforme de $3.00 para taxi y mandadito';
