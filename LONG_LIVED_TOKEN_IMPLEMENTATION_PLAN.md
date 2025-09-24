# Long-Lived Token Implementation Plan

## Overview
This document provides a comprehensive plan to fix the current token generation system in the dashboard, which currently returns short-lived Clerk tokens instead of custom 4-month JWTs for VSCode extension authentication.

## Problem Analysis

### Current Issues
1. **Wrong Token Type**: [`api/extension/auth/token.ts`](api/extension/auth/token.ts:152-158) returns Clerk session tokens directly
2. **Short Expiration**: Clerk tokens expire in ~1 hour, not 4 months as required
3. **No Token Management**: No database tracking of issued extension tokens
4. **Inaccurate Timing**: Tokens aren't generated "immediately" - they use existing Clerk token expiration

### Current vs Target Flow

**Current (Problematic)**:
```
Dashboard → POST /api/extension/auth/token → Verify Clerk Token → Return Same Clerk Token → VSCode Extension (expires in 1hr)
```

**Target (Solution)**:
```
Dashboard → POST /api/extension/auth/token → Verify Clerk Token → Generate 4-month JWT → Store in DB → Return Custom JWT → VSCode Extension (valid 4 months)
```

## Implementation Plan

### 1. Database Schema Enhancement

**File**: `backend-api-example/migrations/20250924_add_extension_tokens.sql`

```sql
-- Extension tokens table for tracking long-lived API tokens
CREATE TABLE IF NOT EXISTS extension_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'VSCode Extension Token',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_extension_tokens_user_id ON extension_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_hash ON extension_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_expires ON extension_tokens(expires_at);

-- RLS policies
ALTER TABLE extension_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extension tokens" ON extension_tokens
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_extension_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM extension_tokens 
  WHERE expires_at < NOW() 
  AND revoked_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke user's existing tokens (for single-token policy)
CREATE OR REPLACE FUNCTION revoke_user_extension_tokens(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE extension_tokens 
  SET revoked_at = NOW()
  WHERE user_id = p_user_id 
  AND revoked_at IS NULL 
  AND expires_at > NOW();
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Enhanced JWT Utilities

**File**: `src/utils/jwt.ts` (enhance existing functions)

```typescript
// Add new function for extension tokens
export function generateExtensionJWT(userData: any): { token: string; expiresAt: Date; hash: string } {
  const now = Math.floor(Date.now() / 1000);
  const fourMonthsInSeconds = 4 * 30 * 24 * 60 * 60; // 4 months
  const expiresAt = new Date((now + fourMonthsInSeconds) * 1000);
  
  const payload = {
    sub: userData.clerk_id,
    email: userData.email,
    org_id: userData.organization_id,
    plan: userData.plan_type,
    type: 'extension',
    iat: now,
    exp: now + fourMonthsInSeconds,
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET!);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, expiresAt, hash };
}

