# Softcodes.ai Website Authentication Changes for VSCode Extension Integration

This document details the changes made to the website (web app) to support the authentication flow for the VSCode extension using Clerk as the auth provider. The changes focus on enabling token generation in the dashboard, PKCE OAuth2 initiation and completion pages, and backend endpoints for token exchange and refresh. These changes are implemented in the main workspace (`/Users/mathysguillou/blue-byte-booster`).

## Overview
- **Scope**: Web app updates to support:
  - Quick token generation in `/dashboard` (Clerk session JWT).
  - PKCE flow initiation (`/auth/vscode-initiate`).
  - Token exchange and refresh APIs.
- **Key Files Modified/Created**:
  - `src/pages/VscodeInitiateAuth.tsx` (modified).
  - `src/pages/VscodeCompleteAuth.tsx` (new).
  - `api/auth/initiate-vscode-auth.ts` (new).
  - `api/auth/complete-vscode-auth.ts` (new).
  - `api/auth/refresh-token.ts` (new).
  - `api/extension/auth/validate/route.ts` (new, fixed for Pages Router).
- **Dependencies**: Ensure `@clerk/backend`, `jsonwebtoken`, `@supabase/supabase-js`, `crypto` are installed (`npm i`).
- **Database**: Requires Supabase table `auth_sessions` (migration below).
- **Env Vars**: Add `JWT_SECRET` (e.g., `openssl rand -base64 32`), `CLERK_DOMAIN`.

## Database Migration (Required)
Run in Supabase SQL editor or via CLI (`supabase db push`):
```sql
CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  code_challenge TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_state ON auth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
```

## 1. Updated `src/pages/VscodeInitiateAuth.tsx` (PKCE Initiation Page)
- **Purpose**: Handles the initial redirect from the extension. Parses PKCE params (code_challenge, state, vscode_redirect_uri), validates, POSTs to backend, redirects to Clerk sign-in.
- **Changes** (from original stub):
  - Added parsing for `codeChallenge` and `state` using `useSearchParams` (lines 9-10).
  - Validation for missing params (lines 17, 22).
  - Switched fetch to POST `/api/auth/initiate-vscode-auth` with JSON body containing all params (lines 29-35).
  - Updated useEffect dependency to include new params (line 38).
  - Error handling with UI Alert (lines 40-47).
- **Full Code** (key sections):
  ```tsx
  const codeChallenge = searchParams.get('code_challenge');
  const state = searchParams.get('state');

  useEffect(() => {
    const initiateAuthFlow = async () => {
      if (!codeChallenge || !state) {
        setError('Missing PKCE parameters.');
        return;
      }
      const response = await fetch('/api/auth/initiate-vscode-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uri: vscodeRedirectUri, code_challenge: codeChallenge, state }),
      });
      const data = await response.json();
      if (data.success && data.auth_url) {
        window.location.href = data.auth_url; // Redirect to Clerk
      } else {
        setError(data.error || 'Failed to initiate.');
      }
    };
    initiateAuthFlow();
  }, [vscodeRedirectUri, codeChallenge, state]);
  ```
- **Testing**: Navigate to `/auth/vscode-initiate?code_challenge=test&state=test&vscode_redirect_uri=test://callback`. Should redirect to Clerk sign-in.
- **Security**: Params are validated; no storage on client.

## 2. New `src/pages/VscodeCompleteAuth.tsx` (PKCE Completion Page)
- **Purpose**: Clerk callback page. Parses `code` (Clerk user ID), `state`, `vscode_redirect_uri`, validates, redirects to extension's custom URI scheme.
- **Changes**: New component (48 lines). Uses `useSearchParams` for params, constructs callback URL, immediate redirect.
- **Full Code** (core logic, lines 12-27):
  ```tsx
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');

  useEffect(() => {
    const completeAuthFlow = async () => {
      if (!code || !state || !vscodeRedirectUri) {
        setError('Missing parameters.');
        return;
      }
      const callbackUrl = `${vscodeRedirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      window.location.href = callbackUrl; // Redirect to extension URI
    };
    completeAuthFlow();
  }, [code, state, vscodeRedirectUri]);
  ```
- **Testing**: Manually navigate to `/auth/complete-vscode-auth?code=user_123&state=test&vscode_redirect_uri=vscode-bluebytebooster://callback`. Should redirect to custom URI.
- **Security**: No token handling; just param forwarding. State validation in extension.

