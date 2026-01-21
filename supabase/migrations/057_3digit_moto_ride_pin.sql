-- ============================================================
-- MoVix Database Migration - 3-Digit PIN for Moto Ride
-- Version: 057_3digit_moto_ride_pin
-- Description: Cambiar PIN a 3 dígitos para Moto Ride
-- ============================================================

-- Función para generar PIN de 3 dígitos (100-999)
CREATE OR REPLACE FUNCTION generate_boarding_pin_3digit()
RETURNS VARCHAR(3) AS $$
DECLARE
    pin VARCHAR(3);
BEGIN
    -- Generar número aleatorio entre 100 y 999
    pin := LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0');
    RETURN pin;
END;
$$ LANGUAGE plpgsql;

-- Actualizar la función auto_generate_boarding_pin para usar 3 dígitos para moto_ride
CREATE OR REPLACE FUNCTION auto_generate_boarding_pin()
RETURNS TRIGGER AS $$
BEGIN
    -- Generar PIN cuando se asigna un conductor
    IF NEW.assigned_driver_id IS NOT NULL AND NEW.boarding_pin IS NULL THEN
        -- Usar PIN de 3 dígitos para moto_ride, 4 dígitos para otros
        IF NEW.service_type = 'moto_ride' THEN
            NEW.boarding_pin := generate_boarding_pin_3digit();
        ELSE
            NEW.boarding_pin := generate_boarding_pin();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Actualizar validate_boarding_pin para aceptar pins de 3 o 4 dígitos
CREATE OR REPLACE FUNCTION validate_boarding_pin(
    p_request_id UUID,
    p_pin VARCHAR(4)  -- Acepta hasta 4 caracteres pero puede ser 3
)
RETURNS JSON AS $$
DECLARE
    v_request service_requests%ROWTYPE;
    v_result JSON;
BEGIN
    -- Obtener el request
    SELECT * INTO v_request
    FROM service_requests
    WHERE id = p_request_id;
    
    -- Validar que existe
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'REQUEST_NOT_FOUND',
            'message', 'Solicitud no encontrada'
        );
    END IF;
    
    -- Validar que el PIN coincide (comparar como texto)
    IF v_request.boarding_pin IS NULL OR TRIM(v_request.boarding_pin) != TRIM(p_pin) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_PIN',
            'message', 'Código incorrecto. Verifica con el cliente.'
        );
    END IF;
    
    -- Validar que no está ya en progreso
    IF v_request.status = 'in_progress' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_IN_PROGRESS',
            'message', 'El viaje ya está en progreso'
        );
    END IF;
    
    -- Actualizar a picked_up e in_progress
    UPDATE service_requests
    SET 
        status = 'in_progress',
        tracking_step = 'picked_up',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Viaje iniciado correctamente'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar servicios moto_ride existentes a PIN de 3 dígitos
UPDATE service_requests
SET boarding_pin = generate_boarding_pin_3digit()
WHERE service_type = 'moto_ride'
  AND assigned_driver_id IS NOT NULL
  AND status IN ('assigned', 'in_progress')
  AND (boarding_pin IS NULL OR LENGTH(boarding_pin) > 3);

-- Permisos
GRANT EXECUTE ON FUNCTION generate_boarding_pin_3digit() TO authenticated;

-- Comentarios
COMMENT ON FUNCTION generate_boarding_pin_3digit() IS 'Genera un PIN aleatorio de 3 dígitos para Moto Ride';
COMMENT ON FUNCTION auto_generate_boarding_pin() IS 'Genera PIN de abordaje: 3 dígitos para moto_ride, 4 dígitos para otros';
