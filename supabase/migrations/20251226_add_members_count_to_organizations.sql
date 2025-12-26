-- Add members_count and pending_invitations_count to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_invitations_count INTEGER DEFAULT 0;

-- Update upsert_organization RPC to include counts
CREATE OR REPLACE FUNCTION upsert_organization(
  p_clerk_org_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_members_count INTEGER DEFAULT 0,
  p_pending_invitations_count INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  INSERT INTO organizations (clerk_org_id, name, stripe_customer_id, members_count, pending_invitations_count)
  VALUES (p_clerk_org_id, p_name, p_stripe_customer_id, p_members_count, p_pending_invitations_count)
  ON CONFLICT (clerk_org_id)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, organizations.name),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, organizations.stripe_customer_id),
    members_count = EXCLUDED.members_count,
    pending_invitations_count = EXCLUDED.pending_invitations_count,
    updated_at = NOW()
  RETURNING id INTO v_org_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;