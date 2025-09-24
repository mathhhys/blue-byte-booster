# VS Code Extension - Required Authentication Changes

To integrate with the new backend authentication flow, the VS Code extension must be updated to follow the complete PKCE OAuth 2.0 flow. The key changes are centered around initiating the login, handling the callback, and exchanging the authorization code for secure tokens.

## 1. Authentication Initiation

- **Action**: When the user triggers authentication, the extension must generate a cryptographically random `code_verifier` and a corresponding `code_challenge`.
- **Storage**: The `code_verifier` and a unique `state` parameter must be stored securely in the extension's local storage (`context.secrets`).
- **Browser Navigation**: The extension should open the user's browser to `/auth/vscode-initiate`, passing the `code_challenge`, `state`, and a `vscode_redirect_uri` as query parameters.

Example URL:
`https://your-app.com/auth/vscode-initiate?code_challenge=...&state=...&vscode_redirect_uri=vscode-bluebytebooster://callback`

## 2. Callback Handling

- **URI Handler**: The extension must have a URI handler registered for the `vscode-bluebytebooster://` scheme.
- **Parameter Parsing**: The handler will receive the `authorization_code` (which will be the Clerk User ID) and the `state` from the URL.
- **State Validation**: The received `state` must be validated against the one stored locally to prevent CSRF attacks.

## 3. Token Exchange

- **Action**: After validating the `state`, the extension must make a `POST` request to the backend's `/api/auth/token` endpoint.
- **Request Body**: The request must include:
  - `code`: The authorization code received in the callback.
  - `code_verifier`: The verifier retrieved from secure storage.
  - `state`: The unique state parameter.
  - `redirect_uri`: The original `vscode-bluebytebooster://callback` URI.
- **Response**: The backend will respond with an `access_token`, `refresh_token`, and `expires_in`.

## 4. Secure Token Storage

- **Action**: The received `access_token` and `refresh_token` must be stored securely using `context.secrets.store()`. Storing the token's expiry time is also recommended for proactive refreshing.

## 5. Authenticated API Calls

- **Header**: All subsequent API requests to the backend must include the `access_token` in the `Authorization` header.
- **Format**: `Authorization: Bearer <access_token>`

## 6. Token Refreshing

- **Trigger**: When an API call returns a `401 Unauthorized` error, the extension should initiate a token refresh.
- **Action**: Make a `POST` request to `/api/auth/refresh-token` with the stored `refresh_token`.
- **Update Storage**: If the refresh is successful, update the stored `access_token` and `refresh_token` with the new ones received from the backend.
- **Re-Authentication**: If the refresh fails, the user must be prompted to log in again.

## 7. JWT Header Decoding Fix (Garbled Characters Issue)

The extension is experiencing base64url decoding failures leading to invalid JSON (e.g., "Unexpected token '', "iձ"..."). This is due to improper handling of JWT padding in base64url format.

**Fix**: Replace or add a safe base64url decoder in your JWT parsing utilities (likely in `src/auth/jwtUtils.ts` or where `parseJWTComponents` is defined):

```typescript
// Safe base64url decoder for JWT parts
function safeBase64UrlDecode(str: string): any {
  // Convert base64url to standard base64 (add padding)
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = 4 - (base64.length % 4);
  for (let i = 0; i < padding; i++) {
    base64 += '=';
  }
  
  try {
    const binary = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(binary);
  } catch (e) {
    console.error('[JWT-DEBUG] Decoding failed for part:', str.substring(0, 20), 'Error:', e);
    throw new Error(`Invalid JWT part: ${e.message}`);
  }
}

// Usage in your JWT parsing (e.g., parseJWTUnsafe or decode function)
export function parseJWTComponents(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  try {
    const header = safeBase64UrlDecode(parts[0]);
    const payload = safeBase64UrlDecode(parts[1]);
    return { header, payload };
  } catch (error) {
    console.error('[JWT-DEBUG] Header decoding failed:', error);
    throw error;
  }
}
```

**Test**: Log the raw token and decoded parts before verification to confirm no garbling.

## 8. JWT Signature Verification Fix (Missing 'kid' Issue)

The extension's `JWTVerificationService` expects RS256 (Clerk-style) with JWKS and 'kid' header, but the backend generates HS256 (symmetric) without 'kid'.

