import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'MISSING_AUTH_HEADER',
        message: 'Missing authorization header',
        userMessage: 'Authentication required.'
      });
    }

    const token = authHeader.substring(7);

    // For development/testing, allow mock tokens
    let clerkUserId;
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
    } else {
      // Verify Clerk token
      const decoded = await verifyClerkToken(token);
      clerkUserId = decoded.clerkUserId;
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Get all active tokens for user
    const { data: tokens, error: tokensError } = await supabase
      .from('extension_tokens')
      .select('id, name, device_name, created_at, expires_at, last_used_at, revoked_at, refresh_count')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return res.status(500).json({
        error: 'FETCH_FAILED',
        message: 'Failed to fetch tokens'
      });
    }

    // Filter and format tokens
    const activeTokens = (tokens || [])
      .filter(token => !token.revoked_at && new Date(token.expires_at) > new Date())
      .map(token => {
        const expiresAt = new Date(token.expires_at);
        const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        if (daysUntilExpiry <= 1) {
          status = 'critical';
        } else if (daysUntilExpiry <= 7) {
          status = 'warning';
        } else if (daysUntilExpiry <= 30) {
          status = 'expiring_soon';
        }

        return {
          id: token.id,
          name: token.name,
          device_name: token.device_name || 'VSCode Extension',
          created_at: token.created_at,
          expires_at: token.expires_at,
          last_used_at: token.last_used_at,
          refresh_count: token.refresh_count || 0,
          days_until_expiry: daysUntilExpiry,
          status: status,
          can_refresh: daysUntilExpiry <= 30
        };
      });

    const revokedTokens = (tokens || [])
      .filter(token => token.revoked_at)
      .map(token => ({
        id: token.id,
        name: token.name,
        device_name: token.device_name || 'VSCode Extension',
        created_at: token.created_at,
        expires_at: token.expires_at,
        revoked_at: token.revoked_at,
        last_used_at: token.last_used_at,
        status: 'revoked'
      }))
      .slice(0, 5); // Only return last 5 revoked tokens

    res.status(200).json({
      success: true,
      tokens: activeTokens,
      revoked_tokens: revokedTokens,
      total_active: activeTokens.length,
      max_tokens: 5
    });

  } catch (error) {
    console.error('Token list error:', error);
    res.status(500).json({ 
      error: 'LIST_FAILED',
      message: 'Failed to list tokens'
    });
  }
}

export default handler;