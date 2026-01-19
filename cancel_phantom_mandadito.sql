-- Script para cancelar servicio fantasma bypaseando RLS
-- Ejecuta esto como SUPERADMIN en Supabase SQL Editor

-- Primero intentar con UPDATE normal agregando más condiciones
UPDATE service_requests
SET 
    status = 'cancelled',
    cancellation_reason = 'Bug de ofertas - servicio fantasma cancelado',
    updated_at = NOW()
WHERE id = 'ec293b68-6b73-4d66-9c70-b87034f27963';

-- Si no funciona, usar DELETE directo
-- DELETE FROM service_requests WHERE id = 'ec293b68-6b73-4d66-9c70-b87034f27963';

-- Verificar
SELECT id, status, cancellation_reason 
FROM service_requests 
WHERE id = 'ec293b68-6b73-4d66-9c70-b87034f27963';
