const express = require('express');
const { authenticateClerkToken } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

console.log('routes/extension-auth.js: Loading...');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

// 4 months in seconds (approx 120 days)
const EXTENSION_TOKEN_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60;

// Helper functions
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function calculateExpiryEpoch(durationSeconds) {
  return getCurrentEpochTime() + durationSeconds;
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

function generateExtensionToken(clerkUserId, userData) {
  const exp = calculateExpiryEpoch(EXTENSION_TOKEN_EXPIRES_SECONDS);
  const payload = {
    sub: clerkUserId,
    email: userData.email,
    org_id: userData.organization_id || null,
    plan: userData.plan_type,
    type: 'extension',
    iat: getCurrentEpochTime(),
    exp: exp,
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  };
  
  const token = jwt.sign(payload, JWT_SECRET);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = epochToISOString(exp);
  
  console.log(`routes/extension-auth.js: Generated extension token for user ${clerkUserId}, expires at ${expiresAt}`);
  
  return { token, expiresAt, hash };
}

// Generate extension token
router.post('/token', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    console.log('routes/extension-auth.js: /token endpoint hit');
    const { clerkUserId } = req.auth;
    
    // Fetch user data from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkUserId)
      .single();
    
    if (userError || !userData) {
      console.error('routes/extension-auth.js: User not found in database for Clerk ID:', clerkUserId);
      return res.status(404).json({ error: 'User not found in database' });
    }
    
    console.log('routes/extension-auth.js: Found user data:', {
      id: userData.id,
      email: userData.email,
      plan_type: userData.plan_type
    });
    
    // Revoke any existing non-expired extension tokens for this user
    const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
      p_user_id: userData.id
    });
    
    if (revokeError) {
      console.error('routes/extension-auth.js: Error revoking old tokens:', revokeError);
      // Continue anyway, don't fail the generation
    }
    
    // Generate new extension token
    const { token, expiresAt, hash } = generateExtensionToken(clerkUserId, userData);
    
    // Store the token hash in database
    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: userData.id,
        token_hash: hash,
        name: 'VSCode Extension Token',
        expires_at: expiresAt
      });
    
    if (insertError) {
      console.error('routes/extension-auth.js: Failed to store extension token hash:', insertError);
      // Still return the token, but log the issue
    }
    
    const expiresIn = EXTENSION_TOKEN_EXPIRES_SECONDS;
    
    console.log('routes/extension-auth.js: Extension token generated successfully for user:', clerkUserId);
    
    res.json({
      success: true,
      access_token: token,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });
    
  } catch (error) {
    console.error('routes/extension-auth.js: /token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;