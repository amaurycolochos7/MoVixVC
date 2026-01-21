-- ============================================================
-- MoVix Database Migration - Simplify Tracking Steps
-- Version: 059_simplify_tracking_steps
-- Description: Change default tracking_step to 'on_the_way' and update existing
-- ============================================================

-- Change default value for tracking_step
ALTER TABLE service_requests 
ALTER COLUMN tracking_step SET DEFAULT 'on_the_way';

-- Update comment to reflect simplified steps
COMMENT ON COLUMN service_requests.tracking_step IS 'Simplified tracking: on_the_way, arrived, picked_up, in_transit, completed';

-- Update existing services with old step values
UPDATE service_requests 
SET tracking_step = 'on_the_way' 
WHERE tracking_step IN ('accepted', 'nearby') 
  AND status = 'assigned';

-- Create function to auto-set tracking_step when driver is assigned
CREATE OR REPLACE FUNCTION auto_set_tracking_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- When a driver is assigned, set tracking to on_the_way
    IF NEW.assigned_driver_id IS NOT NULL AND OLD.assigned_driver_id IS NULL THEN
        NEW.tracking_step := 'on_the_way';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS set_tracking_on_assignment ON service_requests;
CREATE TRIGGER set_tracking_on_assignment
    BEFORE UPDATE ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_tracking_on_assignment();
