# Deployment Checklist - Organization Invitation Count Fix

## Pre-Deployment

- [ ] Review all code changes:
  - [`supabase/migrations/20251226_fix_invitation_counts.sql`](supabase/migrations/20251226_fix_invitation_counts.sql)
  - [`api/clerk/webhooks.ts`](api/clerk/webhooks.ts)
  - [`api/organizations/sync-subscription.ts`](api/organizations/sync-subscription.ts)
  - [`api/organizations/invite.ts`](api/organizations/invite.ts)

- [ ] Backup current database (just in case)
- [ ] Test migration on staging/development environment first

## Deployment Steps

### 1. Database Migration
- [ ] Apply migration to Supabase:
  ```sql
  -- Copy content from supabase/migrations/20251226_fix_invitation_counts.sql
  -- and run in Supabase SQL Editor
  ```

- [ ] Verify functions created:
  ```sql
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_name IN (
    'update_member_count',
    'update_invitation_count',
    'sync_organization_counts'
  );
  ```
  Should return 3 rows.

### 2. Deploy Code Changes
- [ ] Commit changes to git:
  ```bash
  git add .
  git commit -m "Fix: Properly track organization member and invitation counts
  
  - Add RPC functions for count management
  - Update webhooks to track count changes
  - Enhance sync endpoints to fetch real counts from Clerk
  - Implements hybrid webhook + sync approach"
  ```

- [ ] Deploy to production (e.g., Vercel):
  ```bash
  git push origin main
  # Or trigger manual deployment
  ```

- [ ] Wait for deployment to complete

### 3. Verify Clerk Webhooks
- [ ] Check Clerk Dashboard → Webhooks
- [ ] Ensure webhook URL is correct: `https://your-domain.com/api/clerk/webhooks`
- [ ] Verify these events are enabled:
  - [x] `organizationInvitation.created`
  - [x] `organizationInvitation.accepted`
  - [x] `organizationInvitation.revoked`
  - [x] `organizationMembership.created`
  - [x] `organizationMembership.deleted`

### 4. Initialize Existing Organizations
- [ ] Get list of all organizations:
  ```sql
  SELECT clerk_org_id FROM organizations;
  ```

- [ ] For each organization, run sync:
  ```bash
  curl -X POST https://your-domain.com/api/organizations/sync-subscription \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"orgId": "org_XXXX"}'
  ```

- [ ] Verify counts updated in database:
  ```sql
  SELECT clerk_org_id, members_count, pending_invitations_count 
  FROM organizations;
  ```

## Post-Deployment Testing

### Test Webhook Events
- [ ] Create a test invitation in Clerk
- [ ] Check logs for: `✅ Invitation count incremented`
- [ ] Verify count in database increased

- [ ] Accept the invitation
- [ ] Check logs for: `✅ Invitation count decremented` and `✅ Member count incremented`
- [ ] Verify counts updated correctly

- [ ] Remove the member
- [ ] Check logs for: `✅ Member count decremented`
- [ ] Verify count decreased

### Test Sync Endpoint
- [ ] Call sync endpoint manually
- [ ] Verify it fetches real counts from Clerk
- [ ] Confirm counts match Clerk dashboard

### Monitor for Issues
- [ ] Watch application logs for webhook processing
- [ ] Check for any error messages
- [ ] Verify no regressions in existing functionality

## Rollback Plan (if needed)

If critical issues occur:

1. [ ] Revert code deployment:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. [ ] Database migration can stay (doesn't cause harm)

3. [ ] Manually fix any incorrect counts if needed:
   ```sql
   -- Get correct counts from Clerk dashboard
   UPDATE organizations 
   SET members_count = X, pending_invitations_count = Y
   WHERE clerk_org_id = 'org_XXX';
   ```

## Success Criteria

✅ All checklist items completed
✅ No errors in application logs
✅ Counts match Clerk dashboard
✅ Webhooks processing successfully
✅ Sync endpoint returns correct counts

## Notes

- Keep monitoring logs for first 24-48 hours
- Document any issues encountered
- Update this checklist if new steps needed

---

**Deployed By**: _________________  
**Date**: _________________  
**Sign-off**: _________________