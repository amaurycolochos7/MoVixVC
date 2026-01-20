-- ============================================================
-- Client Cancellation RPC
-- Description: Allows clients to cancel assigned services and reset driver availability
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_service_by_client(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'Cliente canceló el servicio'
) RETURNS JSONB AS $$
DECLARE
    v_client_id UUID;
    v_driver_id UUID;
    v_request_status request_status;
BEGIN
    v_client_id := auth.uid();

    -- Check if request exists and belongs to this client
    SELECT status, assigned_driver_id 
    INTO v_request_status, v_driver_id
    FROM service_requests 
    WHERE id = p_request_id 
    AND client_id = v_client_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND_OR_NOT_YOURS');
    END IF;
    
    -- Check if cancellable
    IF v_request_status NOT IN ('pending', 'assigned', 'in_progress', 'negotiating') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_STATUS', 'current_status', v_request_status);
    END IF;
    
    -- Update request status
    UPDATE service_requests SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        assigned_driver_id = NULL,  -- Clear driver assignment
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- IMPORTANT: Reset driver availability if there was an assigned driver
    IF v_driver_id IS NOT NULL THEN
        UPDATE users SET
            is_available = TRUE,  -- Driver goes back online
            updated_at = NOW()
        WHERE id = v_driver_id;
    END IF;
    
    RETURN jsonb_build_object('success', TRUE, 'driver_freed', v_driver_id IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_service_by_client(UUID, TEXT) TO authenticated;
