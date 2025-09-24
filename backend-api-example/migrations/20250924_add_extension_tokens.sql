-- Migration: Add extension tokens table for long-lived VSCode integration tokens
-- Date: 2025-09-24
-- Purpose: Replace short-lived Clerk tokens with 4-month custom JWTs

-- Extension tokens table for tracking long-lived API tokens
CREATE TABLE IF NOT EXISTS extension_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'VSCode Extension Token',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_extension_tokens_user_id ON extension_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_hash ON extension_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_expires ON extension_tokens(expires_at);

-- RLS policies
ALTER TABLE extension_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extension tokens" ON extension_tokens
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_extension_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM extension_tokens 
  WHERE expires_at < NOW() 
  AND revoked_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke user's existing tokens (for single-token policy)
CREATE OR REPLACE FUNCTION revoke_user_extension_tokens(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE extension_tokens 
  SET revoked_at = NOW()
  WHERE user_id = p_user_id 
  AND revoked_at IS NULL 
  AND expires_at > NOW();
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for migration tracking
COMMENT ON TABLE extension_tokens IS 'Stores long-lived JWT tokens for VSCode extension authentication';