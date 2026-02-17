-- Migration: Add User Subscriptions Table for Personal Billing
-- Purpose: Enable tracking of personal (individual) subscriptions similar to organization subscriptions
-- Date: 2026-02-17

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Standard updated_at trigger (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------------------
-- user_subscriptions
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'starter',
  billing_frequency TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  total_credits INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  last_credit_recharge_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_subscriptions_plan_type_check CHECK (plan_type IN ('starter', 'basic', 'pro', 'enterprise')),
  CONSTRAINT user_subscriptions_billing_frequency_check CHECK (billing_frequency IN ('monthly', 'yearly')),
  -- Stripe subscription statuses
  CONSTRAINT user_subscriptions_status_check CHECK (status IN (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused'
  )),
  CONSTRAINT user_subscriptions_credits_check CHECK (total_credits >= 0 AND used_credits >= 0 AND used_credits <= total_credits)
);

-- Ensure columns exist (in case table pre-exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='user_id') THEN
    ALTER TABLE user_subscriptions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='clerk_user_id') THEN
    ALTER TABLE user_subscriptions ADD COLUMN clerk_user_id TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='stripe_customer_id') THEN
    ALTER TABLE user_subscriptions ADD COLUMN stripe_customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE user_subscriptions ADD COLUMN stripe_subscription_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='plan_type') THEN
    ALTER TABLE user_subscriptions ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'starter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='billing_frequency') THEN
    ALTER TABLE user_subscriptions ADD COLUMN billing_frequency TEXT NOT NULL DEFAULT 'monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='status') THEN
    ALTER TABLE user_subscriptions ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='total_credits') THEN
    ALTER TABLE user_subscriptions ADD COLUMN total_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='used_credits') THEN
    ALTER TABLE user_subscriptions ADD COLUMN used_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='last_credit_recharge_at') THEN
    ALTER TABLE user_subscriptions ADD COLUMN last_credit_recharge_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='current_period_start') THEN
    ALTER TABLE user_subscriptions ADD COLUMN current_period_start TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='current_period_end') THEN
    ALTER TABLE user_subscriptions ADD COLUMN current_period_end TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='created_at') THEN
    ALTER TABLE user_subscriptions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='updated_at') THEN
    ALTER TABLE user_subscriptions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Unique constraints via indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_clerk_user_id_unique
  ON user_subscriptions (clerk_user_id)
  WHERE status IN ('active', 'trialing', 'past_due', 'incomplete');

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id_unique
  ON user_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_clerk_user_id ON user_subscriptions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);

