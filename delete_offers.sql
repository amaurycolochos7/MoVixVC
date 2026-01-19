-- Script para limpiar OFERTAS que están bloqueando al cliente
-- El mensaje "¡Tienes ofertas pendientes!" viene de la tabla OFFERS, no de service_requests

-- 1. Ver las ofertas del cliente
SELECT 
    o.id,
    o.request_id,
    o.driver_id,
    o.offered_price,
    o.status,
    o.created_at,
    sr.status as request_status
FROM offers o
LEFT JOIN service_requests sr ON sr.id = o.request_id
WHERE o.request_id = '1d8b9367-c734-4208-96de-80b30e222231'  -- ID del request
ORDER BY o.created_at DESC;

-- 2. ELIMINAR todas las ofertas de ese request
DELETE FROM offers 
WHERE request_id = '1d8b9367-c734-4208-96de-80b30e222231';

-- 3. También eliminar el request si aún existe
DELETE FROM service_requests 
WHERE id = '1d8b9367-c734-4208-96de-80b30e222231';

-- 4. Verificar que se eliminaron
SELECT * FROM offers WHERE request_id = '1d8b9367-c734-4208-96de-80b30e222231';
SELECT * FROM service_requests WHERE id = '1d8b9367-c734-4208-96de-80b30e222231';
-- Ambos deben decir "0 rows"
