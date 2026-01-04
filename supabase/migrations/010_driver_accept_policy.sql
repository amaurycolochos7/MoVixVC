-- Migration: Fix RLS policies for driver acceptance
-- These policies are simpler for development/testing

-- DROP existing restrictive policies (if they exist)
DROP POLICY IF EXISTS "offers_driver_insert" ON offers;
DROP POLICY IF EXISTS "requests_driver_accept_pending" ON service_requests;

-- Simplified policy: Allow any driver to create offers on matching requests
CREATE POLICY "offers_driver_insert" ON offers
    FOR INSERT
    WITH CHECK (
        driver_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM service_requests sr
            WHERE sr.id = request_id 
            AND sr.status IN ('pending', 'negotiating')
        )
    );

-- Policy: Allow drivers to accept pending requests
CREATE POLICY "requests_driver_accept_pending" ON service_requests
    FOR UPDATE
    USING (
        status = 'pending'
    )
    WITH CHECK (
        assigned_driver_id = auth.uid() AND
        status IN ('assigned', 'in_progress', 'completed', 'cancelled')
    );
