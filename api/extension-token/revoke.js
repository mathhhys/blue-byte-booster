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
  if (req.method !== 'POST') {
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

      // Revoke tokens
      const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
        p_user_id: userId,
      });

      if (revokeError) {
        console.error('Token revocation error:', revokeError);
        return res.status(500).json({ error: 'Failed to revoke token' });
      }

      console.log(`Long-lived token revoked for user ${clerkUserId} (ID: ${userId})`);

      return res.status(200).json({
        success: true,
        revoked: true,
        message: 'Extension token revoked successfully',
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

    res.status(200).json({
      success: true,
      revoked: true,
      message: 'Extension token revoked successfully',
    });

  } catch (error) {
    console.error('Token revocation error:', error.message);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
}