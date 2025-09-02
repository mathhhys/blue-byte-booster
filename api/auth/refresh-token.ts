import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' })
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev'
    let decoded: any
    
    try {
      decoded = jwt.verify(refresh_token, jwtSecret)
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify refresh token exists in database and is not revoked
    const { data: tokenData, error: tokenError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refresh_token)
      .eq('clerk_user_id', decoded.clerkUserId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !tokenData) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { clerkUserId: decoded.clerkUserId, type: 'access' },
      jwtSecret,
      { expiresIn: '1h' }
    )

    const newRefreshToken = jwt.sign(
      { clerkUserId: decoded.clerkUserId, type: 'refresh' },
      jwtSecret,
      { expiresIn: '30d' }
    )

    // Revoke old refresh token and store new one
    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', refresh_token)

    await supabase
      .from('refresh_tokens')
      .insert([
        {
          clerk_user_id: decoded.clerkUserId,
          token: newRefreshToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        },
      ])

    // Return new tokens
    return res.status(200).json({
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600, // 1 hour
    })

  } catch (error) {
    console.error('Token refresh error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}