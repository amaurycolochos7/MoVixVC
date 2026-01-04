-- ============================================================
-- 013_driver_location_tracking.sql - Rastreo GPS en Tiempo Real
-- ============================================================

-- Agregar columnas de ubicación actual al conductor
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- Índice para consultas de ubicación
CREATE INDEX IF NOT EXISTS idx_users_location ON users(current_lat, current_lng) WHERE current_lat IS NOT NULL;
