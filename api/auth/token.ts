import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateJWT, generateRefreshToken, verifyJWT } from '../utils/jwt.js'

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
    const { grant_type, refresh_token, authorization_code, code_verifier } = req.body

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (grant_type === 'refresh_token') {
      return await handleRefreshToken(res, supabase, refresh_token)
    } else if (grant_type === 'authorization_code') {
      return await handleAuthorizationCode(res, supabase, { authorization_code, code_verifier })
    } else {
      return res.status(400).json({ 
        error: 'unsupported_grant_type',
        error_description: 'Supported grant types: refresh_token, authorization_code'
      })
    }
  } catch (error) {
    console.error('Token exchange error:', error)
    return res.status(500).json({ 
      error: 'server_error',
      error_description: 'Internal server error during token exchange'
    })
  }
}

async function handleRefreshToken(res: VercelResponse, supabase: any, refreshToken: string) {
  if (!refreshToken) {
    return res.status(400).json({ 
      error: 'invalid_request',
      error_description: 'Missing refresh_token parameter'
    })
  }

  try {
    // Verify the refresh token
    const payload = verifyJWT(refreshToken)
    
    if (payload.type !== 'refresh') {
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Token is not a refresh token'
      })
    }

    // Check if refresh token exists in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .eq('clerk_user_id', payload.sub)
      .single()

    if (tokenError || !tokenData) {
      return res.status(401).json({ 
        error: 'invalid_grant',
        error_description: 'Refresh token not found or expired'
      })
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      // Clean up expired token
      await supabase.from('refresh_tokens').delete().eq('token', refreshToken)
      
      return res.status(401).json({ 
        error: 'invalid_grant',
        error_description: 'Refresh token has expired'
      })
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', payload.sub)
      .single()

    if (userError || !userData) {
      return res.status(401).json({ 
        error: 'invalid_grant',
        error_description: 'User not found'
      })
    }

    // Generate new access token
    const newAccessToken = generateJWT(userData, payload.session_id)

    return res.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours
      scope: 'vscode-extension'
    })
  } catch (error) {
    console.error('Refresh token verification failed:', error)
    return res.status(401).json({ 
      error: 'invalid_grant',
      error_description: 'Invalid refresh token'
    })
  }
}

async function handleAuthorizationCode(res: VercelResponse, supabase: any, { authorization_code, code_verifier }: any) {
  if (!authorization_code) {
    return res.status(400).json({ 
      error: 'invalid_request',
      error_description: 'Missing authorization_code parameter'
    })
  }

  // This is handled by the callback endpoint, but we include it for completeness
  // Redirect to the callback endpoint for proper OAuth flow
  return res.status(400).json({ 
    error: 'invalid_request',
    error_description: 'Authorization code exchange should use /api/extension/auth/callback endpoint'
  })
}