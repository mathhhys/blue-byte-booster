-- Manual migration to add missing columns to existing OAuth tables
-- Run this in Supabase SQL Editor

-- Add missing columns to oauth_codes table
DO $$ 
BEGIN
  -- Add authorization_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oauth_codes' AND column_name = 'authorization_code'
  ) THEN
    ALTER TABLE oauth_codes ADD COLUMN authorization_code TEXT;
    CREATE UNIQUE INDEX idx_oauth_codes_authorization_code_unique ON oauth_codes(authorization_code) WHERE authorization_code IS NOT NULL;
  END IF;

  -- Add session_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oauth_codes' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE oauth_codes ADD COLUMN session_id TEXT;
  END IF;
END $$;

-- Add missing columns to refresh_tokens table
DO $$ 
BEGIN
  -- Add session_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN session_id TEXT;
  END IF;

  -- Add last_used_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refresh_tokens' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add missing columns to users table
DO $$ 
BEGIN
  -- Add organization_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id TEXT;
  END IF;

  -- Add username column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ADD COLUMN username TEXT;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_codes_state ON oauth_codes(state);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_clerk_user ON oauth_codes(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_auth_code ON oauth_codes(authorization_code) WHERE authorization_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(clerk_user_id);

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_codes WHERE expires_at < NOW();
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN oauth_codes.authorization_code IS 'Generated authorization code to be exchanged for tokens';
COMMENT ON COLUMN oauth_codes.session_id IS 'Session identifier for tracking';
COMMENT ON COLUMN refresh_tokens.session_id IS 'Session identifier matching the access token';
COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Timestamp of when this refresh token was last used';