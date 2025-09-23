-- Migration to normalize all expires_at columns to UTC ISO format
-- This ensures consistent timezone handling across all token expiry fields

-- Add comments to document UTC requirement
COMMENT ON COLUMN oauth_codes.expires_at IS 'Expiration timestamp in UTC ISO format (TIMESTAMPTZ)';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Expiration timestamp in UTC ISO format (TIMESTAMPTZ)';
COMMENT ON COLUMN vscode_sessions.expires_at IS 'Expiration timestamp in UTC ISO format (TIMESTAMPTZ)';

-- Create a function to validate and normalize expires_at timestamps
CREATE OR REPLACE FUNCTION normalize_expires_at_utc()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Log start of normalization
    RAISE NOTICE 'Starting expires_at normalization to UTC format...';
    
    -- Update oauth_codes expires_at to ensure UTC
    UPDATE oauth_codes 
    SET expires_at = expires_at AT TIME ZONE 'UTC'
    WHERE expires_at IS NOT NULL;
    
    -- Update refresh_tokens expires_at to ensure UTC
    UPDATE refresh_tokens 
    SET expires_at = expires_at AT TIME ZONE 'UTC'
    WHERE expires_at IS NOT NULL;
    
    -- Update vscode_sessions expires_at to ensure UTC
    UPDATE vscode_sessions 
    SET expires_at = expires_at AT TIME ZONE 'UTC'
    WHERE expires_at IS NOT NULL;
    
    -- Log completion
    RAISE NOTICE 'Completed expires_at normalization to UTC format';
END;
$$ LANGUAGE plpgsql;

-- Run the normalization function
SELECT normalize_expires_at_utc();

-- Create a trigger function to ensure future inserts/updates are in UTC
CREATE OR REPLACE FUNCTION ensure_expires_at_utc()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure expires_at is stored in UTC
    IF NEW.expires_at IS NOT NULL THEN
        NEW.expires_at := NEW.expires_at AT TIME ZONE 'UTC';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables with expires_at columns
DROP TRIGGER IF EXISTS ensure_oauth_codes_expires_at_utc ON oauth_codes;
CREATE TRIGGER ensure_oauth_codes_expires_at_utc
    BEFORE INSERT OR UPDATE ON oauth_codes
    FOR EACH ROW
    EXECUTE FUNCTION ensure_expires_at_utc();

DROP TRIGGER IF EXISTS ensure_refresh_tokens_expires_at_utc ON refresh_tokens;
CREATE TRIGGER ensure_refresh_tokens_expires_at_utc
    BEFORE INSERT OR UPDATE ON refresh_tokens
    FOR EACH ROW
    EXECUTE FUNCTION ensure_expires_at_utc();

DROP TRIGGER IF EXISTS ensure_vscode_sessions_expires_at_utc ON vscode_sessions;
CREATE TRIGGER ensure_vscode_sessions_expires_at_utc
    BEFORE INSERT OR UPDATE ON vscode_sessions
    FOR EACH ROW
    EXECUTE FUNCTION ensure_expires_at_utc();

-- Add indexes for better performance on expires_at queries
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at_utc ON oauth_codes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at_utc ON refresh_tokens(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vscode_sessions_expires_at_utc ON vscode_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Create a view to check current server time vs token expiry times
CREATE OR REPLACE VIEW token_expiry_status AS
SELECT 
    'oauth_codes' as table_name,
    id,
    expires_at,
    NOW() AT TIME ZONE 'UTC' as current_utc,
    CASE 
        WHEN expires_at > NOW() AT TIME ZONE 'UTC' THEN 'valid'
        ELSE 'expired'
    END as status,
    EXTRACT(EPOCH FROM (expires_at - NOW() AT TIME ZONE 'UTC')) as seconds_until_expiry
FROM oauth_codes
WHERE expires_at IS NOT NULL

UNION ALL

SELECT 
    'refresh_tokens' as table_name,
    id::text,
    expires_at,
    NOW() AT TIME ZONE 'UTC' as current_utc,
    CASE 
        WHEN expires_at > NOW() AT TIME ZONE 'UTC' THEN 'valid'
        ELSE 'expired'
    END as status,
    EXTRACT(EPOCH FROM (expires_at - NOW() AT TIME ZONE 'UTC')) as seconds_until_expiry
FROM refresh_tokens
WHERE expires_at IS NOT NULL AND revoked_at IS NULL

UNION ALL

SELECT 
    'vscode_sessions' as table_name,
    id::text,
    expires_at,
    NOW() AT TIME ZONE 'UTC' as current_utc,
    CASE 
        WHEN expires_at > NOW() AT TIME ZONE 'UTC' THEN 'valid'
        ELSE 'expired'
    END as status,
    EXTRACT(EPOCH FROM (expires_at - NOW() AT TIME ZONE 'UTC')) as seconds_until_expiry
FROM vscode_sessions
WHERE expires_at IS NOT NULL AND is_active = true;

-- Grant appropriate permissions
GRANT SELECT ON token_expiry_status TO authenticated;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250923_normalize_expires_at_utc completed successfully';
    RAISE NOTICE 'All expires_at columns are now normalized to UTC format';
    RAISE NOTICE 'Future inserts/updates will automatically ensure UTC format';
    RAISE NOTICE 'Use SELECT * FROM token_expiry_status; to monitor token expiry status';
END $$;