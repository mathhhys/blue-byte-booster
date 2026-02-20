-- Migration: Track individual organization credit usage
-- Purpose: 
-- 1. Add used_credits to organization_members to track how many pooled credits each user has consumed.
-- 2. Update deduct_credits_pooled to deduct from organizations table (fixing bug) and increment organization_members.used_credits.

-- 1. Add used_credits to organization_members
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS used_credits INTEGER DEFAULT 0;

-- 2. Update deduct_credits_pooled function
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

    -- Fetch organization metadata and pooled credits
    SELECT o.id, o.name, o.stripe_customer_id, o.total_credits, o.used_credits
    INTO v_org
    FROM organizations o
    WHERE o.clerk_org_id = p_clerk_org_id
    FOR UPDATE; -- Lock row for atomic update

    IF v_org.id IS NULL THEN
      RAISE EXCEPTION 'Organization not found';
    END IF;

    -- Fetch subscription metadata
    SELECT id, organization_id
    INTO v_org_sub
    FROM organization_subscriptions
    WHERE id = v_org_sub_id
      AND status IN ('active', 'trialing')
    LIMIT 1;

    IF v_org_sub.id IS NULL THEN
      RAISE EXCEPTION 'Active organization subscription not found';
    END IF;

    v_total_credits := COALESCE(v_org.total_credits, 0);
    v_used_credits := COALESCE(v_org.used_credits, 0);

    IF (v_total_credits - v_used_credits) < p_amount THEN
      RETURN FALSE; -- Insufficient pooled credits, NO FALLBACK
    END IF;

    -- Deduct from organization pool (organizations table)
    UPDATE organizations
    SET used_credits = used_credits + p_amount,
        updated_at = NOW()
    WHERE id = v_org.id;

    -- Increment individual user's consumed credits in organization_members
    UPDATE organization_members
    SET used_credits = COALESCE(used_credits, 0) + p_amount,
        updated_at = NOW()
    WHERE clerk_user_id = p_clerk_user_id
      AND clerk_org_id = p_clerk_org_id;

    -- Build enhanced metadata for analytics
    v_metadata := jsonb_build_object(
      'pool', 'organization',
      'clerk_org_id', p_clerk_org_id,
      'organization_id', v_org.id,
      'organization_name', v_org.name,
      'stripe_customer_id', v_org.stripe_customer_id,
      'organization_subscription_id', v_org_sub.id,
      'seat_id', v_seat.id,
      'seat_role', v_seat.role,
      'clerk_user_id', p_clerk_user_id
    );

    -- Record transaction in organization_credit_transactions
    INSERT INTO organization_credit_transactions (
      organization_id,
      amount,
      description,
      transaction_type,
      reference_id,
      metadata
    )
    VALUES (
      v_org.id,
      -p_amount,
      p_description,
      'usage',
      p_reference_id,
      v_metadata
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

COMMENT ON FUNCTION deduct_credits_pooled IS 'Deduct credits from organization pool (if org context provided) or personal pool. Enhanced metadata includes org UUID, subscription UUID, seat ID/role, Stripe customer ID, and clerk_user_id for analytics. Also tracks individual usage in organization_members.';