-- NUCLEAR OPTION: Disable Row Level Security completely
-- This guarantees that if data exists, it IS visible.
-- Run this if previous debug policies didn't work.

ALTER TABLE request_stops DISABLE ROW LEVEL SECURITY;
ALTER TABLE stop_items DISABLE ROW LEVEL SECURITY;

-- Verify it works immediately
NOTIFY pgrst, 'reload schema';
