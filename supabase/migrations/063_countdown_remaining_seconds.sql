-- ============================================================
-- MoVix Database Migration - Countdown Remaining Seconds
-- Version: 063_countdown_remaining_seconds
-- Description: RPC function to fetch requests with server-calculated remaining seconds
-- ============================================================

-- Create function to get service requests with remaining seconds calculated by server
-- This ensures all clients see the exact same countdown
CREATE OR REPLACE FUNCTION get_pending_requests_with_countdown(
    p_municipio TEXT DEFAULT 'Venustiano Carranza',
    p_service_types TEXT[] DEFAULT ARRAY['mandadito', 'moto_ride', 'taxi']
)
RETURNS TABLE (
    id UUID,
    status TEXT,
    service_type TEXT,
    mandadito_type TEXT,
    origin_address TEXT,
    origin_lat DOUBLE PRECISION,
    origin_lng DOUBLE PRECISION,
    destination_address TEXT,
    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,
    delivery_address TEXT,
    delivery_lat DOUBLE PRECISION,
    delivery_lng DOUBLE PRECISION,
    delivery_references TEXT,
    estimated_price NUMERIC,
    final_price NUMERIC,
    notes TEXT,
    client_id UUID,
    created_at TIMESTAMPTZ,
    request_expires_at TIMESTAMPTZ,
    remaining_seconds INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        sr.id,
        sr.status,
        sr.service_type,
        sr.mandadito_type,
        sr.origin_address,
        sr.origin_lat,
        sr.origin_lng,
        sr.destination_address,
        sr.destination_lat,
        sr.destination_lng,
        sr.delivery_address,
        sr.delivery_lat,
        sr.delivery_lng,
        sr.delivery_references,
        sr.estimated_price,
        sr.final_price,
        sr.notes,
        sr.client_id,
        sr.created_at,
        sr.request_expires_at,
        -- Calculate remaining seconds from server's NOW()
        GREATEST(0, EXTRACT(EPOCH FROM (sr.request_expires_at - NOW()))::INTEGER) AS remaining_seconds
    FROM service_requests sr
    WHERE sr.status IN ('pending', 'negotiating')
      AND sr.municipio = p_municipio
      AND sr.request_expires_at > NOW()
      AND sr.service_type = ANY(p_service_types)
    ORDER BY sr.created_at DESC;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_pending_requests_with_countdown(TEXT, TEXT[]) TO authenticated;

COMMENT ON FUNCTION get_pending_requests_with_countdown IS 'Returns pending requests with server-calculated remaining_seconds to ensure countdown sync across all devices';
