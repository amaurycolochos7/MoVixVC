-- Add expiration to service requests
ALTER TABLE service_requests 
ADD COLUMN request_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes');

-- Index for efficient radar filtering (hide expired)
CREATE INDEX idx_requests_expiration ON service_requests(request_expires_at);

-- Update RLS to ensure expired requests are not visible in Radar (optional, but good practice)
-- Existing policy "requests_driver_select_available" checks status IN ('pending', 'negotiating')
-- We should ideally also check expiration, but let's stick to status updates.
-- Logic: The application (or a trigger/cron) should move expired requests to 'cancelled' or 'expired'.
-- For Phase 4 MVP, we will filter valid requests in the SELECT query: WHERE request_expires_at > NOW()
