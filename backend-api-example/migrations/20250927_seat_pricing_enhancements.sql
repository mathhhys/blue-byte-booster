-- Seat-based pricing enhancements: Add quantity tracking, adjustments, roles, and RLS/indexes
-- Builds on existing organization_subscriptions (seats_total, seats_used, status, overage) and organization_seats (status, expires_at)

-- Add columns to organization_subscriptions
ALTER TABLE organization_subscriptions
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS overage_seats INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_update_quantity BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add columns to organization_seats
ALTER TABLE organization_seats
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- Create seat_adjustments table
CREATE TABLE IF NOT EXISTS seat_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL, -- e.g., 'upgrade', 'downgrade', 'overage_charge'
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill quantity from seats_total for existing subscriptions
UPDATE organization_subscriptions
SET quantity = seats_total
WHERE quantity IS NULL;

-- Add constraint for seats limit (compatible with existing seats_used)
ALTER TABLE organization_subscriptions
ADD CONSTRAINT IF NOT EXISTS chk_seats_limit CHECK (seats_used <= quantity + overage_seats);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_seats_org_id_status ON organization_seats(clerk_org_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_adjustments_sub_id ON seat_adjustments(organization_subscription_id);

-- RLS for seat_adjustments
ALTER TABLE seat_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy for viewing adjustments (org members)
CREATE POLICY "Org members view seat adjustments" ON seat_adjustments
FOR SELECT USING (
  organization_subscription_id IN (
    SELECT id FROM organization_subscriptions
    WHERE clerk_org_id = (auth.jwt() ->> 'organization_id')
  )
);

-- Policy for managing adjustments (org admins only)
CREATE POLICY "Org admins manage seat adjustments" ON seat_adjustments
FOR ALL USING (
  auth.uid() IN (
    SELECT clerk_user_id FROM organization_members
    WHERE organization_id = (
      SELECT organization_id FROM organization_subscriptions
      WHERE id = seat_adjustments.organization_subscription_id
    )
    AND role = 'admin'
  )
) WITH CHECK (
  auth.uid() IN (
    SELECT clerk_user_id FROM organization_members
    WHERE organization_id = (
      SELECT organization_id FROM organization_subscriptions
      WHERE id = seat_adjustments.organization_subscription_id
    )
    AND role = 'admin'
  )
);

-- Update existing functions if needed (e.g., assign_organization_seat to set role, assigned_at, but no changes here; handle in app logic)
-- Note: For multi-currency, currency links to src/config/currencies.ts in app code