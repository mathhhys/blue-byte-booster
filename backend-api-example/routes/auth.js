const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

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
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

function generateAccessToken(clerkUserId) {
  return jwt.sign({ clerkUserId, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(clerkUserId) {
  return jwt.sign({ clerkUserId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Update the auth code with the Clerk user ID and authorization code
router.post('/update-auth-code', async (req, res) => {
  try {
    const { state, clerk_user_id, authorization_code } = req.body;

    if (!state || !clerk_user_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

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
      console.error('Error updating auth code:', error);
      return res.status(500).json({ error: 'Failed to update auth code' });
    }

    res.json({ success: true, authorization_code: authCode });

  } catch (error) {
    console.error('Error updating auth code:', error);
    res.status(500).json({ error: 'Failed to update auth code' });
  }
});

// Exchange authorization code for tokens
router.post('/token', async (req, res) => {
  try {
    const { code, code_verifier, state, redirect_uri } = req.body;

    if (!code || !code_verifier || !state || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Fetch OAuth code by authorization_code AND state
    const { data: oauthCode, error: fetchError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('authorization_code', code) // Use authorization_code field
      .eq('state', state)
      .single();

    if (fetchError || !oauthCode || new Date(oauthCode.expires_at) < new Date()) {
      console.error('Invalid or expired authorization code:', code, fetchError);
      return res.status(400).json({ error: 'Invalid or expired authorization code' });
    }

    // Verify PKCE challenge
    const expectedCodeChallenge = await generateCodeChallenge(code_verifier);
    if (oauthCode.code_challenge !== expectedCodeChallenge) {
      console.error('Code challenge mismatch for state:', state);
      return res.status(400).json({ error: 'Invalid code verifier' });
    }

    // Verify redirect_uri
    if (oauthCode.redirect_uri !== redirect_uri) {
      console.error('Redirect URI mismatch. Expected:', oauthCode.redirect_uri, 'Got:', redirect_uri);
      return res.status(400).json({ error: 'Invalid redirect URI' });
    }

    // Get the Clerk user ID from the OAuth record
    const clerkUserId = oauthCode.clerk_user_id;
    const accessToken = generateAccessToken(clerkUserId);
    const refreshToken = generateRefreshToken(clerkUserId);
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: refreshError } = await supabase
      .from('refresh_tokens')
      .insert({
        clerk_user_id: clerkUserId,
        token: refreshToken,
        expires_at: refreshTokenExpiresAt.toISOString(),
      });

    if (refreshError) {
      console.error('Error storing refresh token:', refreshError);
      return res.status(500).json({ error: 'Failed to issue tokens' });
    }

    // Delete the used OAuth code
    await supabase.from('oauth_codes').delete().eq('id', oauthCode.id);

    res.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    });

  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).json({ error: 'Failed to exchange code for tokens' });
  }
});

// Refresh access token
router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token: oldRefreshToken } = req.body;

    if (!oldRefreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyToken(oldRefreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

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
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', storedToken.id);

    const newAccessToken = generateAccessToken(clerkUserId);
    const newRefreshToken = generateRefreshToken(clerkUserId);
    const newRefreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('refresh_tokens')
      .insert({
        clerk_user_id: clerkUserId,
        token: newRefreshToken,
        expires_at: newRefreshTokenExpiresAt.toISOString(),
      });

    if (insertError) {
      return res.status(500).json({ error: 'Failed to issue new tokens' });
    }

    res.json({
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600,
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;