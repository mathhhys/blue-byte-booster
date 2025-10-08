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

const LONG_LIVED_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months in seconds
const BCRYPT_SALT_ROUNDS = 12;
const MAX_TOKENS_PER_USER = 5; // Maximum number of active tokens per user

// Helper functions for time
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

// Verify Clerk token
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

// Generate long-lived token
async function generateLongLivedToken(clerkUserId, deviceName, ipAddress, userAgent) {
  // Fetch user ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (userError || !userData) {
    throw new Error('User not found in database');
  }

  const userId = userData.id;

  // Check number of active tokens
  const { data: existingTokens, error: countError } = await supabase
    .from('extension_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gte('expires_at', new Date().toISOString());

  if (countError) {
    console.error('Error checking token count:', countError);
  }

  const activeTokenCount = existingTokens?.length || 0;

  if (activeTokenCount >= MAX_TOKENS_PER_USER) {
    throw new Error(`Maximum of ${MAX_TOKENS_PER_USER} active tokens allowed. Please revoke an existing token first.`);
  }

  // Generate JWT
  const iat = getCurrentEpochTime();
  const exp = iat + LONG_LIVED_EXPIRES_SECONDS;

  const payload = {
    sub: clerkUserId,
    type: 'extension_long_lived',
    iat,
    exp,
    iss: 'softcodes.ai',
    aud: 'vscode-extension',
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

  // Hash token
  const tokenHash = await bcrypt.hash(token, BCRYPT_SALT_ROUNDS);

  // Expires at ISO
  const expiresAtISO = epochToISOString(exp);

  // Encrypt sensitive metadata
  let deviceInfoEncrypted = null;
  let ipAddressEncrypted = null;

  try {
    if (userAgent) {
      deviceInfoEncrypted = encryptData(userAgent);
    }
    if (ipAddress) {
      ipAddressEncrypted = encryptData(ipAddress);
    }
  } catch (encryptError) {
    console.error('Failed to encrypt metadata:', encryptError);
    // Continue without encryption rather than failing
  }

  // Insert into extension_tokens
  // Try with new columns first, fallback to basic if migration not run
  let newToken;
  let insertData = {
    user_id: userId,
    token_hash: tokenHash,
    name: 'VSCode Long-Lived Token',
    expires_at: expiresAtISO
  };

  // Try to add new columns if they exist
  try {
    insertData = {
      ...insertData,
      device_name: deviceName || 'VSCode Extension',
      device_info_encrypted: deviceInfoEncrypted,
      ip_address_encrypted: ipAddressEncrypted
    };

    const { data, error: insertError } = await supabase
      .from('extension_tokens')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      // If column doesn't exist, try basic insert
      if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
        console.warn('⚠️ New columns not found - using basic insert. Run migration for enhanced features.');
        const { data: basicData, error: basicError } = await supabase
          .from('extension_tokens')
          .insert({
            user_id: userId,
            token_hash: tokenHash,
            name: 'VSCode Long-Lived Token',
            expires_at: expiresAtISO
          })
          .select('id')
          .single();

        if (basicError) {
          throw basicError;
        }
        newToken = basicData;
      } else {
        throw insertError;
      }
    } else {
      newToken = data;
    }
  } catch (error) {
    console.error('Token insert error:', error);
    throw new Error('Failed to store token');
  }

  // Log audit event (gracefully handles missing table)
  await logTokenAudit({
    tokenId: newToken.id,
    userId: userId,
    action: 'generated',
    details: {
      device_name: deviceName || 'VSCode Extension',
      expires_at: expiresAtISO
    },
    ipAddress: ipAddress,
    userAgent: userAgent
  });

  // Log
  console.log(`Long-lived token generated for user ${clerkUserId} (ID: ${userId}), device: ${deviceName}, expires at ${expiresAtISO}`);

  return { token, exp, expiresAtISO, tokenId: newToken.id };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'MISSING_AUTH_HEADER',
        message: 'Missing or invalid authorization header',
        userMessage: 'Authentication required. Please sign in again.'
      });
    }

    const token = authHeader.substring(7);
    const { deviceName } = req.body || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // For development/testing, allow mock tokens
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
      
      // Create mock auth for rate limiting
      req.auth = { userId: clerkUserId, clerkUserId: clerkUserId };
      
      // Apply rate limiting
      const rateLimitCheck = tokenRateLimitMiddleware('generate');
      await new Promise((resolve, reject) => {
        rateLimitCheck(req, res, (err) => {
          if (err) reject(err);
          else if (res.headersSent) reject(new Error('Rate limit exceeded'));
          else resolve();
        });
      });
      
      const tokenData = await generateLongLivedToken(
        clerkUserId,
        deviceName || 'Development Token',
        ipAddress,
        userAgent
      );
      
      return res.status(200).json({
        success: true,
        access_token: tokenData.token,
        expires_in: LONG_LIVED_EXPIRES_SECONDS,
        expires_at: tokenData.expiresAtISO,
        token_type: 'Bearer',
        type: 'long_lived',
        usage: 'vscode_extension',
        token_id: tokenData.tokenId
      });
    }

    // Verify Clerk token
    const decoded = await verifyClerkToken(token);
    const clerkUserId = decoded.clerkUserId;

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
        userMessage: 'Your account was not found. Please try signing in again.'
      });
    }

    // Set auth for rate limiting
    req.auth = { userId: userData.id, clerkUserId: clerkUserId };
    
    // Apply rate limiting
    const rateLimitCheck = tokenRateLimitMiddleware('generate');
    await new Promise((resolve, reject) => {
      rateLimitCheck(req, res, (err) => {
        if (err) reject(err);
        else if (res.headersSent) reject(new Error('Rate limit exceeded'));
        else resolve();
      });
    });

    const tokenData = await generateLongLivedToken(
      clerkUserId,
      deviceName || 'VSCode Extension',
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      access_token: tokenData.token,
      expires_in: LONG_LIVED_EXPIRES_SECONDS,
      expires_at: tokenData.expiresAtISO,
      token_type: 'Bearer',
      type: 'long_lived',
      usage: 'vscode_extension',
      token_id: tokenData.tokenId,
      message: 'Token generated successfully. Store it securely - it won\'t be shown again.'
    });

  } catch (error) {
    console.error('Long-lived token generation error:', error.message);
    
    // User-friendly error messages
    if (error.message.includes('Maximum of')) {
      return res.status(400).json({
        error: 'TOKEN_LIMIT_EXCEEDED',
        message: error.message,
        userMessage: error.message
      });
    }
    
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        userMessage: 'Too many token generation requests. Please try again later.'
      });
    }
    
    res.status(500).json({
      error: 'GENERATION_FAILED',
      message: 'Failed to generate long-lived token',
      userMessage: 'An error occurred while generating your token. Please try again.'
    });
  }
}

export default handler;