-- ============================================================
-- MASTER FIX: Corregir TODOS los problemas de RLS para ofertas y mandaditos
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fix trigger que actualiza service_requests (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION update_request_status_on_offer()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE service_requests
        SET status = 'negotiating',
            updated_at = NOW()
        WHERE id = NEW.request_id
        AND status = 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Fix assign_driver_to_request function (ya tiene SECURITY DEFINER)
-- ============================================================
-- No need to change, already has SECURITY DEFINER

-- ============================================================
-- 3. Fix RLS policies for OFFERS table
-- ============================================================

-- Enable RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Cliente puede ver ofertas de sus propios requests
DROP POLICY IF EXISTS "offers_client_select" ON offers;
CREATE POLICY "offers_client_select" ON offers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests sr
            WHERE sr.id = request_id AND sr.client_id = auth.uid()
        )
    );

-- Cliente puede actualizar ofertas (aceptar/rechazar)
DROP POLICY IF EXISTS "offers_client_update" ON offers;
CREATE POLICY "offers_client_update" ON offers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests sr
            WHERE sr.id = request_id AND sr.client_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM service_requests sr
            WHERE sr.id = request_id AND sr.client_id = auth.uid()
        )
    );

-- Conductor puede ver sus propias ofertas
DROP POLICY IF EXISTS "offers_driver_select_own" ON offers;
CREATE POLICY "offers_driver_select_own" ON offers
    FOR SELECT
    USING (driver_id = auth.uid());

-- Conductor puede insertar ofertas en requests disponibles
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

-- Conductor puede actualizar sus propias ofertas
DROP POLICY IF EXISTS "offers_driver_update_own" ON offers;
CREATE POLICY "offers_driver_update_own" ON offers
    FOR UPDATE
    USING (driver_id = auth.uid())
    WITH CHECK (driver_id = auth.uid());

-- ============================================================
-- 4. Fix RLS policies for SERVICE_REQUESTS table (conductor updates)
-- ============================================================

-- Drivers can update requests they are assigned to
DROP POLICY IF EXISTS "requests_driver_update_assigned" ON service_requests;
CREATE POLICY "requests_driver_update_assigned" ON service_requests
    FOR UPDATE
    USING (assigned_driver_id = auth.uid())
    WITH CHECK (assigned_driver_id = auth.uid());

-- Clients can update their own requests
DROP POLICY IF EXISTS "requests_client_update_own" ON service_requests;
CREATE POLICY "requests_client_update_own" ON service_requests
    FOR UPDATE
    USING (client_id = auth.uid())
    WITH CHECK (client_id = auth.uid());

-- Drivers can SELECT available requests to make offers
DROP POLICY IF EXISTS "requests_driver_select_available" ON service_requests;
CREATE POLICY "requests_driver_select_available" ON service_requests
    FOR SELECT
    USING (
        status IN ('pending', 'negotiating')
        OR assigned_driver_id = auth.uid()
    );

-- ============================================================
-- 5. Verificar políticas creadas
-- ============================================================
COMMIT;

-- Mostrar políticas de offers
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'offers' ORDER BY policyname;

-- Mostrar políticas de service_requests
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'service_requests' ORDER BY policyname;
