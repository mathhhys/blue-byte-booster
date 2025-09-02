# VSCode Extension Authentication - Complete Fix Implementation Plan

## Overview
The authentication between VSCode extension and softcodes.ai website is broken due to multiple issues in the OAuth flow implementation. This plan provides step-by-step fixes.

## Fix Implementation Steps

### Step 1: Create Missing Database Tables
First, ensure the OAuth tables exist in Supabase:

```sql
-- oauth_codes table for PKCE flow
CREATE TABLE IF NOT EXISTS oauth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  authorization_code TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_oauth_codes_state ON oauth_codes(state);
CREATE INDEX idx_oauth_codes_authorization_code ON oauth_codes(authorization_code);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_clerk_user_id ON refresh_tokens(clerk_user_id);
```

### Step 2: Fix Backend API Endpoint
Update `backend-api-example/server.js` (line 516-569):

```javascript
// Initiate VSCode authentication flow
app.get('/api/auth/initiate-vscode-auth', async (req, res) => {
  try {
    const { redirect_uri } = req.query;
    
    if (!redirect_uri) {
      return res.status(400).json({ error: 'Missing redirect_uri parameter' });
    }
    
    const code_verifier = generateCodeVerifier();
    const code_challenge = await generateCodeChallenge(code_verifier);
    const state = generateRandomString(32);
    
    // Store OAuth data in database
    const { data, error } = await supabase
      .from('oauth_codes')
      .insert([{
        clerk_user_id: 'pending', // Will be updated after Clerk auth
        code_verifier,
        code_challenge,
        state,
        redirect_uri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }])
      .select();
    
    if (error) {
      console.error('Error storing OAuth code:', error);
      return res.status(500).json({ error: 'Failed to initiate authentication' });
    }
    
    // Build the absolute URL for Clerk authentication
    const baseUrl = process.env.FRONTEND_URL || 'https://softcodes.ai';
    const authUrl = `${baseUrl}/sign-in?redirect_url=${encodeURIComponent(
      `/auth/vscode-callback?state=${state}&vscode_redirect_uri=${encodeURIComponent(redirect_uri)}`
    )}`;
    
    res.json({
      success: true,
      code_challenge,
      state,
      auth_url: authUrl // Now returns absolute URL
    });
    
  } catch (error) {
    console.error('Error initiating VSCode authentication:', error);
    res.status(500).json({ error: 'Failed to initiate VSCode authentication' });
  }
});
```

### Step 3: Fix VscodeAuthCallback Component
Update `src/pages/VscodeAuthCallback.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const VscodeAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, isLoaded, isSignedIn } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      if (!isLoaded) return;

      if (!isSignedIn || !user) {
        setError('You must be signed in to complete VSCode authentication.');
        setTimeout(() => {
          const currentUrl = window.location.pathname + window.location.search;
          window.location.href = `/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`;
        }, 3000);
        return;
      }

      const state = searchParams.get('state');
      const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');

      if (!state || !vscodeRedirectUri) {
        setError('Missing required parameters for VSCode callback.');
        return;
      }

      setStatus('Generating authorization code...');

      try {
        // Generate a proper authorization code
        const authCode = btoa(`${user.id}:${state}:${Date.now()}`);
        
        // Update the OAuth record with the authorization code
        const response = await fetch('/api/auth/update-auth-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            state, 
            clerk_user_id: user.id,
            authorization_code: authCode 
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update authentication code.');
        }

        // Redirect back to VSCode with the proper authorization code
        const finalVscodeRedirect = new URL(decodeURIComponent(vscodeRedirectUri));
        finalVscodeRedirect.searchParams.set('code', authCode);
        finalVscodeRedirect.searchParams.set('state', state);

        setStatus('Redirecting to VSCode...');
        window.location.href = finalVscodeRedirect.toString();

      } catch (err) {
        console.error('Error processing VSCode auth callback:', err);
        setError('An unexpected error occurred during authentication.');
      }
    };

    handleCallback();
  }, [isLoaded, isSignedIn, user, searchParams]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center text-white">
        <Spinner className="w-10 h-10 mb-4" />
        <p>{status}</p>
      </div>
    </div>
  );
};
```

### Step 4: Update Backend Auth Routes
Update `backend-api-example/routes/auth.js` to handle the authorization code properly:

