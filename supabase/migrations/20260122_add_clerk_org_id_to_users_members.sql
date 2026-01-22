-- Migration: Add clerk_org_id to users (active org for JWT) and organization_members (all memberships)
-- Migrate existing data from organization_id -> clerk_org_id via JOIN
-- Safe idempotent operations

-- Ensure pgcrypto for UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Standard updated_at trigger (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. users table: add clerk_org_id for active/current org context (JWT)
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_clerk_org_id ON users(clerk_org_id);

-- 2. organization_members table: add clerk_user_id and clerk_org_id for Clerk-native tracking
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;

-- Migrate data for organization_members: join with organizations (cast types if needed)
UPDATE organization_members om
SET clerk_org_id = o.clerk_org_id
FROM organizations o
WHERE om.organization_id::uuid = o.id
  AND om.clerk_org_id IS NULL;

-- Unique constraint: one membership per (user, org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique_clerk
ON organization_members (clerk_user_id, clerk_org_id)
WHERE clerk_org_id IS NOT NULL;

-- Trigger for updated_at on organization_members
DROP TRIGGER IF EXISTS trigger_organization_members_updated_at ON organization_members;
CREATE TRIGGER trigger_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Migrate users active org (if organization_id exists)
DO $$
BEGIN
  -- Check if organization_id column exists before migrating
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'organization_id') THEN
    UPDATE users u
    SET clerk_org_id = o.clerk_org_id
    FROM organizations o
    WHERE u.organization_id::uuid = o.id
      AND u.clerk_org_id IS NULL;
  END IF;
END $$;

-- Enable RLS on organization_members if not already
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Service role policy (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_org_members') THEN
    CREATE POLICY "service_role_all_org_members" ON organization_members 
    FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_clerk_user_id ON organization_members(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_clerk_org_id ON organization_members(clerk_org_id);