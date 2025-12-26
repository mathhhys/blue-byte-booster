# Organization Invitation Count Fix - Implementation Summary

## Problem Statement

Organization member counts and pending invitation counts were not being properly tracked in Supabase because:

1. **Clerk API Issue**: The organization object from Clerk doesn't automatically include `membersCount` and `pendingInvitationsCount` properties
2. **Missing Database Functions**: Webhook handlers referenced RPC functions that didn't exist (`increment_invitation_count`)
3. **No Active Fetching**: Sync endpoints didn't actually fetch the counts from Clerk - they just tried to read non-existent properties

## Solution Implemented: Hybrid Approach

We've implemented a **hybrid webhook + sync** approach that provides:
- ✅ **Fast performance** via webhook-based automatic updates
- ✅ **Self-healing capability** via sync endpoints that fetch real counts
- ✅ **Reliability** through dual-path tracking

---

## Files Changed

### 1. Database Migration
**File**: [`supabase/migrations/20251226_fix_invitation_counts.sql`](supabase/migrations/20251226_fix_invitation_counts.sql)

**New RPC Functions Added**:
- `update_member_count(clerk_org_id, delta)` - Increment/decrement member count
- `update_invitation_count(clerk_org_id, delta)` - Increment/decrement invitation count
- `sync_organization_counts(clerk_org_id, members, invitations)` - Set exact counts (for sync/recovery)

**Also Added**:
- Index on `organizations.clerk_org_id` for faster lookups
- Documentation comments for each function

### 2. Webhook Handler Updates
**File**: [`api/clerk/webhooks.ts`](api/clerk/webhooks.ts)

**Events Now Tracked**:
| Event | Action | Count Updated |
|-------|--------|---------------|
| `organizationInvitation.created` | Reserve seat | `pending_invitations_count++` |
| `organizationInvitation.accepted` | Prepare for member | `pending_invitations_count--` |
| `organizationInvitation.revoked` | Release seat | `pending_invitations_count--` |
| `organizationMembership.created` | Activate member | `members_count++` |
| `organizationMembership.deleted` | Revoke member | `members_count--` |

**Changes Made**:
- Split `organizationInvitation.revoked` and `organizationInvitation.accepted` into separate handlers
- Added count tracking to all 5 webhook handlers
- Changed from non-existent `increment_invitation_count` to new `update_invitation_count` and `update_member_count` functions

### 3. Sync Endpoint Updates
**Files**: 
- [`api/organizations/sync-subscription.ts`](api/organizations/sync-subscription.ts)
- [`api/organizations/invite.ts`](api/organizations/invite.ts)

**Changes to `syncOrganizationFromClerk()`**:
- Now calls `clerk.organizations.getOrganizationMembershipList()` to get actual member count
- Now calls `clerk.organizations.getOrganizationInvitationList()` to get actual pending invitation count
- Stores real counts in Supabase via `upsert_organization`

**Benefits**:
- Sync endpoint can now recover from any webhook drift
- Provides validation that counts are accurate
- Acts as fallback if webhooks fail

---

## How It Works

### Normal Operation (Webhook-based)
```
1. User sends invitation in Clerk
   ↓
2. Clerk fires organizationInvitation.created webhook
   ↓
3. Webhook handler calls update_invitation_count(org_id, +1)
   ↓
4. Counter incremented in Supabase (fast!)
```

### Recovery/Sync Operation
```
1. Admin calls /api/organizations/sync-subscription
   ↓
2. Endpoint fetches real counts from Clerk API
   ↓
3. Calls upsert_organization with actual counts
   ↓
4. Database updated with authoritative counts
```

---

## Deployment Steps

### Step 1: Apply Database Migration ✅ (Ready)
```bash
# The migration file has been created
supabase/migrations/20251226_fix_invitation_counts.sql

# Apply it to your Supabase instance:
# Option A: Through Supabase Dashboard
# - Go to SQL Editor
# - Copy and paste the migration content
# - Run it

# Option B: Through Supabase CLI (if configured)
supabase db push
```

### Step 2: Deploy Code Changes ✅ (Ready)
The following files have been updated and are ready to deploy:
- `api/clerk/webhooks.ts` - Enhanced webhook handlers
- `api/organizations/sync-subscription.ts` - Real count fetching
- `api/organizations/invite.ts` - Real count fetching

Deploy these to your hosting environment (Vercel, etc.)

### Step 3: Verify Clerk Webhook Configuration
Ensure your Clerk webhook endpoint is properly configured:

