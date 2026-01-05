# Organization-Scoped JWT Implementation Summary

## Date: 2026-01-05

## What Was Implemented

### 1. Unified Org Attribution Helper
**File**: [`api/utils/org-attribution.ts`](api/utils/org-attribution.ts:1)

- `resolveOrgMembership()`: Claims-first Clerk org membership check with API fallback
- `resolveOrgAttributionClaims()`: Seat-gated org attribution resolver
  - Validates Clerk org membership
  - Requires `organization_seats.status='active'`
  - Fetches `organizations` + `organization_subscriptions` metadata
  - Returns full attribution or `null` (personal token)

### 2. Token Generator Updates

All token issuers now accept optional `clerk_org_id` and embed seat-gated org claims:

#### Long-Lived Extension Tokens (Already Complete)
- [`api/extension-token/generate.js`](api/extension-token/generate.js:417) ✅
- [`api/extension-token/refresh.js`](api/extension-token/refresh.js:274) ✅

#### OAuth-Style Access Tokens (Newly Updated)
- [`api/extension/auth/token.ts`](api/extension/auth/token.ts:97) ✅
  - `handleAuthorizationCode()` accepts `clerk_org_id` param
  - `handleRefreshToken()` accepts `clerk_org_id` param
- [`api/auth/token.ts`](api/auth/token.ts:105) ✅
  - Refresh flow resolves org attribution
- [`api/auth/complete-vscode-auth.ts`](api/auth/complete-vscode-auth.ts:107) ✅
  - PKCE completion embeds org claims
- [`api/auth/refresh-token.ts`](api/auth/refresh-token.ts:106) ✅
  - Clerk token refresh embeds org claims

#### Dashboard Tokens (Newly Updated)
- [`api/dashboard-token/generate.ts`](api/dashboard-token/generate.ts:62) ✅
  - Accepts `clerk_org_id` from request body
  - Uses Clerk claims for faster membership check

### 3. JWT Helper Updates

Both [`api/utils/jwt.ts`](api/utils/jwt.ts:15) and [`src/utils/jwt.ts`](src/utils/jwt.ts:15) `generateAccessToken()`:
- Added `orgAttribution` optional parameter
- Added `type: 'access'` for compatibility with [`/api/extension/auth/validate/route.ts`](api/extension/auth/validate/route.ts:32)
- Embeds `pool` + 8 org attribution fields (clerk_org_id, organization_id UUID, organization_name, stripe_customer_id, organization_subscription_id, seat_id, seat_role, org_role)

### 4. Database Migration

**File**: [`supabase/migrations/20260105_enhance_pooled_credits_metadata.sql`](supabase/migrations/20260105_enhance_pooled_credits_metadata.sql:1)

Enhanced [`deduct_credits_pooled()`](supabase/migrations/20260105_enhance_pooled_credits_metadata.sql:5) RPC to record full attribution:
- Fetches organization metadata (id, name, stripe_customer_id)
- Fetches seat metadata (id, role)
- Records in `credit_transactions.metadata`:
  ```jsonb
  {
    "pool": "organization",
    "clerk_org_id": "org_2...",
    "organization_id": "uuid",
    "organization_name": "Acme Inc",
    "stripe_customer_id": "cus_...",
    "organization_subscription_id": "uuid",
    "seat_id": "uuid",
    "seat_role": "member"
  }
  ```

### 5. Documentation

- [`ORG_SCOPED_JWT_ARCHITECTURE.md`](ORG_SCOPED_JWT_ARCHITECTURE.md:1) - Technical architecture overview
- [`EXTENSION_ORG_INTEGRATION_GUIDE.md`](EXTENSION_ORG_INTEGRATION_GUIDE.md:1) - Extension integration guide

## Token Claim Schema

All tokens now follow this schema:

```typescript
// Common to all token types
{
  sub: string;              // Clerk user ID
  email: string;
  type: 'access' | 'extension_long_lived';
  iat: number;
  exp: number;
  iss: 'softcodes.ai';
  aud: 'vscode-extension';
  
  // Pool indicator (always present)
  pool: 'organization' | 'personal';
  
  // Org attribution (seat-gated, null when pool='personal')
  clerk_org_id: string | null;
  organization_id: string | null;        // Supabase organizations.id UUID
  organization_name: string | null;
  stripe_customer_id: string | null;
  organization_subscription_id: string | null;  // Supabase UUID
  seat_id: string | null;
  seat_role: string | null;
  org_role: string | null;               // Clerk role (org:admin, org:member)
}
```

## Backend Integration Requirements

### For Extension Business Endpoints (Future Work)

When implementing endpoints that consume credits (e.g., `/api/extension/generate`, `/api/extension/chat`):

```typescript
import { validateLongLivedToken } from '../middleware/token-validation.js';
import { creditOperations } from '@/utils/supabase/database.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Validate token (attaches req.auth with decoded claims)
  await validateLongLivedToken(req, res);
  
  // 2. Extract org context from validated token
  const decoded = req.auth.decoded;
  const clerkOrgId = decoded.pool === 'organization' ? decoded.clerk_org_id : null;
  
  // 3. Perform business logic
  const result = await performOperation(req.body);
  
  // 4. Deduct credits (CRITICAL: always pass clerkOrgId from token)
  const deducted = await creditOperations.deductCredits(
    req.auth.clerkUserId,
    costInCredits,
    'Operation description',
    clerkOrgId  // ⚠️ Always pass from validated token, never from request body
  );
  
  if (!deducted) {
    return res.status(402).json({ 
      error: 'Insufficient credits',
      pool: decoded.pool,
      organization_name: decoded.organization_name
    });
  }
  
  return res.status(200).json({ result });
}
```

