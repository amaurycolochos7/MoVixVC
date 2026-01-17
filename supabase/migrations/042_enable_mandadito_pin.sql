-- ============================================================
-- MoVix Database Migration - Enable PIN for Mandadito
-- Version: 042_enable_mandadito_pin
-- Description: Genera PIN de entrega para mandadito también
-- ============================================================

-- Modificar función para generar PIN para TODOS los tipos de servicio
CREATE OR REPLACE FUNCTION auto_generate_boarding_pin()
RETURNS TRIGGER AS $$
BEGIN
    -- Generar PIN para taxi Y mandadito cuando se asigna un conductor
    IF NEW.assigned_driver_id IS NOT NULL 
       AND NEW.boarding_pin IS NULL THEN
        NEW.boarding_pin := generate_boarding_pin();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Actualizar mandaditos existentes sin PIN
-- ============================================================

UPDATE service_requests
SET boarding_pin = generate_boarding_pin()
WHERE service_type = 'mandadito'
  AND assigned_driver_id IS NOT NULL
  AND boarding_pin IS NULL
  AND status IN ('assigned', 'in_progress');

-- ============================================================
-- Crear función para validar PIN de entrega de mandadito
-- ============================================================

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
    
    -- Todo válido - completar el servicio
    UPDATE service_requests
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Calcular ganancias del conductor
    v_commission := COALESCE(v_request.commission_amount, 0);
    v_total_earnings := COALESCE(v_request.service_fee, 28) - v_commission;
    
    -- Actualizar balance del conductor (solo balance, sin total_earnings)
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

GRANT EXECUTE ON FUNCTION validate_mandadito_delivery_pin(UUID, VARCHAR, UUID) TO authenticated;

-- ============================================================
-- Comentarios
-- ============================================================

COMMENT ON FUNCTION auto_generate_boarding_pin() IS 'Genera PIN de abordaje automáticamente para taxi Y mandadito';
COMMENT ON FUNCTION validate_mandadito_delivery_pin(UUID, VARCHAR, UUID) IS 'Valida PIN de entrega y completa servicio de mandadito';
