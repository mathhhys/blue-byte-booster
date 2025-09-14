-- Temporary fix: Allow service role to bypass RLS for users table
-- Run this in your Supabase SQL editor

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create more permissive policy that allows service role access
CREATE POLICY "Users can view own profile or service role access" ON users
  FOR SELECT USING (
    clerk_id = auth.jwt() ->> 'sub' 
    OR auth.role() = 'service_role'
    OR auth.jwt() IS NULL  -- Allow for service role without JWT
  );

-- Also update the update policy
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile or service role access" ON users
  FOR UPDATE USING (
    clerk_id = auth.jwt() ->> 'sub' 
    OR auth.role() = 'service_role'
    OR auth.jwt() IS NULL  -- Allow for service role without JWT
  );