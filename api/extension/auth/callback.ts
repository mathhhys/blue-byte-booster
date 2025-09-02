import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for VSCode extension
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      state, 
      code,
      clerk_user_id,
      redirect_uri 
    } = req.body

    if (!state || !code || !clerk_user_id) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'state, code, and clerk_user_id are required'
      })
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update the OAuth code with the authenticated user's clerk_id
    const { data: oauthData, error: oauthError } = await supabase
      .from('oauth_codes')
      .update({ 
        clerk_user_id: clerk_user_id 
      })
      .eq('code', code)
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .select()
      .single()

    if (oauthError || !oauthData) {
      console.error('OAuth code update error:', oauthError)
      return res.status(400).json({ 
        error: 'Invalid or expired authorization code',
        details: oauthError?.message
      })
    }

    // Verify user exists in the database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerk_user_id)
      .single()

    if (userError || !userData) {
      // User doesn't exist, they need to sign up first
      return res.status(400).json({ 
        error: 'User not found',
        details: 'Please sign up first before authenticating with VSCode'
      })
    }

    // Build the redirect URL with authorization code
    const redirectUrl = new URL(redirect_uri || oauthData.redirect_uri)
    redirectUrl.searchParams.append('code', code)
    redirectUrl.searchParams.append('state', state)

    // Return success with redirect URL
    return res.status(200).json({
      success: true,
      redirect_url: redirectUrl.toString(),
      message: 'Authentication successful. You can now close this window.'
    })

  } catch (error) {
    console.error('Extension auth callback error:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}