-- ============================================================
-- MoVix Database Migration - Update Pricing to $25
-- Version: 058_update_moto_ride_pricing
-- Description: Actualizar tarifas a $25 total ($20 conductor + $5 app)
-- ============================================================

-- Actualizar la función de validación de PIN de mandadito
CREATE OR REPLACE FUNCTION validate_mandadito_delivery_pin(
    p_request_id UUID,
    p_pin VARCHAR(4),
    p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_driver_id UUID;
    v_commission NUMERIC;
    v_total_earnings NUMERIC;
BEGIN
    -- Obtener la solicitud
    SELECT * INTO v_request
    FROM service_requests
    WHERE id = p_request_id;
    
    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Servicio no encontrado');
    END IF;
    
    -- Validar conductor
    IF v_request.assigned_driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No eres el conductor asignado');
    END IF;
    
    -- Validar estado
    IF v_request.status != 'in_progress' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El servicio no está en progreso');
    END IF;
    
    -- Validar PIN
    IF v_request.boarding_pin IS NULL OR TRIM(v_request.boarding_pin) != TRIM(p_pin) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN incorrecto');
    END IF;
    
    -- Todo válido - completar el servicio
    UPDATE service_requests
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Calcular ganancias del conductor
    -- Pricing: $25 total, $5 app commission, driver gets $20
    v_commission := COALESCE(v_request.commission_amount, 5);
    v_total_earnings := COALESCE(v_request.service_fee, 25) - v_commission;
    
    -- Actualizar balance del conductor
    UPDATE users
    SET 
        balance = COALESCE(balance, 0) + v_total_earnings
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Servicio completado exitosamente',
        'earnings', v_total_earnings
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION validate_mandadito_delivery_pin(UUID, VARCHAR, UUID) IS 'Valida PIN de entrega y completa servicio. Pricing: $25 total, $5 commission, $20 driver.';
