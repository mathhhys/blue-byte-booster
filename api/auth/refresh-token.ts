import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error: Missing JWT_SECRET' });
    }

    // Verify refresh token
    let decodedRefresh: any;
    try {
      decodedRefresh = jwt.verify(refresh_token, jwtSecret, { algorithms: ['HS256'] });
    } catch (verifyError) {
      console.error('Refresh token verification failed:', verifyError);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (decodedRefresh.type !== 'refresh' || !decodedRefresh.sub) {
      return res.status(401).json({ error: 'Invalid refresh token payload' });
    }

    const clerkUserId = decodedRefresh.sub;

    // Create Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify user still exists and fetch latest data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, credits')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      console.error('User not found during refresh:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new access token
    const accessTokenPayload = {
      sub: clerkUserId,
      user_id: userData.id,
      email: userData.email,
      plan_type: userData.plan_type,
      type: 'access',
      iss: 'softcodes.ai',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    const newAccessToken = jwt.sign(accessTokenPayload, jwtSecret, { algorithm: 'HS256' });

    // Optionally generate new refresh token (rotation for security)
    const newRefreshTokenPayload = {
      sub: clerkUserId,
      type: 'refresh',
      iss: 'softcodes.ai',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const newRefreshToken = jwt.sign(newRefreshTokenPayload, jwtSecret, { algorithm: 'HS256' });

    const expiresIn = 24 * 60 * 60; // 24 hours in seconds

    console.log('Token refresh successful for user:', clerkUserId);

    res.status(200).json({
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: expiresIn,
      token_type: 'Bearer',
    });
  } catch (error) {
    console.error('Error in refresh-token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}