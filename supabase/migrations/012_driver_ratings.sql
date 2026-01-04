-- ============================================================
-- 012_driver_ratings.sql - Sistema de Calificaciones de Conductores
-- ============================================================

-- TABLA: driver_ratings
-- Almacena cada calificación individual por viaje
CREATE TABLE IF NOT EXISTS driver_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Cada request solo puede tener una calificación
    CONSTRAINT unique_rating_per_request UNIQUE (request_id)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_ratings_driver ON driver_ratings(driver_id);
CREATE INDEX idx_ratings_driver_month ON driver_ratings(driver_id, created_at);
CREATE INDEX idx_ratings_client ON driver_ratings(client_id);

-- CAMPOS AGREGADOS en users para caché de estadísticas
-- Esto evita calcular el promedio en cada consulta
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0;

-- RLS para driver_ratings
ALTER TABLE driver_ratings ENABLE ROW LEVEL SECURITY;

-- Cliente puede ver ratings de viajes que hizo
CREATE POLICY "ratings_client_select" ON driver_ratings
    FOR SELECT
    USING (client_id = auth.uid());

-- Cliente puede crear rating para sus viajes completados
CREATE POLICY "ratings_client_insert" ON driver_ratings
    FOR INSERT
    WITH CHECK (
        client_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND client_id = auth.uid()
            AND status = 'completed'
        )
    );

-- Conductor puede ver sus propios ratings
CREATE POLICY "ratings_driver_select" ON driver_ratings
    FOR SELECT
    USING (driver_id = auth.uid());

-- Admin acceso completo
CREATE POLICY "ratings_admin_all" ON driver_ratings
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- FUNCIÓN: Actualizar estadísticas del conductor cuando se agrega un rating
CREATE OR REPLACE FUNCTION update_driver_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar campos agregados en users
    UPDATE users SET
        rating_sum = rating_sum + NEW.rating,
        rating_count = rating_count + 1,
        rating_avg = (rating_sum + NEW.rating)::DECIMAL / (rating_count + 1)
    WHERE id = NEW.driver_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar automáticamente las estadísticas
CREATE TRIGGER trigger_update_driver_rating
    AFTER INSERT ON driver_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_rating_stats();

-- FUNCIÓN: Obtener distribución de ratings de un conductor
CREATE OR REPLACE FUNCTION get_driver_rating_distribution(p_driver_id UUID)
RETURNS TABLE(
    stars INTEGER,
    count BIGINT,
    percentage DECIMAL(5,2)
) AS $$
DECLARE
    v_total BIGINT;
BEGIN
    -- Obtener total de ratings
    SELECT COUNT(*) INTO v_total 
    FROM driver_ratings 
    WHERE driver_id = p_driver_id;
    
    IF v_total = 0 THEN
        -- Retornar distribución vacía
        RETURN QUERY
        SELECT s, 0::BIGINT, 0.00::DECIMAL(5,2)
        FROM generate_series(5, 1, -1) AS s;
    ELSE
        RETURN QUERY
        SELECT 
            s AS stars,
            COALESCE(r.cnt, 0) AS count,
            ROUND(COALESCE(r.cnt, 0)::DECIMAL / v_total * 100, 2) AS percentage
        FROM generate_series(5, 1, -1) AS s
        LEFT JOIN (
            SELECT rating, COUNT(*) AS cnt
            FROM driver_ratings
            WHERE driver_id = p_driver_id
            GROUP BY rating
        ) r ON r.rating = s
        ORDER BY s DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN: Obtener estadísticas mensuales del conductor
CREATE OR REPLACE FUNCTION get_driver_monthly_stats(p_driver_id UUID, p_months INTEGER DEFAULT 6)
RETURNS TABLE(
    month TEXT,
    avg_rating DECIMAL(3,2),
    total_ratings BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
        ROUND(AVG(rating)::DECIMAL, 2) AS avg_rating,
        COUNT(*) AS total_ratings
    FROM driver_ratings
    WHERE driver_id = p_driver_id
    AND created_at >= NOW() - (p_months || ' months')::INTERVAL
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para funciones
GRANT EXECUTE ON FUNCTION get_driver_rating_distribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_monthly_stats(UUID, INTEGER) TO authenticated;

-- Habilitar realtime para driver_ratings (para que el conductor vea nuevos ratings)
ALTER PUBLICATION supabase_realtime ADD TABLE driver_ratings;
