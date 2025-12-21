-- Fix schema drift: Apply missing tables and columns from 20251212 migration

-- 1. Ensure organization_subscriptions has credit columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='total_credits') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN total_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='used_credits') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN used_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_subscriptions' AND column_name='last_credit_recharge_at') THEN
    ALTER TABLE organization_subscriptions ADD COLUMN last_credit_recharge_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Create organization_seats table if not exists
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

-- Indexes for organization_seats
CREATE INDEX IF NOT EXISTS idx_org_seats_org_subscription_id ON organization_seats(organization_subscription_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_clerk_org_id ON organization_seats(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_clerk_user_id ON organization_seats(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_status ON organization_seats(status);

-- Unique constraints for organization_seats
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_seats_unique_email_active
  ON organization_seats (clerk_org_id, user_email)
  WHERE status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_seats_unique_user_claimed
  ON organization_seats (clerk_org_id, clerk_user_id)
  WHERE clerk_user_id IS NOT NULL AND status IN ('pending', 'active');

-- 3. Create seat_adjustments table if not exists
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

-- 4. Create webhook_events table if not exists
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

-- 5. Enable RLS
ALTER TABLE organization_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- 6. Add RLS policies (service role only)
DO $$
BEGIN
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