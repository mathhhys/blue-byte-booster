import jwt from 'jsonwebtoken'
import crypto from 'crypto'

/**
 * Generate a unique session ID using UUID v4
 */
export function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Generate JWT access token for VSCode extension authentication
 * Token expires in 24 hours
 */
export function generateAccessToken(user: any, sessionId: string): string {
  const payload = {
    sub: user.clerk_id,
    email: user.email,
    username: user.username,
    session_id: sessionId,
    clerk_org_id: user.clerk_org_id || null,
    plan_type: user.plan_type,
    credits: user.credits,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' })
}

/**
 * Generate JWT refresh token for extending session
 * Token expires in 30 days
 */
export function generateRefreshToken(user: any, sessionId: string): string {
  const payload = {
    sub: user.clerk_id,
    session_id: sessionId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    iss: 'softcodes.ai'
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' })
}

/**
 * Legacy function - use generateAccessToken instead
 * @deprecated
 */
export function generateJWT(userData: any, sessionId: string): string {
  return generateAccessToken(userData, sessionId)
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // For Node.js environment, use crypto module
  const hash = crypto.createHash('sha256').update(codeVerifier).digest()
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!)
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// Helper function to validate code verifier against challenge
export async function validatePKCE(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  try {
    const generatedChallenge = await generateCodeChallenge(codeVerifier)
    return generatedChallenge === codeChallenge
  } catch (error) {
    return false
  }
}