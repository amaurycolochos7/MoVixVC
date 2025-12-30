-- ============================================================
-- MoVix Row Level Security Policies
-- Version: 002_rls_policies
-- Description: RLS policies for all tables by role
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS role_type AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Users can view their own complete profile
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    USING (id = auth.uid());

-- Users can view public info of other users (for displaying driver info, etc.)
CREATE POLICY "users_select_public_drivers" ON users
    FOR SELECT
    USING (
        role IN ('taxi', 'mandadito') AND is_active = TRUE
    );

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin can do everything
CREATE POLICY "users_admin_all" ON users
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Insert policy for new user registration (via trigger from auth.users)
CREATE POLICY "users_insert_self" ON users
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================
-- SERVICE REQUESTS TABLE POLICIES
-- ============================================================

-- Cliente: Can view their own requests
CREATE POLICY "requests_client_select" ON service_requests
    FOR SELECT
    USING (client_id = auth.uid());

-- Cliente: Can create new requests
CREATE POLICY "requests_client_insert" ON service_requests
    FOR INSERT
    WITH CHECK (
        client_id = auth.uid() AND
        get_user_role() = 'cliente'
    );

-- Cliente: Can update their own pending requests (cancel, add notes)
CREATE POLICY "requests_client_update" ON service_requests
    FOR UPDATE
    USING (
        client_id = auth.uid() AND
        status IN ('pending', 'negotiating')
    )
    WITH CHECK (client_id = auth.uid());

-- Conductor: Can view available requests matching their type
CREATE POLICY "requests_driver_select_available" ON service_requests
    FOR SELECT
    USING (
        status IN ('pending', 'negotiating') AND
        (
            (get_user_role() = 'taxi' AND service_type = 'taxi') OR
            (get_user_role() = 'mandadito' AND service_type = 'mandadito')
        )
    );

-- Conductor: Can view requests assigned to them
CREATE POLICY "requests_driver_select_assigned" ON service_requests
    FOR SELECT
    USING (assigned_driver_id = auth.uid());

-- Conductor: Can update requests assigned to them (status changes)
CREATE POLICY "requests_driver_update_assigned" ON service_requests
    FOR UPDATE
    USING (assigned_driver_id = auth.uid())
    WITH CHECK (assigned_driver_id = auth.uid());

-- Admin: Full access
CREATE POLICY "requests_admin_all" ON service_requests
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- REQUEST STOPS TABLE POLICIES
-- ============================================================

-- Cliente: Can view stops of their own requests
CREATE POLICY "stops_client_select" ON request_stops
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id AND client_id = auth.uid()
        )
    );

-- Cliente: Can create stops for their pending mandadito requests
CREATE POLICY "stops_client_insert" ON request_stops
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND client_id = auth.uid()
            AND service_type = 'mandadito'
            AND status = 'pending'
        )
    );

-- Cliente: Can update stops of their pending requests
CREATE POLICY "stops_client_update" ON request_stops
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND client_id = auth.uid()
            AND status IN ('pending', 'negotiating')
        )
    );

-- Cliente: Can delete stops of their pending requests
CREATE POLICY "stops_client_delete" ON request_stops
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND client_id = auth.uid()
            AND status = 'pending'
        )
    );

-- Conductor (mandadito): Can view stops of assigned requests
CREATE POLICY "stops_driver_select" ON request_stops
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND assigned_driver_id = auth.uid()
        )
    );

-- Conductor (mandadito): Can update stop status (complete, skip)
CREATE POLICY "stops_driver_update" ON request_stops
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND assigned_driver_id = auth.uid()
            AND status = 'in_progress'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND assigned_driver_id = auth.uid()
        )
    );

-- Admin: Full access
CREATE POLICY "stops_admin_all" ON request_stops
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- OFFERS TABLE POLICIES
-- ============================================================

-- Cliente: Can view offers on their requests
CREATE POLICY "offers_client_select" ON offers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id AND client_id = auth.uid()
        )
    );

-- Cliente: Can create counter-offers on their requests
CREATE POLICY "offers_client_insert_counter" ON offers
    FOR INSERT
    WITH CHECK (
        offer_type = 'counter' AND
        EXISTS (
            SELECT 1 FROM service_requests 
            WHERE id = request_id 
            AND client_id = auth.uid()
            AND status IN ('pending', 'negotiating')
        )
    );

-- Conductor: Can view their own offers
CREATE POLICY "offers_driver_select_own" ON offers
    FOR SELECT
    USING (driver_id = auth.uid());

-- Conductor: Can create initial offers on available requests
CREATE POLICY "offers_driver_insert" ON offers
    FOR INSERT
    WITH CHECK (
        driver_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM service_requests sr
            JOIN users u ON u.id = auth.uid()
            WHERE sr.id = request_id 
            AND sr.status IN ('pending', 'negotiating')
            AND u.role::text = sr.service_type::text
            AND u.is_available = TRUE
        )
    );

-- Conductor: Can update (withdraw) their pending offers
CREATE POLICY "offers_driver_update_own" ON offers
    FOR UPDATE
    USING (
        driver_id = auth.uid() AND 
        status = 'pending'
    )
    WITH CHECK (driver_id = auth.uid());

-- Admin: Full access
CREATE POLICY "offers_admin_all" ON offers
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- LEDGER ENTRIES TABLE POLICIES
-- ============================================================

-- Conductor: Can view their own ledger entries
CREATE POLICY "ledger_driver_select" ON ledger_entries
    FOR SELECT
    USING (driver_id = auth.uid());

-- Admin: Full access (only admin can insert/modify)
CREATE POLICY "ledger_admin_all" ON ledger_entries
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- GRANT EXECUTE ON FUNCTIONS
-- ============================================================

-- Allow authenticated users to call assignment function
GRANT EXECUTE ON FUNCTION assign_driver_to_request(UUID, UUID, UUID, INTEGER) TO authenticated;

-- Allow authenticated users to call complete service function  
GRANT EXECUTE ON FUNCTION complete_service(UUID, UUID) TO authenticated;

-- Admin only for expire offers (could be called by cron job)
GRANT EXECUTE ON FUNCTION expire_pending_offers() TO authenticated;

-- Helper functions need to be accessible
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
