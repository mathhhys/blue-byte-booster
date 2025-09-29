import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code_challenge, state, redirect_uri } = req.body;

  if (!code_challenge || !state || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required parameters: code_challenge, state, redirect_uri' });
  }

  try {
    // Validate inputs
    if (code_challenge.length < 43 || code_challenge.length > 128) {
      return res.status(400).json({ error: 'Invalid code_challenge length' });
    }
    if (state.length < 16) {
      return res.status(400).json({ error: 'State must be at least 16 characters' });
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Store PKCE session data with 5-minute expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: insertError, data } = await supabase
      .from('auth_sessions')
      .insert({
        state,
        code_challenge,
        redirect_uri,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert auth session:', insertError);
      return res.status(500).json({ error: 'Failed to initialize authentication session' });
    }

    console.log('Auth session stored:', { state, sessionId: data.id });

    // Construct Clerk sign-in URL
    // Note: Clerk's standard sign-in URL. PKCE verification happens during token exchange.
    // The redirect_url points to the complete page, which will handle user identification.
    const clerkDomain = process.env.CLERK_DOMAIN || 'clerk.yourapp.com'; // Set in env
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const completeUrl = `${baseUrl}/auth/complete-vscode-auth?state=${encodeURIComponent(state)}&vscode_redirect_uri=${encodeURIComponent(redirect_uri)}`;

    const authUrl = `https://${clerkDomain}/sign-in?redirect_url=${encodeURIComponent(completeUrl)}`;

    console.log('Generated auth URL:', authUrl);

    res.status(200).json({
      success: true,
      auth_url: authUrl,
    });
  } catch (error) {
    console.error('Error in initiate-vscode-auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}