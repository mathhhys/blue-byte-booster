import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const LONG_LIVED_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months in seconds
const BCRYPT_SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    // Extract and verify Clerk token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const clerkToken = authHeader.substring(7);
    const claims = await verifyToken(clerkToken, {
      jwtKey: process.env.CLERK_JWT_KEY!,
    });

    const clerkId = claims.sub;
    if (!clerkId) {
      return NextResponse.json({ error: 'Invalid Clerk token' }, { status: 401 });
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const userId = userData.id;

    // Revoke existing tokens for this user
    const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
      p_user_id: userId,
    });

    if (revokeError) {
      console.error('Token revocation error:', revokeError);
      return NextResponse.json({ error: 'Failed to revoke existing tokens' }, { status: 500 });
    }

    // Generate long-lived JWT
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + LONG_LIVED_EXPIRES_SECONDS;

    const payload = {
      sub: clerkId,
      type: 'extension_long_lived',
      iat,
      exp,
      iss: 'softcodes.ai',
      aud: 'vscode-extension',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' });

    // Hash the token for secure storage
    const tokenHash = bcrypt.hashSync(token, BCRYPT_SALT_ROUNDS);

    // Calculate expires_at in ISO
    const expiresAt = new Date(exp * 1000).toISOString();

    // Insert into extension_tokens table
    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        name: 'VSCode Long-Lived Token',
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Token insertion error:', insertError);
      return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });
    }

    // Log generation
    console.log(`Long-lived token generated for user ${clerkId} (ID: ${userId}), expires at ${expiresAt}`);

    return NextResponse.json({
      success: true,
      access_token: token,
      expires_in: LONG_LIVED_EXPIRES_SECONDS,
      expires_at: expiresAt,
      token_type: 'Bearer',
      type: 'long_lived',
      usage: 'vscode_extension',
    });

  } catch (error) {
    console.error('Long-lived token generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}