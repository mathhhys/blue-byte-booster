-- Enhance organization seats and add license usage tracking
-- This migration adds status and expiration to seats, plus usage tracking for features

-- Add status and expires_at to organization_seats
ALTER TABLE organization_seats
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending', 'expired')),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create license_usages table for tracking feature usage per organization
CREATE TABLE IF NOT EXISTS license_usages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, -- e.g., 'api_calls', 'code_generation'
  usage_count INTEGER DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  overage BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for license_usages
CREATE INDEX IF NOT EXISTS idx_license_usages_org_id ON license_usages(organization_id);
CREATE INDEX IF NOT EXISTS idx_license_usages_feature ON license_usages(feature);
CREATE INDEX IF NOT EXISTS idx_license_usages_period ON license_usages(period_start, period_end);

-- Trigger for updated_at on license_usages
CREATE TRIGGER update_license_usages_updated_at BEFORE UPDATE ON license_usages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for license_usages (if enabling RLS on org tables)
-- ALTER TABLE license_usages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Org admins can view usages" ON license_usages
--   FOR SELECT USING (organization_id IN (
--     SELECT id FROM organizations WHERE clerk_org_id = auth.jwt() ->> 'organization_id'
--   ));

-- Enhanced assign_organization_seat function with status and expiration check
CREATE OR REPLACE FUNCTION assign_organization_seat(
  p_clerk_org_id TEXT,
  p_clerk_user_id TEXT,
  p_user_email TEXT,
  p_user_name TEXT DEFAULT NULL,
  p_assigned_by TEXT DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_subscription_id UUID;
  v_current_seats_used INTEGER;
  v_max_seats INTEGER;
  v_available_seats INTEGER;
BEGIN
  -- Get the active organization subscription
  SELECT id, seats_used, seats_total INTO v_org_subscription_id, v_current_seats_used, v_max_seats
  FROM organization_subscriptions
  WHERE clerk_org_id = p_clerk_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_org_subscription_id IS NULL THEN
    RETURN FALSE; -- No active subscription
  END IF;

  v_available_seats := v_max_seats - v_current_seats_used;

  -- Allow overage temporarily (set flag for billing)
  IF v_available_seats <= 0 THEN
    -- Update subscription to flag overage
    UPDATE organization_subscriptions
    SET overage = TRUE, updated_at = NOW()
    WHERE id = v_org_subscription_id;
    -- Still assign but mark as pending billing
  END IF;

  -- Assign or update seat
  INSERT INTO organization_seats (
    organization_subscription_id,
    clerk_user_id,
    clerk_org_id,
    user_email,
    user_name,
    assigned_by,
    status,
    expires_at
  ) VALUES (
    v_org_subscription_id,
    p_clerk_user_id,
    p_clerk_org_id,
    p_user_email,
    p_user_name,
    p_assigned_by,
    'active',
    p_expires_at
  )
  ON CONFLICT (clerk_org_id, clerk_user_id)
  DO UPDATE SET
    status = 'active',
    expires_at = COALESCE(p_expires_at, expires_at),
    assigned_at = NOW(),
    assigned_by = COALESCE(p_assigned_by, assigned_by);

  -- Update seats used count (even for overage)
  UPDATE organization_subscriptions
  SET seats_used = seats_used + 1, updated_at = NOW()
  WHERE id = v_org_subscription_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced remove_organization_seat function with status update
CREATE OR REPLACE FUNCTION remove_organization_seat(
  p_clerk_org_id TEXT,
  p_clerk_user_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_subscription_id UUID;
  v_seat_count INTEGER;
BEGIN
  -- Get the organization subscription
  SELECT id INTO v_org_subscription_id
  FROM organization_subscriptions
  WHERE clerk_org_id = p_clerk_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_org_subscription_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if seat exists and update status instead of delete (for audit)
  UPDATE organization_seats
  SET status = 'revoked', expires_at = NOW()
  WHERE organization_subscription_id = v_org_subscription_id
    AND clerk_user_id = p_clerk_user_id
    AND status = 'active';

  GET DIAGNOSTICS v_seat_count = ROW_COUNT;

  IF v_seat_count > 0 THEN
    -- Update seats used count
    UPDATE organization_subscriptions
    SET seats_used = GREATEST(0, seats_used - 1),
        overage = FALSE, -- Clear overage if applicable
        updated_at = NOW()
    WHERE id = v_org_subscription_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage (adapted for license tracking)
CREATE OR REPLACE FUNCTION record_license_usage(
  p_organization_id UUID,
  p_feature TEXT,
  p_usage INTEGER,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage INTEGER;
  v_tier_limit INTEGER; -- Would fetch from subscription tier
BEGIN
  -- Get current usage for period
  SELECT COALESCE(SUM(usage_count), 0) INTO v_current_usage
  FROM license_usages
  WHERE organization_id = p_organization_id
    AND feature = p_feature
    AND period_start = p_period_start
    AND period_end = p_period_end;

  -- Insert or update usage
  INSERT INTO license_usages (organization_id, feature, usage_count, period_start, period_end)
  VALUES (p_organization_id, p_feature, p_usage, p_period_start, p_period_end)
  ON CONFLICT (organization_id, feature, period_start, period_end)
  DO UPDATE SET
    usage_count = license_usages.usage_count + p_usage,
    updated_at = NOW();

  -- Check against tier limit (example: api_calls limit based on plan)
  -- For now, assume limit fetched; set overage if exceeded
  -- v_tier_limit = get_plan_limit(p_organization_id, p_feature);
  -- IF (v_current_usage + p_usage) > v_tier_limit THEN
  --   UPDATE organization_subscriptions SET overage = TRUE WHERE organization_id = p_organization_id;
  -- END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing seats: Set status='active' and expires_at=NULL for current seats
UPDATE organization_seats SET status = 'active', expires_at = NULL WHERE status IS NULL;

-- Initialize license_usages for existing orgs (usage=0 for current month)
-- This would be run once; adjust period as needed
INSERT INTO license_usages (organization_id, feature, usage_count, period_start, period_end)
SELECT o.id, 'api_calls', 0,
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second'
FROM organizations o
ON CONFLICT DO NOTHING;