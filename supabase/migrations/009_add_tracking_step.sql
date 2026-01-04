-- Migration: Add tracking_step column to service_requests
-- This column tracks granular progress of the service for real-time client updates

-- Add tracking_step column
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS tracking_step TEXT DEFAULT 'accepted';

-- Add comment for documentation
COMMENT ON COLUMN service_requests.tracking_step IS 'Granular tracking step: accepted, on_the_way, nearby, arrived, picked_up, in_transit, completed';

-- Update existing assigned/in_progress requests to have a default tracking step
UPDATE service_requests 
SET tracking_step = 'accepted' 
WHERE status = 'assigned' AND tracking_step IS NULL;

UPDATE service_requests 
SET tracking_step = 'picked_up' 
WHERE status = 'in_progress' AND tracking_step IS NULL;
