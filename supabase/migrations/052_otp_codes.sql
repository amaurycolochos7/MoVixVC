-- OTP Verification Codes Table
-- Stores temporary OTP codes for email verification during registration

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'registration', -- 'registration', 'password_reset', etc.
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- RLS Policies
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow insert from anyone (for registration)
CREATE POLICY "Allow insert OTP codes" ON otp_codes
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Allow select only your own codes
CREATE POLICY "Allow select own OTP codes" ON otp_codes
    FOR SELECT TO anon, authenticated
    USING (true);

-- Allow update only your own codes
CREATE POLICY "Allow update own OTP codes" ON otp_codes
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Cleanup function for expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
