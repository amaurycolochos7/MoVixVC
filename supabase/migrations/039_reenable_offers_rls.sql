-- Rehabilitar RLS para tabla offers con políticas correctas
-- Esto reemplaza la desactivación de 038_disable_all_rls.sql

BEGIN;

-- Re-enable RLS para offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Asegurar que todas las políticas necesarias existen
-- Cliente puede ver ofertas de sus propias solicitudes
DROP POLICY IF EXISTS "offers_client_select" ON offers;
CREATE POLICY "offers_client_select" ON offers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id AND client_id = auth.uid()
        )
    );

-- Cliente puede actualizar ofertas (para aceptar/rechazar)
DROP POLICY IF EXISTS "offers_client_update" ON offers;
CREATE POLICY "offers_client_update" ON offers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id AND client_id = auth.uid()
        )
    );

-- Conductor puede SELECT sus propias ofertas
DROP POLICY IF EXISTS "offers_driver_select_own" ON offers;
CREATE POLICY "offers_driver_select_own" ON offers
    FOR SELECT
    USING (driver_id = auth.uid());

-- Conductor puede INSERT ofertas
DROP POLICY IF EXISTS "offers_driver_insert" ON offers;
CREATE POLICY "offers_driver_insert" ON offers
    FOR INSERT
    WITH CHECK (
        driver_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM service_requests sr
            WHERE sr.id = request_id 
            AND sr.status IN ('pending', 'negotiating')
        )
    );

-- Conductor puede UPDATE sus propias ofertas pendientes
DROP POLICY IF EXISTS "offers_driver_update_own" ON offers;
CREATE POLICY "offers_driver_update_own" ON offers
    FOR UPDATE
    USING (driver_id = auth.uid() AND status = 'pending')
    WITH CHECK (driver_id = auth.uid());

-- Admin puede hacer todo
DROP POLICY IF EXISTS "offers_admin_all" ON offers;
CREATE POLICY "offers_admin_all" ON offers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMIT;
