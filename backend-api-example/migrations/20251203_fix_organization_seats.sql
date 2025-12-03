-- Fix organization_seats table
-- 1. Add role column
-- 2. Allow multiple pending invites (nullable clerk_user_id)
-- 3. Add missing columns to organization_subscriptions

-- Add role column to organization_seats if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_seats' AND column_name = 'role'
  ) THEN
    ALTER TABLE organization_seats
    ADD COLUMN role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'billing_manager'));
  END IF;
END $$;

-- Make clerk_user_id nullable to support pending invites
ALTER TABLE organization_seats
ALTER COLUMN clerk_user_id DROP NOT NULL;

-- Drop the old unique constraint that prevents multiple pending invites (empty string or null)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'organization_seats'::regclass
    AND contype = 'u'
    AND array_to_string(conkey, ',') IN (
      array_to_string(ARRAY(
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = 'organization_seats'::regclass AND attname = 'clerk_org_id'
      ) || ARRAY(
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = 'organization_seats'::regclass AND attname = 'clerk_user_id'
      ), ','),
      array_to_string(ARRAY(
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = 'organization_seats'::regclass AND attname = 'clerk_user_id'
      ) || ARRAY(
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = 'organization_seats'::regclass AND attname = 'clerk_org_id'
      ), ',')
    )
  ) LOOP
    EXECUTE 'ALTER TABLE organization_seats DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Add unique constraint on email per organization (to prevent duplicate invites)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_seats_unique_email 
ON organization_seats (clerk_org_id, user_email);

-- Add unique constraint on clerk_user_id per organization (only for claimed seats)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_seats_unique_user 
ON organization_seats (clerk_org_id, clerk_user_id) 
WHERE clerk_user_id IS NOT NULL;

-- Add missing columns to organization_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_subscriptions' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE organization_subscriptions
    ADD COLUMN quantity INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_subscriptions' AND column_name = 'overage_seats'
  ) THEN
    ALTER TABLE organization_subscriptions
    ADD COLUMN overage_seats INTEGER DEFAULT 0;
  END IF;
END $$;