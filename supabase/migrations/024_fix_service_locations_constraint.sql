-- Fix FK constraint on service_locations to allow user deletion
ALTER TABLE service_locations DROP CONSTRAINT IF EXISTS service_locations_driver_id_fkey;

ALTER TABLE service_locations 
    ADD CONSTRAINT service_locations_driver_id_fkey 
    FOREIGN KEY (driver_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;
