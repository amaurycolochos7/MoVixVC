-- ============================================================
-- PASO 1: Ejecuta esto primero para ver tus servicios activos
-- ============================================================
SELECT 
    id,
    service_type,
    status,
    assigned_driver_id,
    created_at,
    notes
FROM service_requests
WHERE service_type = 'mandadito'
  AND status IN ('pending', 'assigned', 'in_progress')
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- PASO 2: Copia el ID de arriba y pégalo en la siguiente línea
-- Formato del ID: '19e45ff6-ba8c-455f-bf04-d289bfc56eec'
-- ============================================================

-- ⚠️ ELIMINA ESTOS COMENTARIOS Y EJECUTA SOLO LAS LÍNEAS DE ABAJO
-- ⚠️ REEMPLAZA EL ID EN LA LÍNEA 27

DO $$
DECLARE
    v_service_id UUID := '2505e313-e45d-461f-bf53-3fc38c277277'; -- 🔴 CAMBIA ESTE ID
    v_driver_id UUID;
BEGIN
    SELECT assigned_driver_id INTO v_driver_id
    FROM service_requests
    WHERE id = v_service_id;

    UPDATE service_requests
    SET 
        status = 'cancelled',
        cancellation_reason = 'Prueba - Cancelado manualmente',
        cancelled_at = NOW()
    WHERE id = v_service_id;

    IF v_driver_id IS NOT NULL THEN
        UPDATE users
        SET is_available = TRUE
        WHERE id = v_driver_id;
    END IF;

    UPDATE offers
    SET status = 'rejected', responded_at = NOW()
    WHERE request_id = v_service_id AND status = 'pending';

    RAISE NOTICE 'Servicio cancelado exitosamente';
END $$;
