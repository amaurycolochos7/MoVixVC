-- ============================================================
-- MASTER SCHEMA MIGRATION - MoVix
-- Concatenated from migrations 001, 002, 003, 004, 005
-- ============================================================

-- ============================================================
-- 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE role_type AS ENUM ('cliente', 'taxi', 'mandadito', 'admin');
CREATE TYPE service_type AS ENUM ('taxi', 'mandadito');
CREATE TYPE request_status AS ENUM (
    'pending',      -- Waiting for offers
    'negotiating',  -- Has offers, in negotiation
    'assigned',     -- Driver assigned, on the way
    'in_progress',  -- Service in progress
    'completed',    -- Service completed
    'cancelled'     -- Cancelled
);
CREATE TYPE offer_status AS ENUM (
    'pending',   -- Waiting for response
    'accepted',  -- Accepted by client
    'rejected',  -- Rejected by client
    'expired',   -- Expired without response
    'withdrawn'  -- Withdrawn by driver
);
CREATE TYPE offer_type AS ENUM (
    'initial',  -- Initial offer from driver
    'counter'   -- Counter-offer
);
CREATE TYPE stop_status AS ENUM (
    'pending',     -- Pending
    'in_progress', -- In progress
    'completed',   -- Completed
    'skipped'      -- Skipped
);
CREATE TYPE ledger_entry_type AS ENUM (
    'commission',  -- Commission charged to driver
    'payment',     -- Payment from driver
    'adjustment',  -- Manual adjustment (admin)
    'bonus'        -- Bonus
);

-- TABLES

-- Users table (extends auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT UNIQUE,
    full_name TEXT NOT NULL,
    role role_type NOT NULL DEFAULT 'cliente',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    current_lat DECIMAL(10,7),
    current_lng DECIMAL(10,7),
    location_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT users_driver_availability CHECK (
        (role IN ('cliente', 'admin') AND is_available = FALSE) OR
        (role IN ('taxi', 'mandadito'))
    ),
    CONSTRAINT users_driver_location CHECK (
        (role NOT IN ('taxi', 'mandadito')) OR 
        (is_available = FALSE) OR
        (current_lat IS NOT NULL AND current_lng IS NOT NULL)
    )
);

-- Service requests table
CREATE TABLE service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type service_type NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    assigned_driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Origin location
    origin_address TEXT NOT NULL,
    origin_lat DECIMAL(10,7),
    origin_lng DECIMAL(10,7),
    
    -- Destination (required for taxi)
    destination_address TEXT,
    destination_lat DECIMAL(10,7),
    destination_lng DECIMAL(10,7),
    
    -- Service details
    notes TEXT,
    estimated_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    commission_amount DECIMAL(10,2),
    
    -- Timestamps
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Optimistic locking
    version INTEGER NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT requests_destination_taxi CHECK (
        service_type = 'mandadito' OR destination_address IS NOT NULL
    ),
    CONSTRAINT requests_price_positive CHECK (
        final_price IS NULL OR final_price > 0
    ),
    CONSTRAINT requests_commission_positive CHECK (
        commission_amount IS NULL OR commission_amount > 0
    ),
    CONSTRAINT requests_timestamps_order CHECK (
        (started_at IS NULL OR assigned_at IS NULL OR assigned_at <= started_at) AND
        (completed_at IS NULL OR started_at IS NULL OR started_at <= completed_at)
    )
);

-- Request stops (for mandadito multi-stop)
CREATE TABLE request_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    address TEXT NOT NULL,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    instructions TEXT,
    status stop_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT stops_order_unique UNIQUE (request_id, stop_order),
    CONSTRAINT stops_order_positive CHECK (stop_order > 0)
);

-- Offers table
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_type offer_type NOT NULL,
    offered_price DECIMAL(10,2) NOT NULL,
    status offer_status NOT NULL DEFAULT 'pending',
    parent_offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT offers_price_positive CHECK (offered_price > 0),
    CONSTRAINT offers_expiry_future CHECK (expires_at > created_at),
    CONSTRAINT offers_parent_different CHECK (parent_offer_id IS NULL OR parent_offer_id != id)
);

-- Ledger entries (commission tracking)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_type ledger_entry_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES

-- Users indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_available ON users(is_available) 
    WHERE role IN ('taxi', 'mandadito');
CREATE INDEX idx_users_location ON users(current_lat, current_lng) 
    WHERE is_available = TRUE;

