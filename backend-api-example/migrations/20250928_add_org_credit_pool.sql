-- Add organization credit pool columns to organization_subscriptions
ALTER TABLE organization_subscriptions 
ADD COLUMN IF NOT EXISTS total_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_credits INTEGER DEFAULT 0;

-- Function to calculate base credits per seat based on plan and frequency
CREATE OR REPLACE FUNCTION get_base_credits_per_seat(
  p_plan_type TEXT,
  p_billing_frequency TEXT
)
RETURNS INTEGER AS $$
BEGIN
  IF p_plan_type = 'teams' THEN
    RETURN CASE
      WHEN p_billing_frequency = 'yearly' THEN 6000
      ELSE 500
    END;
  ELSE
    RETURN CASE
      WHEN p_billing_frequency = 'yearly' THEN 6000
      ELSE 500
    END; -- Default to pro/teams equivalent
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Updated function to set org credit pool on subscription creation/update
-- Call this when creating or updating subscription
CREATE OR REPLACE FUNCTION set_org_credit_pool(
  p_org_sub_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_seats_total INTEGER;
  v_plan_type TEXT;
  v_billing_frequency TEXT;
  v_base_credits INTEGER;
BEGIN
  SELECT seats_total, plan_type, billing_frequency 
  INTO v_seats_total, v_plan_type, v_billing_frequency
  FROM organization_subscriptions 
  WHERE id = p_org_sub_id;

  IF v_seats_total IS NULL THEN
    RETURN FALSE;
  END IF;

  v_base_credits := get_base_credits_per_seat(v_plan_type, v_billing_frequency);
  
  UPDATE organization_subscriptions 
  SET 
    total_credits = v_seats_total * v_base_credits,
    used_credits = 0, -- Reset used on pool recalculation
    updated_at = NOW()
  WHERE id = p_org_sub_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated assign_organization_seat_with_credits: no individual allocation, just assign seat
-- Pool is managed at subscription level
CREATE OR REPLACE FUNCTION assign_organization_seat_with_credits(
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
    UPDATE organization_subscriptions
    SET overage = TRUE, updated_at = NOW()
    WHERE id = v_org_subscription_id;
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

  -- Update seats used count
  UPDATE organization_subscriptions
  SET seats_used = seats_used + 1, updated_at = NOW()
  WHERE id = v_org_subscription_id;

  -- Recalculate pool if seats changed (in case of overage or update)
  PERFORM set_org_credit_pool(v_org_subscription_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated remove_organization_seat_with_credits: no individual deallocation
CREATE OR REPLACE FUNCTION remove_organization_seat_with_credits(
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

  -- Update seat status to revoked
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
        overage = FALSE,
        updated_at = NOW()
    WHERE id = v_org_subscription_id;

    -- Recalculate pool (reduce total_credits if seats decreased)
    PERFORM set_org_credit_pool(v_org_subscription_id);

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits from org pool (called on usage)
CREATE OR REPLACE FUNCTION deduct_org_credits(
  p_clerk_org_id TEXT,
  p_credits_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_sub_id UUID;
  v_total_credits INTEGER;
  v_used_credits INTEGER;
BEGIN
  SELECT id, total_credits, used_credits 
  INTO v_org_sub_id, v_total_credits, v_used_credits
  FROM organization_subscriptions
  WHERE clerk_org_id = p_clerk_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_org_sub_id IS NULL OR v_total_credits IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_used_credits + p_credits_amount > v_total_credits THEN
    RETURN FALSE; -- Insufficient credits
  END IF;

  UPDATE organization_subscriptions
  SET used_credits = used_credits + p_credits_amount,
      updated_at = NOW()
  WHERE id = v_org_sub_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits to org pool (top-up)
CREATE OR REPLACE FUNCTION add_org_credits(
  p_clerk_org_id TEXT,
  p_credits_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_sub_id UUID;
BEGIN
  SELECT id INTO v_org_sub_id
  FROM organization_subscriptions
  WHERE clerk_org_id = p_clerk_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_org_sub_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE organization_subscriptions
  SET total_credits = total_credits + p_credits_amount,
      updated_at = NOW()
  WHERE id = v_org_sub_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove old individual allocation functions (or comment out if needed)
-- DROP FUNCTION IF EXISTS allocate_organization_seat_credits(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS deallocate_organization_seat_credits(TEXT, TEXT);