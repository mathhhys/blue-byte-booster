import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  const { state, clerk_user_id, authorization_code, email, username } = req.body;

  if (!state || !clerk_user_id || !authorization_code) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: state, clerk_user_id, authorization_code'
    });
  }

  try {
    // Create Supabase client with service role
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

    // Find the OAuth session by state
    const { data: oauthSession, error: fetchError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('state', state)
      .single();

    if (fetchError || !oauthSession) {
      console.error('OAuth session not found:', fetchError);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired state'
      });
    }

    // Check if session is expired
    if (new Date(oauthSession.expires_at) < new Date()) {
      await supabase.from('oauth_codes').delete().eq('state', state);
      return res.status(400).json({
        success: false,
        error: 'OAuth session expired'
      });
    }

    // Update the OAuth session with authorization code and clerk_user_id
    const { error: updateError } = await supabase
      .from('oauth_codes')
      .update({
        authorization_code,
        clerk_user_id,
        session_id: oauthSession.id
      })
      .eq('state', state);

    if (updateError) {
      console.error('Failed to update OAuth session:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update authorization code'
      });
    }

    // Ensure user exists in database (upsert)
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        clerk_id: clerk_user_id,
        email: email || '',
        username: username || email?.split('@')[0] || 'user',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'clerk_id',
        ignoreDuplicates: false
      });

    if (userError) {
      console.error('Failed to upsert user:', userError);
      // Don't fail the request if user update fails, just log it
    }

    console.log('Authorization code updated successfully:', { state, clerk_user_id });

    return res.status(200).json({
      success: true,
      authorization_code,
      redirect_uri: oauthSession.redirect_uri
    });
  } catch (error) {
    console.error('Error in update-auth-code:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}