# Long-Lived Token Implementation Plan

## Objective
Apply the same schema and information structure from the short-lived Clerk token to the long-lived custom JWT token used for VSCode extension authentication. This ensures consistency in token payloads, including nested claims for user details like firstName, lastName, primaryEmail, sessionId, accountType, and the vscodeExtension flag.

### Provided Short-Lived Token Example
```json
{
  "algorithm": "RS256",
  "azp": "https://www.softcodes.ai",
  "claims": {
    "accountType": null,
    "exp": "{{current_timestamp_plus_seconds(7776000)}}",
    "firstName": "Mathys ",
    "iat": "{{current_timestamp}}",
    "lastName": "Guillou",
    "primaryEmail": "mathys@softcodes.io",
    "sessionId": "{{session.id}}",
    "sub": "user_32mSltWx9KkUkJe3sN2Bkym2w45",
    "userId": "user_32mSltWx9KkUkJe3sN2Bkym2w45",
    "vscodeExtension": true
  },
  "exp": 1767716395,
  "iat": 1759940395,
  "iss": "https://clerk.softcodes.ai",
  "jti": "0641bb39fe74ac90503b",
  "lifetime": 7776000,
  "name": "vscode-extension",
  "nbf": 1759940390,
  "sub": "user_32mSltWx9KkUkJe3sN2Bkym2w45"
}
```

## Current Implementation Overview
- **Short-Lived Token**: Generated via Clerk (RS256), contains rich user claims fetched from Clerk user data.
- **Long-Lived Token**: Custom JWT (HS256) generated in `api/extension-token/refresh.js` and similar endpoints. Current payload is minimal:
  ```js
  const payload = {
    sub: clerkUserId,
    type: 'extension_long_lived',
    iat,
    exp,
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  };
  ```
- **Key Files**:
  - Generation: `api/extension-token/refresh.js` (refresh), similar for generate/revoke.
  - Verification: Likely in VSCode extension or backend middleware (e.g., `backend-api-example/middleware/auth.js`).
  - Tests: `backend-api-example/test-long-lived-token.js`.

## Required Changes
1. **Enrich Payload Structure**:
   - Nest user claims under a `claims` object to match the example.
   - Include: `firstName`, `lastName`, `primaryEmail`, `sessionId`, `accountType` (from Supabase or Clerk), `userId` (alias for sub), `vscodeExtension: true`.
   - Add top-level fields: `algorithm: "RS256"` (if switching), `azp`, `jti` (unique ID), `lifetime`, `name: "vscode-extension"`, `nbf`.
   - Source user data from Clerk API (via `@clerk/backend`) or Supabase `users` table during generation.

2. **Algorithm Consideration**:
   - Current: HS256 (symmetric, uses `JWT_SECRET`).
   - Target: RS256 (asymmetric, matches Clerk) for consistency, but requires key pair generation and management.
   - Decision: Switch to RS256 if verification needs to align with Clerk ecosystem; otherwise, keep HS256 for simplicity but update payload.

3. **Generation Flow Updates**:
   - In `api/extension-token/refresh.js` (and generate endpoint):
     - Fetch full user details using Clerk's `users.getUser(clerkUserId)` or Supabase query.
     - Generate unique `jti` (e.g., UUID).
     - Set `sessionId` from Clerk session or generate new.
     - Compute `exp` as `iat + 7776000` (90 days, matching example).
     - Sign with RS256 if chosen (generate keys via OpenSSL or library).

4. **Refresh Endpoint Propagation**:
   - When refreshing, pull latest user claims from Clerk/Supabase to ensure up-to-date info (e.g., name changes).

5. **Verification & Storage**:
   - No DB changes needed for claims (stored as JWT, not hashed payload).
   - Update verification logic (e.g., in extension or backend) to parse nested `claims`.
   - Ensure `token_hash` in DB only hashes the full signed token.

6. **Security Implications**:
   - RS256: More secure for public verification (pubkey only), but manage private key securely.
   - Include `nbf` (not before) to prevent replay attacks.
   - Audit logs via `logTokenAudit` to track enriched token generations.

## Testing Plan
- Unit: Verify payload structure in `backend-api-example/test-long-lived-token.js`.
- Integration: Test generation/refresh with mock Clerk user data.
- E2E: Simulate VSCode extension auth flow, ensure claims are accessible.
- Edge Cases: Expired claims, missing user data, algorithm mismatch.

## Migration Steps
1. Generate RS256 keys if switching (store private in env, public for verification).
2. Update token generation code.
3. Deploy and test with existing tokens (backward compatible?).
4. Update VSCode extension to handle new claims if needed.

## Potential Risks
- Key management for RS256.
- Performance hit from Clerk API calls during generation.
- Breaking changes to extension if claims structure changes verification.

This plan will be implemented in code mode.