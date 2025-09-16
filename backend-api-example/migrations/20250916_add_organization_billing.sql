-- Organization billing tables for Stripe integration
-- This migration adds support for organization-level subscriptions and billing portals

-- Organizations table (linked to Clerk organizations)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  clerk_org_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('teams', 'enterprise')),
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('monthly', 'yearly')),
  seats_total INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization seats table (tracks seat assignments)
CREATE TABLE IF NOT EXISTS organization_seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  clerk_org_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by TEXT, -- clerk_user_id of the admin who assigned
  UNIQUE(clerk_org_id, clerk_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id ON organizations(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_clerk_org_id ON organization_subscriptions(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_id ON organization_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_org_subscription_id ON organization_seats(organization_subscription_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_clerk_user_id ON organization_seats(clerk_user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_subscriptions_updated_at BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Note: RLS policies are disabled for now as Clerk manages organization membership
-- The API routes handle authorization through Clerk's organization context
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE organization_seats ENABLE ROW LEVEL SECURITY;

-- Function to create or update organization
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

-- Function to assign seat to user
CREATE OR REPLACE FUNCTION assign_organization_seat(
  p_clerk_org_id TEXT,
  p_clerk_user_id TEXT,
  p_user_email TEXT,
  p_user_name TEXT DEFAULT NULL,
  p_assigned_by TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_subscription_id UUID;
  v_current_seats_used INTEGER;
  v_max_seats INTEGER;
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

  IF v_current_seats_used >= v_max_seats THEN
    RETURN FALSE; -- No seats available
  END IF;

  -- Assign the seat
  INSERT INTO organization_seats (
    organization_subscription_id,
    clerk_user_id,
    clerk_org_id,
    user_email,
    user_name,
    assigned_by
  ) VALUES (
    v_org_subscription_id,
    p_clerk_user_id,
    p_clerk_org_id,
    p_user_email,
    p_user_name,
    p_assigned_by
  )
  ON CONFLICT (clerk_org_id, clerk_user_id)
  DO NOTHING;

  -- Update seats used count
  UPDATE organization_subscriptions
  SET seats_used = seats_used + 1, updated_at = NOW()
  WHERE id = v_org_subscription_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove seat from user
CREATE OR REPLACE FUNCTION remove_organization_seat(
  p_clerk_org_id TEXT,
  p_clerk_user_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_subscription_id UUID;
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

  -- Remove the seat
  DELETE FROM organization_seats
  WHERE organization_subscription_id = v_org_subscription_id
    AND clerk_user_id = p_clerk_user_id;

  -- Update seats used count
  UPDATE organization_subscriptions
  SET seats_used = GREATEST(0, seats_used - 1), updated_at = NOW()
  WHERE id = v_org_subscription_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;