## 3. New `api/auth/initiate-vscode-auth.ts` (Backend Initiation Handler)
- **Purpose**: Receives PKCE params from initiate page, stores in Supabase `auth_sessions`, generates Clerk sign-in URL with redirect to complete page.
- **Changes**: New Pages Router API (78 lines). Validates lengths, inserts session (expires 5min), constructs URL.
- **Full Code** (storage and URL, lines 50-78):
  ```ts
  const { data } = await supabase.from('auth_sessions').insert({
    state, code_challenge, redirect_uri, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  }).select('id').single();

  const completeUrl = `${baseUrl}/auth/complete-vscode-auth?state=${encodeURIComponent(state)}&vscode_redirect_uri=${encodeURIComponent(redirect_uri)}`;
  const authUrl = `https://${clerkDomain}/sign-in?redirect_url=${encodeURIComponent(completeUrl)}`;
  res.json({ success: true, auth_url });
  ```
- **Testing**: POST {code_challenge: 'test', state: 'test', redirect_uri: 'test://'} → Returns auth_url.
- **Security**: Session expiry prevents replay; unique state.

## 4. New `api/auth/complete-vscode-auth.ts` (Token Exchange Handler)
- **Purpose**: From extension POST, verifies PKCE, deletes session, queries user, generates custom HS256 access/refresh tokens.
- **Changes**: New API (124 lines). Fetches session, computes SHA256(verifier) for PKCE check, signs tokens with `jsonwebtoken`.
- **Full Code** (PKCE check, lines 50-60):
  ```ts
  const computedChallenge = crypto.createHash('sha256').update(code_verifier).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  if (computedChallenge !== sessionData.code_challenge) {
    await supabase.from('auth_sessions').delete().eq('state', state);
    return res.status(400).json({ error: 'PKCE verification failed' });
  }
  ```
  - Token signing (lines 80-95):
  ```ts
  const accessToken = jwt.sign({ sub: clerkUserId, type: 'access', exp: iat + 86400 }, jwtSecret, { algorithm: 'HS256' });
  const refreshToken = jwt.sign({ sub: clerkUserId, type: 'refresh', exp: iat + 604800 }, jwtSecret, { algorithm: 'HS256' });
  res.json({ success: true, access_token, refresh_token, expires_in: 86400 });
  ```
- **Testing**: POST {code: 'user_123', code_verifier: 'verifier', state: 'test', redirect_uri: 'test://'} (after initiate) → Returns tokens.
- **Security**: PKCE + session deletion; user query ensures validity.

## 5. New `api/auth/refresh-token.ts` (Refresh Handler)
- **Purpose**: Verifies refresh_token, generates new access/refresh (rotation).
- **Changes**: New API (92 lines). Verifies HS256, queries user, signs new tokens.
- **Full Code** (verification, lines 25-35):
  ```ts
  decodedRefresh = jwt.verify(refresh_token, jwtSecret, { algorithms: ['HS256'] });
  if (decodedRefresh.type !== 'refresh' || !decodedRefresh.sub) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  ```
  - New tokens (lines 50-60):
  ```ts
  const newAccessToken = jwt.sign({ sub: clerkUserId, type: 'access', exp: iat + 86400 }, jwtSecret, { algorithm: 'HS256' });
  const newRefreshToken = jwt.sign({ sub: clerkUserId, type: 'refresh', exp: iat + 604800 }, jwtSecret, { algorithm: 'HS256' });
  res.json({ success: true, access_token: newAccessToken, refresh_token: newRefreshToken, expires_in: 86400 });
  ```
- **Testing**: POST {refresh_token: 'valid_token'} → New tokens.
- **Security**: Rotation limits exposure; expiry checks.

## 6. New `api/extension/auth/validate/route.ts` (Token Validation)
- **Purpose**: Fallback for extension to validate tokens.
- **Changes**: New API (58 lines, Pages Router). Verifies HS256, optional user query.
- **Full Code** (verification, lines 25-40):
  ```ts
  decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (decoded.type !== 'access' || !decoded.sub) {
    return res.status(401).json({ valid: false, error: 'Invalid token payload' });
  }
  // Optional Supabase check...
  res.json({ valid: true, userId: decoded.user_id, clerkUserId: decoded.sub });
  ```
- **Testing**: POST with Authorization Bearer token → {valid: true, userId}.
- **Security**: Server-side verification.

## Dashboard Token Generation (Unchanged but Integrated)
- In `src/pages/Dashboard.tsx`, `generateToken()` (lines 232-344) retrieves Clerk JWT via `getToken()`, verifies via `/api/extension/auth/token`, displays for copy.
- **Integration**: Use as fallback; for PKCE, extension initiates.

## Deployment and Testing
- **Deploy**: `npm run build && vercel deploy`.
- **Test Flow**: 1. Extension signin → Browser initiate → Clerk sign-in → Complete redirect → Exchange → Validate token.
- **Logs**: Check console for [VSCode Auth] messages.
- **Edge Cases**: Expired state, invalid verifier, missing params (handled with 400 errors).

This completes the website side. See EXTENSION_AUTH_CHANGES.md for extension implementation.