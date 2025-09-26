import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJWT, generateJWT, generateRefreshToken, generateSessionId } from '../../../src/utils/jwt.js';
import { VSCodeIntegrationService } from '../../../src/utils/supabase/vscode-integration.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const payload = verifyJWT(refresh_token);
    if (!payload || payload.type !== 'refresh' || !payload.sub || !payload.session_id) {
      throw new Error('Invalid refresh token');
    }

    const clerkId = payload.sub;
    const sessionId = payload.session_id;

    // Check session active
    const session = await VSCodeIntegrationService.getActiveVSCodeSession(sessionId);
    if (!session) {
      throw new Error('Session inactive or expired');
    }

    // Rotate for security
    const newSessionId = generateSessionId();
    const newRefreshToken = generateRefreshToken({ clerk_id: clerkId }, newSessionId);
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1h

    // Generate new access token
    const newAccessToken = generateJWT({
      clerk_id: clerkId,
      email: session.user_email || '',
      organization_id: session.organization_id || null,
      plan_type: session.plan_type || 'starter'
    }, newSessionId);

    // Update session
    await VSCodeIntegrationService.refreshVSCodeSession(sessionId, {
      userId: clerkId,
      sessionId: newSessionId,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      clientInfo: session.client_info,
      userEmail: session.user_email,
      planType: session.plan_type,
      orgId: session.organization_id
    });

    res.status(200).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600,
      session_id: newSessionId
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({ error: 'Refresh failed - re-auth required' });
  }
}