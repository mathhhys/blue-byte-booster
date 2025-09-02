import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// PKCE Utility Functions
function sha256(plain: string): Buffer {
  return crypto.createHash('sha256').update(plain).digest()
}

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function generateCodeChallenge(codeVerifier: string): string {
  const hashed = sha256(codeVerifier)
  return base64URLEncode(hashed)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code, code_verifier, state, redirect_uri } = req.body

    if (!code || !code_verifier || !state || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify the OAuth code and PKCE parameters
    const { data: oauthData, error: oauthError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('state', state)
      .eq('redirect_uri', redirect_uri)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (oauthError || !oauthData) {
      return res.status(400).json({ error: 'Invalid or expired authorization code' })
    }

    // Verify code verifier matches code challenge
    const expectedChallenge = generateCodeChallenge(code_verifier)
    if (expectedChallenge !== oauthData.code_challenge) {
      return res.status(400).json({ error: 'Invalid code verifier' })
    }

    // In this implementation, 'code' is the clerk user ID
    const clerkUserId = code

    // Get user data from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkUserId)
      .single()

    if (userError || !userData) {
      return res.status(400).json({ error: 'User not found' })
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev'
    
    const accessToken = jwt.sign(
      { clerkUserId: clerkUserId, type: 'access' },
      jwtSecret,
      { expiresIn: '1h' }
    )

    const refreshToken = jwt.sign(
      { clerkUserId: clerkUserId, type: 'refresh' },
      jwtSecret,
      { expiresIn: '30d' }
    )

    // Store refresh token in database
    await supabase
      .from('refresh_tokens')
      .insert([
        {
          clerk_user_id: clerkUserId,
          token: refreshToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        },
      ])

    // Clean up the used OAuth code
    await supabase
      .from('oauth_codes')
      .delete()
      .eq('state', state)

    // Return success response
    return res.status(200).json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 1 hour
      user: {
        id: userData.clerk_id,
        email: userData.email,
        name: userData.name || userData.email,
        picture: userData.avatar_url
      }
    })

  } catch (error) {
    console.error('Token exchange error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}