-- Service requests indexes
CREATE INDEX idx_requests_client ON service_requests(client_id);
CREATE INDEX idx_requests_driver ON service_requests(assigned_driver_id) 
    WHERE assigned_driver_id IS NOT NULL;
CREATE INDEX idx_requests_status ON service_requests(status);
CREATE INDEX idx_requests_pending ON service_requests(service_type, created_at) 
    WHERE status = 'pending';
CREATE INDEX idx_requests_active ON service_requests(status) 
    WHERE status IN ('pending', 'assigned', 'in_progress');

-- Request stops indexes
CREATE INDEX idx_stops_request ON request_stops(request_id, stop_order);

-- Offers indexes
CREATE INDEX idx_offers_request ON offers(request_id, status);
CREATE INDEX idx_offers_driver ON offers(driver_id, status);
CREATE INDEX idx_offers_pending ON offers(expires_at) WHERE status = 'pending';
CREATE INDEX idx_offers_parent ON offers(parent_offer_id) WHERE parent_offer_id IS NOT NULL;

-- Ledger indexes
CREATE INDEX idx_ledger_driver ON ledger_entries(driver_id, created_at DESC);
CREATE INDEX idx_ledger_request ON ledger_entries(request_id);

-- FUNCTIONS

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for service_requests
CREATE TRIGGER trigger_requests_updated_at
    BEFORE UPDATE ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ANTI-DOUBLE-ASSIGNMENT FUNCTION
CREATE OR REPLACE FUNCTION assign_driver_to_request(
    p_request_id UUID,
    p_driver_id UUID,
    p_offer_id UUID,
    p_expected_version INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_current_version INTEGER;
    v_current_status request_status;
    v_service_type service_type;
    v_final_price DECIMAL(10,2);
    v_commission DECIMAL(10,2);
    v_driver_balance DECIMAL(10,2);
BEGIN
    -- Lock the row for update (prevents concurrent modifications)
    SELECT version, status, service_type 
    INTO v_current_version, v_current_status, v_service_type
    FROM service_requests 
    WHERE id = p_request_id
    FOR UPDATE;
    
    -- Check if request exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND');
    END IF;
    
    -- Check optimistic lock version
    IF v_current_version != p_expected_version THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'VERSION_CONFLICT',
            'message', 'Request was modified by another process',
            'current_version', v_current_version
        );
    END IF;
    
    -- Check status allows assignment
    IF v_current_status NOT IN ('pending', 'negotiating') THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'message', 'Request cannot be assigned in current status',
            'current_status', v_current_status
        );
    END IF;
    
    -- Verify driver exists and is available
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_driver_id 
        AND is_active = TRUE 
        AND is_available = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DRIVER_NOT_AVAILABLE');
    END IF;
    
    -- Get the accepted offer price
    SELECT offered_price INTO v_final_price
    FROM offers 
    WHERE id = p_offer_id 
    AND request_id = p_request_id
    AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'OFFER_NOT_FOUND');
    END IF;
    
    -- Calculate commission based on service type
    v_commission := CASE v_service_type 
        WHEN 'taxi' THEN 3.00
        WHEN 'mandadito' THEN 2.50
    END;
    
    -- Update the offer to accepted
    UPDATE offers SET
        status = 'accepted',
        responded_at = NOW()
    WHERE id = p_offer_id;
    
    -- Update request with atomic version increment
    UPDATE service_requests SET
        assigned_driver_id = p_driver_id,
        status = 'assigned',
        final_price = v_final_price,
        commission_amount = v_commission,
        assigned_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Reject all other pending offers for this request
    UPDATE offers SET
        status = 'rejected',
        responded_at = NOW()
    WHERE request_id = p_request_id 
    AND id != p_offer_id 
    AND status = 'pending';
    
    -- Mark driver as unavailable (busy with this request)
    UPDATE users SET
        is_available = FALSE,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'new_version', v_current_version + 1,
        'final_price', v_final_price,
        'commission', v_commission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMPLETE SERVICE FUNCTION
