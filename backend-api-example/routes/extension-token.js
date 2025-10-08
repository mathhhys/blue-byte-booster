const express = require('express');
const { authenticateClerkToken } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LONG_LIVED_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months in seconds
const BCRYPT_SALT_ROUNDS = 12;

// Helper functions for time
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

// Generate long-lived token
async function generateLongLivedToken(clerkUserId) {
  // Fetch detailed user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, plan_type')
    .eq('clerk_id', clerkUserId)
    .single();

  if (userError || !userData) {
    throw new Error('User not found in database');
  }

  const { id: userId, first_name: firstName, last_name: lastName, email: primaryEmail, plan_type: accountType } = userData;

  // Revoke existing tokens
  const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
    p_user_id: userId,
  });

  if (revokeError) {
    throw new Error('Failed to revoke existing tokens');
  }

  // Generate detailed Clerk-mimicking JWT payload
  const iat = getCurrentEpochTime();
  const lifetime = LONG_LIVED_EXPIRES_SECONDS;
  const exp = iat + lifetime;

  const payload = {
    sub: clerkUserId,
    userId,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    primaryEmail,
    accountType,
    vscodeExtension: true,
    iat,
    exp,
    iss: 'https://clerk.softcodes.ai',
    aud: 'softcodes-ai-vscode',
    type: 'access' // Retain for backward compatibility
  };

  const token = jwt.sign(payload, process.env.JWT_PRIVATE_KEY, { algorithm: 'RS256' });

  // Hash token
  const tokenHash = bcrypt.hashSync(token, BCRYPT_SALT_ROUNDS);

  // Expires at ISO
  const expiresAtISO = epochToISOString(exp);

  // Insert into extension_tokens
  const { error: insertError } = await supabase
    .from('extension_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      name: 'VSCode Long-Lived Token',
      expires_at: expiresAtISO,
    });

  if (insertError) {
    throw new Error('Failed to store token');
  }

  // Log
  console.log(`Long-lived token generated for user ${clerkUserId} (ID: ${userId}), expires at ${expiresAtISO}`);

  return { token, exp, expiresAtISO };
}

// POST /api/extension-token/generate
router.post('/generate', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.auth;
    console.log('Generating long-lived extension token for Clerk User ID:', clerkUserId);

    const tokenData = await generateLongLivedToken(clerkUserId);

    res.json({
      success: true,
      access_token: tokenData.token,
      expires_in: LONG_LIVED_EXPIRES_SECONDS,
      expires_at: tokenData.expiresAtISO,
      token_type: 'Bearer',
      type: 'long_lived',
      usage: 'vscode_extension',
    });

  } catch (error) {
    console.error('Long-lived token generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate long-lived token' });
  }
});

// POST /api/extension-token/revoke
router.post('/revoke', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.auth;
    console.log('Revoking long-lived extension token for Clerk User ID:', clerkUserId);

    // Fetch user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userData.id;

    // Revoke tokens
    const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
      p_user_id: userId,
    });

    if (revokeError) {
      console.error('Token revocation error:', revokeError);
      return res.status(500).json({ error: 'Failed to revoke token' });
    }

    console.log(`Long-lived token revoked for user ${clerkUserId} (ID: ${userId})`);

    res.json({
      success: true,
      revoked: true,
      message: 'Extension token revoked successfully',
    });

  } catch (error) {
    console.error('Token revocation error:', error.message);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// GET /api/extension-token/active - Check if user has an active long-lived token
router.get('/active', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.auth;
    console.log('Checking active long-lived token for Clerk User ID:', clerkUserId);

    // Fetch user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userData.id;

    // Check for active token (not revoked and not expired)
    const { data: tokenData, error: tokenError } = await supabase
      .from('extension_tokens')
      .select('id, expires_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle(); // Use maybeSingle to handle no rows gracefully

    if (tokenError) {
      console.error('Token check error:', tokenError);
      return res.status(500).json({ error: 'Failed to check token status' });
    }

    const hasActive = !!tokenData;

    console.log(`Active long-lived token check for user ${clerkUserId} (ID: ${userId}): ${hasActive}`);

    res.json({
      success: true,
      hasActive: hasActive,
      ...(tokenData && {
        tokenId: tokenData.id,
        expiresAt: tokenData.expires_at,
      }),
    });

  } catch (error) {
    console.error('Active token check error:', error.message);
    res.status(500).json({ error: 'Failed to check active token' });
  }
});

module.exports = router;