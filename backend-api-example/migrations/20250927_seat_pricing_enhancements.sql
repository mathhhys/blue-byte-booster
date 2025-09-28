-- Seat-based pricing enhancements: Add quantity tracking, adjustments, roles, and RLS/indexes
-- Builds on existing organization_subscriptions (seats_total, seats_used, status, overage) and organization_seats (status, expires_at)

-- Add columns to organization_subscriptions
DO $$
BEGIN
    -- Add quantity column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_subscriptions' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE organization_subscriptions ADD COLUMN quantity INTEGER;
    END IF;
    
    -- Add overage_seats column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_subscriptions' AND column_name = 'overage_seats'
    ) THEN
        ALTER TABLE organization_subscriptions ADD COLUMN overage_seats INTEGER DEFAULT 0;
    END IF;
    
    -- Add auto_update_quantity column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_subscriptions' AND column_name = 'auto_update_quantity'
    ) THEN
        ALTER TABLE organization_subscriptions ADD COLUMN auto_update_quantity BOOLEAN DEFAULT true;
    END IF;
    
    -- Add currency column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_subscriptions' AND column_name = 'currency'
    ) THEN
        ALTER TABLE organization_subscriptions ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;
END $$;

-- Add columns to organization_seats
DO $$
BEGIN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_seats' AND column_name = 'role'
    ) THEN
        ALTER TABLE organization_seats ADD COLUMN role TEXT;
    END IF;

    -- Add assigned_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_seats' AND column_name = 'assigned_at'
    ) THEN
        ALTER TABLE organization_seats ADD COLUMN assigned_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add revoked_reason column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_seats' AND column_name = 'revoked_reason'
    ) THEN
        ALTER TABLE organization_seats ADD COLUMN revoked_reason TEXT;
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_seats' AND column_name = 'status'
    ) THEN
        ALTER TABLE organization_seats ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending', 'expired'));

        -- Backfill existing rows with default status
        UPDATE organization_seats SET status = 'active' WHERE status IS NULL;
    END IF;
END $$;

-- Create seat_adjustments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'seat_adjustments'
    ) THEN
        CREATE TABLE seat_adjustments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
          old_quantity INTEGER NOT NULL,
          new_quantity INTEGER NOT NULL,
          adjustment_type TEXT NOT NULL, -- e.g., 'upgrade', 'downgrade', 'overage_charge'
          stripe_invoice_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Backfill quantity from seats_total for existing subscriptions
UPDATE organization_subscriptions
SET quantity = seats_total
WHERE quantity IS NULL;

-- Add constraint for seats limit (compatible with existing seats_used)
-- Use a DO block to add constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_seats_limit'
        AND conrelid = 'organization_subscriptions'::regclass
    ) THEN
        ALTER TABLE organization_subscriptions
        ADD CONSTRAINT chk_seats_limit CHECK (seats_used <= quantity + overage_seats);
    END IF;
END $$;

-- Indexes
-- Use DO blocks to create indexes only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_org_seats_org_id_status'
        AND tablename = 'organization_seats'
    ) THEN
        CREATE INDEX idx_org_seats_org_id_status ON organization_seats(clerk_org_id, status);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_seat_adjustments_sub_id'
        AND tablename = 'seat_adjustments'
    ) THEN
        CREATE INDEX idx_seat_adjustments_sub_id ON seat_adjustments(organization_subscription_id);
    END IF;
END $$;

-- RLS for seat_adjustments
-- Note: Using simplified RLS policies since organization_members table is not available
ALTER TABLE seat_adjustments ENABLE ROW LEVEL SECURITY;

-- Basic policy for seat adjustments (simplified - can be enhanced later)
CREATE POLICY "Basic seat adjustments access" ON seat_adjustments
FOR ALL USING (true);

-- Update existing functions if needed (e.g., assign_organization_seat to set role, assigned_at, but no changes here; handle in app logic)
-- Note: For multi-currency, currency links to src/config/currencies.ts in app code