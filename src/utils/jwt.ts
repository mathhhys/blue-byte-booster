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

// New function for extension tokens with 4-month validity
export function generateExtensionJWT(userData: any): { token: string; expiresAt: Date; hash: string } {
  const now = Math.floor(Date.now() / 1000);
  const fourMonthsInSeconds = 4 * 30 * 24 * 60 * 60; // 4 months
  const expiresAt = new Date((now + fourMonthsInSeconds) * 1000);
  
  const payload = {
    sub: userData.clerk_id,
    email: userData.email,
    org_id: userData.organization_id,
    plan: userData.plan_type,
    type: 'extension',
    iat: now,
    exp: now + fourMonthsInSeconds,
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET!);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, expiresAt, hash };
}

export function verifyExtensionJWT(token: string): any {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decoded === 'object' && decoded !== null && 'type' in decoded && decoded.type !== 'extension') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid extension token');
  }
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