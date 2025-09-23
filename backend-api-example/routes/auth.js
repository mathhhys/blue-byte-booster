const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { tokenMonitor } = require('../utils/token-monitoring');
const router = express.Router();

console.log('routes/auth.js: SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('routes/auth.js: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PKCE Utility Functions
function sha256(plain) {
  return crypto.createHash('sha256').update(plain).digest();
}

function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(code_verifier) {
  const hashed = await sha256(code_verifier);
  return base64URLEncode(hashed);
}

// JWT Utility Functions
console.log('routes/auth.js: JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded');
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_SECONDS = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

// Unified time calculation functions
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
  console.log(`routes/auth.js: ${tokenType} token timing:`, {
    currentServerEpoch: currentTime,
    currentServerUTC: serverTimeISO,
    tokenExpEpoch: exp,
    tokenExpiresAtISO: expiresAtISO,
    validitySeconds: exp - currentTime
  });
  
  // Add production monitoring
  tokenMonitor.logTokenGeneration(tokenType, clerkUserId, exp, expiresAtISO);
}

function generateAccessToken(clerkUserId) {
  const exp = calculateExpiryEpoch(ACCESS_TOKEN_EXPIRES_SECONDS);
  const accessToken = jwt.sign({ clerkUserId, type: 'access', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  logTokenTiming('Access', exp, expiresAtISO, clerkUserId);
  
  return { token: accessToken, exp, expiresAtISO };
}

function generateRefreshToken(clerkUserId) {
  const exp = calculateExpiryEpoch(REFRESH_TOKEN_EXPIRES_SECONDS);
  const refreshToken = jwt.sign({ clerkUserId, type: 'refresh', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  logTokenTiming('Refresh', exp, expiresAtISO, clerkUserId);
  
  return { token: refreshToken, exp, expiresAtISO };
}

function verifyToken(token, clerkUserId = null) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 5 });
    
    // Log successful validation
    if (clerkUserId) {
      tokenMonitor.logTokenValidation(decoded.type || 'unknown', clerkUserId, decoded.exp, {
        valid: true
      });
    }
    
    return decoded;
  } catch (error) {
    console.error('routes/auth.js: Token verification failed:', error.message);
    
    // Log failed validation
    if (clerkUserId) {
      tokenMonitor.logTokenValidation('unknown', clerkUserId, null, {
        valid: false,
        error: error.message
      });
    }
    
    return null;
  }
}

