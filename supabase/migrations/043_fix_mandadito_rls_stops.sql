-- Fix RLS for request_stops and stop_items to allow drivers to update during 'assigned' status
-- (Shopping phase happens while status is 'assigned', before 'in_progress')

-- 1. Update request_stops policy
DROP POLICY IF EXISTS "stops_driver_update" ON request_stops;

CREATE POLICY "stops_driver_update" ON request_stops
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND assigned_driver_id = auth.uid()
            AND status IN ('assigned', 'in_progress')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND assigned_driver_id = auth.uid()
        )
    );

-- 2. Update stop_items policy
DROP POLICY IF EXISTS "items_driver_update" ON stop_items;

CREATE POLICY "items_driver_update" ON stop_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id 
            AND sr.assigned_driver_id = auth.uid()
            AND sr.status IN ('assigned', 'in_progress')
        )
    );
