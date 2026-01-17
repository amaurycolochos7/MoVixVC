-- Fix RLS policy for service_locations to prevent 406 errors
-- Simplifying the check and ensuring access for clients

-- Drop existing policy
DROP POLICY IF EXISTS "Clients can view locations for their services" ON service_locations;

-- Re-create policy with simplified logic
-- We allow clients to see locations if they are the owner of the service_request
-- removing the strict status check or making it optional to avoid race conditions
CREATE POLICY "Clients can view locations for their services"
ON service_locations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM service_requests
        WHERE id = service_id
        AND client_id = auth.uid()
        -- Removed strict status check to prevent race conditions during "accepted" -> "assigned" transition
        -- The client owns the request, so seeing the location (if any exists) is safe.
    )
);

-- Ensure Realtime is enabled
DO $$
BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'service_locations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE service_locations;
    END IF;
END
$$;
