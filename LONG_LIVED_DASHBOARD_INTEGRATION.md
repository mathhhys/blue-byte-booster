# Long-Lived Token Dashboard Integration Implementation Plan

## Overview
This plan extends the dashboard to generate and manage 4-month long-lived JWT tokens for VSCode extension authentication. These tokens are stored in the `extension_tokens` table, replacing short-lived Clerk tokens. The implementation includes backend endpoints for generation and revocation, frontend UI updates, security measures, testing, and documentation.

Key goals:
- Enable users to generate a single long-lived token (4 months) directly from the dashboard.
- Automatically revoke any existing tokens to enforce a single active token policy.
- Provide revocation capability from the dashboard.
- Ensure high security through hashing, rate limiting, and logging.
- Maintain compatibility with existing short-lived token flow.

## Security Considerations
Security is paramount for long-lived tokens. The following measures will be implemented:

### 1. Token Generation Security
- **Clerk Authentication**: All endpoints require a valid Clerk JWT in the `Authorization: Bearer` header. Use `@clerk/backend`'s `verifyToken` with `CLERK_JWT_KEY` for verification.
- **User Ownership Verification**: After Clerk verification, fetch the user from Supabase using the `clerk_id` to ensure the requestor owns the token.
- **Single Active Token Policy**: Before generating a new token, call the Supabase function `revoke_user_extension_tokens(user_id)` to invalidate all existing non-expired tokens for that user. This prevents multiple active tokens.
- **JWT Payload**: Include minimal claims: `{ userId, type: 'extension_long_lived', exp, iat }`. Avoid sensitive data like email or credits to reduce exposure if compromised.
- **Expiry Calculation**: Set `exp = Math.floor(Date.now() / 1000) + (4 * 30 * 24 * 60 * 60)` (approximately 12096000 seconds for 4 months). Use UTC timestamps.
- **Token Signing**: Use `jsonwebtoken` with `HS256` algorithm and `JWT_SECRET` (strong, 256-bit key from env). Ensure `JWT_SECRET` is rotated periodically.

### 2. Token Storage and Hashing
- **Hashing Algorithm**: Use `bcrypt` for one-way hashing of the full JWT token before storage in `extension_tokens.token_hash`. 
  - Why bcrypt? It's designed for password hashing with adaptive work factors (salt rounds), resistant to brute-force attacks, and widely used for token storage (e.g., API keys).
  - Configuration: `bcrypt.hashSync(token, 12)` (12 salt rounds for balance between security and performance; adjustable based on load).
  - During validation (in other endpoints like VSCode routes), hash the incoming token and query for a match: `SELECT * FROM extension_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`.
  - Benefits: Even if the database is breached, attackers can't retrieve plaintext tokens. Bcrypt's slowness deters rainbow table attacks.
- **Database Security**: 
  - Use Supabase service role key for admin operations (bypasses RLS).
  - Enable RLS on `extension_tokens` (existing policy: users can view own tokens).
  - Store `expires_at` as `TIMESTAMP WITH TIME ZONE` in UTC.
  - Auto-cleanup via `cleanup_expired_extension_tokens()` function (schedule via cron job or Supabase edge function).
- **No Plaintext Storage**: Never store the plaintext token in the DB; only the hash.

### 3. Rate Limiting and Abuse Prevention
- **Rate Limiting**: Apply a global limit of 1 generation per user per 24 hours (to prevent spam). Use a simple in-memory cache (e.g., Node.js Map with TTL) or integrate with Upstash Redis if scaling. For revocation, limit to 5 per hour.
- **Request Validation**: Use Zod for body/header validation (e.g., optional `name` for token). Reject malformed requests with 400.
- **Logging**: Log all generations/revocations with user ID, IP (from `x-forwarded-for`), timestamp, and success/failure. Use structured logging (e.g., JSON to console for Vercel logs). Monitor for anomalies (e.g., multiple revocations).

