# Dashboard Token Authentication Fix

## Problem Summary

The dashboard token generation feature was failing with multiple errors:

1. **Browser Compatibility Error**: `ReferenceError: Buffer is not defined`
2. **Wrong Endpoint Error**: `400 Bad Request - Invalid grant_type`
3. **Authentication Flow Mismatch**: Dashboard was calling VSCode OAuth endpoint instead of dashboard token endpoint
4. **Clerk Token Verification Error**: `Failed to resolve JWK during verification` - Wrong environment variable used

## Root Cause Analysis

### Issue 1: Browser Incompatibility
**Location**: [`src/pages/Dashboard.tsx:263`](src/pages/Dashboard.tsx:263)

```typescript
// ❌ BEFORE (Node.js only)
const payloadJson = Buffer.from(payloadB64, 'base64').toString();
```

**Problem**: `Buffer` is a Node.js API not available in browser environments, causing runtime errors when trying to decode JWT payloads for debugging.

### Issue 2: Wrong Endpoint Called
**Location**: [`src/pages/Dashboard.tsx:282`](src/pages/Dashboard.tsx:282)

```typescript
// ❌ BEFORE (Wrong endpoint)
const response = await fetch('/api/extension/auth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  }
});
```

**Problem**: The dashboard was calling [`/api/extension/auth/token`](api/extension/auth/token.ts:1) which expects OAuth2 flow parameters (`grant_type`, `code`, `code_verifier`) but dashboard only provided Authorization header.

### Issue 3: Incorrect Clerk Verification Parameter
**Location**: [`api/dashboard-token/generate.ts:18`](api/dashboard-token/generate.ts:18)

```typescript
// ❌ BEFORE (Wrong parameter)
const claims = await verifyToken(clerkToken, {
  jwtKey: process.env.CLERK_JWT_KEY!  // This env var doesn't exist!
});
```

**Problem**: Using `jwtKey` parameter with non-existent `CLERK_JWT_KEY` environment variable. The correct parameter is `secretKey` with `CLERK_SECRET_KEY`.

### Issue 4: Architecture Mismatch

The project has **two distinct token generation flows**:

#### Dashboard Flow (for web users)
- **Endpoint**: [`/api/dashboard-token/generate`](api/dashboard-token/generate.ts:1)
- **Auth Method**: Clerk Bearer token in Authorization header
- **Purpose**: Generate JWT for VSCode extension from web dashboard
- **Request**: Authorization header only, no body

#### VSCode Extension Flow (OAuth2)
- **Endpoint**: [`/api/extension/auth/token`](api/extension/auth/token.ts:1)
- **Auth Method**: OAuth2 authorization code flow with PKCE
- **Purpose**: Direct VSCode extension authentication
- **Request**: `grant_type`, `code`, `code_verifier` in body

## Solutions Implemented

### Fix 1: Browser-Compatible Base64 Decoding
**File**: [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:264)

```typescript
// ✅ AFTER (Browser-compatible)
const payloadJson = atob(payloadB64);
```

**Changes**:
- Replaced `Buffer.from(payloadB64, 'base64').toString()` with native `atob(payloadB64)`
- `atob()` is a standard browser API for base64 decoding
- Maintains token inspection functionality for debugging

### Fix 2: Correct Clerk Token Verification
**File**: [`api/dashboard-token/generate.ts`](api/dashboard-token/generate.ts:18)

```typescript
// ✅ AFTER (Correct parameter)
const claims = await verifyToken(clerkToken, {
  secretKey: process.env.CLERK_SECRET_KEY!
});
```

**Changes**:
- Changed from `jwtKey: process.env.CLERK_JWT_KEY` to `secretKey: process.env.CLERK_SECRET_KEY`
- Uses the correct environment variable that exists in the project
- Matches verification pattern used in [`api/extension/auth/validate.ts`](api/extension/auth/validate.ts:17)

### Fix 3: Correct Endpoint Usage
**File**: [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:283)

```typescript
// ✅ AFTER (Correct endpoint)
const response = await fetch('/api/dashboard-token/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  }
});
```

**Changes**:
- Changed endpoint from `/api/extension/auth/token` to `/api/dashboard-token/generate`
- Aligns with intended dashboard authentication architecture
- Uses proper Clerk token verification flow

### Fix 4: Request Structure Verification

