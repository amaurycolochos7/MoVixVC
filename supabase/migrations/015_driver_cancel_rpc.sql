-- ============================================================
-- Driver Cancellation RPC
-- Version: 015_driver_cancel_rpc
-- Description: Allows drivers to cancel assigned requests and resets availability
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_service_by_driver(
    p_request_id UUID,
    p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
    v_driver_id UUID;
    v_request_status request_status;
BEGIN
    v_driver_id := auth.uid();

    -- Check if request exists and is assigned to this driver
    SELECT status INTO v_request_status
    FROM service_requests 
    WHERE id = p_request_id 
    AND assigned_driver_id = v_driver_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND_OR_NOT_ASSIGNED');
    END IF;
    
    -- Check if cancellable
    IF v_request_status NOT IN ('assigned', 'in_progress') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_STATUS', 'current_status', v_request_status);
    END IF;
    
    -- Update request status
    UPDATE service_requests SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Reset driver availability
    UPDATE users SET
        is_available = TRUE,
        updated_at = NOW()
    WHERE id = v_driver_id;
    
    RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_service_by_driver(UUID, TEXT) TO authenticated;
