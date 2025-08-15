-- Migration: Fix starter plan implementation
-- This migration corrects the starter plan database constraints and functions
BEGIN;

-- Ensure users table supports starter plan (should already exist from main schema)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_type_check;
ALTER TABLE users ADD CONSTRAINT users_plan_type_check 
  CHECK (plan_type IN ('starter', 'pro', 'teams', 'enterprise'));

-- Ensure subscriptions table excludes starter (correct behavior)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check 
  CHECK (plan_type IN ('pro', 'teams', 'enterprise'));

-- Update upsert_user function to ensure it grants starter credits properly
CREATE OR REPLACE FUNCTION upsert_user(
  p_clerk_id TEXT,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'starter'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_is_new_user BOOLEAN := FALSE;
  v_existing_credits INTEGER;
BEGIN
  -- Check if user exists and get current credits
  SELECT id, credits INTO v_user_id, v_existing_credits 
  FROM users WHERE clerk_id = p_clerk_id;
  
  IF v_user_id IS NULL THEN
    v_is_new_user := TRUE;
  END IF;
  
  -- Insert or update user
  INSERT INTO users (clerk_id, email, first_name, last_name, plan_type, credits)
  VALUES (p_clerk_id, p_email, p_first_name, p_last_name, p_plan_type, 
          CASE WHEN p_plan_type = 'starter' THEN 25 ELSE 0 END)
  ON CONFLICT (clerk_id) 
  DO UPDATE SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Grant starter credits if this is a new starter user
  IF v_is_new_user AND p_plan_type = 'starter' THEN
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (v_user_id, 25, 'grant', 'Starter plan welcome credits');
  END IF;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;