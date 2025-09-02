import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// PKCE Utility Functions
function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

function sha256(plain: string): Buffer {
  return crypto.createHash('sha256').update(plain).digest()
}

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32))
}

function generateCodeChallenge(codeVerifier: string): string {
  const hashed = sha256(codeVerifier)
  return base64URLEncode(hashed)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { redirect_uri } = req.query
    
    if (!redirect_uri || typeof redirect_uri !== 'string') {
      return res.status(400).json({ error: 'Missing redirect_uri parameter' })
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateRandomString(32)

    // Store PKCE parameters and state in Supabase
    const { error } = await supabase
      .from('oauth_codes')
      .insert([
        {
          code_verifier: codeVerifier,
          code_challenge: codeChallenge,
          state: state,
          redirect_uri: redirect_uri,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        },
      ])

    if (error) {
      console.error('Error storing PKCE parameters:', error)
      return res.status(500).json({ error: 'Failed to initiate authentication' })
    }

    // Generate the authentication URL that redirects to our sign-in page
    const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173'
    const authUrl = `${baseUrl}/extension-signin?state=${state}&redirect_uri=${encodeURIComponent(redirect_uri)}`

    return res.status(200).json({
      success: true,
      auth_url: authUrl,
      state: state,
      code_challenge: codeChallenge
    })

  } catch (error) {
    console.error('VSCode auth initiation error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}