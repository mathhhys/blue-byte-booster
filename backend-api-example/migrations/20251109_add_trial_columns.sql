-- Add trial columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone;

-- Update grant_credits function to handle trial plans if needed
-- Assuming grant_credits exists, this is an example update
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_transaction_type text DEFAULT 'grant'
) RETURNS void AS $$
BEGIN
  -- Update user credits
  UPDATE users 
  SET credits = credits + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  -- Insert transaction record
  INSERT INTO credit_transactions (user_id, amount, description, transaction_type)
  VALUES (p_user_id, p_amount, p_description, p_transaction_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;