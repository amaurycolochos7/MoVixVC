-- ============================================================
-- MoVix Database Migration - Server Time Function
-- Version: 062_server_time_function
-- Description: Function to get server timestamp for clock sync
-- ============================================================

-- Create function to get server time (for syncing countdown timers)
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT NOW();
$$;

-- Allow everyone to call this function
GRANT EXECUTE ON FUNCTION get_server_time() TO anon;
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;

COMMENT ON FUNCTION get_server_time() IS 'Returns current server timestamp for device clock synchronization';
