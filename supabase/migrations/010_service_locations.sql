-- ============================================
-- Service Locations Table (Idempotent Migration)
-- Stores GPS tracking points for active services
-- ============================================

-- Drop table if exists (for clean re-run)
DROP TABLE IF EXISTS service_locations CASCADE;

CREATE TABLE service_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id),
    
    -- GPS data
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy FLOAT,
    bearing FLOAT,
    speed FLOAT, -- m/s
    
    -- Metadata
    status_phase TEXT CHECK (status_phase IN ('pickup', 'trip')), -- For debugging/analytics
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Most common query: get latest location for a service
CREATE INDEX idx_service_locations_service_created 
ON service_locations(service_id, created_at DESC NULLS LAST);

-- For fast COUNT and existence checks
CREATE INDEX idx_service_locations_service 
ON service_locations(service_id);

-- For driver queries
CREATE INDEX idx_service_locations_driver 
ON service_locations(driver_id, created_at DESC);

-- For cleanup queries
CREATE INDEX idx_service_locations_created 
ON service_locations(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE service_locations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Driver can INSERT locations for their assigned services
CREATE POLICY "Drivers can insert locations for their services"
ON service_locations
FOR INSERT
TO authenticated
WITH CHECK (
    -- User must be the driver
    auth.uid() = driver_id
    AND
    -- Service must be assigned to this driver and active
    EXISTS (
        SELECT 1 FROM service_requests
        WHERE id = service_id
        AND assigned_driver_id = auth.uid()
        AND status IN ('assigned', 'in_progress')
    )
);

-- Policy 2: Client can SELECT locations for their active service
CREATE POLICY "Clients can view locations for their services"
ON service_locations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM service_requests
        WHERE id = service_id
        AND client_id = auth.uid()
        AND status IN ('assigned', 'in_progress')
    )
);

-- Policy 3: Driver can SELECT their own locations
CREATE POLICY "Drivers can view their own locations"
ON service_locations
FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- Policy 4: Admin can view all locations
CREATE POLICY "Admins can view all locations"
ON service_locations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- ============================================
-- Realtime Publication
-- ============================================

-- Enable Realtime for service_locations table
-- Note: This may fail if already enabled, which is OK
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE service_locations;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'service_locations already in publication';
END $$;

-- ============================================
-- Cleanup Function
-- Delete location points older than 24 hours
-- ============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS cleanup_old_service_locations();

CREATE OR REPLACE FUNCTION cleanup_old_service_locations()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM service_locations
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % old service_location records', v_deleted;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_old_service_locations() TO service_role;

-- ============================================
-- Helper Function: Get Latest Location
-- ============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_latest_service_location(UUID);

CREATE OR REPLACE FUNCTION get_latest_service_location(p_service_id UUID)
RETURNS TABLE (
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    accuracy FLOAT,
    bearing FLOAT,
    speed FLOAT,
    status_phase TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.lat,
        sl.lng,
        sl.accuracy,
        sl.bearing,
        sl.speed,
        sl.status_phase,
        sl.created_at
    FROM service_locations sl
    WHERE sl.service_id = p_service_id
    ORDER BY sl.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Testing Queries (commented out)
-- ============================================

-- Test 1: Insert a location (as driver)
/*
INSERT INTO service_locations (service_id, driver_id, lat, lng, accuracy, bearing, speed, status_phase)
VALUES (
    'your-service-id',
    'your-driver-id',
    19.4326,
    -99.1332,
    15.0,
    45.0,
    10.5,
    'pickup'
);
*/

-- Test 2: Get latest location for a service
/*
SELECT * FROM get_latest_service_location('your-service-id');
*/

-- Test 3: Get all locations for a service (last 10)
/*
SELECT * FROM service_locations
WHERE service_id = 'your-service-id'
ORDER BY created_at DESC
LIMIT 10;
*/

-- Test 4: Cleanup old locations (manual)
/*
SELECT cleanup_old_service_locations();
*/
