-- Migration to add auth_sessions table for PKCE OAuth2 flow
-- Run this in Supabase SQL editor or via supabase db push

CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  code_challenge TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance and expiry cleanup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_state ON auth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- Optional: Function to clean expired sessions (run periodically via cron or edge function)
CREATE OR REPLACE FUNCTION cleanup_expired_auth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Example call: SELECT cleanup_expired_auth_sessions();