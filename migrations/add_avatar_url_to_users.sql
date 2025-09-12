-- Migration: Add avatar_url column to users table and update upsert_user function
-- Date: 2025-01-11
-- Description: Add avatar_url support for Clerk webhook synchronization

-- Add avatar_url column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update the upsert_user function to handle avatar_url
CREATE OR REPLACE FUNCTION upsert_user(
  p_clerk_id TEXT,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'starter'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  INSERT INTO users (clerk_id, email, first_name, last_name, avatar_url, plan_type)
  VALUES (p_clerk_id, p_email, p_first_name, p_last_name, p_avatar_url, p_plan_type)
  ON CONFLICT (clerk_id) 
  DO UPDATE SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'avatar_url';

-- Test the updated function (you can run this to verify it works)
-- SELECT upsert_user('test_clerk_id', 'test@example.com', 'Test', 'User', 'https://example.com/avatar.png', 'starter');