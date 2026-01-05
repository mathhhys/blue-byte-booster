import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { generateAccessToken, generateRefreshToken, generateSessionId, validatePKCE } from '../../utils/jwt.js';
import { resolveOrgAttributionClaims } from '../../utils/org-attribution.js';
import { verifyToken } from '@clerk/backend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, grant_type, code_verifier, refresh_token, state } = req.body;

  try {
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

    // Handle refresh token flow
    if (grant_type === 'refresh_token') {
      const { clerk_org_id } = req.body;
      return await handleRefreshToken(supabase, refresh_token, clerk_org_id, res);
    }

    // Handle authorization code flow
    if (grant_type === 'authorization_code') {
      const { clerk_org_id } = req.body;
      return await handleAuthorizationCode(
        supabase,
        code,
        code_verifier,
        state,
        clerk_org_id,
        res
      );
    }

    return res.status(400).json({ error: 'Invalid grant_type' });
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}

async function handleAuthorizationCode(
  supabase: any,
  code: string,
  codeVerifier: string,
  state: string,
  clerkOrgId: string | undefined,
  res: NextApiResponse
) {
  // Retrieve OAuth session
  const { data: oauthSession, error: fetchError } = await supabase
    .from('oauth_codes')
    .select('*')
    .eq('state', state)
    .eq('authorization_code', code)
    .single();

  if (fetchError || !oauthSession) {
    return res.status(400).json({ error: 'Invalid authorization code' });
  }

  // Validate PKCE
  const isPKCEValid = await validatePKCE(codeVerifier, oauthSession.code_challenge);
  
  if (!isPKCEValid) {
    console.error('PKCE verification failed');
    await supabase.from('oauth_codes').delete().eq('id', oauthSession.id);
    return res.status(400).json({ error: 'Invalid code verifier' });
  }

  // Check expiration
  if (new Date(oauthSession.expires_at) < new Date()) {
    await supabase.from('oauth_codes').delete().eq('id', oauthSession.id);
    return res.status(400).json({ error: 'Authorization code expired' });
  }

  // Get user data
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', oauthSession.clerk_user_id)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Resolve org attribution (seat-gated)
  let orgAttribution = null;
  if (clerkOrgId) {
    // We don't have Clerk claims here, so we'll use null and let it fallback to API
    orgAttribution = await resolveOrgAttributionClaims({
      supabase,
      clerkUserId: user.clerk_id,
      clerkOrgId,
      clerkClaims: null
    });
  }

  // Generate tokens
  const sessionId = generateSessionId();
  const accessToken = generateAccessToken(user, sessionId, orgAttribution);
  const refreshToken = generateRefreshToken(user, sessionId);

  // Store refresh token
  await supabase.from('refresh_tokens').insert({
    clerk_user_id: user.clerk_id,
    token: refreshToken,
    session_id: sessionId,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });

  // Update user's last login
  await supabase
    .from('users')
    .update({
      last_vscode_login: new Date().toISOString(),
      vscode_session_id: sessionId
    })
    .eq('id', user.id);

  // Delete used OAuth session
  await supabase.from('oauth_codes').delete().eq('id', oauthSession.id);

  return res.status(200).json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 86400,
    session_id: sessionId,
    user: {
      clerk_id: user.clerk_id,
      email: user.email,
      username: user.username,
      plan_type: user.plan_type,
      credits: user.credits,
      organization_id: user.organization_id
    }
  });
}

async function handleRefreshToken(
  supabase: any,
  refreshToken: string,
  clerkOrgId: string | undefined,
  res: NextApiResponse
) {
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  // Validate refresh token exists
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token', refreshToken)
    .single();

  if (tokenError || !tokenRecord) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // Check expiration
  if (new Date(tokenRecord.expires_at) < new Date()) {
    await supabase.from('refresh_tokens').delete().eq('id', tokenRecord.id);
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  // Get user data
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', tokenRecord.clerk_user_id)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Resolve org attribution (seat-gated)
  let orgAttribution = null;
  if (clerkOrgId) {
    orgAttribution = await resolveOrgAttributionClaims({
      supabase,
      clerkUserId: user.clerk_id,
      clerkOrgId,
      clerkClaims: null
    });
  }

  // Generate new access token
  const accessToken = generateAccessToken(user, tokenRecord.session_id, orgAttribution);

  // Update last_used_at for refresh token
  await supabase
    .from('refresh_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRecord.id);

  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 86400
  });
}