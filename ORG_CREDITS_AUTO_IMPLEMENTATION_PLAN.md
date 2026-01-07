# Organization Credits Auto-Assignment Implementation Plan

## Overview
Mirror personal `users.credits` flow for orgs:
- Add `total_credits`, `used_credits` to `organizations` table.
- Stripe webhooks grant 500/seat monthly (6000 yearly) to `organizations.total_credits` on sub create/update/payment.
- Migrate data from `organization_subscriptions.total_credits` to `organizations.total_credits`.

## Database Changes
### 1. Migration: `supabase/migrations/20260107_add_organization_credits.sql`
```sql
-- Add columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS total_credits INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS used_credits INTEGER DEFAULT 0;

-- Add constraints
ALTER TABLE organizations ADD CONSTRAINT org_credits_check CHECK (total_credits >= 0 AND used_credits >= 0 AND used_credits <= total_credits);

-- Data migration
UPDATE organizations o
SET 
  total_credits = os.total_credits,
  used_credits = os.used_credits
FROM organization_subscriptions os
WHERE o.clerk_org_id = os.clerk_org_id;

-- Reset old columns (optional, or keep for compatibility)
-- UPDATE organization_subscriptions SET total_credits = 0, used_credits = 0;
```

## API Changes
### 2. Stripe Webhooks: `api/stripe/webhooks.js`
Update `handleSubscriptionCreated`, `handleSubscriptionUpdated`, and `handleInvoicePaymentSucceeded` to update `organizations` table instead of `organization_subscriptions`.

## Frontend Changes
### 3. Types: `src/types/database.ts`
Update `organizations` table definition.

### 4. Billing Utils: `src/utils/organization/billing.ts`
Update `getOrgCredits` to fetch from `organizations` table.

## Testing
### 5. Test File: `src/_tests_/api/org-credits-auto.test.ts`
Create a test suite to simulate Stripe webhooks and verify `organizations` table updates.