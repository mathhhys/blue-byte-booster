import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';
import { logTokenAudit } from '../middleware/token-validation.js';

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
        userMessage: 'Authentication required.'
      });
    }

    const token = authHeader.substring(7);
    const { tokenId } = req.body || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // For development/testing, allow mock tokens
    let clerkUserId;
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
    } else {
      // Verify Clerk token
      const decoded = await verifyClerkToken(token);
      clerkUserId = decoded.clerkUserId;
    }

    // Fetch user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
        userMessage: 'Your account was not found.'
      });
    }

    const userId = userData.id;

    if (tokenId) {
      // Revoke specific token
      const { data: tokenData, error: fetchError } = await supabase
        .from('extension_tokens')
        .select('id, device_name')
        .eq('id', tokenId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !tokenData) {
        return res.status(404).json({
          error: 'TOKEN_NOT_FOUND',
          message: 'Token not found',
          userMessage: 'The specified token was not found or does not belong to you.'
        });
      }

      const { error: revokeError } = await supabase
        .from('extension_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', tokenId)
        .eq('user_id', userId);

      if (revokeError) {
        console.error('Token revocation error:', revokeError);
        return res.status(500).json({
          error: 'REVOCATION_FAILED',
          message: 'Failed to revoke token',
          userMessage: 'An error occurred while revoking the token. Please try again.'
        });
      }

      // Log audit event
      await logTokenAudit({
        tokenId: tokenId,
        userId: userId,
        action: 'revoked',
        details: { device_name: tokenData.device_name },
        ipAddress: ipAddress,
        userAgent: userAgent
      });

      console.log(`Token ${tokenId} revoked for user ${clerkUserId} (ID: ${userId})`);

      return res.status(200).json({
        success: true,
        revoked: true,
        message: `Token "${tokenData.device_name}" revoked successfully`,
        userMessage: `Token "${tokenData.device_name}" has been revoked. Any VSCode extension using it will stop working.`
      });
    } else {
      // Revoke all tokens (legacy behavior)
      const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
        p_user_id: userId,
      });

      if (revokeError) {
        console.error('Token revocation error:', revokeError);
        return res.status(500).json({
          error: 'REVOCATION_FAILED',
          message: 'Failed to revoke tokens',
          userMessage: 'An error occurred while revoking tokens. Please try again.'
        });
      }

      // Log audit event
      await logTokenAudit({
        tokenId: null,
        userId: userId,
        action: 'revoked',
        details: { revoke_all: true },
        ipAddress: ipAddress,
        userAgent: userAgent
      });

      console.log(`All tokens revoked for user ${clerkUserId} (ID: ${userId})`);

      return res.status(200).json({
        success: true,
        revoked: true,
        message: 'All extension tokens revoked successfully',
        userMessage: 'All your tokens have been revoked. Generate new ones to continue using the VSCode extension.'
      });
    }

  } catch (error) {
    console.error('Token revocation error:', error.message);
    res.status(500).json({
      error: 'REVOCATION_FAILED',
      message: 'Failed to revoke token',
      userMessage: 'An error occurred. Please try again.'
    });
  }
}

export default handler;