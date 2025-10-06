import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';
import * as jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;  // Expect the access token for refresh

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    // First, try to verify the token with Clerk
    let claims;
    try {
      claims = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!
      });
    } catch (verifyError) {
      console.error('Clerk token verification failed:', verifyError);
      
      // If verification fails due to expiration, check if session is still active
      if (verifyError.message.includes('expired') || verifyError.message.includes('TokenExpiredError')) {
        // Decode the token to extract sub without verification
        const decoded = jwt.decode(token, { complete: true });
        if (decoded && decoded.payload && decoded.payload.sub) {
          const userId = decoded.payload.sub;
          
          // For session activity check, we need Clerk client
          const { createClerkClient } = await import('@clerk/backend');
          const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
          
          // Check if user is still active (not banned)
          const user = await clerk.users.getUser(userId as string);
          
          if (user.banned) {
            return res.status(401).json({ error: 'User account inactive. Please re-authenticate.' });
          }
          
          // User is active, proceed to generate new token
          claims = decoded.payload;  // Use decoded claims (not verified, but user active)
          console.log('Token expired but user active, generating new access token');
        } else {
          return res.status(401).json({ error: 'Invalid token format' });
        }
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const clerkUserId = claims.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

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

    // Generate new custom access token (since we can't issue new Clerk token from backend)
    // This maintains compatibility while using Clerk for verification
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error: Missing JWT_SECRET' });
    }

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

    // Generate new refresh token for future refreshes
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