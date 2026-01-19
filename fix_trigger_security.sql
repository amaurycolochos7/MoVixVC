-- FIX: Corregir trigger que actualiza service_requests cuando se crea oferta
-- El problema es que la función del trigger no tiene SECURITY DEFINER
-- Ejecutar en Supabase SQL Editor

-- 1. Recrear la función con SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_request_status_on_offer()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new offer is created, update request to 'negotiating'
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

-- 2. Verificar que el trigger existe
SELECT tgname, proname 
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_offer_insert';
