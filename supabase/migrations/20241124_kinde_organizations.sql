-- Migration: Create Kinde Organization Tables for B2B Seat-Based Pricing
-- This adds support for Kinde-based organizations alongside existing Clerk organizations

-- Table: kinde_organization_customers
-- Maps Kinde organizations to Stripe customers
CREATE TABLE IF NOT EXISTS kinde_organization_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kinde_org_code TEXT NOT NULL UNIQUE,
  kinde_org_name TEXT,
  stripe_customer_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: kinde_organization_subscriptions
-- Stores subscription details for Kinde organizations
CREATE TABLE IF NOT EXISTS kinde_organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kinde_org_code TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'teams',
  status TEXT NOT NULL DEFAULT 'pending',
  seats_total INTEGER NOT NULL DEFAULT 3,
  billing_frequency TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'unpaid')),
  CONSTRAINT valid_billing_frequency CHECK (billing_frequency IN ('monthly', 'yearly')),
  CONSTRAINT valid_seats CHECK (seats_total >= 1 AND seats_total <= 100),
  
  -- Unique constraint for active subscriptions per org
  UNIQUE (kinde_org_code, stripe_subscription_id)
);

-- Table: kinde_organization_seats
-- Tracks seat assignments within Kinde organizations
CREATE TABLE IF NOT EXISTS kinde_organization_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kinde_org_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  revoked_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_role CHECK (role IN ('admin', 'member')),
  CONSTRAINT valid_seat_status CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  
  -- Unique constraint for user per org
  UNIQUE (kinde_org_code, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kinde_org_customers_code ON kinde_organization_customers(kinde_org_code);
CREATE INDEX IF NOT EXISTS idx_kinde_org_customers_stripe ON kinde_organization_customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_kinde_org_subs_code ON kinde_organization_subscriptions(kinde_org_code);
CREATE INDEX IF NOT EXISTS idx_kinde_org_subs_stripe ON kinde_organization_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_kinde_org_subs_status ON kinde_organization_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_kinde_org_seats_code ON kinde_organization_seats(kinde_org_code);
CREATE INDEX IF NOT EXISTS idx_kinde_org_seats_user ON kinde_organization_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_kinde_org_seats_email ON kinde_organization_seats(email);
CREATE INDEX IF NOT EXISTS idx_kinde_org_seats_status ON kinde_organization_seats(status);

-- Row Level Security (RLS) Policies
ALTER TABLE kinde_organization_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinde_organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinde_organization_seats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for API operations)
-- Note: These policies use service role, so API calls with service key bypass RLS
-- For user-facing operations, we validate org membership in the API layer

-- Policy for customers table
CREATE POLICY "service_role_all_kinde_customers" ON kinde_organization_customers
  FOR ALL USING (auth.role() = 'service_role');

-- Policy for subscriptions table
CREATE POLICY "service_role_all_kinde_subscriptions" ON kinde_organization_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Policy for seats table  
CREATE POLICY "service_role_all_kinde_seats" ON kinde_organization_seats
  FOR ALL USING (auth.role() = 'service_role');

-- Optional: Add column to existing users table for auth provider tracking
-- This helps identify which authentication provider a user uses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'auth_provider'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'clerk';
    COMMENT ON COLUMN users.auth_provider IS 'Authentication provider: clerk (B2C) or kinde (B2B)';
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_kinde_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_kinde_customers_updated_at ON kinde_organization_customers;
CREATE TRIGGER trigger_kinde_customers_updated_at
  BEFORE UPDATE ON kinde_organization_customers
  FOR EACH ROW EXECUTE FUNCTION update_kinde_updated_at();

DROP TRIGGER IF EXISTS trigger_kinde_subs_updated_at ON kinde_organization_subscriptions;
CREATE TRIGGER trigger_kinde_subs_updated_at
  BEFORE UPDATE ON kinde_organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_kinde_updated_at();

-- Comments for documentation
COMMENT ON TABLE kinde_organization_customers IS 'Maps Kinde B2B organizations to Stripe customers';
COMMENT ON TABLE kinde_organization_subscriptions IS 'Stores subscription details for Kinde organizations with seat-based pricing';
COMMENT ON TABLE kinde_organization_seats IS 'Tracks individual seat assignments within Kinde organizations';

COMMENT ON COLUMN kinde_organization_subscriptions.seats_total IS 'Total number of seats purchased for this subscription';
COMMENT ON COLUMN kinde_organization_seats.status IS 'pending = invited, active = accepted, revoked = removed, expired = subscription ended';