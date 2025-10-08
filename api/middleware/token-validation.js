import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Log token audit event
 * @param {Object} data - Audit log data
 */
async function logTokenAudit(data) {
  try {
    const { error } = await supabase.from('token_audit_logs').insert({
      token_id: data.tokenId,
      user_id: data.userId,
      action: data.action,
      details: data.details || {},
      ip_address: data.ipAddress,
      user_agent: data.userAgent
    });
    
    if (error) {
      // Gracefully handle if table doesn't exist yet
      if (error.message?.includes('relation "token_audit_logs" does not exist')) {
        console.warn('⚠️ token_audit_logs table not found - run migration to enable audit logging');
      } else {
        console.error('Failed to log token audit:', error);
      }
    }
  } catch (error) {
    // Don't throw - audit logging is non-critical
    console.error('Token audit logging error:', error);
  }
}

/**
 * Validate long-lived JWT token
 * Middleware for protecting VSCode extension endpoints
 */
async function validateLongLivedToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'MISSING_AUTH_HEADER',
        message: 'Missing or invalid authorization header',
        userMessage: 'Authentication required. Please provide a valid token.'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Token has expired',
          userMessage: 'Your authentication token has expired. Please generate a new one from the dashboard.',
          expiredAt: jwtError.expiredAt
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid token signature',
          userMessage: 'The provided token is invalid. Please generate a new one from the dashboard.'
        });
      }
      throw jwtError;
    }

    // Verify token type
    if (decoded.type !== 'extension_long_lived') {
      return res.status(401).json({
        error: 'INVALID_TOKEN_TYPE',
        message: 'Invalid token type',
        userMessage: 'This token type is not valid for this operation.'
      });
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, email')
      .eq('clerk_id', decoded.sub)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
        userMessage: 'User account not found. Please contact support.'
      });
    }

    // Find matching token in database
    const { data: tokens } = await supabase
      .from('extension_tokens')
      .select('id, token_hash, expires_at, revoked_at, last_used_at, device_name')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString());

    if (!tokens || tokens.length === 0) {
      return res.status(401).json({
        error: 'TOKEN_REVOKED_OR_INVALID',
        message: 'No valid tokens found',
        userMessage: 'This token is no longer valid. Please generate a new one from the dashboard.'
      });
    }

    // Check if token hash matches any stored token
    let matchedToken = null;
    for (const dbToken of tokens) {
      try {
        const isMatch = await bcrypt.compare(token, dbToken.token_hash);
        if (isMatch) {
          matchedToken = dbToken;
          break;
        }
      } catch (compareError) {
        console.error('Token comparison error:', compareError);
      }
    }

    if (!matchedToken) {
      return res.status(401).json({
        error: 'TOKEN_REVOKED_OR_INVALID',
        message: 'Token is revoked or invalid',
        userMessage: 'This token is no longer valid. Please generate a new one from the dashboard.'
      });
    }

    // Check if token expires soon (within 30 days)
    const expiresAt = new Date(matchedToken.expires_at);
    const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 30) {
      res.set({
        'X-Token-Expires-Soon': 'true',
        'X-Token-Days-Until-Expiry': daysUntilExpiry.toString(),
        'X-Token-Expiry-Date': expiresAt.toISOString()
      });
      
      if (daysUntilExpiry <= 7) {
        res.set('X-Token-Expiry-Critical', 'true');
      }
    }

    // Update last_used_at asynchronously (don't wait)
    supabase
      .from('extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', matchedToken.id)
      .then(({ error }) => {
        if (error) console.error('Failed to update last_used_at:', error);
      });

    // Log usage asynchronously
    logTokenAudit({
      tokenId: matchedToken.id,
      userId: user.id,
      action: 'used',
      details: {
        endpoint: req.path,
        method: req.method
      },
      ipAddress: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    // Attach auth info to request
    req.auth = {
      userId: user.id,
      clerkUserId: user.clerk_id,
      email: user.email,
      tokenId: matchedToken.id,
      tokenExpiry: expiresAt,
      daysUntilExpiry: daysUntilExpiry
    };

    next();
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Token validation failed',
      userMessage: 'An error occurred while validating your token. Please try again.'
    });
  }
}

export {
  validateLongLivedToken,
  logTokenAudit
};