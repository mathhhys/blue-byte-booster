import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { generateSessionId, generateJWT } from '../../../api/utils/jwt.js';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TOKEN API DEBUG START ===');
    console.log('Env vars check: CLERK_SECRET_KEY:', !!process.env.CLERK_SECRET_KEY);
    console.log('Env vars check: SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Env vars check: NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Env vars check: JWT_SECRET:', !!process.env.JWT_SECRET);

    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid auth header');
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    console.log('Clerk token length:', clerkToken.length);
    console.log('Verifying Clerk token...');
    const claims = await verifyToken(clerkToken, {
      jwtKey: process.env.CLERK_SECRET_KEY!,
      issuer: 'https://clerk.softcodes.ai'
    });
    console.log('✅ Clerk claims:', { sub: claims.sub, email: claims.email });

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    // Fetch user data from Supabase (using service role for server-side)
    console.log('Creating Supabase client...');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('✅ Supabase client created');

    console.log('Querying users table for clerkId:', clerkId);
    const { data: userData, error } = await supabase
      .from('users')
      .select('clerk_id, email, plan_type, credits, organization_id')
      .eq('clerk_id', clerkId)
      .single();

    console.log('Supabase query result:', { data: !!userData, error: error?.message });
    if (error || !userData) {
      console.error('User fetch error:', error);
      return res.status(404).json({ error: 'User not found in database' });
    }
    console.log('✅ User data fetched:', { clerk_id: userData.clerk_id, plan_type: userData.plan_type });

    console.log('Generating session ID and JWT...');
    const sessionId = generateSessionId();
    const accessToken = generateJWT(userData, sessionId);
    console.log('✅ JWT generated, length:', accessToken.length);

    const expiresIn = 24 * 60 * 60; // 24 hours in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('Returning success response');
    res.status(200).json({
      success: true,
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });
    console.log('=== TOKEN API DEBUG END ===');

  } catch (error) {
    const err = error as Error;
    console.error('❌ TOKEN API EXCEPTION:', err);
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
    console.log('=== TOKEN API DEBUG END (ERROR) ===');
  }
}