### 4. Frontend Security
- **Token Display**: Show the token only once in a copyable textarea with a warning: "This 4-month token grants long-term access. Copy it now and store securely. It cannot be viewed again."
- **HTTPS Only**: Ensure all API calls use HTTPS (Vercel default).
- **No Local Storage**: Advise users not to store tokens in browser storage; recommend secure vault (e.g., VSCode settings or password manager).
- **Revocation Warning**: Before revocation, confirm with a modal: "This will invalidate your active extension token. Re-generate if needed."

### 5. General Best Practices
- **Env Vars**: Add `BCRYPT_SALT_ROUNDS=12` (default). Ensure `JWT_SECRET` is at least 32 characters, generated securely.
- **Error Handling**: Never leak sensitive info in responses (e.g., no stack traces in prod).
- **Dependencies**: Install `bcrypt` (`npm i bcrypt`) and `zod` if not present. Use TypeScript for type safety.
- **Auditing**: After implementation, run Supabase advisors for security/performance issues.
- **Compliance**: Tokens comply with GDPR (revocable, auditable). No PII in JWT beyond userId.

## Implementation Steps

### Backend (New API Routes in /api/extension-token/)
1. **Create /api/extension-token/generate/route.ts (POST)**:
   - Verify Clerk token → Fetch user → Revoke existing tokens → Generate JWT (4-month exp) → Hash with bcrypt → Insert into `extension_tokens` (user_id, token_hash, name='VSCode Long-Lived', expires_at) → Return `{ success: true, access_token, expires_in: 12096000, expires_at: ISO, type: 'long_lived' }`.
   - Error cases: 401 (auth fail), 429 (rate limit), 500 (DB error).

2. **Create /api/extension-token/revoke/route.ts (POST)**:
   - Verify Clerk token → Fetch user → Update `extension_tokens` SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW() → Return `{ success: true, revoked: true }`.

3. **Token Validation Helper**: Add to src/utils/jwt.ts: `async validateLongLivedToken(token: string): Promise<{ valid: boolean, userId: string | null, expired: boolean }>` – Hash token, query DB for match, verify JWT exp.

4. **Rate Limiting**: Implement simple middleware or inline check using a cache.

### Frontend (src/pages/Dashboard.tsx)
1. **UI Updates**:
   - Add toggle/radio for "Short-lived (24h)" vs "Long-lived (4 months)".
   - On submit, call appropriate endpoint based on selection.
   - For long-lived: Show warning modal, display token with expiry info, add "Revoke Active Token" button (calls revoke endpoint, refreshes UI).

2. **State Management**: Use React state for token type, loading, and active token status (fetch current active token on load via new GET /api/extension-token/active).

3. **Error/Success Handling**: Use existing toast system; add specific messages for long-lived (e.g., "Token generated – valid for 4 months. Revoke anytime.").

### Database
- Leverage existing `extension_tokens` table and functions.
- Add index on `revoked_at` if needed for queries.

### Testing
1. **Backend**: Unit tests for generate/revoke (mock Supabase/Clerk). Integration: Use Supabase local or test DB.
2. **Frontend**: Cypress tests for UI flow (generate, copy, revoke).
3. **E2E**: Generate token → Use in VSCode mock → Verify auth → Revoke → Confirm invalidation.

### Deployment
- Add to Vercel: Ensure env vars (BCRYPT_SALT_ROUNDS, etc.).
- Post-deploy: Test on staging, monitor logs.

## Potential Risks and Mitigations
- **Hash Collision**: Unlikely with bcrypt; use unique salts.
- **Long Expiry Abuse**: Enforced single-token policy and easy revocation mitigate.
- **Performance**: Bcrypt is CPU-intensive; offload to worker if high traffic.
- **Migration**: No DB changes needed; build on existing schema.

This enhanced plan prioritizes security while keeping the implementation straightforward. Proceed to Code mode for execution.