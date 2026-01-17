-- ============================================================
-- MoVix Database Migration - Driver Vehicles and Approval
-- Version: 022_driver_vehicles_and_approval
-- Description: Adds vehicle data table and phone requirement for drivers
-- ============================================================

-- ============================================================
-- NEW TABLE: driver_vehicles
-- Stores vehicle information for taxi/mandadito drivers
-- ============================================================

CREATE TABLE driver_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Vehicle information (all required)
    brand TEXT NOT NULL,           -- Vehicle brand (e.g., "Nissan", "Toyota")
    model TEXT NOT NULL,           -- Vehicle model (e.g., "Versa 2020")
    color TEXT NOT NULL,           -- Vehicle color (e.g., "Blanco", "Verde", "Blanco con azul")
    plate_number TEXT NOT NULL,    -- License plate (unique)
    taxi_number TEXT NOT NULL,     -- Taxi number / Economic number (unique)
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT driver_vehicles_user_unique UNIQUE (user_id),
    CONSTRAINT driver_vehicles_plate_unique UNIQUE (plate_number),
    CONSTRAINT driver_vehicles_taxi_number_unique UNIQUE (taxi_number)
);

-- Index for lookups
CREATE INDEX idx_driver_vehicles_user ON driver_vehicles(user_id);
CREATE INDEX idx_driver_vehicles_plate ON driver_vehicles(plate_number);
CREATE INDEX idx_driver_vehicles_taxi_number ON driver_vehicles(taxi_number);

-- Trigger for updated_at
CREATE TRIGGER trigger_driver_vehicles_updated_at
    BEFORE UPDATE ON driver_vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- UPDATE CONSTRAINT: Phone required for drivers
-- ============================================================

-- First, update existing drivers without phone to have a placeholder
-- This prevents the constraint from failing on existing data
UPDATE users 
SET phone = 'SIN_TELEFONO_' || id::text
WHERE role IN ('taxi', 'mandadito') 
  AND phone IS NULL;

-- Now add constraint to ensure NEW drivers must have phone
-- Existing drivers with placeholder will need to update their phone later
ALTER TABLE users ADD CONSTRAINT users_driver_phone_required CHECK (
    (role IN ('cliente', 'admin')) OR
    (role IN ('taxi', 'mandadito') AND phone IS NOT NULL)
);

-- ============================================================
-- COMMENT: Using existing KYC system for approval
-- ============================================================

-- NOTE: We are using the existing kyc_status field from 003_kyc_schema.sql
-- as the approval mechanism. Values are:
--   - 'not_submitted': Driver registered but not yet approved (default)
--   - 'pending': Driver submitted KYC documents for review
--   - 'approved': Driver approved by admin, can work
--   - 'rejected': Driver rejected, cannot work
--
-- The existing constraint from 003_kyc_schema.sql already ensures:
-- ALTER TABLE users ADD CONSTRAINT users_driver_kyc_required CHECK (
--     (role NOT IN ('taxi', 'mandadito')) OR
--     (is_available = FALSE) OR
--     (is_available = TRUE AND kyc_status = 'approved')
-- );
--
-- This means drivers can only go online (is_available = TRUE) 
-- if they have been approved (kyc_status = 'approved')
