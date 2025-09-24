const express = require('express');
const { authenticateClerkToken } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const jwt = require('jsonwebtoken');
const router = express.Router();

console.log('routes/dashboard-token.js: JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded');
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months in seconds

// Unified time calculation functions (matching auth.js)
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function calculateExpiryEpoch(durationSeconds) {
  return getCurrentEpochTime() + durationSeconds;
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

function logTokenTiming(tokenType, exp, expiresAtISO, clerkUserId) {
  const currentTime = getCurrentEpochTime();
  const serverTimeISO = new Date().toISOString();
  console.log(`routes/dashboard-token.js: ${tokenType} token timing for user ${clerkUserId}:`, {
    currentServerEpoch: currentTime,
    currentServerUTC: serverTimeISO,
    tokenExpEpoch: exp,
    tokenExpiresAtISO: expiresAtISO,
    validitySeconds: exp - currentTime
  });
}

function generateDashboardAccessToken(clerkUserId) {
  const exp = calculateExpiryEpoch(ACCESS_TOKEN_EXPIRES_SECONDS);
  const accessToken = jwt.sign({ clerkUserId, type: 'access', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  logTokenTiming('Dashboard Access', exp, expiresAtISO, clerkUserId);
  
  return { token: accessToken, exp, expiresAtISO };
}

// Generate dashboard token (for VSCode extension use)
router.post('/generate', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    console.log('routes/dashboard-token.js: /generate endpoint hit');
    const { clerkUserId } = req.auth;
    
    console.log('routes/dashboard-token.js: Generating dashboard token for Clerk User ID:', clerkUserId);
    
    // Generate backend JWT token (not using OAuth flow since user is already authenticated)
    const accessTokenData = generateDashboardAccessToken(clerkUserId);
    
    console.log('routes/dashboard-token.js: Generated dashboard token successfully');

    res.json({
      success: true,
      access_token: accessTokenData.token,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
      expires_at: accessTokenData.expiresAtISO,
      token_type: 'Bearer',
      usage: 'vscode_extension'
    });

  } catch (error) {
    console.error('routes/dashboard-token.js: /generate: Catch block error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard token' });
  }
});

// Validate dashboard token
router.post('/validate', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    console.log('routes/dashboard-token.js: /validate endpoint hit');
    const { token } = req.body;
    const { clerkUserId } = req.auth;
    
    if (!token) {
      console.error('routes/dashboard-token.js: /validate: Missing token parameter');
      return res.status(400).json({ error: 'Token is required' });
    }
    
    console.log('routes/dashboard-token.js: Validating token for Clerk User ID:', clerkUserId);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 5 });
      
      // Verify the token belongs to the authenticated user
      if (decoded.clerkUserId !== clerkUserId) {
        console.error('routes/dashboard-token.js: /validate: Token user mismatch');
        return res.status(401).json({ error: 'Token does not belong to authenticated user' });
      }
      
      // Verify token type
      if (decoded.type !== 'access') {
        console.error('routes/dashboard-token.js: /validate: Invalid token type:', decoded.type);
        return res.status(401).json({ error: 'Invalid token type' });
      }
      
      const currentTime = getCurrentEpochTime();
      const timeUntilExpiry = decoded.exp - currentTime;
      
      console.log('routes/dashboard-token.js: Token validation successful:', {
        clerkUserId: decoded.clerkUserId,
        tokenExp: decoded.exp,
        currentTime: currentTime,
        timeUntilExpiry: timeUntilExpiry
      });

      res.json({
        success: true,
        valid: true,
        expires_at: epochToISOString(decoded.exp),
        seconds_until_expiry: timeUntilExpiry,
        user_id: decoded.clerkUserId
      });

    } catch (verifyError) {
      console.error('routes/dashboard-token.js: /validate: Token verification failed:', verifyError.message);
      
      if (verifyError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token has expired',
          valid: false,
          expired: true
        });
      } else if (verifyError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token signature',
          valid: false
        });
      } else {
        return res.status(401).json({ 
          error: 'Token validation failed',
          valid: false
        });
      }
    }

  } catch (error) {
    console.error('routes/dashboard-token.js: /validate: Catch block error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

module.exports = router;