-- Updated at trigger
DROP TRIGGER IF EXISTS trigger_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER trigger_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- user_subscription_credit_transactions
-- Track credit usage and grants for personal subscriptions
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscription_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_credit_transactions_type_check CHECK (transaction_type IN ('grant', 'usage', 'refund', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_subscription_id ON user_subscription_credit_transactions(user_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_clerk_user_id ON user_subscription_credit_transactions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_created_at ON user_subscription_credit_transactions(created_at);

-- -------------------------------------------------------------------------------------
-- RPC: upsert_user_subscription (used by webhook handlers)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_user_subscription(
  p_clerk_user_id TEXT,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'starter',
  p_billing_frequency TEXT DEFAULT 'monthly',
  p_status TEXT DEFAULT 'active',
  p_total_credits INTEGER DEFAULT 0,
  p_current_period_start TIMESTAMPTZ DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_subscription_id UUID;
BEGIN
  -- Get user_id from users table
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found for clerk_id: %', p_clerk_user_id;
  END IF;

  -- Insert or update subscription
  INSERT INTO user_subscriptions (
    user_id,
    clerk_user_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan_type,
    billing_frequency,
    status,
    total_credits,
    current_period_start,
    current_period_end
  )
  VALUES (
    v_user_id,
    p_clerk_user_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_plan_type,
    p_billing_frequency,
    p_status,
    p_total_credits,
    p_current_period_start,
    p_current_period_end
  )
  ON CONFLICT (clerk_user_id) 
  WHERE status IN ('active', 'trialing', 'past_due', 'incomplete')
  DO UPDATE SET
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_subscriptions.stripe_subscription_id),
    plan_type = EXCLUDED.plan_type,
    billing_frequency = EXCLUDED.billing_frequency,
    status = EXCLUDED.status,
    total_credits = EXCLUDED.total_credits,
    current_period_start = COALESCE(EXCLUDED.current_period_start, user_subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, user_subscriptions.current_period_end),
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------------------
-- RPC: add_user_subscription_credits
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_user_subscription_credits(
  p_clerk_user_id TEXT,
  p_credits_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Get the active subscription for this user
  SELECT id INTO v_subscription_id
  FROM user_subscriptions
  WHERE clerk_user_id = p_clerk_user_id
    AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for user: %', p_clerk_user_id;
  END IF;

  -- Add credits to subscription
  UPDATE user_subscriptions
  SET 
    total_credits = total_credits + p_credits_amount,
    updated_at = NOW()
  WHERE id = v_subscription_id;

  -- Log the transaction
  INSERT INTO user_subscription_credit_transactions (
    user_subscription_id,
    clerk_user_id,
    amount,
    transaction_type,
    description,
    reference_id
  ) VALUES (
    v_subscription_id,
    p_clerk_user_id,
    p_credits_amount,
    'grant',
    COALESCE(p_description, 'Credit grant'),
    p_reference_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------------------
-- RPC: deduct_user_subscription_credits
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_user_subscription_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
  v_total_credits INTEGER;
  v_used_credits INTEGER;
BEGIN
  -- Get the active subscription
  SELECT id, total_credits, used_credits
  INTO v_subscription_id, v_total_credits, v_used_credits
  FROM user_subscriptions
  WHERE clerk_user_id = p_clerk_user_id
    AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for user: %', p_clerk_user_id;
  END IF;

  -- Check if sufficient credits available
  IF (v_total_credits - v_used_credits) < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits available. Required: %, Available: %', 
      p_amount, (v_total_credits - v_used_credits);
  END IF;

  -- Deduct credits
  UPDATE user_subscriptions
  SET 
    used_credits = used_credits + p_amount,
    updated_at = NOW()
  WHERE id = v_subscription_id;

  -- Log the transaction
  INSERT INTO user_subscription_credit_transactions (
    user_subscription_id,
    clerk_user_id,
    amount,
    transaction_type,
    description,
    reference_id
  ) VALUES (
    v_subscription_id,
    p_clerk_user_id,
    -p_amount,
    'usage',
    COALESCE(p_description, 'Credit usage'),
    p_reference_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------------------
-- RPC: get_user_subscription
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_subscription(p_clerk_user_id TEXT)
RETURNS TABLE (
  id UUID,
  plan_type TEXT,
  billing_frequency TEXT,
  status TEXT,
  total_credits INTEGER,
  used_credits INTEGER,
  available_credits INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_credit_recharge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.plan_type,
    us.billing_frequency,
    us.status,
    us.total_credits,
    us.used_credits,
    (us.total_credits - us.used_credits) as available_credits,
    us.stripe_customer_id,
    us.stripe_subscription_id,
    us.current_period_start,
    us.current_period_end,
    us.last_credit_recharge_at,
    us.created_at,
    us.updated_at
  FROM user_subscriptions us
  WHERE us.clerk_user_id = p_clerk_user_id
    AND us.status IN ('active', 'trialing', 'past_due', 'incomplete')
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------------------
-- RLS: service role only (API uses service key)
-- -------------------------------------------------------------------------------------
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscription_credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_user_subscriptions') THEN
    CREATE POLICY "service_role_all_user_subscriptions" ON user_subscriptions FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_user_credit_transactions') THEN
    CREATE POLICY "service_role_all_user_credit_transactions" ON user_subscription_credit_transactions FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Comments
COMMENT ON TABLE user_subscriptions IS 'Stores subscription details for individual users';
COMMENT ON TABLE user_subscription_credit_transactions IS 'Tracks credit grants and usage for personal subscriptions';