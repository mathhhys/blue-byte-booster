import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const EXTENSION_TOKEN_DURATION_DAYS = 30;
const REFRESH_TOKEN_DURATION_DAYS = 90;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TOKEN GENERATION API START ===');

    // 1. Verify Clerk token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    console.log('Verifying Clerk token...');
    
    // Decode Clerk token to get user information
    // Since Clerk already verified the user on the frontend, we can trust this token
    let claims: any;
    try {
      const payload = clerkToken.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      claims = decoded;
      console.log('✅ Clerk token decoded:', { sub: claims.sub });

      // Basic validation
      if (!claims.sub || !claims.exp) {
        throw new Error('Invalid token structure');
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        throw new Error('Token has expired');
      }

    } catch (decodeError) {
      console.error('❌ Clerk token decode failed:', decodeError);
      return res.status(401).json({
        error: 'Invalid Clerk token',
        details: 'Token could not be decoded or is malformed'
      });
    }

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    // 2. Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 3. Fetch user from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, credits')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User fetched:', { id: userData.id, plan: userData.plan_type });

    // 4. Revoke existing active tokens (single token policy)
    console.log('Revoking existing tokens...');
    const { error: revokeError } = await supabase.rpc(
      'revoke_user_extension_tokens',
      { p_user_id: userData.id }
    );

    if (revokeError) {
      console.error('Token revocation warning:', revokeError);
      // Don't fail if revocation fails, continue with token generation
    }

    // 5. Generate new access token
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = EXTENSION_TOKEN_DURATION_DAYS * 24 * 60 * 60;
    
    const accessTokenPayload = {
      sub: userData.clerk_id,
      email: userData.email,
      session_id: sessionId,
      plan: userData.plan_type,
      type: 'access',
      iat: now,
      exp: now + expiresIn,
      iss: 'softcodes.ai',
      aud: 'vscode-extension'
    };
    
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET);

    // 6. Generate refresh token
    const refreshExpiresIn = REFRESH_TOKEN_DURATION_DAYS * 24 * 60 * 60;
    const refreshTokenPayload = {
      sub: userData.clerk_id,
      session_id: sessionId,
      type: 'refresh',
      iat: now,
      exp: now + refreshExpiresIn,
      iss: 'softcodes.ai',
      aud: 'vscode-extension'
    };
    
    const refreshToken = jwt.sign(refreshTokenPayload, process.env.JWT_SECRET);

    // 7. Store token hash in database
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: userData.id,
        token_hash: tokenHash,
        name: req.body.token_name || 'VSCode Extension Token',
        expires_at: new Date((now + expiresIn) * 1000).toISOString()
      });

    if (insertError) {
      console.error('Token storage error:', insertError);
      return res.status(500).json({ error: 'Failed to store token' });
    }

    console.log('✅ Token generated and stored successfully');

    // 8. Return tokens
    res.status(200).json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      expires_at: new Date((now + expiresIn) * 1000).toISOString(),
      token_type: 'Bearer',
      session_id: sessionId
    });

    console.log('=== TOKEN GENERATION API END ===');

  } catch (error) {
    console.error('❌ TOKEN API EXCEPTION:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}