export function verifyExtensionJWT(token: string): any {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (decoded.type !== 'extension') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid extension token');
  }
}
```

### 3. Updated Token Generation API

**File**: `api/extension/auth/token.ts` (complete rewrite)

```typescript
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { generateExtensionJWT } from '@/src/utils/jwt';
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Clerk token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    const claims = await verifyToken(clerkToken, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch user data
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, organization_id')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !userData) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    // Revoke existing tokens (single token policy)
    await supabase.rpc('revoke_user_extension_tokens', { p_user_id: userData.id });

    // Generate new extension token
    const { token, expiresAt, hash } = generateExtensionJWT(userData);

    // Store token metadata in database
    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: userData.id,
        token_hash: hash,
        name: 'VSCode Extension Token',
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Error storing token:', insertError);
      return res.status(500).json({ error: 'Failed to store token' });
    }

    // Calculate response data
    const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    res.status(200).json({
      success: true,
      access_token: token,
      expires_in: expiresIn,
      expires_at: expiresAt.toISOString(),
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 4. Enhanced Authentication Middleware

**File**: `backend-api-example/middleware/auth.js` (enhance existing)

```javascript
// Add extension token verification function
async function verifyExtensionToken(token) {
  try {
    // First verify JWT signature and structure
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'extension') {
      throw new Error('Not an extension token');
    }

    // Check if token exists and is not revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const { data: tokenData, error } = await supabase
      .from('extension_tokens')
      .select('user_id, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !tokenData) {
      throw new Error('Token not found in database');
    }

    if (tokenData.revoked_at) {
      throw new Error('Token has been revoked');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Token has expired');
    }

    // Update last_used_at
    await supabase
      .from('extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    return {
      clerkUserId: decoded.sub,
      userId: tokenData.user_id,
      planType: decoded.plan
    };

  } catch (error) {
    throw new Error('Invalid extension token: ' + error.message);
  }
}

// Update main auth middleware
const authenticateClerkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Mock token handling
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
      req.auth = {
        clerkUserId: clerkUserId,
        isAdmin: false
      };
      return next();
    }

    let authResult;

    try {
      // Try extension token first
      authResult = await verifyExtensionToken(token);
    } catch (extensionError) {
      // Fall back to existing Clerk/JWT verification
      try {
        const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 5 });
        authResult = { clerkUserId: decoded.clerkUserId };
      } catch (jwtError) {
        const clerkDecoded = await verifyClerkToken(token);
        authResult = { clerkUserId: clerkDecoded.clerkUserId };
      }
    }

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, plan_type')
      .eq('clerk_id', authResult.clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.auth = {
      clerkUserId: authResult.clerkUserId,
      userId: authResult.userId || userData.id,
      planType: authResult.planType || userData.plan_type,
      isAdmin: userData.plan_type === 'admin'
    };

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};
```

### 5. Updated Token Validation API

**File**: `api/extension/auth/validate.ts` (enhance existing)

```typescript
import { verifyExtensionJWT } from '@/src/utils/jwt';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT structure and signature
    const decoded = verifyExtensionJWT(token);
    
    // Check database for token status
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const { data: tokenData, error } = await supabase
      .from('extension_tokens')
      .select('expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !tokenData) {
      return res.status(401).json({ valid: false, error: 'Token not found' });
    }

    if (tokenData.revoked_at) {
      return res.status(401).json({ valid: false, error: 'Token revoked' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({ valid: false, error: 'Token expired' });
    }

    res.status(200).json({ 
      valid: true, 
      userId: decoded.sub,
      expiresAt: tokenData.expires_at
    });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
}
```

### 6. Enhanced Dashboard UI

**File**: `src/pages/Dashboard.tsx` (modify VSCode Extension section)

```typescript
// Add to state declarations
const [tokenInfo, setTokenInfo] = useState<{
  expiresAt?: string;
  createdAt?: string;
  isExpired?: boolean;
} | null>(null);

// Update generateToken function
const generateToken = async () => {
  if (!user?.id) {
    toast({
      title: "Authentication Error",
      description: "User not authenticated",
      variant: "destructive",
    });
    return;
  }

  setIsGenerating(true);
  try {
    const clerkToken = await getToken();
    
    if (!clerkToken) {
      throw new Error('Failed to get Clerk authentication token');
    }
    
    const response = await fetch('/api/extension/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clerkToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token generation failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.access_token) {
      setExtensionToken(data.access_token);
      setTokenInfo({
        expiresAt: data.expires_at,
        createdAt: new Date().toISOString(),
        isExpired: false
      });
      
      const monthsUntilExpiry = Math.floor(data.expires_in / (30 * 24 * 60 * 60));
      
      toast({
        title: "Token Generated",
        description: `Long-lived extension token generated. Valid for ${monthsUntilExpiry} months.`,
      });
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (error) {
    toast({
      title: "Token Generation Failed",
      description: error instanceof Error ? error.message : "Failed to generate extension token",
      variant: "destructive",
    });
  } finally {
    setIsGenerating(false);
  }
};

// Update the JSX in the VSCode Extension card
{extensionToken && tokenInfo && (
  <div className="mt-3 p-3 bg-[#1a1a1a] rounded border border-white/10">
    <div className="text-xs text-gray-400 space-y-1">
      <div>Created: {new Date(tokenInfo.createdAt!).toLocaleDateString()}</div>
      <div>Expires: {new Date(tokenInfo.expiresAt!).toLocaleDateString()}</div>
      <div className="text-green-400">✓ Valid for 4 months</div>
    </div>
  </div>
)}
```

### 7. Environment Configuration

**Required Environment Variables**:
```
JWT_SECRET=your_jwt_secret_key_here
CLERK_SECRET_KEY=your_clerk_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 8. Testing Strategy

**Files to create**:
- `src/_tests_/api/extension/long-lived-token.test.ts`
- `backend-api-example/test-long-lived-token.js`

**Test Cases**:
1. Token generation creates 4-month JWT
2. Token validation works correctly
3. Previous tokens are revoked on new generation
4. Expired tokens are rejected
5. Revoked tokens are rejected
6. Token usage updates last_used_at

### 9. Migration and Deployment

**Steps**:
1. Run database migration: `backend-api-example/migrations/20250924_add_extension_tokens.sql`
2. Deploy updated API endpoints
3. Update environment variables
4. Test token generation in dashboard
5. Verify VSCode extension authentication

## Benefits of This Implementation

✅ **4-month validity**: Custom JWTs with precise 4-month expiration  
✅ **Immediate generation**: Tokens created instantly when requested  
✅ **Accurate timing**: Exact expiration tracking from generation time  
✅ **Single active token**: New generation revokes previous token  
✅ **Security**: Token hashing, revocation support, and database tracking  
✅ **Backward compatibility**: Existing auth middleware supports both token types  
✅ **Simple management**: Basic dashboard UI for token status and regeneration

## Security Considerations

- **Token Storage**: Only hashed versions stored in database
- **Single Token Policy**: New token generation automatically revokes previous tokens
- **Proper Expiration**: Database-tracked expiration with cleanup functions
- **Revocation Support**: Tokens can be revoked immediately if needed
- **Usage Tracking**: Last used timestamp for monitoring

This implementation provides the exact solution requested: tokens that are issued immediately and remain valid for a full 4 months, replacing the current short-lived and inaccurate token system.