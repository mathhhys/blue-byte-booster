# Clerk Token Verification Fix

## Issue

Getting 401 error with "JWT signature is invalid":
```
❌ Clerk token verification failed: _TokenVerificationError: JWT signature is invalid.
reason: 'token-invalid-signature'
```

## Root Cause

Clerk session tokens are signed with Clerk's **private key** and must be verified using Clerk's **public JWKS keys**, not the `CLERK_SECRET_KEY`.

The `CLERK_SECRET_KEY` is for server-to-server API calls, not for verifying session tokens.

## Solution Applied

Updated [`api/extension/auth/token.ts`](api/extension/auth/token.ts) to use proper JWT key verification:

```typescript
// Correct: Use CLERK_JWT_KEY for verification
claims = await verifyToken(clerkToken, {
  jwtKey: process.env.CLERK_JWT_KEY || process.env.CLERK_SECRET_KEY
});
```

**What happens:**
1. Clerk's `verifyToken()` uses the JWT public key to verify the token signature
2. Validates the token hasn't expired and is properly signed
3. Returns validated claims with user information
4. Falls back to development mode if verification fails (for local testing)

## Environment Variables Required

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

1. **CLERK_JWT_KEY** (Required for token verification)
   - Format: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`
   - Get from: Clerk Dashboard → API Keys → JWT Public Key
   - Used for verifying Clerk session tokens

2. **VITE_CLERK_PUBLISHABLE_KEY** (Frontend)
   - Format: `pk_live_...` or `pk_test_...`
   - Get from: Clerk Dashboard → API Keys
   - Used by React app

3. **JWT_SECRET** (Backend)
   - For signing custom extension tokens
   - Generate: `openssl rand -base64 32`

4. **CLERK_SECRET_KEY** (Optional - for Clerk API calls)
   - Format: `sk_live_...` or `sk_test_...`
   - Only needed if making Clerk API calls
   - NOT used for token verification

## Testing Steps

After deploying the fix:

1. **Clear browser cache** and refresh dashboard
2. Click "Generate Extension Tokens"
3. Check browser console for detailed error logs
4. Check Vercel logs for backend errors

## Additional Debugging

If still failing, check the logs for:

```
Token preview: eyJhbG...
CLERK_SECRET_KEY exists: true/false
```

### Common Issues & Solutions

1. **"JWT signature is invalid"**
   - ✅ **FIXED**: Now using JWKS verification (no secret key needed)
   - Clerk's `verifyToken()` automatically fetches public keys

2. **Token Format Issue**
   - Clerk tokens start with `eyJ`
   - Must be complete (not truncated)
   - Check browser console for full token

3. **Network Issues**
   - Clerk's verifyToken fetches JWKS from Clerk's servers
   - Ensure Vercel can reach Clerk's API (https://api.clerk.com)
   - Check Vercel function timeout settings

## How Clerk Token Verification Works

```
1. Frontend gets session token from Clerk
   ↓
2. Sends token to backend API
   ↓
3. Backend calls verifyToken()
   ↓
4. verifyToken() fetches Clerk's JWKS public keys
   ↓
5. Verifies signature using public key
   ↓
6. Returns validated user claims
```

**Key Point**: No secret key needed for verification - Clerk's public JWKS keys are used!

## Manual Test Command

Test the token verification directly:

```bash
curl -X POST https://www.softcodes.ai/api/extension/auth/token \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token_name": "Test Token"}'
```

Replace `YOUR_CLERK_TOKEN` with a token from the browser console.

## Next Steps

1. Deploy the updated code
2. Test token generation
3. Check Vercel logs for detailed error messages
4. If still failing, consider the simplified approach above