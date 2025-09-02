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
      grant_type,
      code,
      code_verifier,
      redirect_uri,
      refresh_token: refreshTokenParam
    } = req.body

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Handle refresh token grant
    if (grant_type === 'refresh_token') {
      if (!refreshTokenParam) {
        return res.status(400).json({ error: 'refresh_token is required' })
      }

      // Verify and get refresh token data
      const { data: tokenData, error: tokenError } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token', refreshTokenParam)
        .gt('expires_at', new Date().toISOString())
        .is('revoked_at', null)
        .single()

      if (tokenError || !tokenData) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' })
      }

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', tokenData.clerk_user_id)
        .single()

      if (userError || !userData) {
        return res.status(400).json({ error: 'User not found' })
      }

      // Generate new access token
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev'
      const accessToken = jwt.sign(
        { 
          clerkUserId: tokenData.clerk_user_id,
          userId: userData.id,
          type: 'access'
        },
        jwtSecret,
        { expiresIn: '1h' }
      )

      return res.status(200).json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshTokenParam,
        user: {
          id: userData.clerk_id,
          email: userData.email,
          name: userData.name || userData.email,
          picture: userData.avatar_url
        }
      })
    }

    // Handle authorization code grant
    if (grant_type === 'authorization_code' || !grant_type) {
      if (!code || !code_verifier || !redirect_uri) {
        return res.status(400).json({ 
          error: 'Missing required parameters',
          details: 'code, code_verifier, and redirect_uri are required'
        })
      }

      // Verify the OAuth code exists and is valid
      const { data: oauthData, error: oauthError } = await supabase
        .from('oauth_codes')
        .select('*')
        .eq('code', code)
        .eq('redirect_uri', redirect_uri)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (oauthError || !oauthData) {
        console.error('OAuth code lookup error:', oauthError)
        return res.status(400).json({ 
          error: 'Invalid or expired authorization code',
          details: oauthError?.message
        })
      }

      // Verify PKCE code verifier matches code challenge
      const expectedChallenge = generateCodeChallenge(code_verifier)
      if (oauthData.code_challenge && expectedChallenge !== oauthData.code_challenge) {
        return res.status(400).json({ error: 'Invalid code verifier' })
      }

      // Get the clerk_user_id from the oauth_codes table
      const clerkUserId = oauthData.clerk_user_id

      // If no clerk_user_id is stored, this means the user hasn't authenticated yet
      if (!clerkUserId) {
        return res.status(400).json({ 
          error: 'Authentication incomplete',
          details: 'User must complete authentication first'
        })
      }

      // Get user data from Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkUserId)
        .single()

      if (userError || !userData) {
        console.error('User lookup error:', userError)
        return res.status(400).json({ 
          error: 'User not found',
          details: 'User must sign up first'
        })
      }

      // Generate JWT tokens
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev'
      
      const accessToken = jwt.sign(
        { 
          clerkUserId: clerkUserId,
          userId: userData.id,
          type: 'access'
        },
        jwtSecret,
        { expiresIn: '1h' }
      )

      const refreshToken = jwt.sign(
        { 
          clerkUserId: clerkUserId,
          userId: userData.id,
          type: 'refresh'
        },
        jwtSecret,
        { expiresIn: '30d' }
      )

      // Store refresh token in database
      const { error: insertError } = await supabase
        .from('refresh_tokens')
        .insert([
          {
            clerk_user_id: clerkUserId,
            token: refreshToken,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          },
        ])

      if (insertError) {
        console.error('Error storing refresh token:', insertError)
      }

      // Clean up the used OAuth code
      await supabase
        .from('oauth_codes')
        .delete()
        .eq('code', code)

      // Return success response
      return res.status(200).json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600, // 1 hour
        refresh_token: refreshToken,
        user: {
          id: userData.clerk_id,
          email: userData.email,
          name: userData.name || userData.email,
          picture: userData.avatar_url
        }
      })
    }

    // Invalid grant type
    return res.status(400).json({ 
      error: 'unsupported_grant_type',
      details: 'Only authorization_code and refresh_token grants are supported'
    })

  } catch (error) {
    console.error('Token exchange error:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}