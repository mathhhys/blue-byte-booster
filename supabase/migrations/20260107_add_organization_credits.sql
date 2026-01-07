-- Migration: Add organization-level credits (total_credits, used_credits) to mirror users.credits
-- Purpose: Auto-grant 500/seat monthly (6000 yearly) via Stripe webhooks to organizations.total_credits
-- Data migration: Transfer from organization_subscriptions.total_credits/used_credits

-- Add columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS total_credits INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS used_credits INTEGER DEFAULT 0;

-- Add constraints
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS org_credits_check;
ALTER TABLE organizations ADD CONSTRAINT org_credits_check CHECK (total_credits >= 0 AND used_credits >= 0 AND used_credits <= total_credits);

-- Data migration
UPDATE organizations o
SET 
  total_credits = os.total_credits,
  used_credits = os.used_credits
FROM organization_subscriptions os
WHERE o.clerk_org_id = os.clerk_org_id;