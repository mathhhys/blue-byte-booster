import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyJWT } from '../utils/jwt'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for VSCode extension
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { session_id, access_token } = req.body

    if (!session_id || !access_token) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'session_id and access_token are required'
      })
    }

    // Verify the access token
    const payload = verifyJWT(access_token)
    
    if (payload.session_id !== session_id) {
      return res.status(401).json({ 
        error: 'Session mismatch',
        details: 'Session ID does not match token'
      })
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validate session exists in database
    const { data: sessionData, error: sessionError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('session_id', session_id)
      .eq('clerk_user_id', payload.sub)
      .single()

    if (sessionError || !sessionData) {
      return res.status(401).json({ 
        error: 'Invalid session',
        details: 'Session not found or expired'
      })
    }

    // Check if session is expired
    if (new Date(sessionData.expires_at) < new Date()) {
      // Clean up expired session
      await supabase.from('refresh_tokens').delete().eq('session_id', session_id)
      
      return res.status(401).json({ 
        error: 'Session expired',
        details: 'Session has expired and been removed'
      })
    }

    // Get user information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('clerk_id, email, first_name, last_name, plan_type, organization_id, credits')
      .eq('clerk_id', payload.sub)
      .single()

    if (userError || !userData) {
      return res.status(401).json({ 
        error: 'User not found',
        details: 'Associated user account not found'
      })
    }

    // Return session validation and user information
    return res.json({
      valid: true,
      session_id: session_id,
      user_id: payload.sub,
      expires_at: payload.exp,
      user: {
        clerk_id: userData.clerk_id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        plan_type: userData.plan_type,
        organization_id: userData.organization_id,
        credits: userData.credits
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid token') {
      return res.status(401).json({ 
        error: 'Invalid token',
        details: 'Access token is invalid or malformed'
      })
    }
    
    console.error('Session token validation error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to validate session token'
    })
  }
}