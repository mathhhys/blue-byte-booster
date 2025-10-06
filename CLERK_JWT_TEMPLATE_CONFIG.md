# Clerk JWT Template Configuration for VSCode Extension

This document provides step-by-step instructions to configure a custom JWT template in Clerk for generating long-lived session tokens suitable for the VSCode extension. These tokens will have an extended lifetime (e.g., 24 hours) and include necessary claims for authentication.

## Prerequisites
- Access to the Clerk Dashboard (https://dashboard.clerk.com)
- Your Clerk application ID and publishable/secret keys configured in the project
- The frontend already uses Clerk for authentication (as per current implementation)

## Step 1: Navigate to JWT Templates
1. Log in to your Clerk Dashboard.
2. Select your application from the sidebar.
3. Go to **JWT Templates** in the left navigation menu (under "API Keys" or "Sessions" section).

## Step 2: Create a New JWT Template
1. Click **+ New Template**.
2. **Template Name**: Enter `vscode-extension` (this matches the template name used in the Dashboard code: `getToken({ template: 'vscode-extension' })`).
3. **Description**: "Long-lived JWT for VSCode extension authentication with auto-refresh support".

## Step 3: Configure Token Claims
In the **Claims** section, ensure the following claims are included (Clerk includes most by default, but verify/customize):
- **sub** (Subject): User ID (required for identification)
- **email**: User's email address
- **name**: User's full name (if available)
- **iat** (Issued At): Timestamp
- **exp** (Expiration): Set to 24 hours from issuance
- **iss** (Issuer): Your Clerk instance URL
- **aud** (Audience): Set to `vscode-extension` or your app domain

**Custom Claims** (optional but recommended):
- Add a custom claim like `scope: "vscode:auth"` to restrict usage.

## Step 4: Set Token Lifetime
1. In the **Lifetime** section:
   - **Access Token Lifetime**: Set to `24h` (86400 seconds). This makes the token suitable for extension use without frequent manual refreshes.
   - **Refresh Token Lifetime**: Set to `7d` (if using refresh tokens; otherwise, rely on session refresh).
   - **Leeway**: Set to `5s` for clock skew tolerance.

2. **Signing Algorithm**: Ensure it's RS256 (default for Clerk, provides `kid` header for verification).

## Step 5: Configure Token Usage
1. **Allowed Signers**: Use Clerk's default RS256 keys (public JWKS endpoint: `https://your-instance.clerk.dev/.well-known/jwks.json`).
2. **Audience**: Set to your application domain or `vscode-extension` to match verification in the extension/backend.
3. **Not Before (nbf)**: Optional, set to current time.

## Step 6: Enable the Template
1. Toggle the template to **Enabled**.
2. Save the configuration.

## Step 7: Verify Configuration
1. In your Clerk Dashboard, go to **Sessions** > **JWT Templates** and confirm the template appears.
2. Test token generation:
   - In the frontend (Dashboard), trigger `getToken({ template: 'vscode-extension' })`.
   - Decode the token at [jwt.io](https://jwt.io) to verify:
     - `exp` claim shows 24 hours from `iat`.
     - Includes `sub`, `email`, and other required claims.
     - Header has `kid` and `alg: RS256`.

## Step 8: Update Environment Variables (if needed)
No new env vars required, but ensure:
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```
The template name is hardcoded in the Dashboard code as `'vscode-extension'`.

## Security Considerations
- **Token Lifetime**: 24 hours balances security and UX. For longer sessions, implement proactive refresh in the extension.
- **Claims**: Only include necessary data to minimize token size.
- **Verification**: The extension and backend will verify using Clerk's public JWKS (no secret key exposure).
- **Revocation**: Tokens are revoked if the user session ends (e.g., logout). Use webhooks for real-time revocation handling.
- **HTTPS Only**: Ensure all token transmission uses HTTPS.

## Troubleshooting
- **Token Lifetime Too Short**: Check the template config; default falls back to 60s if template not found.
- **Missing Claims**: Verify in Clerk Dashboard > Users > Sessions for a sample token.
- **Verification Fails**: Ensure the `kid` header matches Clerk's JWKS keys.
- **Template Not Found**: Confirm exact name match (`vscode-extension`) in `getToken()` call.

## Next Steps After Configuration
1. Test token generation in Dashboard.tsx.
2. Update backend verification to use `@clerk/backend` with the new RS256 tokens.
3. Implement extension-side verification using the same Clerk JWKS.

This configuration enables secure, long-lived tokens for seamless VSCode integration.