CREATE OR REPLACE FUNCTION complete_service(
    p_request_id UUID,
    p_driver_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_driver_balance DECIMAL(10,2);
BEGIN
    -- Get and lock the request
    SELECT * INTO v_request
    FROM service_requests
    WHERE id = p_request_id
    AND assigned_driver_id = p_driver_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'REQUEST_NOT_FOUND');
    END IF;
    
    IF v_request.status != 'in_progress' THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'current_status', v_request.status
        );
    END IF;
    
    -- Update request to completed
    UPDATE service_requests SET
        status = 'completed',
        completed_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Calculate driver's current balance
    SELECT COALESCE(SUM(amount), 0) INTO v_driver_balance
    FROM ledger_entries
    WHERE driver_id = p_driver_id;
    
    -- Record commission in ledger
    INSERT INTO ledger_entries (
        request_id, driver_id, entry_type, amount, balance_after, description
    ) VALUES (
        p_request_id,
        p_driver_id,
        'commission',
        v_request.commission_amount,
        v_driver_balance + v_request.commission_amount,
        'Comisión por servicio ' || v_request.service_type::TEXT || ' #' || LEFT(p_request_id::TEXT, 8)
    );
    
    -- Mark driver as available again
    UPDATE users SET
        is_available = TRUE,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'final_price', v_request.final_price,
        'commission', v_request.commission_amount,
        'driver_new_balance', v_driver_balance + v_request.commission_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- EXPIRE OFFERS FUNCTION
CREATE OR REPLACE FUNCTION expire_pending_offers()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE offers SET
        status = 'expired',
        responded_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- UPDATE REQUEST STATUS BASED ON OFFERS
CREATE OR REPLACE FUNCTION update_request_status_on_offer()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new offer is created, update request to 'negotiating'
    IF TG_OP = 'INSERT' THEN
        UPDATE service_requests
        SET status = 'negotiating',
        updated_at = NOW()
        WHERE id = NEW.request_id
        AND status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offer_insert
    AFTER INSERT ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_request_status_on_offer();

-- ============================================================
-- 002_rls_policies.sql
-- ============================================================

-- ENABLE RLS ON ALL TABLES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS

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

-- USERS TABLE POLICIES

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

-- SERVICE REQUESTS TABLE POLICIES

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

-- REQUEST STOPS TABLE POLICIES

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

-- OFFERS TABLE POLICIES

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

-- LEDGER ENTRIES TABLE POLICIES

-- Conductor: Can view their own ledger entries
CREATE POLICY "ledger_driver_select" ON ledger_entries
    FOR SELECT
    USING (driver_id = auth.uid());

