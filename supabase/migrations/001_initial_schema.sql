-- ============================================================
-- MoVix Database Migration - Phase 2
-- Version: 001_initial_schema
-- Description: Creates all tables, enums, indexes, and functions
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

-- User roles
CREATE TYPE role_type AS ENUM ('cliente', 'taxi', 'mandadito', 'admin');

-- Service types
CREATE TYPE service_type AS ENUM ('taxi', 'mandadito');

-- Request status (State Machine)
CREATE TYPE request_status AS ENUM (
    'pending',      -- Waiting for offers
    'negotiating',  -- Has offers, in negotiation
    'assigned',     -- Driver assigned, on the way
    'in_progress',  -- Service in progress
    'completed',    -- Service completed
    'cancelled'     -- Cancelled
);

-- Offer status
CREATE TYPE offer_status AS ENUM (
    'pending',   -- Waiting for response
    'accepted',  -- Accepted by client
    'rejected',  -- Rejected by client
    'expired',   -- Expired without response
    'withdrawn'  -- Withdrawn by driver
);

-- Offer types
CREATE TYPE offer_type AS ENUM (
    'initial',  -- Initial offer from driver
    'counter'   -- Counter-offer
);

-- Stop status (for mandadito)
CREATE TYPE stop_status AS ENUM (
    'pending',     -- Pending
    'in_progress', -- In progress
    'completed',   -- Completed
    'skipped'      -- Skipped
);

-- Ledger entry types
CREATE TYPE ledger_entry_type AS ENUM (
    'commission',  -- Commission charged to driver
    'payment',     -- Payment from driver
    'adjustment',  -- Manual adjustment (admin)
    'bonus'        -- Bonus
);

-- ============================================================
-- TABLES
-- ============================================================

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

-- ============================================================
-- INDEXES
-- ============================================================

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

-- ============================================================
-- FUNCTIONS
-- ============================================================

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

-- ============================================================
-- ANTI-DOUBLE-ASSIGNMENT FUNCTION
-- Atomic driver assignment with optimistic locking
-- ============================================================

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

-- ============================================================
-- COMPLETE SERVICE FUNCTION
-- Handles service completion and commission recording
-- ============================================================

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

-- ============================================================
-- EXPIRE OFFERS FUNCTION
-- Automatically expire pending offers past their expiration
-- ============================================================

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

-- ============================================================
-- UPDATE REQUEST STATUS BASED ON OFFERS
-- Transitions from 'pending' to 'negotiating' when offers exist
-- ============================================================

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
