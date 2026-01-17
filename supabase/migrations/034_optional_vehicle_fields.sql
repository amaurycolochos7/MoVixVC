-- ============================================================
-- MoVix Database Migration - Optional Vehicle Fields for Mandadito
-- Version: 034_optional_vehicle_fields
-- Description: Makes plate_number and taxi_number optional for motorcycles
-- ============================================================

-- ============================================================
-- 1. ALTER COLUMNS TO BE NULLABLE
-- ============================================================

-- Make plate_number nullable (mandaditos on motorcycles may not have plates)
ALTER TABLE driver_vehicles ALTER COLUMN plate_number DROP NOT NULL;

-- Make taxi_number nullable (mandaditos may not have economic number)
ALTER TABLE driver_vehicles ALTER COLUMN taxi_number DROP NOT NULL;

-- ============================================================
-- 2. FIX UNIQUE CONSTRAINTS TO IGNORE NULLS
-- ============================================================

-- Drop old unique constraints
ALTER TABLE driver_vehicles DROP CONSTRAINT IF EXISTS driver_vehicles_plate_unique;
ALTER TABLE driver_vehicles DROP CONSTRAINT IF EXISTS driver_vehicles_taxi_number_unique;

-- Create partial unique indexes that ignore NULL values
-- This allows multiple NULLs but still enforces uniqueness for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicles_plate_unique 
    ON driver_vehicles(plate_number) 
    WHERE plate_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicles_taxi_unique 
    ON driver_vehicles(taxi_number) 
    WHERE taxi_number IS NOT NULL;

-- ============================================================
-- 3. ADD VEHICLE TYPE FIELD
-- ============================================================

-- Add a field to distinguish vehicle type
ALTER TABLE driver_vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'car';
-- Values: 'car' for taxi, 'motorcycle' for mandadito

-- Update existing records based on user role
UPDATE driver_vehicles dv
SET vehicle_type = CASE 
    WHEN u.role = 'mandadito' THEN 'motorcycle'
    ELSE 'car'
END
FROM users u
WHERE dv.user_id = u.id;
