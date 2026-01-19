-- ================================================
-- DATOS BANCARIOS PARA MANDADEROS Y METODO DE PAGO
-- ================================================

-- 1. Agregar campos de datos bancarios a usuarios
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_clabe TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_card_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_holder_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- 2. Agregar campo de método de pago a service_requests
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS payment_method TEXT 
    CHECK (payment_method IN ('cash', 'transfer', NULL));

-- 3. Agregar campo para confirmar pago recibido
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2);
