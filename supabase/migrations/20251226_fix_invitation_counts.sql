-- Fix Organization Invitation and Member Counts
-- This migration adds RPC functions to properly track member and invitation counts

-- Function to update member count (increment or decrement)
CREATE OR REPLACE FUNCTION update_member_count(
  p_clerk_org_id TEXT,
  p_delta INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET 
    members_count = GREATEST(0, members_count + p_delta),
    updated_at = NOW()
  WHERE clerk_org_id = p_clerk_org_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Organization not found for member count update: %', p_clerk_org_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update invitation count (increment or decrement)
CREATE OR REPLACE FUNCTION update_invitation_count(
  p_clerk_org_id TEXT,
  p_delta INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET 
    pending_invitations_count = GREATEST(0, pending_invitations_count + p_delta),
    updated_at = NOW()
  WHERE clerk_org_id = p_clerk_org_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Organization not found for invitation count update: %', p_clerk_org_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync exact counts (for recovery/sync operations)
CREATE OR REPLACE FUNCTION sync_organization_counts(
  p_clerk_org_id TEXT,
  p_members_count INTEGER,
  p_pending_invitations_count INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET 
    members_count = p_members_count,
    pending_invitations_count = p_pending_invitations_count,
    updated_at = NOW()
  WHERE clerk_org_id = p_clerk_org_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Organization not found for count sync: %', p_clerk_org_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for faster lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id 
ON organizations(clerk_org_id);

-- Add comments for documentation
COMMENT ON FUNCTION update_member_count IS 'Increment or decrement member count for an organization. Used by webhooks when members join/leave.';
COMMENT ON FUNCTION update_invitation_count IS 'Increment or decrement pending invitation count for an organization. Used by webhooks when invitations are created/revoked/accepted.';
COMMENT ON FUNCTION sync_organization_counts IS 'Set exact member and invitation counts from Clerk API. Used for recovery and sync operations.';