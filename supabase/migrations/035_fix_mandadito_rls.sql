-- Fix RLS for request_stops to allow drivers to see pending requests
DROP POLICY IF EXISTS "stops_driver_select" ON request_stops;

CREATE POLICY "stops_driver_select_v2" ON request_stops
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests sr
            WHERE sr.id = request_id
            AND (
                -- Allow if assigned to driver
                sr.assigned_driver_id = auth.uid()
                OR
                -- Allow if pending/negotiating (so they can see details before creating offer)
                sr.status IN ('pending', 'negotiating')
            )
        )
    );

-- Fix RLS for stop_items
DROP POLICY IF EXISTS "items_driver_select" ON stop_items;

CREATE POLICY "items_driver_select_v2" ON stop_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id
            AND (
                sr.assigned_driver_id = auth.uid()
                OR
                sr.status IN ('pending', 'negotiating')
            )
        )
    );
