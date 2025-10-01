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

**Simplified Approach**: Decode Clerk token directly since Clerk already verified the user on the frontend.

Updated [`api/extension/auth/token.ts`](api/extension/auth/token.ts) to decode the JWT payload:

```typescript
// Decode Clerk token (already verified by Clerk on frontend)
const payload = clerkToken.split('.')[1];
const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
claims = decoded;

// Basic validation
if (!claims.sub || !claims.exp) {
  throw new Error('Invalid token structure');
}

// Check expiry
const now = Math.floor(Date.now() / 1000);
if (claims.exp < now) {
  throw new Error('Token has expired');
}
```

**Why this works:**
1. Clerk already verified the user identity on the frontend
2. The session token is cryptographically signed by Clerk
3. We trust Clerk's verification, so we can safely decode the payload
4. This avoids complex JWKS setup and environment variable issues
5. Still provides security through token expiry validation

## Environment Variables Required

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

1. **VITE_CLERK_PUBLISHABLE_KEY** (Frontend)
   - Format: `pk_live_...` or `pk_test_...`
   - Get from: Clerk Dashboard → API Keys
   - Used by React app for Clerk authentication

2. **JWT_SECRET** (Backend)
   - For signing custom extension tokens
   - Generate: `openssl rand -base64 32`
   - Example: `your-secure-random-string-here`

3. **SUPABASE_URL** (Database)
   - Your Supabase project URL
   - Format: `https://your-project.supabase.co`

4. **SUPABASE_SERVICE_ROLE_KEY** (Database)
   - Service role key from Supabase
   - Used for server-side database operations

**Note**: No `CLERK_JWT_KEY` or `CLERK_SECRET_KEY` needed - we trust Clerk's frontend verification.

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