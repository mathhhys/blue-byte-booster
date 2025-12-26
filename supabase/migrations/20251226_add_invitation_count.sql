-- Migration: Add invitation count tracking to organizations
-- Purpose: Track the total number of invitations sent by an organization

-- Add counter column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS invitations_sent_count INTEGER DEFAULT 0;

-- Create RPC for atomic increment of invitation count
-- This is used by the Clerk webhook handler when organizationInvitation.created is received
CREATE OR REPLACE FUNCTION increment_invitation_count(p_clerk_org_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE organizations
  SET invitations_sent_count = invitations_sent_count + 1,
      updated_at = NOW()
  WHERE clerk_org_id = p_clerk_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;