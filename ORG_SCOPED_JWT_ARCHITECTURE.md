# Organization-Scoped JWT Token Architecture

## Overview

All token issuers in the system now embed consistent organization attribution claims when a user has an active seat in a Clerk organization. This enables:
- Seat-based licensing enforcement
- Organization-scoped credit pools
- Unified analytics across all token types
- Consistent authorization model

## Token Types

### 1. Long-Lived Extension Tokens (4 months)
- **Endpoints**: [`/api/extension-token/generate`](api/extension-token/generate.js:1), [`/api/extension-token/refresh`](api/extension-token/refresh.js:1)
- **Algorithm**: HS256
- **Type**: `extension_long_lived`
- **Storage**: Hashed with bcrypt in `extension_tokens` table
- **Validation**: [`api/middleware/token-validation.js`](api/middleware/token-validation.js:1) `validateLongLivedToken()`
- **Status**: ✅ **Org attribution implemented** (already completed)

### 2. OAuth-Style Access Tokens (24 hours)
- **Endpoints**:
  - [`/api/extension/auth/token`](api/extension/auth/token.ts:1) (authorization code + refresh flows)
  - [`/api/auth/token`](api/auth/token.ts:1) (refresh flow)
  - [`/api/auth/complete-vscode-auth`](api/auth/complete-vscode-auth.ts:1) (PKCE completion)
  - [`/api/auth/refresh-token`](api/auth/refresh-token.ts:1) (Clerk token refresh)
- **Algorithm**: HS256
- **Type**: `access`
- **Helper**: [`api/utils/jwt.ts`](api/utils/jwt.ts:15) `generateAccessToken()`
- **Validation**: [`api/extension/auth/validate/route.ts`](api/extension/auth/validate/route.ts:32) requires `decoded.type === 'access'`
- **Status**: ✅ **Org attribution implemented** (this session)

### 3. Dashboard Short-Lived Tokens (24 hours)
- **Endpoint**: [`/api/dashboard-token/generate`](api/dashboard-token/generate.ts:1)
- **Algorithm**: HS256
- **Type**: `access`
- **Helper**: [`src/utils/jwt.ts`](src/utils/jwt.ts:15) `generateAccessToken()`
- **Status**: ✅ **Org attribution implemented** (this session)

## Organization Attribution Claims (Seat-Gated)

All tokens now contain the following org-scoped claims when the user has an active seat:

```typescript
{
  // Pool indicator
  pool: 'organization' | 'personal',
  
  // Clerk identifiers
  clerk_org_id: string | null,
  org_role: string | null, // e.g., 'org:admin', 'org:member'
  
  // Supabase identifiers
  organization_id: string | null, // organizations.id (UUID)
  organization_name: string | null,
  organization_subscription_id: string | null,
  
  // Stripe identifiers
  stripe_customer_id: string | null,
  
  // Seat identifiers
  seat_id: string | null,
  seat_role: string | null
}
```

### Claim Resolution Logic

Implemented in [`api/utils/org-attribution.ts`](api/utils/org-attribution.ts:1):

1. **`resolveOrgMembership()`**:
   - Claims-first: Check Clerk JWT `claims.organizations[clerk_org_id]`
   - Fallback: Query Clerk API `users.getOrganizationMembershipList()`
   - Returns: `{ orgRole, source: 'claims' | 'api' }` or `null`

2. **`resolveOrgAttributionClaims()`**:
   - Validates org membership
   - **Seat-gating**: Queries `organization_seats` for active seat (`status='active'`)
   - Fetches `organizations` + `organization_subscriptions` metadata
   - Returns full attribution claims or `null` (personal token)

## Request Flow

### Frontend → Token Issuance

1. **User selects organization** in Clerk `<OrganizationSwitcher>`
2. **Frontend passes** `clerk_org_id: organization?.id` in request body
3. **Backend resolves** org attribution (seat-gated via [`resolveOrgAttributionClaims()`](api/utils/org-attribution.ts:95))
4. **Token minted** with org claims if seat is active, otherwise personal

### Token Usage → Credit Deduction

1. **Extension/client** sends token in `Authorization: Bearer <token>`
2. **Middleware validates** token and extracts claims
3. **Business logic** passes `clerk_org_id` from token claims to [`deduct_credits_pooled()`](supabase/migrations/20251231_pooled_credits_deduction.sql:1)
4. **RPC enforces** org-only deduction (no personal fallback) when `p_clerk_org_id` is provided

