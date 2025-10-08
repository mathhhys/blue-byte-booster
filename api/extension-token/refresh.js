import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { verifyToken } from '@clerk/backend';
import { encryptData } from '../utils/encryption.js';
import { tokenRateLimitMiddleware } from '../middleware/token-rate-limit.js';
import { logTokenAudit } from '../middleware/token-validation.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LONG_LIVED_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months
const REFRESH_THRESHOLD_DAYS = 30; // Allow refresh within 30 days of expiry
const BCRYPT_SALT_ROUNDS = 12;

function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

async function verifyClerkToken(token) {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('Missing CLERK_SECRET_KEY environment variable');
    }

    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    if (!claims.sub) {
      throw new Error('Invalid Clerk token: missing user ID');
    }

    return {
      clerkUserId: claims.sub,
      sessionId: claims.sid,
      exp: claims.exp,
      email: claims.email
    };
  } catch (error) {
    throw new Error('Invalid Clerk token: ' + error.message);
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'MISSING_AUTH_HEADER',
        message: 'Missing authorization header',
        userMessage: 'Authentication required. Please sign in again.'
      });
    }

    const clerkToken = authHeader.substring(7);
    const { tokenId } = req.body || {};
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Verify Clerk session token
    const decoded = await verifyClerkToken(clerkToken);
    const clerkUserId = decoded.sub;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User not found',
        userMessage: 'Your account was not found. Please sign in again.'
      });
    }

    // Set auth for rate limiting
    req.auth = { userId: user.id, clerkUserId: clerkUserId };
    
    // Apply rate limiting
    const rateLimitCheck = tokenRateLimitMiddleware('refresh');
    await new Promise((resolve, reject) => {
      rateLimitCheck(req, res, (err) => {
        if (err) reject(err);
        else if (res.headersSent) reject(new Error('Rate limit exceeded'));
        else resolve();
      });
    });

    // Get active token to refresh
    let query = supabase
      .from('extension_tokens')
      .select('id, expires_at, revoked_at, device_name, device_info_encrypted, ip_address_encrypted, refresh_count')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false });

    if (tokenId) {
      query = query.eq('id', tokenId);
    }

    const { data: existingToken, error: tokenError } = await query.limit(1).single();

    if (tokenError || !existingToken) {
      return res.status(404).json({
        error: 'NO_ACTIVE_TOKEN',
        message: 'No active token found to refresh',
        userMessage: 'No active token found. Please generate a new token from the dashboard.'
      });
    }

    // Check if token is within refresh window
    const expiresAt = new Date(existingToken.expires_at);
    const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry > REFRESH_THRESHOLD_DAYS) {
      return res.status(400).json({
        error: 'TOO_EARLY_TO_REFRESH',
        message: `Token can only be refreshed within ${REFRESH_THRESHOLD_DAYS} days of expiration`,
        userMessage: `Your token doesn't need refreshing yet. It expires in ${daysUntilExpiry} days. Tokens can be refreshed within ${REFRESH_THRESHOLD_DAYS} days of expiration.`,
        daysUntilExpiry
      });
    }

    // Generate new token
    const iat = getCurrentEpochTime();
    const exp = iat + LONG_LIVED_EXPIRES_SECONDS;

    const payload = {
      sub: clerkUserId,
      type: 'extension_long_lived',
      iat,
      exp,
      iss: 'softcodes.ai',
      aud: 'vscode-extension'
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const tokenHash = await bcrypt.hash(newToken, BCRYPT_SALT_ROUNDS);
    const newExpiresAt = epochToISOString(exp);

    // Encrypt metadata
    let deviceInfoEncrypted = existingToken.device_info_encrypted;
    let ipAddressEncrypted = existingToken.ip_address_encrypted;

    try {
      if (userAgent && !deviceInfoEncrypted) {
        deviceInfoEncrypted = encryptData(userAgent);
      }
      if (ipAddress) {
        ipAddressEncrypted = encryptData(ipAddress);
      }
    } catch (encryptError) {
      console.error('Failed to encrypt metadata:', encryptError);
    }

    // Revoke old token
    await supabase
      .from('extension_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', existingToken.id);

    // Create new token
    const { data: newTokenRecord, error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        name: 'VSCode Long-Lived Token',
        device_name: existingToken.device_name || 'VSCode Extension',
        expires_at: newExpiresAt,
        device_info_encrypted: deviceInfoEncrypted,
        ip_address_encrypted: ipAddressEncrypted,
        refresh_count: (existingToken.refresh_count || 0) + 1
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Token insert error:', insertError);
      throw new Error('Failed to store refreshed token');
    }

    // Log audit
    await logTokenAudit({
      tokenId: existingToken.id,
      userId: user.id,
      action: 'refreshed',
      details: { 
        old_expires_at: existingToken.expires_at, 
        new_expires_at: newExpiresAt,
        new_token_id: newTokenRecord.id,
        refresh_count: (existingToken.refresh_count || 0) + 1
      },
      ipAddress: ipAddress,
      userAgent: userAgent
    });

    console.log(`Token refreshed for user ${clerkUserId}, old token: ${existingToken.id}, new token: ${newTokenRecord.id}`);

    res.status(200).json({
      success: true,
      access_token: newToken,
      expires_in: LONG_LIVED_EXPIRES_SECONDS,
      expires_at: newExpiresAt,
      token_type: 'Bearer',
      type: 'long_lived',
      usage: 'vscode_extension',
      token_id: newTokenRecord.id,
      message: 'Token refreshed successfully. Update your VSCode extension settings with the new token.'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        userMessage: 'Too many token refresh requests. Please try again later.'
      });
    }
    
    res.status(500).json({ 
      error: 'REFRESH_FAILED',
      message: 'Failed to refresh token',
      userMessage: 'An error occurred while refreshing your token. Please try again or generate a new one.'
    });
  }
}

export default handler;