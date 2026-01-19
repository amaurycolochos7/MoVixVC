-- ================================================
-- SISTEMA DE COMISIONES SEMANALES PARA CONDUCTORES
-- ================================================

-- 1. Agregar campo de estado de comisión a usuarios
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'ok' 
    CHECK (commission_status IN ('ok', 'blocked'));

-- 2. Tabla para períodos de comisión
CREATE TABLE IF NOT EXISTS driver_commission_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('mandadito', 'taxi')),
    period_start TIMESTAMPTZ NOT NULL,  -- Lunes 00:00
    period_end TIMESTAMPTZ NOT NULL,    -- Domingo 23:59
    completed_services INT DEFAULT 0,
    commission_amount DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'no_services')),
    paid_at TIMESTAMPTZ,
    marked_paid_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint: one period per driver per service type per week
    UNIQUE(driver_id, service_type, period_start)
);

-- 3. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_commission_periods_driver ON driver_commission_periods(driver_id);
CREATE INDEX IF NOT EXISTS idx_commission_periods_status ON driver_commission_periods(status);
CREATE INDEX IF NOT EXISTS idx_commission_periods_period ON driver_commission_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_commission_periods_service_type ON driver_commission_periods(service_type);

-- 4. Función para obtener el inicio de semana (Lunes)
CREATE OR REPLACE FUNCTION get_week_start(ts TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- Obtener el lunes de la semana actual
    RETURN date_trunc('week', ts AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Función para obtener el fin de semana (Domingo 23:59:59)
CREATE OR REPLACE FUNCTION get_week_end(ts TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- Domingo 23:59:59.999 de la semana actual
    RETURN (date_trunc('week', ts AT TIME ZONE 'America/Mexico_City') + interval '6 days 23 hours 59 minutes 59 seconds') AT TIME ZONE 'America/Mexico_City';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Función para calcular comisiones de un conductor en un período
CREATE OR REPLACE FUNCTION calculate_driver_commission(
    p_driver_id UUID,
    p_service_type TEXT,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ
)
RETURNS TABLE(completed_count INT, commission_total DECIMAL) AS $$
DECLARE
    v_commission_per_service DECIMAL;
BEGIN
    -- Tarifa de comisión por tipo de servicio
    IF p_service_type = 'mandadito' THEN
        v_commission_per_service := 3.00;
    ELSE
        v_commission_per_service := 5.00; -- Taxi tiene otra tarifa
    END IF;
    
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as completed_count,
        (COUNT(*) * v_commission_per_service)::DECIMAL as commission_total
    FROM service_requests
    WHERE assigned_driver_id = p_driver_id
        AND service_type = p_service_type
        AND status = 'completed'
        AND completed_at >= p_period_start
        AND completed_at <= p_period_end;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Función para bloquear conductores con pagos vencidos (ejecutar cada lunes)
CREATE OR REPLACE FUNCTION block_overdue_drivers()
RETURNS INT AS $$
DECLARE
    v_blocked_count INT := 0;
    v_previous_week_start TIMESTAMPTZ;
    v_previous_week_end TIMESTAMPTZ;
BEGIN
    -- Calcular semana anterior
    v_previous_week_start := get_week_start(now() - interval '7 days');
    v_previous_week_end := get_week_end(now() - interval '7 days');
    
    -- Marcar períodos pendientes como vencidos
    UPDATE driver_commission_periods
    SET status = 'overdue', updated_at = now()
    WHERE status = 'pending'
        AND commission_amount > 0
        AND period_end < now();
    
    -- Bloquear conductores con períodos vencidos
    UPDATE users
    SET commission_status = 'blocked'
    WHERE id IN (
        SELECT DISTINCT driver_id 
        FROM driver_commission_periods 
        WHERE status = 'overdue'
    )
    AND commission_status = 'ok';
    
    GET DIAGNOSTICS v_blocked_count = ROW_COUNT;
    
    RETURN v_blocked_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Función para marcar pago recibido
CREATE OR REPLACE FUNCTION mark_commission_paid(
    p_period_id UUID,
    p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    -- Actualizar período a pagado
    UPDATE driver_commission_periods
    SET 
        status = 'paid',
        paid_at = now(),
        marked_paid_by = p_admin_id,
        updated_at = now()
    WHERE id = p_period_id
    RETURNING driver_id INTO v_driver_id;
    
    IF v_driver_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar si el conductor tiene otros períodos vencidos
    IF NOT EXISTS (
        SELECT 1 FROM driver_commission_periods 
        WHERE driver_id = v_driver_id AND status = 'overdue'
    ) THEN
        -- Desbloquear conductor
        UPDATE users SET commission_status = 'ok' WHERE id = v_driver_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 9. RLS policies
ALTER TABLE driver_commission_periods ENABLE ROW LEVEL SECURITY;

-- Admin puede ver y modificar todo
CREATE POLICY "Admin full access to commission periods" ON driver_commission_periods
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Conductores pueden ver sus propios períodos
CREATE POLICY "Drivers can view own commission periods" ON driver_commission_periods
    FOR SELECT USING (driver_id = auth.uid());

-- 10. Grant permisos
GRANT ALL ON driver_commission_periods TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_driver_commission TO authenticated;
GRANT EXECUTE ON FUNCTION mark_commission_paid TO authenticated;
GRANT EXECUTE ON FUNCTION block_overdue_drivers TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_start TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_end TO authenticated;
