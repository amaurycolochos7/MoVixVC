-- ============================================================
-- MoVix Database Migration - Add driver_waiting_at column
-- Version: 060_add_driver_waiting_at
-- Description: Add column to track when driver notifies they are waiting
-- ============================================================

-- Add driver_waiting_at column to service_requests
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS driver_waiting_at TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN service_requests.driver_waiting_at IS 'Timestamp when driver notified they are waiting outside for client';
