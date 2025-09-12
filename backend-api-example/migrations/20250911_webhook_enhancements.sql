-- Migration: Enhanced Webhook Integration Schema
-- Description: Adds comprehensive webhook tracking, monitoring, and rate limiting tables

-- ===========================
-- Webhook Events Tracking
-- ===========================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT UNIQUE NOT NULL, -- Clerk's event ID
  event_type TEXT NOT NULL, -- user.created, user.updated, user.deleted
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'retry')),
  payload JSONB NOT NULL, -- Full webhook payload from Clerk
  user_clerk_id TEXT, -- Extracted from payload for easier querying
  processed_at TIMESTAMP WITH TIME ZONE,
  error_details JSONB, -- Error information for failed events
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================
-- Webhook Delivery Tracking
-- ===========================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  delivery_attempt INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout', 'error')),
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================
-- Rate Limiting
-- ===========================

CREATE TABLE IF NOT EXISTS webhook_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL, -- IP address or other identifier
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user_agent', 'clerk_org')),
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  window_duration_minutes INTEGER DEFAULT 60,
  max_requests INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(identifier, identifier_type, window_start)
);

-- ===========================
-- Webhook Configuration
-- ===========================

CREATE TABLE IF NOT EXISTS webhook_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default webhook configuration
INSERT INTO webhook_config (key, value, description) VALUES
('retry_delays', '[1000, 5000, 25000, 125000]', 'Retry delays in milliseconds (exponential backoff)'),
('max_retries', '3', 'Maximum number of retry attempts'),
('rate_limit_window', '60', 'Rate limit window in minutes'),
('rate_limit_max_requests', '100', 'Maximum requests per window'),
('webhook_timeout', '30000', 'Webhook processing timeout in milliseconds'),
('security_settings', '{"require_https": true, "validate_timestamp": true, "timestamp_tolerance": 300}', 'Security configuration')
ON CONFLICT (key) DO NOTHING;

-- ===========================
-- Indexes for Performance
-- ===========================

