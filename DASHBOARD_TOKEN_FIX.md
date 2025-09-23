# Fix for 404 Error on /api/dashboard-token/generate

## Issue Description
The 404 error occurred when attempting to generate a backend JWT token for the VSCode extension from the dashboard (softcodes.ai/dashboard). The frontend in [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx:232-318) makes a POST request to `/api/dashboard-token/generate` with a Clerk session token, but the route did not exist, resulting in "Backend token generation failed: 404 - The page could not be found".

**Root Cause**: Missing Next.js API route for token generation. The endpoint is required to verify the user's Clerk token, fetch user data from Supabase, and issue a short-lived JWT for extension authentication.

**Impact**: Users cannot generate tokens for VSCode extension integration, blocking secure backend access (e.g., credits, plans).

## Solution Overview
- Created the missing API route at [`api/dashboard-token/generate/route.ts`](api/dashboard-token/generate/route.ts).
- Uses Clerk for token verification, Supabase for user data retrieval, and existing JWT utilities for signing.
- No frontend changes needed; existing error handling (toasts, dev mock) suffices.
- JWT expiry: 24 hours (configurable via code).
- Security: Server-side verification; service role key for Supabase (bypasses RLS for admin query).

## Implementation Details

### API Route Code
The full handler in [`api/dashboard-token/generate/route.ts`](api/dashboard-token/generate/route.ts):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { generateSessionId, generateJWT } from '../../../api/utils/jwt';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const clerkToken = authHeader.substring(7);
    const claims = await verifyToken(clerkToken, { 
      jwtKey: process.env.CLERK_JWT_KEY!
    });

    const clerkId = claims.sub;
    if (!clerkId) {
      return NextResponse.json({ error: 'Invalid Clerk token' }, { status: 401 });
    }

    // Fetch user data from Supabase (using service role for server-side)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: userData, error } = await supabase
      .from('users')
      .select('clerk_id, email, plan_type, credits, organization_id')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !userData) {
      console.error('User fetch error:', error);
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const sessionId = generateSessionId();
    const accessToken = generateJWT(userData, sessionId);

    const expiresIn = 24 * 60 * 60; // 24 hours in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return NextResponse.json({
      success: true,
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Key Components
- **Clerk Verification**: Uses `@clerk/backend`'s `verifyToken` with `CLERK_JWT_KEY` from env.
- **Supabase Query**: Direct query to 'users' table using service role key (admin access; ensure RLS allows or use service role for this endpoint).
- **JWT Generation**: Leverages [`api/utils/jwt.ts`](api/utils/jwt.ts:8-22) `generateJWT`, including user claims (clerk_id, email, plan_type, etc.) and 24h expiry.
- **Response Format**: Matches frontend expectations for success/error handling.
- **Error Handling**: 401 for auth issues, 404 for missing user, 500 for server errors; logs for debugging.

### Environment Variables Required
Add to `.env.local` and Vercel dashboard:
```
CLERK_JWT_KEY=your_clerk_jwt_key_from_dashboard
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret (already used in utils/jwt.ts)
```

### Testing Steps
1. **Local Testing**:
   - Run `npm run dev`.
   - Navigate to http://localhost:3000/dashboard, sign in.
   - Click "Generate Extension Token" – should succeed without 404, show token.
   - Verify token: Decode at jwt.io; check claims and expiry.
   - Test invalid token: Manually call API with bad header (expect 401).

2. **Extension Integration**:
   - Paste generated token into VSCode extension settings.
   - Run backend-api-example/test-vscode-auth-mock.js or actual extension to confirm auth works.

3. **Edge Cases**:
   - No user in DB: Expect 404.
   - Invalid Clerk token: 401.
   - Missing env vars: 500 with logs.

### Deployment
- Commit and push: `git add . && git commit -m "Add dashboard token generation API route" && git push`.
- Vercel auto-deploys if linked; or `vercel deploy`.
- Verify on softcodes.ai/dashboard post-deploy.
- Monitor Vercel logs for errors.

### Frontend Notes
No changes required. The Dashboard already:
- Logs errors (line 266-271).
- Shows destructive toast on failure (line 309-313).
- Uses mock in DEV (line 299-307).

Optional enhancement: Add a "Retry" button to the error toast if needed.

## Auth Flow
```
Frontend (Dashboard) → POST /api/dashboard-token/generate (Bearer: clerk_token)
  ↓
Clerk verifyToken → claims (clerk_id)
  ↓
Supabase query (service role) → userData (email, plan, credits)
  ↓
generateJWT (utils/jwt.ts) → access_token (24h expiry)
  ↓
Response: { success: true, access_token, expires_in: 86400 }
Extension uses access_token for backend calls
```

## Future Improvements
- Rate limiting on endpoint (use existing middleware if available).
- Shorter expiry (e.g., 1h) for security.
- Include credits in JWT for extension caching.
- Add tests: e.g., src/_tests_/api/dashboard-token.test.ts.

This fix resolves the 404 and enables VSCode extension token generation. Contact support if deployment issues arise.