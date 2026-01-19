-- FIX RLS para tabla offers - Ejecutar en Supabase SQL Editor
-- Este script arregla el error 42501 al crear ofertas

BEGIN;

-- Asegurar que RLS está habilitado
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Recrear política de INSERT para conductores
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

-- Recrear política de SELECT para conductores
DROP POLICY IF EXISTS "offers_driver_select_own" ON offers;
CREATE POLICY "offers_driver_select_own" ON offers
    FOR SELECT
    USING (driver_id = auth.uid());

-- Recrear política de SELECT para clientes
DROP POLICY IF EXISTS "offers_client_select" ON offers;
CREATE POLICY "offers_client_select" ON offers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id AND client_id = auth.uid()
        )
    );

-- Recrear política de UPDATE para clientes
DROP POLICY IF EXISTS "offers_client_update" ON offers;
CREATE POLICY "offers_client_update" ON offers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id AND client_id = auth.uid()
        )
    );

-- Conductor puede UPDATE sus propias ofertas pendientes
DROP POLICY IF EXISTS "offers_driver_update_own" ON offers;
CREATE POLICY "offers_driver_update_own" ON offers
    FOR UPDATE
    USING (driver_id = auth.uid() AND status = 'pending')
    WITH CHECK (driver_id = auth.uid());

COMMIT;

-- Verificar que las políticas existen
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'offers';
