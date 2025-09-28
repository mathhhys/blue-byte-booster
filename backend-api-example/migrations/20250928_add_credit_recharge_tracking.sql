-- Add last_credit_recharge_at columns to track monthly credit recharge
-- This prevents double charging credits in the same billing period

-- For individual subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS last_credit_recharge_at TIMESTAMP WITH TIME ZONE;

-- For organization subscriptions  
ALTER TABLE organization_subscriptions
ADD COLUMN IF NOT EXISTS last_credit_recharge_at TIMESTAMP WITH TIME ZONE;

-- Update existing records to set last_credit_recharge_at to current_period_start if null
UPDATE subscriptions 
SET last_credit_recharge_at = current_period_start 
WHERE last_credit_recharge_at IS NULL AND current_period_start IS NOT NULL;

UPDATE organization_subscriptions
SET last_credit_recharge_at = current_period_start 
WHERE last_credit_recharge_at IS NULL AND current_period_start IS NOT NULL;