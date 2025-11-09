-- Update RLS policies to include trial status for Pro plan access
-- This migration creates or replaces the policy for trial access

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can access pro features during trial" ON public.users;

-- Create new policy for trial access
CREATE POLICY "Users can access pro features during trial" ON public.users
FOR ALL
TO public
USING (
  plan_type = 'pro' 
  OR (plan_type = 'starter' AND trial_end > NOW())
)
WITH CHECK (
  plan_type = 'pro' 
  OR (plan_type = 'starter' AND trial_end > NOW())
);

-- Ensure RLS is enabled on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Verify the policy was created (optional, for logging)
-- SELECT * FROM pg_policies WHERE tablename = 'users';