# VSCode Extension Organization Integration Guide

## Overview

The backend now issues tokens with organization attribution claims (seat-gated). This guide explains how the VSCode extension should integrate with these tokens to enable org-scoped credit pooling.

## Token Claims Structure

All tokens now contain these additional org-scoped claims when the user has an active seat:

```typescript
interface TokenClaims {
  // Standard claims
  sub: string;              // Clerk user ID
  email: string;
  type: 'access' | 'extension_long_lived';
  iat: number;
  exp: number;
  iss: 'softcodes.ai';
  aud: 'vscode-extension';
  
  // Pool indicator
  pool: 'organization' | 'personal';
  
  // Org attribution (null when pool='personal')
  clerk_org_id: string | null;
  organization_id: string | null;        // Supabase UUID
  organization_name: string | null;
  stripe_customer_id: string | null;
  organization_subscription_id: string | null;
  seat_id: string | null;
  seat_role: string | null;
  org_role: string | null;
}
```

## Extension Implementation Steps

### 1. Request Org-Scoped Tokens

When the user selects an organization in their extension settings:

```typescript
// Extension: Request long-lived token with org context
const response = await fetch(`${API_URL}/api/extension-token/generate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkSessionToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deviceName: 'VSCode Extension',
    clerk_org_id: selectedOrgId  // From user's org selection
  })
});

const { access_token } = await response.json();
```

**Result**: Token will contain org claims if user has active seat, otherwise personal claims.

### 2. Store and Parse Token Claims

```typescript
// Extension: Parse token to determine pool
import * as jwt from 'jsonwebtoken';

const decoded = jwt.decode(accessToken) as TokenClaims;

