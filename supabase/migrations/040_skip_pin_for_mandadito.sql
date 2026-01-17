-- ============================================================
-- MoVix Database Migration - Skip PIN for Mandadito
-- Version: 040_skip_pin_for_mandadito
-- Description: Modifica trigger para que solo taxis generen PIN
-- ============================================================

-- Modificar función para generar PIN solo para servicios tipo 'taxi'
CREATE OR REPLACE FUNCTION auto_generate_boarding_pin()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo generar PIN para servicios de taxi, NO para mandadito
    IF NEW.assigned_driver_id IS NOT NULL 
       AND NEW.boarding_pin IS NULL 
       AND NEW.service_type = 'taxi' THEN
        NEW.boarding_pin := generate_boarding_pin();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Verificación
-- ============================================================

-- Verificar que la función fue actualizada
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'auto_generate_boarding_pin';

-- ============================================================
-- Comentarios
-- ============================================================

COMMENT ON FUNCTION auto_generate_boarding_pin() IS 'Genera PIN de abordaje automáticamente SOLO para servicios de taxi';
