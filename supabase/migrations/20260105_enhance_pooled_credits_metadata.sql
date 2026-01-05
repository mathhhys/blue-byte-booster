-- Migration: Enhance Pooled Credit Deduction Metadata
-- Purpose: Record full organization attribution (org UUID, subscription UUID, seat ID/role, stripe customer)
--          in credit_transactions.metadata for analytics and auditing

CREATE OR REPLACE FUNCTION deduct_credits_pooled(
  p_clerk_user_id TEXT,
  p_amount NUMERIC,
  p_clerk_org_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Credits used',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_org_sub_id UUID;
  v_current_credits NUMERIC;
  v_total_credits NUMERIC;
  v_used_credits NUMERIC;
  v_metadata JSONB;
  v_org RECORD;
  v_org_sub RECORD;
  v_seat RECORD;
BEGIN
  -- 1. Get internal user ID
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 2. Handle Organization Context
  IF p_clerk_org_id IS NOT NULL THEN
    -- Verify user has an active seat and fetch seat details
    SELECT id, role, organization_subscription_id 
    INTO v_seat
    FROM organization_seats
    WHERE clerk_org_id = p_clerk_org_id
      AND clerk_user_id = p_clerk_user_id
      AND status = 'active'
    LIMIT 1;

    IF v_seat.id IS NULL THEN
      RAISE EXCEPTION 'User does not have an active seat in this organization';
    END IF;

    v_org_sub_id := v_seat.organization_subscription_id;

    -- Fetch organization metadata
    SELECT o.id, o.name, o.stripe_customer_id
    INTO v_org
    FROM organizations o
    WHERE o.clerk_org_id = p_clerk_org_id
    LIMIT 1;

    -- Check organization pooled balance and fetch subscription metadata
    SELECT id, organization_id, total_credits, used_credits 
    INTO v_org_sub
    FROM organization_subscriptions
    WHERE id = v_org_sub_id
      AND status IN ('active', 'trialing')
    FOR UPDATE; -- Lock row for atomic update

    IF v_org_sub.id IS NULL THEN
      RAISE EXCEPTION 'Active organization subscription not found';
    END IF;

    v_total_credits := v_org_sub.total_credits;
    v_used_credits := v_org_sub.used_credits;

    IF (v_total_credits - v_used_credits) < p_amount THEN
      RETURN FALSE; -- Insufficient pooled credits, NO FALLBACK
    END IF;

    -- Deduct from organization pool
    UPDATE organization_subscriptions
    SET used_credits = used_credits + p_amount,
        updated_at = NOW()
    WHERE id = v_org_sub_id;

    -- Build enhanced metadata for analytics
    v_metadata := jsonb_build_object(
      'pool', 'organization',
      'clerk_org_id', p_clerk_org_id,
      'organization_id', COALESCE(v_org.id, v_org_sub.organization_id),
      'organization_name', v_org.name,
      'stripe_customer_id', v_org.stripe_customer_id,
      'organization_subscription_id', v_org_sub.id,
      'seat_id', v_seat.id,
      'seat_role', v_seat.role
    );

    -- Record transaction (linked to user but marked as org usage)
    INSERT INTO credit_transactions (
      user_id, 
      credits_amount, 
      operation_type, 
      description, 
      reference_id,
      metadata
    )
    VALUES (
      v_user_id, 
      -p_amount, 
      'deduction', 
      p_description, 
      p_reference_id,
      v_metadata
    );

    RETURN TRUE;

  ELSE
    -- 3. Fallback to Personal Credits
    SELECT credits INTO v_current_credits
    FROM users
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_current_credits < p_amount THEN
      RETURN FALSE; -- Insufficient personal credits
    END IF;

    -- Deduct from personal credits
    UPDATE users
    SET credits = credits - p_amount,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Record transaction
    INSERT INTO credit_transactions (
      user_id, 
      credits_amount, 
      operation_type, 
      description, 
      reference_id,
      metadata
    )
    VALUES (
      v_user_id, 
      -p_amount, 
      'deduction', 
      p_description, 
      p_reference_id,
      jsonb_build_object('pool', 'personal')
    );

    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to service role
ALTER FUNCTION deduct_credits_pooled(TEXT, NUMERIC, TEXT, TEXT, TEXT) SET search_path = public;

COMMENT ON FUNCTION deduct_credits_pooled IS 'Deduct credits from organization pool (if org context provided) or personal pool. Enhanced metadata includes org UUID, subscription UUID, seat ID/role, and Stripe customer ID for analytics.';