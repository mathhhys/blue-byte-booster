m-- OAuth session storage for VSCode extension authentication
-- This migration creates tables for OAuth 2.0 with PKCE flow
-- Safe migration that handles existing tables

-- Create oauth_codes table if it doesn't exist (basic structure)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public'
                 AND table_name = 'oauth_codes') THEN
    CREATE TABLE oauth_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      state TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      authorization_code TEXT,
      clerk_user_id TEXT,
      session_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Add columns to oauth_codes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'state') THEN
    ALTER TABLE oauth_codes ADD COLUMN state TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'code_challenge') THEN
    ALTER TABLE oauth_codes ADD COLUMN code_challenge TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'redirect_uri') THEN
    ALTER TABLE oauth_codes ADD COLUMN redirect_uri TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'authorization_code') THEN
    ALTER TABLE oauth_codes ADD COLUMN authorization_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'clerk_user_id') THEN
    ALTER TABLE oauth_codes ADD COLUMN clerk_user_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'session_id') THEN
    ALTER TABLE oauth_codes ADD COLUMN session_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'oauth_codes' AND column_name = 'expires_at') THEN
    ALTER TABLE oauth_codes ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add constraints to oauth_codes if they don't exist
DO $$
BEGIN
  -- Unique constraint on state
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'oauth_codes_state_key') THEN
    ALTER TABLE oauth_codes ADD CONSTRAINT oauth_codes_state_key UNIQUE (state);
  END IF;
  
  -- Unique constraint on authorization_code
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'oauth_codes_authorization_code_key') THEN
    ALTER TABLE oauth_codes ADD CONSTRAINT oauth_codes_authorization_code_key UNIQUE (authorization_code);
  END IF;
END $$;

-- Create refresh_tokens table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public'
                 AND table_name = 'refresh_tokens') THEN
    CREATE TABLE refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      session_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    );
  END IF;
END $$;

-- Add columns to refresh_tokens if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'refresh_tokens' AND column_name = 'clerk_user_id') THEN
    ALTER TABLE refresh_tokens ADD COLUMN clerk_user_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'refresh_tokens' AND column_name = 'token') THEN
    ALTER TABLE refresh_tokens ADD COLUMN token TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'refresh_tokens' AND column_name = 'session_id') THEN
    ALTER TABLE refresh_tokens ADD COLUMN session_id TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'refresh_tokens' AND column_name = 'expires_at') THEN
    ALTER TABLE refresh_tokens ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'refresh_tokens' AND column_name = 'last_used_at') THEN
    ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add unique constraint to refresh_tokens.token if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'refresh_tokens_token_key') THEN
    ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_codes_state ON oauth_codes(state);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_clerk_user ON oauth_codes(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_auth_code ON oauth_codes(authorization_code);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(clerk_user_id);

-- Auto-cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_codes WHERE expires_at < NOW();
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add last_vscode_login and vscode_session_id to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'last_vscode_login') THEN
    ALTER TABLE users ADD COLUMN last_vscode_login TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'vscode_session_id') THEN
    ALTER TABLE users ADD COLUMN vscode_session_id TEXT;
  END IF;
END $$;

-- Add organization_id to users table if not exists (for Teams plan)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'organization_id') THEN
    ALTER TABLE users ADD COLUMN organization_id TEXT;
  END IF;
END $$;

-- Add username to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'username') THEN
    ALTER TABLE users ADD COLUMN username TEXT;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE oauth_codes IS 'Stores OAuth 2.0 authorization codes with PKCE challenge for VSCode extension authentication';
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for extending user sessions without re-authentication';
COMMENT ON COLUMN oauth_codes.code_challenge IS 'SHA256 hash of the code_verifier (base64url encoded)';
COMMENT ON COLUMN oauth_codes.state IS 'Random string for CSRF protection';
COMMENT ON COLUMN oauth_codes.authorization_code IS 'Generated authorization code to be exchanged for tokens';