-- Organization credit allocation functions
-- This migration adds functions to allocate and deallocate credits when organization seats are assigned/revoked

-- Function to allocate credits to a user when assigned an organization seat
CREATE OR REPLACE FUNCTION allocate_organization_seat_credits(
  p_clerk_org_id TEXT,
  p_clerk_user_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription RECORD;
  v_credits_per_seat INTEGER;
  v_description TEXT;
BEGIN
  -- Get organization subscription details
  SELECT os.plan_type, os.billing_frequency
  INTO v_subscription
  FROM organization_subscriptions os
  WHERE os.clerk_org_id = p_clerk_org_id AND os.status = 'active'
  ORDER BY os.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE; -- No active subscription
  END IF;

  -- Calculate credits per seat based on plan and billing frequency
  -- Teams plan: monthly = 500 credits, yearly = 6000 credits
  IF v_subscription.plan_type = 'teams' THEN
    v_credits_per_seat := CASE
      WHEN v_subscription.billing_frequency = 'yearly' THEN 6000
      ELSE 500
    END;
  ELSE
    -- Default to pro plan credits for other plans
    v_credits_per_seat := CASE
      WHEN v_subscription.billing_frequency = 'yearly' THEN 6000
      ELSE 500
    END;
  END IF;

  -- Create description for the credit transaction
  v_description := format('Organization seat allocation (%s %s plan)',
    v_subscription.plan_type, v_subscription.billing_frequency);

  -- Grant credits to the user
  PERFORM grant_credits(p_clerk_user_id, v_credits_per_seat, v_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deallocate credits from a user when organization seat is revoked
CREATE OR REPLACE FUNCTION deallocate_organization_seat_credits(
  p_clerk_org_id TEXT,
  p_clerk_user_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription RECORD;
  v_credits_per_seat INTEGER;
  v_description TEXT;
BEGIN
  -- Get organization subscription details
  SELECT os.plan_type, os.billing_frequency
  INTO v_subscription
  FROM organization_subscriptions os
  WHERE os.clerk_org_id = p_clerk_org_id AND os.status = 'active'
  ORDER BY os.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE; -- No active subscription
  END IF;

  -- Calculate credits per seat based on plan and billing frequency
  -- Teams plan: monthly = 500 credits, yearly = 6000 credits
  IF v_subscription.plan_type = 'teams' THEN
    v_credits_per_seat := CASE
      WHEN v_subscription.billing_frequency = 'yearly' THEN 6000
      ELSE 500
    END;
  ELSE
    -- Default to pro plan credits for other plans
    v_credits_per_seat := CASE
      WHEN v_subscription.billing_frequency = 'yearly' THEN 6000
      ELSE 500
    END;
  END IF;

  -- Create description for the credit transaction
  v_description := format('Organization seat revocation (%s %s plan)',
    v_subscription.plan_type, v_subscription.billing_frequency);

  -- Deduct credits from the user (only if they have sufficient credits)
  PERFORM deduct_credits(p_clerk_user_id, v_credits_per_seat, v_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced assign_organization_seat function with credit allocation
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

  -- Allocate credits to the user
  PERFORM allocate_organization_seat_credits(p_clerk_org_id, p_clerk_user_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced remove_organization_seat function with credit deallocation
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

    -- Deallocate credits from the user
    PERFORM deallocate_organization_seat_credits(p_clerk_org_id, p_clerk_user_id);

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;