-- Admin: Full access (only admin can insert/modify)
CREATE POLICY "ledger_admin_all" ON ledger_entries
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- GRANT EXECUTE ON FUNCTIONS
GRANT EXECUTE ON FUNCTION assign_driver_to_request(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_service(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_pending_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================================
-- 003_kyc_schema.sql
-- ============================================================

-- NEW ENUM: kyc_status
CREATE TYPE kyc_status AS ENUM (
    'not_submitted',  -- No ha enviado documentos (default)
    'pending',        -- Enviado, esperando revisión admin
    'approved',       -- Aprobado por admin
    'rejected'        -- Rechazado por admin (puede re-enviar)
);

-- ALTER TABLE: users - Add KYC fields
ALTER TABLE users 
ADD COLUMN kyc_status kyc_status NOT NULL DEFAULT 'not_submitted',
ADD COLUMN kyc_rejection_reason TEXT,
ADD COLUMN kyc_submitted_at TIMESTAMPTZ,
ADD COLUMN kyc_reviewed_at TIMESTAMPTZ,
ADD COLUMN kyc_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for filtering by KYC status
CREATE INDEX idx_users_kyc_status ON users(kyc_status) 
    WHERE role IN ('taxi', 'mandadito');

-- Index for admin dashboard (pending KYC)
CREATE INDEX idx_users_kyc_pending ON users(kyc_submitted_at) 
    WHERE kyc_status = 'pending';

-- UPDATE CONSTRAINT: Driver can only be available if KYC approved

-- Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_driver_availability;

-- New constraint: drivers must have KYC approved to be available
ALTER TABLE users ADD CONSTRAINT users_driver_kyc_required CHECK (
    -- Non-drivers: no restrictions on availability check here
    (role NOT IN ('taxi', 'mandadito')) OR
    -- Drivers: if available, must be KYC approved
    (is_available = FALSE) OR
    (is_available = TRUE AND kyc_status = 'approved')
);

-- NEW TABLE: kyc_submissions
CREATE TABLE kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Google Drive folder info
    drive_folder_id TEXT NOT NULL,
    drive_folder_url TEXT NOT NULL,
    
    -- INE Frente
    ine_front_file_id TEXT NOT NULL,
    ine_front_url TEXT NOT NULL,
    
    -- INE Atrás
    ine_back_file_id TEXT NOT NULL,
    ine_back_url TEXT NOT NULL,
    
    -- Selfie
    selfie_file_id TEXT NOT NULL,
    selfie_url TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Each user can only have one KYC submission at a time
    CONSTRAINT kyc_one_per_user UNIQUE (user_id)
);

-- Index for user lookup
CREATE INDEX idx_kyc_user ON kyc_submissions(user_id);

-- FUNCTION: Admin approve KYC
CREATE OR REPLACE FUNCTION approve_kyc(
    p_user_id UUID,
    p_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_role role_type;
    v_current_status kyc_status;
BEGIN
    -- Verify admin
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin'
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_ADMIN');
    END IF;

    -- Get user info
    SELECT role, kyc_status INTO v_user_role, v_current_status
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_NOT_FOUND');
    END IF;
    
    IF v_user_role NOT IN ('taxi', 'mandadito') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_ROLE');
    END IF;
    
    IF v_current_status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'current_status', v_current_status
        );
    END IF;

    -- Approve
    UPDATE users SET
        kyc_status = 'approved',
        kyc_reviewed_at = NOW(),
        kyc_reviewed_by = p_admin_id,
        kyc_rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', TRUE, 'new_status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: Admin reject KYC
CREATE OR REPLACE FUNCTION reject_kyc(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_role role_type;
    v_current_status kyc_status;
BEGIN
    -- Verify admin
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin'
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_ADMIN');
    END IF;

    -- Get user info
    SELECT role, kyc_status INTO v_user_role, v_current_status
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_NOT_FOUND');
    END IF;
    
    IF v_user_role NOT IN ('taxi', 'mandadito') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_ROLE');
    END IF;
    
    IF v_current_status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'current_status', v_current_status
        );
    END IF;

    -- Reject
    UPDATE users SET
        kyc_status = 'rejected',
        kyc_reviewed_at = NOW(),
        kyc_reviewed_by = p_admin_id,
        kyc_rejection_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Delete the KYC submission so user can re-submit
    DELETE FROM kyc_submissions WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', TRUE, 
        'new_status', 'rejected',
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: Reset KYC for re-submission (after rejection)
CREATE OR REPLACE FUNCTION reset_kyc_for_resubmit(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_current_status kyc_status;
BEGIN
    -- Get current status
    SELECT kyc_status INTO v_current_status
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'USER_NOT_FOUND');
    END IF;
    
    -- Only allow reset if rejected
    IF v_current_status != 'rejected' THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'INVALID_STATUS',
            'message', 'Can only reset KYC if status is rejected'
        );
    END IF;

    -- Reset to not_submitted
    UPDATE users SET
        kyc_status = 'not_submitted',
        kyc_rejection_reason = NULL,
        kyc_submitted_at = NULL,
        kyc_reviewed_at = NULL,
        kyc_reviewed_by = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', TRUE, 'new_status', 'not_submitted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 004_kyc_rls.sql
-- ============================================================

-- ENABLE RLS ON KYC TABLE
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

-- KYC_SUBMISSIONS POLICIES

-- Drivers can view their own KYC submission
CREATE POLICY "kyc_select_own" ON kyc_submissions
    FOR SELECT
    USING (user_id = auth.uid());

-- Drivers can insert their own KYC submission (only if not_submitted)
CREATE POLICY "kyc_insert_own" ON kyc_submissions
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('taxi', 'mandadito')
            AND kyc_status = 'not_submitted'
        )
    );

-- Admin can view all KYC submissions
CREATE POLICY "kyc_admin_select" ON kyc_submissions
    FOR SELECT
    USING (is_admin());

-- Admin can delete KYC submissions (for re-submit flow)
CREATE POLICY "kyc_admin_delete" ON kyc_submissions
    FOR DELETE
    USING (is_admin());

-- GRANT EXECUTE ON KYC FUNCTIONS
GRANT EXECUTE ON FUNCTION approve_kyc(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_kyc(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_kyc_for_resubmit(UUID) TO authenticated;

-- ============================================================
-- 005_request_expiration.sql
-- ============================================================

-- Add expiration to service requests
ALTER TABLE service_requests 
ADD COLUMN request_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes');

-- Index for efficient radar filtering (hide expired)
CREATE INDEX idx_requests_expiration ON service_requests(request_expires_at);

-- ============================================================
-- END OF MASTER SCHEMA
-- ============================================================
