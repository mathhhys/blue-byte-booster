import jwt from 'jsonwebtoken'
import crypto from 'crypto'

export function generateSessionId(): string {
  return crypto.randomUUID()
}

export function generateJWT(userData: any, sessionId: string): string {
  const payload = {
    sub: userData.clerk_id,
    email: userData.email,
    session_id: sessionId,
    org_id: userData.organization_id,
    plan: userData.plan_type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET!)
}

export function generateRefreshToken(userData: any, sessionId: string): string {
  const payload = {
    sub: userData.clerk_id,
    session_id: sessionId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    iss: 'softcodes.ai'
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET!)
}

export function generateExtensionJWT(payload: any): string {
  const now = Math.floor(Date.now() / 1000);
  const extensionPayload = {
    ...payload,
    iat: now,
    exp: now + 12096000, // 4 months (4 * 30 * 24 * 60 * 60 seconds)
    iss: 'softcodes.ai',
    aud: 'vscode-extension',
    scope: 'vscode:auth'
  };
  
  return jwt.sign(extensionPayload, process.env.JWT_SECRET!);
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