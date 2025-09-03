import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('complete-vscode-auth: Function started');
    const { state, clerk_user_id, redirect_uri } = req.body

    console.log('complete-vscode-auth: Received parameters - state:', state, 'clerk_user_id:', clerk_user_id, 'redirect_uri:', redirect_uri);

    if (!state || !clerk_user_id || !redirect_uri) {
      console.error('complete-vscode-auth: Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    console.log('complete-vscode-auth: SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Not Loaded');
    console.log('complete-vscode-auth: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify the OAuth code exists and is valid
    const { data: oauthData, error: oauthError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('state', state)
      .eq('redirect_uri', redirect_uri)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (oauthError || !oauthData) {
      console.error('complete-vscode-auth: Invalid or expired authorization code. Error:', oauthError, 'Data:', oauthData);
      return res.status(400).json({ error: 'Invalid or expired authorization code' })
    }
    console.log('complete-vscode-auth: OAuth code verified. OAuth Data:', oauthData);

    // Update the oauth_codes entry with the clerk_user_id
    const { error: updateError } = await supabase
      .from('oauth_codes')
      .update({ clerk_user_id: clerk_user_id })
      .eq('state', state)

    if (updateError) {
      console.error('complete-vscode-auth: Error updating oauth_codes:', updateError);
      return res.status(500).json({ error: 'Failed to complete authentication' })
    }
    console.log('complete-vscode-auth: OAuth code updated with Clerk user ID.');

    // Ensure user exists in users table
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          clerk_id: clerk_user_id,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'clerk_id' }
      )

    if (upsertError) {
      console.error('complete-vscode-auth: Error upserting user:', upsertError);
      // Don't fail the request if user upsert fails, as it's not critical
    }
    console.log('complete-vscode-auth: User upserted successfully (or already existed).');

    return res.status(200).json({
      success: true,
      message: 'Authentication completed successfully'
    })

  } catch (error) {
    console.error('complete-vscode-auth: Complete VSCode auth error:', error);
    return res.status(500).json({ error: 'Internal server error' })
  }
}