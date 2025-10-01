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
    console.log('=== TOKEN REFRESH API START ===');

    const { refresh_token, current_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token' });
    }

    // 1. Verify refresh token
    let decoded: any;
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
      }
      decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
    } catch (error) {
      console.error('Refresh token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    console.log('✅ Refresh token verified for user:', decoded.sub);

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

    // 3. Fetch user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type')
      .eq('clerk_id', decoded.sub)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // 4. Revoke old token if provided
    if (current_token) {
      const oldTokenHash = crypto
        .createHash('sha256')
        .update(current_token)
        .digest('hex');

      await supabase
        .from('extension_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', oldTokenHash)
        .eq('user_id', userData.id);
      
      console.log('✅ Old token revoked');
    }

    // 5. Generate new access token
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = EXTENSION_TOKEN_DURATION_DAYS * 24 * 60 * 60;
    const sessionId = decoded.session_id; // Maintain session ID
    
    const newAccessTokenPayload = {
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
    
    const newAccessToken = jwt.sign(newAccessTokenPayload, process.env.JWT_SECRET);

    // 6. Generate new refresh token
    const refreshExpiresIn = REFRESH_TOKEN_DURATION_DAYS * 24 * 60 * 60;
    const newRefreshTokenPayload = {
      sub: userData.clerk_id,
      session_id: sessionId,
      type: 'refresh',
      iat: now,
      exp: now + refreshExpiresIn,
      iss: 'softcodes.ai',
      aud: 'vscode-extension'
    };
    
    const newRefreshToken = jwt.sign(newRefreshTokenPayload, process.env.JWT_SECRET);

    // 7. Store new token hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(newAccessToken)
      .digest('hex');

    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: userData.id,
        token_hash: tokenHash,
        name: 'VSCode Extension Token (Refreshed)',
        expires_at: new Date((now + expiresIn) * 1000).toISOString()
      });

    if (insertError) {
      console.error('Token storage error:', insertError);
      return res.status(500).json({ error: 'Failed to store refreshed token' });
    }

    console.log('✅ New tokens generated and stored');

    // 8. Return new tokens
    res.status(200).json({
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: expiresIn,
      expires_at: new Date((now + expiresIn) * 1000).toISOString(),
      token_type: 'Bearer'
    });

    console.log('=== TOKEN REFRESH API END ===');

  } catch (error) {
    console.error('❌ TOKEN REFRESH API EXCEPTION:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}