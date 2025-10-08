import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { verifyToken } from '@clerk/backend';

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
async function generateLongLivedToken(clerkUserId) {
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

  // Revoke existing tokens
  const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
    p_user_id: userId,
  });

  if (revokeError) {
    throw new Error('Failed to revoke existing tokens');
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // For development/testing, allow mock tokens
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
      const tokenData = await generateLongLivedToken(clerkUserId);
      return res.status(200).json({
        success: true,
        access_token: tokenData.token,
        expires_in: LONG_LIVED_EXPIRES_SECONDS,
        expires_at: tokenData.expiresAtISO,
        token_type: 'Bearer',
        type: 'long_lived',
        usage: 'vscode_extension',
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
      return res.status(401).json({ error: 'User not found' });
    }

    const tokenData = await generateLongLivedToken(clerkUserId);

    res.status(200).json({
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
}