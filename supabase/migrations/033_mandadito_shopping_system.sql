-- ============================================================
-- MoVix Database Migration - Mandadito Shopping System
-- Version: 033_mandadito_shopping_system
-- Description: Shopping lists per stop, expense tracking, driver offers
-- ============================================================

-- ============================================================
-- 1. STOP ITEMS TABLE (Shopping List Items)
-- ============================================================

CREATE TABLE stop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stop_id UUID NOT NULL REFERENCES request_stops(id) ON DELETE CASCADE,
    
    -- Item details (client fills)
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    
    -- Expense tracking (driver fills)
    actual_cost DECIMAL(10,2),
    is_purchased BOOLEAN DEFAULT FALSE,
    purchase_notes TEXT,
    purchased_at TIMESTAMPTZ,
    
    -- Order
    item_order INTEGER NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying items by stop
CREATE INDEX idx_stop_items_stop ON stop_items(stop_id, item_order);

-- ============================================================
-- 2. ADD EXPENSE TRACKING TO request_stops
-- ============================================================

ALTER TABLE request_stops
ADD COLUMN IF NOT EXISTS stop_type TEXT DEFAULT 'errand', -- 'errand', 'pickup', 'delivery'
ADD COLUMN IF NOT EXISTS total_expense DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS expense_notes TEXT;

-- ============================================================
-- 3. ADD MANDADITO-SPECIFIC FIELDS TO service_requests
-- ============================================================

ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS mandadito_type TEXT, -- 'shopping', 'delivery'
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS delivery_references TEXT,
ADD COLUMN IF NOT EXISTS total_shopping_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- 4. RLS POLICIES FOR stop_items
-- ============================================================

ALTER TABLE stop_items ENABLE ROW LEVEL SECURITY;

-- Client can view items on their request stops
CREATE POLICY "items_client_select" ON stop_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id AND sr.client_id = auth.uid()
        )
    );

-- Client can insert items on pending stops
CREATE POLICY "items_client_insert" ON stop_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id 
            AND sr.client_id = auth.uid()
            AND sr.status IN ('pending', 'negotiating')
        )
    );

-- Client can update items on pending stops
CREATE POLICY "items_client_update" ON stop_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id 
            AND sr.client_id = auth.uid()
            AND sr.status IN ('pending', 'negotiating')
        )
    );

-- Client can delete items on pending stops
CREATE POLICY "items_client_delete" ON stop_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id 
            AND sr.client_id = auth.uid()
            AND sr.status = 'pending'
        )
    );

-- Driver can view items on assigned stops
CREATE POLICY "items_driver_select" ON stop_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id 
            AND sr.assigned_driver_id = auth.uid()
        )
    );

-- Driver can update items (mark purchased, add cost) on in_progress requests
CREATE POLICY "items_driver_update" ON stop_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM request_stops rs
            JOIN service_requests sr ON rs.request_id = sr.id
            WHERE rs.id = stop_id 
            AND sr.assigned_driver_id = auth.uid()
            AND sr.status = 'in_progress'
        )
    );

-- Admin full access
CREATE POLICY "items_admin_all" ON stop_items
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 5. TRIGGER: Auto-update stop total when items change
-- ============================================================

CREATE OR REPLACE FUNCTION update_stop_total_expense()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE request_stops
    SET total_expense = (
        SELECT COALESCE(SUM(actual_cost), 0)
        FROM stop_items
        WHERE stop_id = COALESCE(NEW.stop_id, OLD.stop_id)
        AND is_purchased = TRUE
    )
    WHERE id = COALESCE(NEW.stop_id, OLD.stop_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_item_expense_update
    AFTER INSERT OR UPDATE OR DELETE ON stop_items
    FOR EACH ROW
    EXECUTE FUNCTION update_stop_total_expense();

-- ============================================================
-- 6. TRIGGER: Auto-update request total when stop totals change
-- ============================================================

CREATE OR REPLACE FUNCTION update_request_shopping_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE service_requests
    SET total_shopping_cost = (
        SELECT COALESCE(SUM(total_expense), 0)
        FROM request_stops
        WHERE request_id = COALESCE(NEW.request_id, OLD.request_id)
    )
    WHERE id = COALESCE(NEW.request_id, OLD.request_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stop_expense_update
    AFTER UPDATE OF total_expense ON request_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_request_shopping_total();

-- ============================================================
-- 7. ENABLE REALTIME FOR NEW TABLE
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE stop_items;
