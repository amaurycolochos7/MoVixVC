-- ============================================================
-- MoVix Database Migration - Driver Approval System
-- Version: 053_driver_approval
-- Description: Adds driver approval field for admin verification
-- ============================================================

-- Add is_approved column to users table
-- Clients are auto-approved, drivers need admin approval
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Auto-approve existing clients
UPDATE users 
SET is_approved = TRUE 
WHERE role = 'cliente' OR role = 'admin';

-- Create index for finding pending driver approvals
CREATE INDEX IF NOT EXISTS idx_users_pending_approval 
ON users(role, is_approved) 
WHERE role IN ('taxi', 'mandadito') AND is_approved = FALSE;

-- Function to auto-approve clients on insert
CREATE OR REPLACE FUNCTION auto_approve_clients()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-approve clients and admins
    IF NEW.role IN ('cliente', 'admin') THEN
        NEW.is_approved := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-approval
DROP TRIGGER IF EXISTS trigger_auto_approve_clients ON users;
CREATE TRIGGER trigger_auto_approve_clients
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_clients();

-- Update RLS policies to check is_approved for drivers
-- Drivers can only access driver features if approved

-- Comment: Add this check to existing driver-related RLS policies
-- Example: AND (role = 'cliente' OR is_approved = TRUE)
