-- Script DIRECTO para eliminar servicio fantasma
-- Ejecuta CADA comando UNO POR UNO en Supabase

-- 1. Primero ver el servicio problemático
SELECT id, status, service_type, client_id 
FROM service_requests 
WHERE client_id = '30c3b222231'  -- Reemplaza con el ID del cliente si es necesario
  AND service_type = 'mandadito'
  AND status IN ('negotiating', 'assigned', 'pending')
ORDER BY created_at DESC
LIMIT 5;

-- 2. Si aparece el servicio, ELIMINALO directamente con DELETE (más fuerte que UPDATE)
-- Reemplaza 'ec293b68-6b73-4d66-9c70-b87034f27963' con el ID que salió arriba

DELETE FROM service_requests 
WHERE id = 'ec293b68-6b73-4d66-9c70-b87034f27963';

-- 3. Verifica que se eliminó
SELECT id, status FROM service_requests WHERE id = 'ec293b68-6b73-4d66-9c70-b87034f27963';
-- Debe decir "0 rows" o error "no existe"

-- 4. Si DELETE no funciona por RLS, usa función de administrador:
-- Ejecuta esto COMO SERVICIO (Service Role Key):

/*
ALTER TABLE service_requests DISABLE ROW LEVEL SECURITY;
DELETE FROM service_requests WHERE id = 'ec293b68-6b73-4d66-9c70-b87034f27963';
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
*/
