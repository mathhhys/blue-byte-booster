-- Create oauth_codes table with proper structure for OAuth 2.0 PKCE flow
CREATE TABLE IF NOT EXISTS oauth_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,  -- The authorization code
    clerk_user_id TEXT,  -- Can be NULL initially, set after user authentication
    code_verifier TEXT,  -- For server-generated PKCE (optional)
    code_challenge TEXT NOT NULL,  -- Required for PKCE
    state TEXT NOT NULL,  -- OAuth state parameter
    redirect_uri TEXT NOT NULL,  -- Redirect URI for the OAuth flow
    expires_at TIMESTAMPTZ NOT NULL,  -- Expiration time for the code
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Add indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_oauth_codes_code ON oauth_codes(code);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_state ON oauth_codes(state);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_clerk_user_id ON refresh_tokens(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Clean up expired oauth codes (optional cleanup function)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Clean up expired refresh tokens (optional cleanup function)
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;