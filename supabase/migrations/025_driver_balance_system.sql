-- Add balance to users table (default 0.00)
-- Positive means the driver has credit/money in favor.
-- Negative means the driver OWES money to the platform (commissions).
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00;

-- Create wallet transactions table for history
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL, -- Negative for fees, Positive for payments
    transaction_type VARCHAR(50) NOT NULL, -- 'service_fee', 'payment', 'adjustment'
    description TEXT,
    reference_id UUID, -- Can link to service_request_id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) -- Admin who made the transaction (if manual)
);

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own transactions" ON wallet_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON wallet_transactions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Trigger Function: Deduct commission when service is completed
CREATE OR REPLACE FUNCTION handle_service_commission()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when status changes to 'completed' AND commission > 0
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.commission_amount > 0 THEN
        -- Deduct from driver's balance (Assumes assigned_driver_id is present)
        UPDATE users
        SET balance = balance - NEW.commission_amount
        WHERE id = NEW.assigned_driver_id;

        -- Record transaction
        INSERT INTO wallet_transactions (user_id, amount, transaction_type, description, reference_id)
        VALUES (
            NEW.assigned_driver_id, 
            -NEW.commission_amount, 
            'service_fee', 
            'Comisión por servicio ' || SUBSTRING(NEW.id::text, 1, 8), 
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_service_complete_commission ON service_requests;
CREATE TRIGGER on_service_complete_commission
    AFTER UPDATE ON service_requests
    FOR EACH ROW
    EXECUTE FUNCTION handle_service_commission();

-- RPC: Add Balance (Recarga/Pago de deuda)
CREATE OR REPLACE FUNCTION add_driver_balance(
    p_driver_id UUID,
    p_amount NUMERIC,
    p_description TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_new_balance NUMERIC;
BEGIN
    -- Get current user ID (must be admin)
    v_admin_id := auth.uid();
    
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied. Admins only.';
    END IF;

    -- Update Balance
    UPDATE users
    SET balance = balance + p_amount
    WHERE id = p_driver_id
    RETURNING balance INTO v_new_balance;

    -- Record Transaction
    INSERT INTO wallet_transactions (user_id, amount, transaction_type, description, created_by)
    VALUES (p_driver_id, p_amount, 'payment', p_description, v_admin_id);

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