// Determine credit pool
if (decoded.pool === 'organization' && decoded.clerk_org_id) {
  console.log(`Using ${decoded.organization_name} credits`);
  console.log(`Your seat role: ${decoded.seat_role}`);
  // Store org context for API calls
  await context.globalState.update('current_org_id', decoded.clerk_org_id);
  await context.globalState.update('pool_type', 'organization');
} else {
  console.log('Using personal credits');
  await context.globalState.update('pool_type', 'personal');
}
```

### 3. Pass Org Context to Business Endpoints

When calling credit-consuming operations (code completions, chat, etc.):

```typescript
// Extension: Make API call with org-attributed token
const response = await fetch(`${API_URL}/api/extension/generate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: userPrompt,
    // Future business endpoints will extract clerk_org_id from token claims
  })
});
```

### 4. Backend Business Endpoint Pattern

**REQUIRED**: Extension business endpoints must extract `clerk_org_id` from validated tokens:

```typescript
// Backend: api/extension/generate.ts (example)
import { validateLongLivedToken } from '../middleware/token-validation.js';
import { creditOperations } from '@/utils/supabase/database.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate token and attach req.auth
  await validateLongLivedToken(req, res);
  
  const { prompt } = req.body;
  const clerkUserId = req.auth.clerkUserId;
  
  // Extract org context from token claims
  // Tokens validated by validateLongLivedToken have decoded claims available
  const decoded = req.auth.decoded;
  const clerkOrgId = decoded.pool === 'organization' ? decoded.clerk_org_id : null;
  
  try {
    // Perform AI operation
    const result = await generateCode(prompt);
    
    // Deduct credits (org-scoped if token has org context)
    const deducted = await creditOperations.deductCredits(
      clerkUserId,
      10, // cost
      'Code generation',
      clerkOrgId  // ⚠️ CRITICAL: Always pass from token
    );
    
    if (!deducted) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        pool: decoded.pool
      });
    }
    
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ error: 'Generation failed' });
  }
}
```

### 5. Handle Insufficient Credits

```typescript
// Extension: Handle org credit exhaustion
if (response.status === 402) {
  const { error, pool } = await response.json();
  
  if (pool === 'organization') {
    vscode.window.showErrorMessage(
      `${organizationName} has insufficient credits. An admin needs to top up the organization credit pool.`,
      'View Billing'
    ).then(selection => {
      if (selection === 'View Billing') {
        // Open dashboard billing page
        vscode.env.openExternal(vscode.Uri.parse(
          `${DASHBOARD_URL}/teams?org=${orgId}`
        ));
      }
    });
  } else {
    vscode.window.showErrorMessage(
      'Insufficient personal credits. Please top up your account.',
      'Add Credits'
    );
  }
}
```

## Critical Rules

### ✅ DO

1. **Always extract `clerk_org_id` from validated token claims** (not from request body)
2. **Always pass `clerk_org_id` to `creditOperations.deductCredits()`** when present in token
3. **Never fallback to personal credits** if org pool is insufficient
4. **Show user the organization name** from `organization_name` claim
5. **Validate tokens** using appropriate middleware before accessing claims

### ❌ DON'T

1. **Never trust `clerk_org_id` from request body** - always use validated token claims
2. **Never retry personal** when org deduction returns false
3. **Never assume org credits** without checking `pool === 'organization'`
4. **Never mint org tokens** without active seat verification (backend already enforces this)

## Middleware Integration

The [`validateLongLivedToken()`](api/middleware/token-validation.js:1) middleware should be used for extension business endpoints:

```typescript
// Backend: Protect endpoint with long-lived token validation
import { validateLongLivedToken } from '../middleware/token-validation.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // This attaches req.auth with { userId, clerkUserId, tokenId, decoded }
  const validationResult = await new Promise((resolve) => {
    validateLongLivedToken(req, res, () => resolve(true));
  });
  
  if (!validationResult || res.headersSent) {
    return; // Validation failed, response already sent
  }
  
  // req.auth.decoded now contains all token claims including org attribution
  const { pool, clerk_org_id } = req.auth.decoded;
  
  // Use clerk_org_id for credit deductions...
}
```

## OAuth vs Long-Lived Tokens

### Long-Lived Tokens (Recommended for Production)
- **Type**: `extension_long_lived`
- **Validity**: 4 months
- **Validation**: [`api/middleware/token-validation.js`](api/middleware/token-validation.js:1)
- **Storage**: Hashed in `extension_tokens` table
- **Refresh**: Via [`/api/extension-token/refresh`](api/extension-token/refresh.js:1)

### OAuth Access Tokens (Alternative)
- **Type**: `access`
- **Validity**: 24 hours
- **Validation**: [`api/extension/auth/validate/route.ts`](api/extension/auth/validate/route.ts:1)
- **Refresh**: Via OAuth refresh token flow

Both token types now contain identical org attribution claims.

## Frontend Org Selection

The extension should provide a UI for users to select which organization context to use:

```typescript
// Extension: Allow user to select organization
const orgs = await clerk.user.organizationMemberships;

const selectedOrg = await vscode.window.showQuickPick(
  [
    { label: 'Personal Account', value: null },
    ...orgs.map(m => ({
      label: m.organization.name,
      value: m.organization.id
    }))
  ],
  { placeHolder: 'Select credit pool to use' }
);

// Request new token with org context
if (selectedOrg?.value) {
  await requestOrgScopedToken(selectedOrg.value);
} else {
  await requestPersonalToken();
}
```

## Analytics & Auditing

When org-scoped

 credits are used, the backend RPC stores:

```json
{
  "clerk_org_id": "org_2abc...",
  "pool": "organization"
}
```

**Planned Enhancement**: Full attribution metadata including:
- `organization_id` (UUID)
- `organization_subscription_id` (UUID)
- `seat_id`, `seat_role`
- `stripe_customer_id`

## Testing Checklist

- [ ] Extension can request org-scoped tokens
- [ ] Extension can request personal tokens
- [ ] Extension parses token claims correctly
- [ ] Extension shows org name from token
- [ ] Extension handles 402 (insufficient credits) for org pool
- [ ] Backend never fallbacks to personal when org context present
- [ ] Backend validates seat status before minting org tokens
- [ ] Analytics correctly attribute org usage

## Migration Notes

The following database tables must exist:
- `extension_tokens` (for long-lived token hashes)
- `refresh_tokens` (for OAuth refresh flow)
- `organization_seats` (for seat-gating)
- `organizations` (for org metadata)
- `organization_subscriptions` (for pooled credits)

See [`backend-api-example/migrations/`](backend-api-example/migrations/) for reference schemas.