-- ============================================================
-- Script para cancelar un servicio de Mandadito
-- ID del servicio: 3a6bd746-8428-439d-af2c-e4ade963cd0b
-- ============================================================

-- Paso 1: Verificar el estado actual del servicio
SELECT 
    id,
    client_id,
    service_type,
    status,
    assigned_driver_id,
    origin_address,
    destination_address,
    final_price,
    created_at
FROM service_requests
WHERE id = '3a6bd746-8428-439d-af2c-e4ade963cd0b';

-- Paso 2: Cancelar el servicio
UPDATE service_requests
SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelado manualmente por admin desde SQL',
    updated_at = NOW()
WHERE id = '3a6bd746-8428-439d-af2c-e4ade963cd0b'
AND status != 'completed'; -- Solo cancelar si no está completado

-- Paso 3: Si había un driver asignado, marcarlo como disponible nuevamente
UPDATE users
SET 
    is_available = TRUE,
    updated_at = NOW()
WHERE id IN (
    SELECT assigned_driver_id 
    FROM service_requests 
    WHERE id = '3a6bd746-8428-439d-af2c-e4ade963cd0b'
    AND assigned_driver_id IS NOT NULL
)
AND role IN ('taxi', 'mandadito');

-- Paso 4: Rechazar todas las ofertas pendientes relacionadas
UPDATE offers
SET 
    status = 'rejected',
    responded_at = NOW()
WHERE request_id = '3a6bd746-8428-439d-af2c-e4ade963cd0b'
AND status = 'pending';

-- Paso 5: Verificar que se canceló correctamente
SELECT 
    id,
    status,
    cancelled_at,
    cancellation_reason,
    assigned_driver_id
FROM service_requests
WHERE id = '3a6bd746-8428-439d-af2c-e4ade963cd0b';

-- ============================================================
-- SCRIPT ALTERNATIVO: Para cancelar TODOS los servicios activos de un cliente
-- ============================================================
-- CUIDADO: Descomenta solo si quieres cancelar TODOS los servicios del cliente

/*
-- Obtener el client_id del servicio
DO $$
DECLARE
    v_client_id UUID;
BEGIN
    SELECT client_id INTO v_client_id
    FROM service_requests
    WHERE id = '3a6bd746-8428-439d-af2c-e4ade963cd0b';
    
    -- Cancelar todos los servicios activos del cliente
    UPDATE service_requests
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = 'Cancelación masiva por admin',
        updated_at = NOW()
    WHERE client_id = v_client_id
    AND status IN ('pending', 'negotiating', 'assigned', 'in_progress');
    
    RAISE NOTICE 'Servicios cancelados para cliente: %', v_client_id;
END $$;
*/
