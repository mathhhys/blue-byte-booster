-- Migration: Enhance Token System with Audit Logs, Rate Limiting, and Metadata
-- Date: 2025-10-08
-- Purpose: Add comprehensive token management features

-- Enhance extension_tokens table with additional fields
ALTER TABLE extension_tokens 
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS device_info_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ip_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP WITH TIME ZONE;

-- Create token_audit_logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS token_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID REFERENCES extension_tokens(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'generated', 'used', 'refreshed', 'revoked', 'expired', 'warning_sent'
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_audit_logs_token_id ON token_audit_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_token_audit_logs_user_id ON token_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_audit_logs_action ON token_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_token_audit_logs_created_at ON token_audit_logs(created_at);

-- Create token_rate_limits table for rate limiting
CREATE TABLE IF NOT EXISTS token_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'generate', 'refresh'
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_token_rate_limits_user_action ON token_rate_limits(user_id, action, window_start);
CREATE INDEX IF NOT EXISTS idx_token_rate_limits_window ON token_rate_limits(window_start);

-- RLS policies for new tables
ALTER TABLE token_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token audit logs" ON token_audit_logs
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can view own rate limits" ON token_rate_limits
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Function to increment rate limit
CREATE OR REPLACE FUNCTION increment_token_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_window_start_hour TIMESTAMP WITH TIME ZONE,
  p_window_start_day TIMESTAMP WITH TIME ZONE
)
RETURNS void AS $$
BEGIN
  -- Upsert hourly record
  INSERT INTO token_rate_limits (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, p_window_start_hour, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET 
    request_count = token_rate_limits.request_count + 1,
    updated_at = NOW();

  -- Upsert daily record
  INSERT INTO token_rate_limits (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, p_window_start_day, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET 
    request_count = token_rate_limits.request_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint for rate limits
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_rate_limits_unique 
  ON token_rate_limits(user_id, action, window_start);

-- Function to get tokens requiring expiration warnings
CREATE OR REPLACE FUNCTION get_tokens_needing_warnings()
RETURNS TABLE (
  token_id UUID,
  user_id UUID,
  user_email TEXT,
  device_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    et.id as token_id,
    et.user_id,
    u.email as user_email,
    et.device_name,
    et.expires_at,
    FLOOR(EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400)::INTEGER as days_until_expiry
  FROM extension_tokens et
  JOIN users u ON et.user_id = u.id
  WHERE 
    et.revoked_at IS NULL
    AND et.expires_at > NOW()
    AND (
      -- 30 days warning (not sent yet)
      (EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400 <= 30 
       AND EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400 > 29
       AND et.warning_sent_at IS NULL)
      OR
      -- 7 days warning
      (EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400 <= 7 
       AND EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400 > 6)
      OR
      -- 1 day warning
      (EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400 <= 1 
       AND EXTRACT(EPOCH FROM (et.expires_at - NOW())) / 86400 > 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark warning as sent
CREATE OR REPLACE FUNCTION mark_warning_sent(p_token_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE extension_tokens
  SET warning_sent_at = NOW()
  WHERE id = p_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old rate limit records (older than 2 days)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM token_rate_limits 
  WHERE window_start < NOW() - INTERVAL '2 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old audit logs (older than 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM token_audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE token_audit_logs IS 'Audit trail for all token lifecycle events';
COMMENT ON TABLE token_rate_limits IS 'Rate limiting records for token operations';
COMMENT ON FUNCTION get_tokens_needing_warnings() IS 'Returns tokens that need expiration warnings at 30, 7, or 1 day thresholds';
COMMENT ON FUNCTION cleanup_old_rate_limits() IS 'Removes rate limit records older than 2 days';
COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Removes audit logs older than 1 year';