1. Go to Clerk Dashboard → Webhooks
2. Verify endpoint URL points to: `https://your-domain.com/api/clerk/webhooks`
3. Ensure these events are enabled:
   - `organizationInvitation.created`
   - `organizationInvitation.accepted`
   - `organizationInvitation.revoked`
   - `organizationMembership.created`
   - `organizationMembership.deleted`

### Step 4: Initialize Existing Organizations (One-time)
For any existing organizations, run the sync endpoint to populate initial counts:

```bash
# For each organization in your system:
curl -X POST https://your-domain.com/api/organizations/sync-subscription \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orgId": "org_xxx"}'
```

---

## Testing Checklist

### Database Functions
- [ ] Verify migration applied successfully
- [ ] Test `update_member_count` with positive delta
- [ ] Test `update_member_count` with negative delta
- [ ] Test `update_invitation_count` with positive delta
- [ ] Test `update_invitation_count` with negative delta
- [ ] Verify counts never go below 0 (GREATEST function works)

### Webhook Events
- [ ] Create invitation in Clerk → verify `pending_invitations_count` increments
- [ ] Revoke invitation in Clerk → verify `pending_invitations_count` decrements
- [ ] Accept invitation → verify `pending_invitations_count` decrements
- [ ] New member joins → verify `members_count` increments
- [ ] Member leaves → verify `members_count` decrements

### Sync Endpoint
- [ ] Call sync endpoint for an organization
- [ ] Verify counts match actual Clerk counts
- [ ] Test sync after manual changes to verify recovery

### Edge Cases
- [ ] Test with organization that has 0 members
- [ ] Test with organization that has 0 pending invitations
- [ ] Test sync when Clerk API call fails (should handle gracefully)
- [ ] Test webhook when organization not found (should log warning)

---

## Monitoring & Validation

### Check Count Accuracy
```sql
-- View current counts in Supabase
SELECT 
  clerk_org_id,
  name,
  members_count,
  pending_invitations_count,
  updated_at
FROM organizations
ORDER BY updated_at DESC;
```

### Validate Against Clerk
Use the sync endpoint periodically to verify counts match Clerk:
```bash
# This will fetch real counts and update if drift detected
POST /api/organizations/sync-subscription
{
  "orgId": "org_xxx"
}
```

### Monitor Webhook Processing
Check logs for webhook events:
```
✅ Invitation count incremented for org org_xxx
✅ Member count incremented for org org_xxx
```

---

## Rollback Plan (if needed)

If issues arise, you can rollback by:

1. **Revert code changes** (webhook handlers and sync functions)
2. **Keep database migration** (the new functions won't cause harm if unused)
3. **Manually set counts** if needed:
   ```sql
   UPDATE organizations 
   SET 
     members_count = X,
     pending_invitations_count = Y
   WHERE clerk_org_id = 'org_xxx';
   ```

---

## Future Enhancements

Potential improvements to consider:

1. **Periodic Background Sync**: Schedule a daily/hourly job to sync all organizations
2. **Count Validation Alerts**: Alert if counts drift beyond threshold
3. **Health Check Endpoint**: API endpoint to validate count accuracy
4. **Dashboard Widget**: Display member/invitation counts in admin UI

---

## Support & Troubleshooting

### Common Issues

**Issue**: Counts not updating after webhook
- **Check**: Verify webhook events are being received (check logs)
- **Check**: Verify database functions exist (run `\df update_*` in psql)
- **Fix**: Run sync endpoint to recover

**Issue**: Counts are incorrect
- **Check**: Compare with Clerk dashboard
- **Fix**: Run sync endpoint to correct from Clerk API

**Issue**: Migration fails
- **Check**: Verify `organizations` table has `members_count` and `pending_invitations_count` columns
- **Fix**: Run previous migration [`20251226_add_members_count_to_organizations.sql`](supabase/migrations/20251226_add_members_count_to_organizations.sql) first

---

## Summary

This implementation provides a robust, self-healing solution for tracking organization member and invitation counts:

- **Primary tracking**: Webhooks update counts in real-time (fast, efficient)
- **Backup tracking**: Sync endpoints fetch real counts from Clerk (accurate, recovery)
- **Resilient**: Can recover from webhook failures or drift
- **Performant**: Counts stored in Supabase for fast reads
- **Maintainable**: Clear separation between webhook and sync logic

The hybrid approach gives you the best of both worlds: performance AND accuracy.