-- Test Script: Verify Users ↔ Organizations Sync
-- Run this in Supabase SQL Editor after migration
-- Assumes service_role or RLS disabled for test

-- 1. Setup test data (cleanup first)
DELETE FROM organization_members WHERE clerk_user_id = 'test_user_123';
DELETE FROM users WHERE clerk_id = 'test_user_123';
DELETE FROM organizations WHERE clerk_org_id = 'test_org_456';

-- Insert test organization
INSERT INTO organizations (clerk_org_id, name) VALUES ('test_org_456', 'Test Org');

-- Insert test user
INSERT INTO users (clerk_id, email, clerk_org_id) VALUES ('test_user_123', 'test@example.com', NULL);

-- 2. Simulate webhook: organizationMembership.created
-- Upsert membership
INSERT INTO organization_members (clerk_user_id, clerk_org_id, role) 
VALUES ('test_user_123', 'test_org_456', 'member')
ON CONFLICT (clerk_user_id, clerk_org_id) DO NOTHING;

-- Update user active org
UPDATE users SET clerk_org_id = 'test_org_456' WHERE clerk_id = 'test_user_123';

-- 3. Verify sync
SELECT 'User Active Org' as test, clerk_org_id FROM users WHERE clerk_id = 'test_user_123';
SELECT 'All Memberships' as test, clerk_user_id, clerk_org_id, role FROM organization_members WHERE clerk_user_id = 'test_user_123';

-- 4. Simulate membership.deleted
DELETE FROM organization_members WHERE clerk_user_id = 'test_user_123' AND clerk_org_id = 'test_org_456';
UPDATE users SET clerk_org_id = NULL WHERE clerk_id = 'test_user_123' AND clerk_org_id = 'test_org_456';

-- Verify cleared
SELECT 'Cleared User Org' as test, clerk_org_id FROM users WHERE clerk_id = 'test_user_123';
SELECT 'Cleared Memberships' as test, COUNT(*) as count FROM organization_members WHERE clerk_user_id = 'test_user_123';

-- Expected Results:
-- - Active org shows 'test_org_456' after join sim
-- - Memberships table shows entry
-- - Cleared after delete sim
-- JWT will include clerk_org_id for activity attribution