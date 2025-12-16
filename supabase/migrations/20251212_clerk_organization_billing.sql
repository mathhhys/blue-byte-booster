-- Migration: Clerk Organization Billing + Seat Management + Pooled Credits
-- Purpose:
-- - Provide Supabase schema required by /api/organizations/* endpoints and Stripe webhook processing
-- - Support invite-first seat reservation (pending seats) and later claiming on Clerk membership acceptance
-- - Track pooled credits at the organization subscription level
--
-- Notes:
-- - We keep constraints reasonably permissive to avoid blocking Stripe statuses.
-- - RLS is enabled with service_role-only policies (API routes use service key).

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Standard updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------------------
-- organizations
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (in case table pre-exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='stripe_customer_id') THEN
    ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='name') THEN
    ALTER TABLE organizations ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='created_at') THEN
    ALTER TABLE organizations ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='updated_at') THEN
    ALTER TABLE organizations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id ON organizations(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);

DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON organizations;
CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- organization_subscriptions
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  clerk_org_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'teams',
  billing_frequency TEXT NOT NULL DEFAULT 'monthly',
  seats_total INTEGER NOT NULL DEFAULT 1,
  seats_used INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  overage_seats INTEGER NOT NULL DEFAULT 0,
  overage BOOLEAN NOT NULL DEFAULT FALSE,
  auto_update_quantity BOOLEAN NOT NULL DEFAULT FALSE,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'trialing',
  total_credits INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  last_credit_recharge_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT org_subscriptions_plan_type_check CHECK (plan_type IN ('teams', 'enterprise')),
  CONSTRAINT org_subscriptions_billing_frequency_check CHECK (billing_frequency IN ('monthly', 'yearly')),
  -- Stripe subscription statuses (keep fairly permissive)
  CONSTRAINT org_subscriptions_status_check CHECK (status IN (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused'
  )),
  CONSTRAINT org_subscriptions_seats_total_check CHECK (seats_total >= 1),
  CONSTRAINT org_subscriptions_seats_used_check CHECK (seats_used >= 0),
  CONSTRAINT org_subscriptions_overage_seats_check CHECK (overage_seats >= 0),
  CONSTRAINT org_subscriptions_credits_check CHECK (total_credits >= 0 AND used_credits >= 0 AND used_credits <= total_credits)
);

-- Ensure critical columns exist if table pre-exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='clerk_org_id') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN clerk_org_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='stripe_customer_id') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN stripe_customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN stripe_subscription_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='plan_type') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'teams';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='billing_frequency') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN billing_frequency TEXT NOT NULL DEFAULT 'monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='seats_total') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN seats_total INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='seats_used') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN seats_used INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='quantity') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='overage_seats') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN overage_seats INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='overage') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN overage BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='auto_update_quantity') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN auto_update_quantity BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='currency') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN currency TEXT NOT NULL DEFAULT 'usd';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='status') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN status TEXT NOT NULL DEFAULT 'trialing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='total_credits') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN total_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='used_credits') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN used_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='last_credit_recharge_at') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN last_credit_recharge_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='current_period_start') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN current_period_start TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='current_period_end') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN current_period_end TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='created_at') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='updated_at') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Unique constraints via indexes (safe to run idempotently)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_clerk_org_id_unique
  ON organization_subscriptions (clerk_org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_subscription_id_unique
  ON organization_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status);

DROP TRIGGER IF EXISTS trigger_org_subscriptions_updated_at ON organization_subscriptions;
CREATE TRIGGER trigger_org_subscriptions_updated_at
  BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- organization_seats
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  clerk_org_id TEXT NOT NULL,
  clerk_user_id TEXT,
  user_email TEXT NOT NULL,
  user_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  expires_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT org_seats_role_check CHECK (role IN ('admin', 'member', 'billing_manager')),
  CONSTRAINT org_seats_status_check CHECK (status IN ('pending', 'active', 'revoked', 'expired'))
);

-- Ensure columns exist / nullable clerk_user_id for pending invites
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_seats' AND column_name='clerk_user_id' AND is_nullable = 'NO') THEN
    ALTER TABLE organization_seats ALTER COLUMN clerk_user_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_seats_org_subscription_id ON organization_seats(organization_subscription_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_clerk_org_id ON organization_seats(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_clerk_user_id ON organization_seats(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_status ON organization_seats(status);

-- Uniqueness rules:
-- - Only one active/pending seat per (org,email) to prevent duplicate invites.
-- - Only one claimed seat per (org,clerk_user_id) when clerk_user_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_seats_unique_email_active
  ON organization_seats (clerk_org_id, user_email)
  WHERE status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_seats_unique_user_claimed
  ON organization_seats (clerk_org_id, clerk_user_id)
  WHERE clerk_user_id IS NOT NULL AND status IN ('pending', 'active');

DROP TRIGGER IF EXISTS trigger_org_seats_updated_at ON organization_seats;
CREATE TRIGGER trigger_org_seats_updated_at
  BEFORE UPDATE ON organization_seats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- seat_adjustments (used by organizationSubscriptionOperations.updateSubscriptionQuantity)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT seat_adjustments_type_check CHECK (adjustment_type IN ('upgrade', 'downgrade'))
);

CREATE INDEX IF NOT EXISTS idx_seat_adjustments_org_sub_id ON seat_adjustments(organization_subscription_id);

-- -------------------------------------------------------------------------------------
-- webhook_events (idempotency log for Stripe webhook processing)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  payload JSONB,
  user_clerk_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_clerk_id ON webhook_events(user_clerk_id);

-- -------------------------------------------------------------------------------------
-- RPC: upsert_organization (used by Clerk webhook handler)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_organization(
  p_clerk_org_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  INSERT INTO organizations (clerk_org_id, name, stripe_customer_id)
  VALUES (p_clerk_org_id, p_name, p_stripe_customer_id)
  ON CONFLICT (clerk_org_id)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, organizations.name),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, organizations.stripe_customer_id),
    updated_at = NOW()
  RETURNING id INTO v_org_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------------------
-- RLS: service role only (API uses service key)
-- -------------------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent-ish: create if not exists isn't available, so we use distinct names and rely on migrations running once)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_organizations') THEN
    CREATE POLICY "service_role_all_organizations" ON organizations FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_org_subscriptions') THEN
    CREATE POLICY "service_role_all_org_subscriptions" ON organization_subscriptions FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_org_seats') THEN
    CREATE POLICY "service_role_all_org_seats" ON organization_seats FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_seat_adjustments') THEN
    CREATE POLICY "service_role_all_seat_adjustments" ON seat_adjustments FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_webhook_events') THEN
    CREATE POLICY "service_role_all_webhook_events" ON webhook_events FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;