// Update the auth code with the Clerk user ID and authorization code
router.post('/update-auth-code', async (req, res) => {
  try {
    console.log('routes/auth.js: /update-auth-code endpoint hit');
    const { state, clerk_user_id, authorization_code } = req.body;
 
    if (!state || !clerk_user_id) {
      console.error('routes/auth.js: /update-auth-code: Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    console.log('routes/auth.js: /update-auth-code: Received state:', state, 'clerk_user_id:', clerk_user_id);

    // Generate authorization code if not provided
    const authCode = authorization_code || Buffer.from(`${clerk_user_id}:${state}:${Date.now()}`).toString('base64');

    const { data, error } = await supabase
      .from('oauth_codes')
      .update({
        clerk_user_id,
        authorization_code: authCode
      })
      .eq('state', state);

    if (error) {
      console.error('routes/auth.js: /update-auth-code: Error updating auth code:', error);
      return res.status(500).json({ error: 'Failed to update auth code' });
    }
    console.log('routes/auth.js: /update-auth-code: Auth code updated successfully. Authorization Code:', authCode);

    res.json({ success: true, authorization_code: authCode });

  } catch (error) {
    console.error('routes/auth.js: /update-auth-code: Catch block error:', error);
    res.status(500).json({ error: 'Failed to update auth code' });
  }
});

// Exchange authorization code for tokens
router.post('/token', async (req, res) => {
  try {
    console.log('routes/auth.js: /token endpoint hit');
    const { code, code_verifier, state, redirect_uri } = req.body;
 
    if (!code || !code_verifier || !state || !redirect_uri) {
      console.error('routes/auth.js: /token: Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    console.log('routes/auth.js: /token: Received code:', code, 'state:', state, 'redirect_uri:', redirect_uri);

    // Fetch OAuth code by authorization_code AND state
    const { data: oauthCode, error: fetchError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('authorization_code', code) // Use authorization_code field
      .eq('state', state)
      .single();

    if (fetchError || !oauthCode || new Date(oauthCode.expires_at) < new Date()) {
      console.error('routes/auth.js: /token: Invalid or expired authorization code. Code:', code, 'Error:', fetchError, 'OAuthCode:', oauthCode);
      return res.status(400).json({ error: 'Invalid or expired authorization code' });
    }
    console.log('routes/auth.js: /token: OAuth code fetched and validated. OAuthCode:', oauthCode);

    // Verify PKCE challenge
    const expectedCodeChallenge = await generateCodeChallenge(code_verifier);
    if (oauthCode.code_challenge !== expectedCodeChallenge) {
      console.error('routes/auth.js: /token: Code challenge mismatch for state:', state, 'Expected:', expectedCodeChallenge, 'Got:', oauthCode.code_challenge);
      return res.status(400).json({ error: 'Invalid code verifier' });
    }
    console.log('routes/auth.js: /token: Code challenge verified.');

    // Verify redirect_uri
    if (oauthCode.redirect_uri !== redirect_uri) {
      console.error('routes/auth.js: /token: Redirect URI mismatch. Expected:', oauthCode.redirect_uri, 'Got:', redirect_uri);
      return res.status(400).json({ error: 'Invalid redirect URI' });
    }
    console.log('routes/auth.js: /token: Redirect URI verified.');

    // Get the Clerk user ID from the OAuth record
    const clerkUserId = oauthCode.clerk_user_id;
    const accessTokenData = generateAccessToken(clerkUserId);
    const refreshTokenData = generateRefreshToken(clerkUserId);

    const { error: refreshError } = await supabase
      .from('refresh_tokens')
      .insert({
        clerk_user_id: clerkUserId,
        token: refreshTokenData.token,
        expires_at: refreshTokenData.expiresAtISO,
      });

    if (refreshError) {
      console.error('routes/auth.js: /token: Error storing refresh token:', refreshError);
      return res.status(500).json({ error: 'Failed to issue tokens' });
    }
    console.log('routes/auth.js: /token: Refresh token stored successfully.');

    // Delete the used OAuth code
    await supabase.from('oauth_codes').delete().eq('id', oauthCode.id);

    res.json({
      success: true,
      access_token: accessTokenData.token,
      refresh_token: refreshTokenData.token,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
    });

  } catch (error) {
    console.error('routes/auth.js: /token: Catch block error:', error);
    res.status(500).json({ error: 'Failed to exchange code for tokens' });
  }
});

// Refresh access token
router.post('/refresh-token', async (req, res) => {
  try {
    console.log('routes/auth.js: /refresh-token endpoint hit');
    const { refresh_token: oldRefreshToken } = req.body;
 
    if (!oldRefreshToken) {
      console.error('routes/auth.js: /refresh-token: Refresh token is required');
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    console.log('routes/auth.js: /refresh-token: Received oldRefreshToken (first 10 chars):', oldRefreshToken.substring(0, 10));

    const decoded = verifyToken(oldRefreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      console.error('routes/auth.js: /refresh-token: Invalid refresh token. Decoded:', decoded);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    console.log('routes/auth.js: /refresh-token: Old refresh token decoded. Clerk User ID:', decoded.clerkUserId);

    const { clerkUserId } = decoded;

    const { data: storedToken, error: fetchError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', oldRefreshToken)
      .eq('clerk_user_id', clerkUserId)
      .is('revoked_at', null)
      .single();

    if (fetchError || !storedToken || new Date(storedToken.expires_at) < new Date()) {
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('clerk_user_id', clerkUserId)
        .is('revoked_at', null);
      console.error('routes/auth.js: /refresh-token: Invalid or expired refresh token. Error:', fetchError, 'Stored Token:', storedToken);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    console.log('routes/auth.js: /refresh-token: Stored refresh token fetched and validated.');

    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', storedToken.id);

    const newAccessTokenData = generateAccessToken(clerkUserId);
    const newRefreshTokenData = generateRefreshToken(clerkUserId);

    const { error: insertError } = await supabase
      .from('refresh_tokens')
      .insert({
        clerk_user_id: clerkUserId,
        token: newRefreshTokenData.token,
        expires_at: newRefreshTokenData.expiresAtISO,
      });

    if (insertError) {
      console.error('routes/auth.js: /refresh-token: Error storing new refresh token:', insertError);
      return res.status(500).json({ error: 'Failed to issue new tokens' });
    }
    console.log('routes/auth.js: /refresh-token: New refresh token stored successfully.');

    res.json({
      success: true,
      access_token: newAccessTokenData.token,
      refresh_token: newRefreshTokenData.token,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
    });

  } catch (error) {
    console.error('routes/auth.js: /refresh-token: Catch block error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;