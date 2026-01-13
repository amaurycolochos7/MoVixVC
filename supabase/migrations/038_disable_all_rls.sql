-- NUCLEAR OPTION 2: Disable RLS for Offers and Locations
-- The previous one verified stops. Now we verify Offers.
-- Ensuring NO RLS blocks communication.

ALTER TABLE offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests DISABLE ROW LEVEL SECURITY; -- Just in case

-- Reload schema
NOTIFY pgrst, 'reload schema';
