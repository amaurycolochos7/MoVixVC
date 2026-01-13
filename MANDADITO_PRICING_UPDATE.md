# Tarifas y Comisiones de Mandadito - Actualización

## Estructura de Precios Correcta

### Tarifa de Servicio (`service_fee`)
- **Base (1 parada)**: $28 MXN
  - $25 MXN para el mandadito
  - $3 MXN para la plataforma
- **Cada parada adicional**: +$10 MXN

**Ejemplos:**
- 1 parada: $28 MXN
- 2 paradas: $38 MXN ($28 + $10)
- 3 paradas: $48 MXN ($28 + $20)

### Comisión Plataforma
- **Mandadito**: $3.00 MXN
- **Taxi**: $3.00 MXN

## SQL a Ejecutar

El componente ya usa correctamente `service_fee || 28` como base. Solo necesitas actualizar la comisión en la base de datos:

```sql
-- ============================================================
-- Actualizar comisión de Mandadito de $2.50 a $3.00
-- ============================================================

CREATE OR REPLACE FUNCTION assign_driver_to_request(
    p_request_id UUID,
    p_driver_id UUID,
    p_offer_id UUID,
    p_expected_version INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_current_version INTEGER;
    v_current_status request_status;
    v_service_type service_type;
    v_final_price DECIMAL(10,2);
    v_commission DECIMAL(10,2);
    v_driver_balance DECIMAL(10,2);
BEGIN
    -- Lock the row for update
    SELECT version, status, service_type 
    INTO v_current_version, v_current_status, v_service_type
    FROM service_requests 
    WHERE id = p_request_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND');
    END IF;
    
    IF v_current_version != p_expected_version THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'VERSION_CONFLICT',
            'message', 'Request was modified by another process',
            'current_version', v_current_version
        );
    END IF;
    
    IF v_current_status NOT IN ('pending', 'negotiating') THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'message', 'Request cannot be assigned in current status',
            'current_status', v_current_status
        );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_driver_id 
        AND is_active = TRUE 
        AND is_available = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DRIVER_NOT_AVAILABLE');
    END IF;
    
    SELECT offered_price INTO v_final_price
    FROM offers 
    WHERE id = p_offer_id 
    AND request_id = p_request_id
    AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'OFFER_NOT_FOUND');
    END IF;
    
    -- MODIFICADO: Ambos servicios ahora tienen comisión de $3.00
    v_commission := CASE v_service_type 
        WHEN 'taxi' THEN 3.00
        WHEN 'mandadito' THEN 3.00
    END;
    
    UPDATE offers SET
        status = 'accepted',
        responded_at = NOW()
    WHERE id = p_offer_id;
    
    UPDATE service_requests SET
        assigned_driver_id = p_driver_id,
        status = 'assigned',
        final_price = v_final_price,
        commission_amount = v_commission,
        assigned_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    UPDATE offers SET
        status = 'rejected',
        responded_at = NOW()
    WHERE request_id = p_request_id 
    AND id != p_offer_id 
    AND status = 'pending';
    
    UPDATE users SET
        is_available = FALSE,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'new_version', v_current_version + 1,
        'final_price', v_final_price,
        'commission', v_commission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Notas
- ✅ El componente `MandaditoClientTracking` ya usa `request.service_fee || 28` como fallback
- ✅ La tarifa se calcula correctamente según número de paradas
- 🔧 Solo falta actualizar la comisión en la BD de $2.50 → $3.00