## Frontend Integration Requirements

### Token Generation UI (Already Updated)

- [`src/components/dashboard/TokenManagement.tsx`](src/components/dashboard/TokenManagement.tsx:1) ✅
- [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:1) ✅

Both now pass `organization?.id` when generating/refreshing tokens.

### OAuth Flow (Requires Extension Update)

The PKCE/OAuth flow ([`VscodeInitiateAuth.tsx`](src/pages/VscodeInitiateAuth.tsx:1), [`ExtensionSignIn.tsx`](src/pages/ExtensionSignIn.tsx:1)) does not currently propagate org context. Options:

1. **Extension-driven**: Extension sends `clerk_org_id` in auth initiation URL params
2. **UI-driven**: Add org selection to the auth callback page before completing flow
3. **Post-auth**: Extension requests new token with org context after initial auth

## Critical Rules (Enforcement Complete)

### ✅ Implemented
1. Tokens are only org-scoped if user is Clerk org member AND has active seat
2. Org attribution claims are server-side validated (never trusted from client)
3. RPC enforces no personal fallback when `p_clerk_org_id` is provided
4. All token issuers use consistent claim schema

### ⚠️ Requires Extension Integration
1. Extension must extract `clerk_org_id` from validated token claims
2. Extension business endpoints must pass `clerk_org_id` to credit deduction
3. Extension must handle 402 errors for insufficient org credits

## Testing Status

### Existing Tests (Need Updates)
- [`src/_tests_/api/organization-credits.test.ts`](src/_tests_/api/organization-credits.test.ts:1) - verify org credits endpoint
- [`src/_tests_/api/pooled-credits.test.ts`](src/_tests_/api/pooled-credits.test.ts:1) - verify deduction behavior

### New Tests Needed
- Verify org-scoped token claims (all generators)
- Verify seat-gating rejects token issuance without active seat
- Verify deduction fails (no fallback) when org credits insufficient
- Verify analytics metadata contains full attribution

## Database Schema Status

### Confirmed Tables
- ✅ `users` - personal credits
- ✅ `organizations` - org metadata
- ✅ `organization_seats` - seat status
- ✅ `organization_subscriptions` - pooled credits
- ✅ `credit_transactions` - deduction records
- ✅ `extension_tokens` - long-lived token hashes (in `backend-api-example/migrations`, verify production)
- ⚠️ `refresh_tokens` - OAuth refresh tokens (used by code, may need migration)
- ⚠️ `oauth_codes` - PKCE sessions (used by code, may need migration)

## Deployment Checklist

1. **Apply Database Migration**:
   ```bash
   # Apply enhanced pooled credits metadata
   supabase db push
   ```

2. **Verify Environment Variables**:
   - `JWT_SECRET` - for HS256 token signing
   - `CLERK_SECRET_KEY` - for Clerk API and token verification
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - for database access

3. **Verify Token Validators**:
   - Long-lived: [`api/middleware/token-validation.js`](api/middleware/token-validation.js:1)
   - OAuth access: [`api/extension/auth/validate/route.ts`](api/extension/auth/validate/route.ts:1)

4. **Update Extension** (VSCode):
   - Parse token claims to detect `pool` and `organization_name`
   - Show org context in UI
   - Handle 402 errors with org-specific messaging
   - Extract `clerk_org_id` from token for API calls

5. **Monitor Analytics**:
   - Query `credit_transactions.metadata` for org usage patterns
   - Track seat utilization via `seat_id` in transaction logs

## Migration Path (Completed in this Session)

1. ✅ Created [`api/utils/org-attribution.ts`](api/utils/org-attribution.ts:1) with seat-gating logic
2. ✅ Updated [`api/utils/jwt.ts`](api/utils/jwt.ts:15) `generateAccessToken()` to accept org attribution
3. ✅ Updated [`src/utils/jwt.ts`](src/utils/jwt.ts:15) (duplicate) with same signature
4. ✅ Integrated into [`api/extension/auth/token.ts`](api/extension/auth/token.ts:1) (OAuth flow)
5. ✅ Integrated into [`api/auth/token.ts`](api/auth/token.ts:1) (refresh flow)
6. ✅ Integrated into [`api/auth/complete-vscode-auth.ts`](api/auth/complete-vscode-auth.ts:1) (PKCE completion)
7. ✅ Integrated into [`api/auth/refresh-token.ts`](api/auth/refresh-token.ts:1) (Clerk refresh)
8. ✅ Integrated into [`api/dashboard-token/generate.ts`](api/dashboard-token/generate.ts:1) (dashboard tokens)
9. ✅ Created [`supabase/migrations/20260105_enhance_pooled_credits_metadata.sql`](supabase/migrations/20260105_enhance_pooled_credits_metadata.sql:1)
10. ✅ Long-lived tokens already implemented in prior session

## Status: Backend Implementation Complete ✅

The backend is now fully prepared for organization-scoped billing. The VSCode extension needs to be updated to:
1. Send `clerk_org_id` when requesting tokens
2. Parse token claims to show org context
3. Extract `clerk_org_id` from tokens for business API calls (when extension business endpoints are created)

See [`EXTENSION_ORG_INTEGRATION_GUIDE.md`](EXTENSION_ORG_INTEGRATION_GUIDE.md:1) for detailed extension integration instructions.