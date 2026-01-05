import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateAccessToken, verifyJWT } from '../utils/jwt.js';

/**
 * Token endpoint for refreshing access tokens
 * Supports OAuth 2.0 refresh_token grant type
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { grant_type, refresh_token } = req.body;

  if (grant_type !== 'refresh_token') {
    return res.status(400).json({ 
      error: 'Invalid grant_type',
      error_description: 'Only refresh_token grant type is supported'
    });
  }

  if (!refresh_token) {
    return res.status(400).json({ 
      error: 'Missing refresh_token',
      error_description: 'refresh_token parameter is required'
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        error_description: 'Missing required environment variables'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify refresh token is valid JWT
    let tokenPayload;
    try {
      tokenPayload = verifyJWT(refresh_token);
      
      if (tokenPayload.type !== 'refresh') {
        return res.status(401).json({ 
          error: 'Invalid token',
          error_description: 'Provided token is not a refresh token'
        });
      }
    } catch (error) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        error_description: 'Token verification failed'
      });
    }

    // Check if refresh token exists in database and is not expired
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refresh_token)
      .single();

    if (tokenError || !tokenRecord) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        error_description: 'Token not found in database'
      });
    }

    // Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      // Clean up expired token
      await supabase.from('refresh_tokens').delete().eq('id', tokenRecord.id);
      return res.status(401).json({ 
        error: 'Refresh token expired',
        error_description: 'Token has expired and must be re-authenticated'
      });
    }

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', tokenRecord.clerk_user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        error: 'User not found',
        error_description: 'User associated with token does not exist'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user, tokenRecord.session_id);

    // Update last_used_at timestamp
    await supabase
      .from('refresh_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    console.log('Token refresh successful for user:', user.clerk_id);

    return res.status(200).json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours in seconds
      scope: 'vscode-extension'
    });
  } catch (error) {
    console.error('Error in token refresh:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      error_description: 'An unexpected error occurred'
    });
  }
}