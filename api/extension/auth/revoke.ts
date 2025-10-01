import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TOKEN REVOCATION API START ===');

    // 1. Verify Clerk token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    
    let claims: any;
    try {
      claims = await verifyToken(clerkToken, {
        jwtKey: process.env.CLERK_SECRET_KEY!
      });
    } catch (error) {
      console.error('Clerk token verification failed:', error);
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid token' });
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

    // 3. Get user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 4. Revoke all active tokens or specific token
    const { token_to_revoke } = req.body;

    if (token_to_revoke) {
      // Revoke specific token
      const tokenHash = crypto
        .createHash('sha256')
        .update(token_to_revoke)
        .digest('hex');

      const { error } = await supabase
        .from('extension_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .eq('user_id', userData.id)
        .is('revoked_at', null);

      if (error) {
        console.error('Token revocation error:', error);
        throw error;
      }

      console.log('✅ Specific token revoked');
    } else {
      // Revoke all active tokens
      const { error } = await supabase.rpc(
        'revoke_user_extension_tokens',
        { p_user_id: userData.id }
      );

      if (error) {
        console.error('Bulk revocation error:', error);
        throw error;
      }

      console.log('✅ All active tokens revoked');
    }

    res.status(200).json({
      success: true,
      message: token_to_revoke 
        ? 'Token revoked successfully' 
        : 'All active tokens revoked successfully'
    });

    console.log('=== TOKEN REVOCATION API END ===');

  } catch (error) {
    console.error('❌ TOKEN REVOCATION API EXCEPTION:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}