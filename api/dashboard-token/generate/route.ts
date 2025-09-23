import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { generateSessionId, generateJWT } from '../../../api/utils/jwt';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const clerkToken = authHeader.substring(7);
    const claims = await verifyToken(clerkToken, {
      jwtKey: process.env.CLERK_JWT_KEY!
    });

    const clerkId = claims.sub;
    if (!clerkId) {
      return NextResponse.json({ error: 'Invalid Clerk token' }, { status: 401 });
    }

    // Fetch user data from Supabase (using service role for server-side)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: userData, error } = await supabase
      .from('users')
      .select('clerk_id, email, plan_type, credits, organization_id')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !userData) {
      console.error('User fetch error:', error);
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const sessionId = generateSessionId();
    const accessToken = generateJWT(userData, sessionId);

    const expiresIn = 24 * 60 * 60; // 24 hours in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return NextResponse.json({
      success: true,
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}