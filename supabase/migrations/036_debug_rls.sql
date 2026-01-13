-- EMERGENCY DEBUG: Open access to stops and items to rule out RLS issues
-- Run this if stops are persistently not showing up

DROP POLICY IF EXISTS "stops_driver_select" ON request_stops;
DROP POLICY IF EXISTS "stops_driver_select_v2" ON request_stops;
DROP POLICY IF EXISTS "request_stops_policy" ON request_stops;

CREATE POLICY "debug_stops_open" ON request_stops 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "items_driver_select" ON stop_items;
DROP POLICY IF EXISTS "items_driver_select_v2" ON stop_items;
DROP POLICY IF EXISTS "stop_items_policy" ON stop_items;

CREATE POLICY "debug_items_open" ON stop_items 
    FOR SELECT 
    USING (true);
