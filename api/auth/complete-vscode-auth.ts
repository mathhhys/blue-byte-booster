import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { resolveOrgAttributionClaims } from '../utils/org-attribution.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, code_verifier, state, redirect_uri, clerk_org_id } = req.body;

  if (!code || !code_verifier || !state || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required parameters: code, code_verifier, state, redirect_uri' });
  }

  try {
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

    // Retrieve auth session by state
    const { data: sessionData, error: fetchError } = await supabase
      .from('auth_sessions')
      .select('code_challenge, redirect_uri, expires_at')
      .eq('state', state)
      .single();

    if (fetchError || !sessionData) {
      console.error('Auth session not found or expired:', fetchError);
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    // Check expiry
    const now = new Date();
    if (new Date(sessionData.expires_at) < now) {
      await supabase.from('auth_sessions').delete().eq('state', state);
      return res.status(400).json({ error: 'Authentication session expired' });
    }

    // Verify redirect_uri
    if (sessionData.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'Redirect URI mismatch' });
    }

    // PKCE verification: compute SHA256(code_verifier) and compare to stored code_challenge
    const computedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (computedChallenge !== sessionData.code_challenge) {
      console.error('PKCE verification failed');
      await supabase.from('auth_sessions').delete().eq('state', state);
      return res.status(400).json({ error: 'PKCE verification failed' });
    }

    // Clean up session
    await supabase.from('auth_sessions').delete().eq('state', state);

    // Assume 'code' is the Clerk user ID (sub) from the authentication
    const clerkUserId = code;

    // Verify user exists in Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, credits')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Resolve org attribution (seat-gated)
    let orgAttribution = null;
    if (clerk_org_id) {
      orgAttribution = await resolveOrgAttributionClaims({
        supabase,
        clerkUserId,
        clerkOrgId: clerk_org_id,
        clerkClaims: null
      });
    }

    // Generate custom access token (HS256) for extension
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

      // Org attribution (seat-gated). If absent => personal.
      pool: orgAttribution?.pool === 'organization' ? 'organization' : 'personal',
      clerk_org_id: orgAttribution?.clerk_org_id || null,
      organization_id: orgAttribution?.organization_id || null,
      organization_name: orgAttribution?.organization_name || null,
      stripe_customer_id: orgAttribution?.stripe_customer_id || null,
      organization_subscription_id: orgAttribution?.organization_subscription_id || null,
      seat_id: orgAttribution?.seat_id || null,
      seat_role: orgAttribution?.seat_role || null,
      org_role: orgAttribution?.org_role || null
    };

    const accessToken = jwt.sign(accessTokenPayload, jwtSecret, { algorithm: 'HS256' });

    // Generate refresh token (longer expiry, 7 days)
    const refreshTokenPayload = {
      sub: clerkUserId,
      type: 'refresh',
      iss: 'softcodes.ai',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const refreshToken = jwt.sign(refreshTokenPayload, jwtSecret, { algorithm: 'HS256' });

    const expiresIn = 24 * 60 * 60; // 24 hours in seconds

    console.log('Token exchange successful for user:', clerkUserId);

    res.status(200).json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: 'Bearer',
      user: {
        id: userData.id,
        clerk_id: userData.clerk_id,
        email: userData.email,
        plan_type: userData.plan_type,
        credits: userData.credits,
      },
    });
  } catch (error) {
    console.error('Error in complete-vscode-auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}