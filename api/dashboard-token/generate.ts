import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { generateSessionId, generateAccessToken } from '../../src/utils/jwt.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    const claims = await verifyToken(clerkToken, {
      secretKey: process.env.CLERK_SECRET_KEY!
    });

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    // Fetch user data from Supabase (using service role for server-side)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: userData, error } = await supabase
      .from('users')
      .select('clerk_id, email, plan_type, credits, clerk_org_id')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !userData) {
      console.error('User fetch error:', error);
      return res.status(404).json({ error: 'User not found in database' });
    }

    const sessionId = generateSessionId();
    const accessToken = generateAccessToken(userData, sessionId);

    const expiresIn = 24 * 60 * 60; // 24 hours in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return res.status(200).json({
      success: true,
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}