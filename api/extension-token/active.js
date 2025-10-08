import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // For development/testing, allow mock tokens
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
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
        .maybeSingle();

      if (tokenError) {
        console.error('Token check error:', tokenError);
        return res.status(500).json({ error: 'Failed to check token status' });
      }

      const hasActive = !!tokenData;

      console.log(`Active long-lived token check for user ${clerkUserId} (ID: ${userId}): ${hasActive}`);

      return res.status(200).json({
        success: true,
        hasActive: hasActive,
        ...(tokenData && {
          tokenId: tokenData.id,
          expiresAt: tokenData.expires_at,
        }),
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

    const userId = userData.id;

    // Check for active token (not revoked and not expired)
    const { data: tokenData, error: tokenError } = await supabase
      .from('extension_tokens')
      .select('id, expires_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (tokenError) {
      console.error('Token check error:', tokenError);
      return res.status(500).json({ error: 'Failed to check token status' });
    }

    const hasActive = !!tokenData;

    console.log(`Active long-lived token check for user ${clerkUserId} (ID: ${userId}): ${hasActive}`);

    res.status(200).json({
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
}