## Integration Points

### Token Generators (Updated)

- [`api/extension-token/generate.js`](api/extension-token/generate.js:417) ✅
- [`api/extension-token/refresh.js`](api/extension-token/refresh.js:274) ✅
- [`api/extension/auth/token.ts`](api/extension/auth/token.ts:97) ✅
- [`api/auth/token.ts`](api/auth/token.ts:105) ✅
- [`api/auth/complete-vscode-auth.ts`](api/auth/complete-vscode-auth.ts:107) ✅
- [`api/auth/refresh-token.ts`](api/auth/refresh-token.ts:106) ✅
- [`api/dashboard-token/generate.ts`](api/dashboard-token/generate.ts:62) ✅

### Frontend UI (Updated)

- [`src/components/dashboard/TokenManagement.tsx`](src/components/dashboard/TokenManagement.tsx:1) - passes `organization?.id` ✅
- [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:1) - legacy generator passes `organization?.id` ✅

### Frontend UI (Needs Update)

- [`src/pages/VscodeInitiateAuth.tsx`](src/pages/VscodeInitiateAuth.tsx:27) - Could pass `clerk_org_id` in PKCE initiation
- [`src/pages/ExtensionSignIn.tsx`](src/pages/ExtensionSignIn.tsx:38) - Could pass `clerk_org_id` in auth completion

**Note**: The OAuth flow currently doesn't propagate org context from frontend → backend. The extension would need to be updated to request org-scoped tokens explicitly, or we implement org selection in the auth UI.

## Remaining Work

### 1. Credit Deduction Enforcement ⚠️ CRITICAL

**Problem**: Extension business endpoints must extract `clerk_org_id` from validated token claims and always pass it to [`creditOperations.deductCredits()`](src/utils/supabase/database.ts:300).

**Action Items**:
- Locate all extension API endpoints that call `creditOperations.deductCredits()`
- Update to read `req.auth.clerk_org_id` (from validated token)
- Pass to deduction: `deductCredits(clerkId, amount, description, clerkOrgId)`
- Ensure NO retry on personal if org deduction fails

### 2. Analytics Enhancement

**Current**: [`deduct_credits_pooled()`](supabase/migrations/20251231_pooled_credits_deduction.sql:1) only records `{ clerk_org_id, pool }` in metadata.

**Desired**: Record full attribution for analytics/auditing:
```sql
metadata := jsonb_build_object(
  'clerk_org_id', p_clerk_org_id,
  'organization_id', v_org.id,
  'organization_subscription_id', v_org_sub.id,
  'seat_id', v_seat.id,
  'seat_role', v_seat.role,
  'stripe_customer_id', v_org.stripe_customer_id,
  'pool', 'organization'
);
```

### 3. Validation Middleware Integration

**Current**: [`validateLongLivedToken()`](api/middleware/token-validation.js:1) exists but is only used by token CRUD endpoints for audit logging.

**Action**: Wire into actual extension business endpoints that perform usage/deductions.

### 4. Test Coverage

Update tests to verify:
- Org-scoped tokens contain all attribution fields
- Personal tokens when no seat
- Seat-gating rejects token issuance without active seat
- Deduction fails (no fallback) when org credits insufficient

## Security Considerations

1. **Seat-Gating**: Users without an active seat in the organization cannot mint org-scoped tokens
2. **Claim Verification**: All org attribution is re-validated server-side (not trusted from client)
3. **No Privilege Escalation**: User must be a Clerk org member AND have an active seat
4. **Token Rotation**: Long-lived tokens support refresh+revoke; OAuth tokens expire naturally

## Migration Status

- ✅ `extension_tokens` schema exists in `backend-api-example/migrations/*` (verify production Supabase)
- ✅ `refresh_tokens` table used by OAuth flow (needs schema check)
- ✅ `oauth_codes` table used by PKCE flow (needs schema check)
- ⚠️ `organization_seats`, `organizations`, `organization_subscriptions` required for seat-gating

## Next Steps

1. **Audit extension business endpoints** for credit deduction call sites
2. **Wire validation middleware** into those endpoints  
3. **Enforce org-context deductions** (always pass `clerk_org_id` from token)
4. **Enhance RPC analytics** metadata
5. **Add comprehensive tests**