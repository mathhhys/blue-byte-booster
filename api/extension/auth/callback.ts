import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateJWT, generateRefreshToken, generateSessionId, validatePKCE } from '../../utils/jwt'

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
      // VSCode Extension format
      code,
      grant_type,
      code_verifier,
      
      // Website format (existing)
      state,
      clerk_user_id,
      redirect_uri
    } = req.body

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // BRIDGE LOGIC: Detect VSCode extension by grant_type
    if (grant_type === "authorization_code") {
      return await handleVSCodeFlow(req, res, supabase, { code, code_verifier, state, redirect_uri })
    } else {
      return await handleWebsiteFlow(req, res, supabase, { state, code, clerk_user_id, redirect_uri })
    }

  } catch (error) {
    console.error('Extension auth callback error:', error)
    return res.status(500).json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle VSCode Extension OAuth Flow
async function handleVSCodeFlow(req: VercelRequest, res: VercelResponse, supabase: any, { code, code_verifier, state, redirect_uri }: any) {
  if (!code || !state) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'code and state are required for VSCode flow'
    })
  }

  // 1. Get OAuth session data
  const { data: oauthData, error: oauthError } = await supabase
    .from('oauth_codes')
    .select('*')
    .eq('code', code)
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (oauthError || !oauthData) {
    console.error('OAuth code lookup error:', oauthError)
    return res.status(400).json({
      error: 'Invalid or expired authorization code',
      details: oauthError?.message
    })
  }

  if (!oauthData.clerk_user_id) {
    return res.status(400).json({
      error: 'Authentication incomplete',
      details: 'User must complete authentication in browser first'
    })
  }

  // 2. Verify PKCE code_verifier (security check)
  if (code_verifier && oauthData.code_challenge) {
    const isValidPKCE = await validatePKCE(code_verifier, oauthData.code_challenge)
    if (!isValidPKCE) {
      return res.status(400).json({ error: 'Invalid code verifier' })
    }
  }

  // 3. Get user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', oauthData.clerk_user_id)
    .single()

  if (userError || !userData) {
    return res.status(400).json({
      error: 'User not found',
      details: 'Please sign up first before authenticating with VSCode'
    })
  }

  // 4. Generate tokens for VSCode
  const sessionId = generateSessionId()
  const accessToken = generateJWT(userData, sessionId)
  const refreshToken = generateRefreshToken(userData, sessionId)

  // 5. Store refresh token in database
  const { error: tokenError } = await supabase.from('refresh_tokens').insert({
    clerk_user_id: userData.clerk_id,
    token: refreshToken,
    session_id: sessionId,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  })

  if (tokenError) {
    console.error('Error storing refresh token:', tokenError)
    // Continue anyway, just log the error
  }

  // 6. Clean up OAuth session
  await supabase.from('oauth_codes').delete().eq('code', code)

  // 7. Return VSCode-compatible format
  return res.status(200).json({
    access_token: accessToken,
    refresh_token: refreshToken,
    session_id: sessionId,
    organization_id: userData.organization_id || null,
    token_type: 'Bearer',
    expires_in: 86400
  })
}

// Handle Website OAuth Flow (maintain existing functionality)
async function handleWebsiteFlow(req: VercelRequest, res: VercelResponse, supabase: any, { state, code, clerk_user_id, redirect_uri }: any) {
  if (!state || !code || !clerk_user_id) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'state, code, and clerk_user_id are required'
    })
  }

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
}