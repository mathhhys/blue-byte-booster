-- Migration: add 'starter' to subscriptions.plan_type, add started_at, create billing_records
BEGIN;

-- Add started_at column to subscriptions if not exists
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Keep subscriptions table for paid plans only (starter plans don't need subscriptions)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check CHECK (plan_type IN ('pro','teams','enterprise'));

-- Create billing_records table used as a placeholder for billing/usage entries
CREATE TABLE IF NOT EXISTS billing_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_records_user_id ON billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_subscription_id ON billing_records(subscription_id);

COMMIT;