-- ============================================================
-- MoVix Database Migration - Driver Availability Sessions
-- Version: 061_driver_availability_sessions
-- Description: Track when drivers are connected (is_available = true)
-- ============================================================

-- Table to track availability sessions
CREATE TABLE IF NOT EXISTS driver_availability_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN ended_at IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
            ELSE NULL
        END
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by driver and date
CREATE INDEX IF NOT EXISTS idx_availability_sessions_driver 
ON driver_availability_sessions(driver_id, started_at DESC);

-- RLS policies
ALTER TABLE driver_availability_sessions ENABLE ROW LEVEL SECURITY;

-- Drivers can see their own sessions
CREATE POLICY "Drivers can view own sessions" ON driver_availability_sessions
    FOR SELECT USING (auth.uid() = driver_id);

-- Drivers can insert their own sessions
CREATE POLICY "Drivers can insert own sessions" ON driver_availability_sessions
    FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Drivers can update their own sessions (to set ended_at)
CREATE POLICY "Drivers can update own sessions" ON driver_availability_sessions
    FOR UPDATE USING (auth.uid() = driver_id);

-- Comment
COMMENT ON TABLE driver_availability_sessions IS 'Tracks when drivers are connected/available in the app';