-- Webhook events indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_clerk_id ON webhook_events(user_clerk_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry_at ON webhook_events(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON webhook_events(status, next_retry_at) WHERE status IN ('pending', 'retry');

-- Webhook deliveries indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id ON webhook_deliveries(webhook_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_identifier ON webhook_rate_limits(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_window ON webhook_rate_limits(window_start, window_duration_minutes);

-- ===========================
-- Triggers for Updated At
-- ===========================

CREATE TRIGGER update_webhook_events_updated_at 
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_rate_limits_updated_at 
  BEFORE UPDATE ON webhook_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_config_updated_at 
  BEFORE UPDATE ON webhook_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================
-- Webhook Processing Functions
-- ===========================

-- Function to record webhook event
CREATE OR REPLACE FUNCTION record_webhook_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_user_clerk_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_webhook_event_id UUID;
BEGIN
  INSERT INTO webhook_events (event_id, event_type, payload, user_clerk_id)
  VALUES (p_event_id, p_event_type, p_payload, p_user_clerk_id)
  ON CONFLICT (event_id) DO UPDATE SET
    updated_at = NOW()
  RETURNING id INTO v_webhook_event_id;
  
  RETURN v_webhook_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record delivery attempt
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_webhook_event_id UUID,
  p_delivery_attempt INTEGER,
  p_status TEXT,
  p_response_code INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_delivery_id UUID;
BEGIN
  INSERT INTO webhook_deliveries (
    webhook_event_id, delivery_attempt, status, response_code, 
    response_body, error_message, execution_time_ms, completed_at
  )
  VALUES (
    p_webhook_event_id, p_delivery_attempt, p_status, p_response_code,
    p_response_body, p_error_message, p_execution_time_ms, NOW()
  )
  RETURNING id INTO v_delivery_id;
  
  RETURN v_delivery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update webhook event status
CREATE OR REPLACE FUNCTION update_webhook_event_status(
  p_webhook_event_id UUID,
  p_status TEXT,
  p_error_details JSONB DEFAULT NULL,
  p_next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE webhook_events SET
    status = p_status,
    error_details = COALESCE(p_error_details, error_details),
    next_retry_at = p_next_retry_at,
    retry_count = CASE 
      WHEN p_status = 'retry' THEN retry_count + 1 
      ELSE retry_count 
    END,
    processed_at = CASE 
      WHEN p_status IN ('success', 'failed') THEN NOW() 
      ELSE processed_at 
    END,
    updated_at = NOW()
  WHERE id = p_webhook_event_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_webhook_rate_limit(
  p_identifier TEXT,
  p_identifier_type TEXT DEFAULT 'ip',
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSONB AS $$
DECLARE
  v_current_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
  v_result JSONB;
BEGIN
  -- Calculate current window start
  v_current_window_start := date_trunc('hour', NOW()) + 
    (EXTRACT(minute FROM NOW())::INTEGER / p_window_minutes) * 
    (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Get or create rate limit record
  INSERT INTO webhook_rate_limits (
    identifier, identifier_type, request_count, window_start, 
    window_duration_minutes, max_requests
  )
  VALUES (
    p_identifier, p_identifier_type, 1, v_current_window_start,
    p_window_minutes, p_max_requests
  )
  ON CONFLICT (identifier, identifier_type, window_start) 
  DO UPDATE SET 
    request_count = webhook_rate_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_current_count;
  
  -- Build result
  v_result := jsonb_build_object(
    'allowed', v_current_count <= p_max_requests,
    'current_count', v_current_count,
    'max_requests', p_max_requests,
    'window_start', v_current_window_start,
    'window_end', v_current_window_start + (p_window_minutes || ' minutes')::INTERVAL,
    'remaining', GREATEST(0, p_max_requests - v_current_count)
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get webhook statistics
CREATE OR REPLACE FUNCTION get_webhook_stats(
  p_hours_back INTEGER DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
  v_since TIMESTAMP WITH TIME ZONE;
BEGIN
  v_since := NOW() - (p_hours_back || ' hours')::INTERVAL;
  
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'successful_events', COUNT(*) FILTER (WHERE status = 'success'),
    'failed_events', COUNT(*) FILTER (WHERE status = 'failed'),
    'pending_events', COUNT(*) FILTER (WHERE status IN ('pending', 'retry')),
    'average_execution_time_ms', COALESCE(AVG(
      (SELECT execution_time_ms FROM webhook_deliveries wd 
       WHERE wd.webhook_event_id = we.id AND wd.status = 'success' 
       ORDER BY wd.created_at DESC LIMIT 1)
    ), 0),
    'events_by_type', (
      SELECT jsonb_object_agg(event_type, count)
      FROM (
        SELECT event_type, COUNT(*) as count
        FROM webhook_events
        WHERE created_at >= v_since
        GROUP BY event_type
      ) type_counts
    ),
    'success_rate', CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END
  ) INTO v_stats
  FROM webhook_events we
  WHERE created_at >= v_since;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================
-- Row Level Security
-- ===========================

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;

-- Service role can access all webhook data
CREATE POLICY "Service role full access" ON webhook_events
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role full access" ON webhook_deliveries
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role full access" ON webhook_rate_limits
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role full access" ON webhook_config
  FOR ALL USING (current_setting('role') = 'service_role');

-- ===========================
-- Cleanup Functions
-- ===========================

-- Function to clean up old webhook events
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(
  p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
  AND status IN ('success', 'failed');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits(
  p_hours_to_keep INTEGER DEFAULT 48
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_rate_limits 
  WHERE window_start < NOW() - (p_hours_to_keep || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add missing avatar_url column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- Add webhook tracking columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'webhook_created_at'
  ) THEN
    ALTER TABLE users ADD COLUMN webhook_created_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_webhook_update'
  ) THEN
    ALTER TABLE users ADD COLUMN last_webhook_update TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;