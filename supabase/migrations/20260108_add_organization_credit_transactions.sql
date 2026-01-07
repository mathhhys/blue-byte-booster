-- Migration: Add organization_credit_transactions table mirroring credit_transactions
-- For logging org credit top-ups (purchase), auto-grants (recurring), etc.

-- Create table
CREATE TABLE IF NOT EXISTS organization_credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  description text,
  transaction_type text NOT NULL,  -- 'purchase', 'recurring', 'bonus', etc.
  reference_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance/queries
CREATE INDEX IF NOT EXISTS idx_org_credit_tx_org_id ON organization_credit_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_credit_tx_reference ON organization_credit_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_org_credit_tx_type ON organization_credit_transactions(transaction_type);

-- Constraints
ALTER TABLE organization_credit_transactions ADD CONSTRAINT chk_org_credit_amount CHECK (amount != 0);