```javascript
// Update the auth code with proper authorization code
router.post('/update-auth-code', async (req, res) => {
  try {
    const { state, clerk_user_id, authorization_code } = req.body;

    if (!state || !clerk_user_id || !authorization_code) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const { data, error } = await supabase
      .from('oauth_codes')
      .update({ 
        clerk_user_id,
        authorization_code 
      })
      .eq('state', state);

    if (error) {
      console.error('Error updating auth code:', error);
      return res.status(500).json({ error: 'Failed to update auth code' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error updating auth code:', error);
    res.status(500).json({ error: 'Failed to update auth code' });
  }
});

// Fix token exchange to use authorization_code
router.post('/token', async (req, res) => {
  try {
    const { code, code_verifier, state, redirect_uri } = req.body;

    if (!code || !code_verifier || !state || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Fetch OAuth code by authorization_code, not state
    const { data: oauthCode, error: fetchError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('authorization_code', code) // Use authorization_code
      .eq('state', state)
      .single();

    if (fetchError || !oauthCode || new Date(oauthCode.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired authorization code' });
    }

    // Verify PKCE challenge
    const expectedCodeChallenge = await generateCodeChallenge(code_verifier);
    if (oauthCode.code_challenge !== expectedCodeChallenge) {
      return res.status(400).json({ error: 'Invalid code verifier' });
    }

    // Verify redirect_uri
    if (oauthCode.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'Invalid redirect URI' });
    }

    // Generate tokens using the clerk_user_id from the OAuth record
    const clerkUserId = oauthCode.clerk_user_id;
    const accessToken = generateAccessToken(clerkUserId);
    const refreshToken = generateRefreshToken(clerkUserId);
    
    // Store refresh token
    const { error: refreshError } = await supabase
      .from('refresh_tokens')
      .insert({
        clerk_user_id: clerkUserId,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

    if (refreshError) {
      console.error('Error storing refresh token:', refreshError);
      return res.status(500).json({ error: 'Failed to issue tokens' });
    }

    // Delete used OAuth code
    await supabase.from('oauth_codes').delete().eq('id', oauthCode.id);

    res.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600
    });

  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).json({ error: 'Failed to exchange code for tokens' });
  }
});
```

### Step 5: Environment Variables
Add to `.env` file:

```env
# Frontend URL for absolute redirects
FRONTEND_URL=https://softcodes.ai

# Clerk domain (if using custom domain)
CLERK_DOMAIN=clerk.softcodes.ai
```

### Step 6: Remove Conflicting Files
Delete `src/pages/extension/callback.tsx` as it uses Next.js code and conflicts with the React implementation.

### Step 7: VSCode Extension URI Scheme
Ensure the VSCode extension uses consistent URI scheme. Check the extension's `package.json`:

```json
{
  "contributes": {
    "uriSchemes": [
      "vscode-softcodes"
    ]
  }
}
```

And update all references to use `vscode-softcodes://` consistently.

## Testing Plan

### 1. Database Setup Test
```bash
# Check if tables exist
psql $DATABASE_URL -c "\dt oauth_codes"
psql $DATABASE_URL -c "\dt refresh_tokens"
```

### 2. API Endpoint Test
```bash
# Test initiate endpoint
curl "http://localhost:3001/api/auth/initiate-vscode-auth?redirect_uri=vscode-softcodes://auth/callback"
```

### 3. Full Flow Test
1. Start backend server
2. Open VSCode extension
3. Click "Sign In"
4. Should redirect to Clerk sign-in
5. After sign-in, should redirect back to VSCode
6. VSCode should receive valid authorization code

## Deployment Checklist

- [ ] Run database migrations to create tables
- [ ] Update backend server code
- [ ] Update frontend callback component
- [ ] Set environment variables
- [ ] Remove conflicting Next.js files
- [ ] Update VSCode extension URI scheme
- [ ] Test complete authentication flow
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test in production

## Error Handling

Add proper error logging at each step:

1. Database operation failures
2. Network request failures
3. Invalid parameters
4. Expired codes
5. PKCE validation failures

## Security Considerations

1. **State Parameter**: Always validate to prevent CSRF
2. **Code Expiry**: Set 10-minute expiry for authorization codes
3. **One-time Use**: Delete authorization codes after use
4. **PKCE**: Always validate code_verifier against code_challenge
5. **HTTPS**: Ensure all production URLs use HTTPS

## Monitoring

Add logging for:
- Authentication attempts
- Success/failure rates
- Token generation
- Error types and frequencies

This completes the fix implementation plan for VSCode extension authentication with Clerk and Supabase.