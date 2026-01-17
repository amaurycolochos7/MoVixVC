-- =====================================================
-- Migration 020: Sistema de PIN de Abordaje
-- =====================================================

-- 1. Agregar columna boarding_pin a service_requests
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS boarding_pin VARCHAR(4);

-- 2. Crear tabla para tracking de cancelaciones
CREATE TABLE IF NOT EXISTS cancellation_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    was_charged BOOLEAN DEFAULT false,
    charge_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_cancellation_tracking_user_id ON cancellation_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_tracking_cancelled_at ON cancellation_tracking(cancelled_at);

-- 3. Crear tabla para bloqueos temporales
CREATE TABLE IF NOT EXISTS user_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suspended_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON user_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_active ON user_suspensions(is_active);

-- 4. Función para generar PIN aleatorio de 4 dígitos
CREATE OR REPLACE FUNCTION generate_boarding_pin()
RETURNS VARCHAR(4) AS $$
DECLARE
    pin VARCHAR(4);
BEGIN
    -- Generar número aleatorio entre 1000 y 9999
    pin := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    RETURN pin;
END;
$$ LANGUAGE plpgsql;

-- 5. Función para contar cancelaciones recientes
CREATE OR REPLACE FUNCTION count_recent_cancellations(p_user_id UUID, p_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    cancellation_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO cancellation_count
    FROM cancellation_tracking
    WHERE user_id = p_user_id
    AND cancelled_at > NOW() - INTERVAL '1 day' * p_days;
    
    RETURN COALESCE(cancellation_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 6. Función para verificar si usuario está suspendido
CREATE OR REPLACE FUNCTION is_user_suspended(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_suspended BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM user_suspensions
        WHERE user_id = p_user_id
        AND is_active = true
        AND suspended_until > NOW()
    ) INTO is_suspended;
    
    RETURN COALESCE(is_suspended, false);
END;
$$ LANGUAGE plpgsql;

-- 7. Función para validar PIN y iniciar viaje
CREATE OR REPLACE FUNCTION validate_boarding_pin(
    p_request_id UUID,
    p_pin VARCHAR(4)
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
    
    -- Validar que el PIN coincide
    IF v_request.boarding_pin IS NULL OR v_request.boarding_pin != p_pin THEN
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

-- 8. Trigger para generar PIN automáticamente cuando se asigna conductor
CREATE OR REPLACE FUNCTION auto_generate_boarding_pin()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se asigna un conductor y no hay PIN, generar uno
    IF NEW.assigned_driver_id IS NOT NULL AND NEW.boarding_pin IS NULL THEN
        NEW.boarding_pin := generate_boarding_pin();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_boarding_pin ON service_requests;
CREATE TRIGGER trigger_auto_generate_boarding_pin
    BEFORE INSERT OR UPDATE ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_boarding_pin();

-- 9. RLS Policies para cancellation_tracking
ALTER TABLE cancellation_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cancellations" ON cancellation_tracking;
CREATE POLICY "Users can view their own cancellations"
    ON cancellation_tracking FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert cancellations" ON cancellation_tracking;
CREATE POLICY "System can insert cancellations"
    ON cancellation_tracking FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 10. RLS Policies para user_suspensions
ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own suspensions" ON user_suspensions;
CREATE POLICY "Users can view their own suspensions"
    ON user_suspensions FOR SELECT
    USING (auth.uid() = user_id);

-- Comentarios
COMMENT ON TABLE cancellation_tracking IS 'Tracking de cancelaciones de usuarios para detección de abuso';
COMMENT ON TABLE user_suspensions IS 'Bloqueos temporales por cancelaciones excesivas';
COMMENT ON FUNCTION generate_boarding_pin() IS 'Genera un PIN aleatorio de 4 dígitos';
COMMENT ON FUNCTION validate_boarding_pin(UUID, VARCHAR) IS 'Valida PIN e inicia el viaje';
COMMENT ON FUNCTION count_recent_cancellations(UUID, INTEGER) IS 'Cuenta cancelaciones en los últimos N días';
COMMENT ON FUNCTION is_user_suspended(UUID) IS 'Verifica si un usuario está suspendido';
