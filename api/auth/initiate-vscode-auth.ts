import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Support both GET and POST for browser compatibility
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract parameters from query string (GET) or body (POST)
  const { code_challenge, state, redirect_uri } = req.method === 'GET'
    ? req.query
    : req.body;

  if (!code_challenge || !state || !redirect_uri) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: code_challenge, state, redirect_uri'
    });
  }

  try {
    // Validate inputs
    const challengeStr = code_challenge as string;
    const stateStr = state as string;
    
    if (challengeStr.length < 43 || challengeStr.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Invalid code_challenge length (must be 43-128 characters)'
      });
    }
    
    if (stateStr.length < 16) {
      return res.status(400).json({
        success: false,
        error: 'State must be at least 16 characters'
      });
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Store OAuth session with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from('oauth_codes')
      .insert({
        id: sessionId,
        state: stateStr,
        code_challenge: challengeStr,
        redirect_uri: redirect_uri as string,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Failed to insert OAuth session:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize authentication session'
      });
    }

    console.log('OAuth session stored:', { state: stateStr, sessionId });

    // Construct callback URL for after Clerk authentication
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/vscode-auth-callback?state=${encodeURIComponent(stateStr)}&vscode_redirect_uri=${encodeURIComponent(redirect_uri as string)}`;

    // Build Clerk sign-in URL
    const clerkDomain = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API || process.env.CLERK_DOMAIN;
    
    if (!clerkDomain) {
      console.error('Missing Clerk domain configuration');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const authUrl = `https://${clerkDomain}/sign-in?redirect_url=${encodeURIComponent(callbackUrl)}`;

    console.log('Generated auth URL:', authUrl);

    return res.status(200).json({
      success: true,
      auth_url: authUrl,
      session_id: sessionId
    });
  } catch (error) {
    console.error('Error in initiate-vscode-auth:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}