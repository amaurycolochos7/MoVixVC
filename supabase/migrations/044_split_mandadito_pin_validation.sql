-- ============================================================
-- MoVix Database Migration - Split PIN Validation
-- Version: 044_split_mandadito_pin_validation
-- Description: Separa validación de PIN de la finalización del servicio
--              para permitir mostrar el modal de cobro antes de completar
-- ============================================================

-- ============================================================
-- Función 1: Solo valida el PIN (NO completa el servicio)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_mandadito_pin_only(
    p_request_id UUID,
    p_pin VARCHAR(4),
    p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- Obtener la solicitud
    SELECT * INTO v_request
    FROM service_requests
    WHERE id = p_request_id;
    
    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Servicio no encontrado');
    END IF;
    
    -- Validar que es mandadito
    IF v_request.service_type != 'mandadito' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta función es solo para mandadito');
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
    IF v_request.boarding_pin IS NULL OR v_request.boarding_pin != p_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN incorrecto');
    END IF;
    
    -- Todo válido - solo retornar éxito SIN cambiar el estado
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'PIN validado correctamente'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Función 2: Completar el servicio (después del modal de cobro)
-- ============================================================

CREATE OR REPLACE FUNCTION complete_mandadito_service(
    p_request_id UUID,
    p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
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
    
    -- Validar que es mandadito
    IF v_request.service_type != 'mandadito' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta función es solo para mandadito');
    END IF;
    
    -- Validar conductor
    IF v_request.assigned_driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No eres el conductor asignado');
    END IF;
    
    -- Validar que está en progreso (no ya completado)
    IF v_request.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Servicio ya estaba completado');
    END IF;
    
    IF v_request.status != 'in_progress' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El servicio no está en progreso');
    END IF;
    
    -- Completar el servicio
    UPDATE service_requests
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Calcular ganancias del conductor
    v_commission := COALESCE(v_request.commission_amount, 0);
    v_total_earnings := COALESCE(v_request.service_fee, 28) - v_commission;
    
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

-- ============================================================
-- Permisos
-- ============================================================

GRANT EXECUTE ON FUNCTION validate_mandadito_pin_only(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_mandadito_service(UUID, UUID) TO authenticated;

-- ============================================================
-- Comentarios
-- ============================================================

COMMENT ON FUNCTION validate_mandadito_pin_only(UUID, VARCHAR, UUID) IS 'Solo valida el PIN de entrega sin completar el servicio';
COMMENT ON FUNCTION complete_mandadito_service(UUID, UUID) IS 'Completa el servicio de mandadito después del modal de cobro';
