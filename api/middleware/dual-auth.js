// Dual Authentication Middleware
// Validates tokens from both Clerk (B2C) and Kinde (B2B/Teams)

import { createClerkClient } from '@clerk/backend';
import jwt from 'jsonwebtoken';

// Initialize Clerk client for B2C validation
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Kinde configuration for B2B validation
const KINDE_ISSUER = process.env.KINDE_ISSUER_URL;
const KINDE_JWKS_URL = `${KINDE_ISSUER}/.well-known/jwks.json`;

// Cache for Kinde JWKS
let kindeJwksCache = null;
let kindeJwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch Kinde JWKS (JSON Web Key Set)
 */
async function getKindeJwks() {
  const now = Date.now();
  if (kindeJwksCache && (now - kindeJwksCacheTime) < JWKS_CACHE_TTL) {
    return kindeJwksCache;
  }

  try {
    const response = await fetch(KINDE_JWKS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }
    kindeJwksCache = await response.json();
    kindeJwksCacheTime = now;
    return kindeJwksCache;
  } catch (error) {
    console.error('Error fetching Kinde JWKS:', error);
    throw error;
  }
}

/**
 * Validate Kinde JWT token
 */
async function validateKindeToken(token) {
  try {
    // Decode token header to get key ID
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    // Get JWKS and find matching key
    const jwks = await getKindeJwks();
    const key = jwks.keys.find(k => k.kid === decoded.header.kid);
    if (!key) {
      throw new Error('Key not found in JWKS');
    }

    // Convert JWK to PEM format for verification
    const pem = jwkToPem(key);
    
    // Verify token
    const payload = jwt.verify(token, pem, {
      algorithms: ['RS256'],
      issuer: KINDE_ISSUER,
    });

    return {
      valid: true,
      provider: 'kinde',
      userId: payload.sub,
      email: payload.email,
      orgCode: payload.org_code,
      orgName: payload.org_name,
      permissions: payload.permissions || [],
      roles: payload.roles || [],
      raw: payload,
    };
  } catch (error) {
    console.error('Kinde token validation error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Convert JWK to PEM format
 */
function jwkToPem(jwk) {
  // Simple RSA JWK to PEM conversion
  const { n, e } = jwk;
  const buff = Buffer.from(
    JSON.stringify({
      kty: 'RSA',
      n,
      e,
    })
  );
  
  // Using Node.js crypto for proper conversion
  const crypto = require('crypto');
  const key = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n,
      e,
    },
    format: 'jwk',
  });
  
  return key.export({ type: 'spki', format: 'pem' });
}

/**
 * Validate Clerk JWT token
 */
async function validateClerkToken(token) {
  try {
    const payload = await clerkClient.verifyToken(token);
    
    return {
      valid: true,
      provider: 'clerk',
      userId: payload.sub,
      email: payload.email,
      orgId: payload.org_id,
      orgRole: payload.org_role,
      raw: payload,
    };
  } catch (error) {
    console.error('Clerk token validation error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Detect token provider based on issuer claim
 */
function detectTokenProvider(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.iss) {
      return 'unknown';
    }

    const issuer = decoded.iss;
    
    // Check if it's a Kinde token
    if (issuer.includes('kinde.com') || issuer === KINDE_ISSUER) {
      return 'kinde';
    }
    
    // Check if it's a Clerk token
    if (issuer.includes('clerk')) {
      return 'clerk';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Main dual-auth middleware
 */
export async function dualAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const provider = detectTokenProvider(token);
    let authResult;

    switch (provider) {
      case 'kinde':
        authResult = await validateKindeToken(token);
        break;
      case 'clerk':
        authResult = await validateClerkToken(token);
        break;
      default:
        // Try both providers
        authResult = await validateClerkToken(token);
        if (!authResult.valid) {
          authResult = await validateKindeToken(token);
        }
    }

    if (!authResult.valid) {
      return res.status(401).json({ error: 'Invalid token', details: authResult.error });
    }

    // Set normalized user object on request
    req.auth = {
      provider: authResult.provider,
      userId: authResult.userId,
      email: authResult.email,
      // Organization info (provider-specific)
      organizationId: authResult.provider === 'kinde' ? authResult.orgCode : authResult.orgId,
      organizationName: authResult.provider === 'kinde' ? authResult.orgName : undefined,
      organizationRole: authResult.provider === 'kinde' 
        ? (authResult.roles?.includes('admin') ? 'admin' : 'member')
        : authResult.orgRole,
      // Raw token payload for advanced use cases
      raw: authResult.raw,
    };

    if (next) {
      next();
    }
    return true;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
}

/**
 * Helper to extract auth from request without blocking
 */
export function extractAuthFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const provider = detectTokenProvider(token);
  const decoded = jwt.decode(token);

  return {
    provider,
    token,
    decoded,
  };
}

/**
 * Middleware that requires Kinde authentication specifically
 */
export async function kindeAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.substring(7);
  const provider = detectTokenProvider(token);

  if (provider !== 'kinde') {
    return res.status(401).json({ error: 'Kinde authentication required for this endpoint' });
  }

  const authResult = await validateKindeToken(token);
  if (!authResult.valid) {
    return res.status(401).json({ error: 'Invalid Kinde token' });
  }

  req.auth = {
    provider: 'kinde',
    userId: authResult.userId,
    email: authResult.email,
    orgCode: authResult.orgCode,
    orgName: authResult.orgName,
    permissions: authResult.permissions,
    roles: authResult.roles,
    raw: authResult.raw,
  };

  if (next) {
    next();
  }
  return true;
}

export default dualAuthMiddleware;