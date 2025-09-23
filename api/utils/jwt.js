import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Generate a unique session ID
export function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

// Generate JWT token for user authentication
export function generateJWT(userData, sessionId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const payload = {
    sub: userData.clerk_id,
    email: userData.email,
    plan_type: userData.plan_type,
    credits: userData.credits,
    organization_id: userData.organization_id,
    session_id: sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiration
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

// Verify JWT token
export function verifyJWT(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}