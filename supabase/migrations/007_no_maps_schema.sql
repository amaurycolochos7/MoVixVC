-- ============================================================
-- MoVix No-Maps MVP Schema
-- Version: 007_no_maps_schema
-- Description: Client Addresses, text-based location fields
-- ============================================================

-- 1. Client Addresses Table
CREATE TABLE client_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- "Casa", "Trabajo", "Donde mi tía"
    full_address TEXT NOT NULL,
    neighborhood TEXT,
    address_references TEXT, -- Renamed from references (reserved keyword)
    contact_phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookup
CREATE INDEX idx_addresses_user ON client_addresses(user_id);

-- 2. Update Service Requests with text snapshots
ALTER TABLE service_requests
    ADD COLUMN origin_neighborhood TEXT,
    ADD COLUMN origin_references TEXT,
    ADD COLUMN destination_neighborhood TEXT,
    ADD COLUMN destination_references TEXT,
    ADD COLUMN contact_phone TEXT,
    ADD COLUMN municipio TEXT DEFAULT 'Venustiano Carranza'; -- Filtro local forzado Fase 5

-- 3. Update Request Stops
ALTER TABLE request_stops
    ADD COLUMN neighborhood TEXT,
    ADD COLUMN stop_references TEXT; -- Renamed from references

-- 4. RLS for Client Addresses
ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses_select_own" ON client_addresses
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "addresses_insert_own" ON client_addresses
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "addresses_update_own" ON client_addresses
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "addresses_delete_own" ON client_addresses
    FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "addresses_admin_all" ON client_addresses
    FOR ALL USING (is_admin());