**Dashboard Token Generation Flow**:
1. User clicks "Generate Extension Token" in dashboard
2. Frontend calls `getToken()` to get Clerk session token
3. Frontend sends POST to [`/api/dashboard-token/generate`](api/dashboard-token/generate.ts:1) with Clerk token in Authorization header
4. Backend verifies Clerk token using [`@clerk/backend`](api/dashboard-token/generate.ts:2)
5. Backend fetches user data from Supabase
6. Backend generates JWT using [`generateAccessToken()`](src/utils/jwt.ts:15)
7. Backend returns JWT token to frontend

**No request body needed** - only Authorization header with Clerk Bearer token.

## Testing Verification

### Expected Success Flow

1. **Token Request Initiated**:
   ```
   🔍 [DASHBOARD] Generating backend JWT token for VSCode extension...
   🔍 [DASHBOARD] Got Clerk auth token, calling dashboard token generation endpoint...
   ```

2. **Successful Response**:
   ```json
   {
     "success": true,
     "access_token": "eyJhbGc...",
     "expires_in": 86400,
     "expires_at": "2025-10-04T12:38:00.000Z",
     "token_type": "Bearer"
   }
   ```

3. **Success Message**:
   ```
   ✅ Generated backend JWT token for VSCode extension
   Token Generated: Backend JWT token generated successfully. Expires in 1440 minutes.
   ```

### Error Scenarios Handled

1. **Authentication Failure**: User not authenticated → Returns 401
2. **Token Verification Failure**: Invalid Clerk token → Returns 401
3. **User Not Found**: User doesn't exist in database → Returns 404
4. **Server Error**: Internal error → Returns 500 with proper error message

## Files Modified

1. **[`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:1)**
   - Line 264: Replaced `Buffer.from()` with `atob()` for browser compatibility
   - Line 283: Changed endpoint to `/api/dashboard-token/generate`
   - Line 280: Updated console message for clarity

2. **[`api/dashboard-token/generate.ts`](api/dashboard-token/generate.ts:1)**
   - Line 18-20: Fixed Clerk verification to use `secretKey` instead of `jwtKey`
   - Uses correct `CLERK_SECRET_KEY` environment variable

## Architecture Overview

```
┌─────────────────┐
│   Dashboard     │
│   (Browser)     │
└────────┬────────┘
         │ 1. getToken() → Clerk Session Token
         ↓
    ┌────────────────────────────────┐
    │ POST /api/dashboard-token/     │
    │      generate                  │
    │ Authorization: Bearer <clerk>  │
    └────────┬───────────────────────┘
             │ 2. Verify Clerk Token
             ↓
    ┌─────────────────────────┐
    │  @clerk/backend         │
    │  verifyToken()          │
    └────────┬────────────────┘
             │ 3. Get clerk_id
             ↓
    ┌─────────────────────────┐
    │  Supabase Database      │
    │  SELECT user data       │
    └────────┬────────────────┘
             │ 4. User data
             ↓
    ┌─────────────────────────┐
    │  generateAccessToken()  │
    │  Sign JWT with secret   │
    └────────┬────────────────┘
             │ 5. Backend JWT
             ↓
    ┌─────────────────────────┐
    │  Return to Dashboard    │
    │  { access_token: ... }  │
    └─────────────────────────┘
```

## Deployment Checklist

- [x] Fix browser compatibility issue (Buffer → atob)
- [x] Update endpoint path
- [x] Fix Clerk token verification parameter
- [x] Verify request structure
- [x] Test error handling
- [x] Update documentation
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Verify token generation works in production

## Environment Variables Required

Ensure these environment variables are set in your deployment:

- `CLERK_SECRET_KEY` - Clerk secret key for token verification (required)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required)
- `JWT_SECRET` - Secret for signing backend JWT tokens (required)

**Note**: `CLERK_JWT_KEY` is NOT used and should not be set.

## Related Files

- Dashboard Frontend: [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:1)
- Dashboard Token API: [`api/dashboard-token/generate.ts`](api/dashboard-token/generate.ts:1)
- VSCode OAuth API: [`api/extension/auth/token.ts`](api/extension/auth/token.ts:1)
- JWT Utilities: [`src/utils/jwt.ts`](src/utils/jwt.ts:1), [`api/utils/jwt.ts`](api/utils/jwt.ts:1)
- Vercel Configuration: [`vercel.json`](vercel.json:1)

## Additional Notes

- The fix maintains backward compatibility with existing VSCode extension OAuth flow
- No database schema changes required
- No environment variable changes needed
- Token expiration remains 24 hours (86400 seconds)
- Development mode fallback still functional for testing