**Fix**: Add custom HS256 verification path in the extension (in `unifiedAuthService.ts` or `JWTVerificationService.verifyJWT`):

```typescript
// Add to your verification service (e.g., unifiedAuthService.ts)
import * as jwt from 'jsonwebtoken'; // Ensure jsonwebtoken is installed in extension

const JWT_SECRET = 'your-shared-jwt-secret'; // Load securely (e.g., from extension config or fetch during init). NEVER hardcode in production!

async function verifyCustomHS256Token(token: string): Promise<{ valid: boolean; clerkUserId?: string; error?: string }> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 5
    }) as any;
    
    // Validate payload
    if (decoded.type !== 'access' || !decoded.sub || decoded.iss !== 'softcodes.ai') {
      return { valid: false, error: 'Invalid token payload' };
    }
    
    console.log('[JWT-DEBUG] Custom HS256 verification succeeded:', { sub: decoded.sub });
    return { valid: true, clerkUserId: decoded.sub };
  } catch (error) {
    console.error('[JWT-DEBUG] Custom HS256 verification failed:', error);
    return { valid: false, error: error.message };
  }
}

// Update signinWithToken() or verifyJWTToken() to try custom first
export async function verifyJWTToken(token: string): Promise<{ isAuthenticated: boolean; clerkUserId?: string }> {
  // Step 1: Try custom HS256 (backend tokens)
  const customResult = await verifyCustomHS256Token(token);
  if (customResult.valid) {
    // Proceed with Supabase checks if needed
    return { isAuthenticated: true, clerkUserId: customResult.clerkUserId };
  }
  
  // Step 2: Fallback to Clerk JWKS/RS256 for Clerk tokens
  try {
    // Your existing JWKS verification code here
    const clerkResult = await JWTVerificationService.getInstance().verifyJWT(token);
    if (clerkResult.valid) {
      return { isAuthenticated: true, clerkUserId: clerkResult.userId };
    }
  } catch (clerkError) {
    console.error('[JWT-DEBUG] Clerk JWKS verification failed:', clerkError);
  }
  
  return { isAuthenticated: false };
}
```

**Security Note**: For production, fetch `JWT_SECRET` dynamically from a secure endpoint during extension initialization (e.g., `/api/extension/config`), or use asymmetric signing on backend.

## 9. API Fallback Fix (Localhost Calls)

The extension falls back to `http://localhost:3000/api/auth/validate-session` when JWKS fails.

**Fix**: Make the fallback URL environment-aware (in `unifiedAuthService.ts` or config):

```typescript
// Environment-aware API base URL
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.softcodes.ai/api/extension'
  : 'http://localhost:3000/api/extension';

// Update fallback validation call
const VALIDATE_ENDPOINT = `${API_BASE_URL}/validate`; // New endpoint for token validation

// In validateTokenWithAPI()
async function validateTokenWithAPI(token: string): Promise<{ valid: boolean }> {
  try {
    const response = await fetch(VALIDATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ token }) // If needed
    });
    const data = await response.json();
    return { valid: data.valid };
  } catch (error) {
    console.error('[API-DEBUG] Fallback validation failed:', error);
    return { valid: false };
  }
}
```

**Backend Support**: Create the validation endpoint in your Next.js app:

```typescript
// api/extension/auth/validate/route.ts (new file)
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '../../../../utils/jwt.js'; // Adjust path

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    
    if (!decoded || !decoded.sub) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 401 });
    }

    return NextResponse.json({ valid: true, userId: decoded.sub });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
```

## Testing the Full Flow

1. **Initiate Auth**: Trigger login in extension → Browser opens → User authenticates with Clerk.
2. **Callback**: Extension receives code/state → Exchanges for tokens via `/api/auth/token`.
3. **Token Usage**: Use access_token for API calls → Verify with custom HS256 or fallback to `/api/extension/auth/validate`.
4. **Refresh**: On 401, refresh via `/api/auth/refresh-token`.
5. **Debug**: Add logs for each step and check VSCode output panel for [JWT-DEBUG] and [API-DEBUG] messages.

These changes ensure robust token handling without garbling or algo mismatches. Deploy backend first, then update extension package.json with new dependencies (jsonwebtoken if needed) and rebuild.