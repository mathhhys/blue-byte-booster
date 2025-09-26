import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJWT, generateJWT, generateRefreshToken, generateSessionId } from '../../../src/utils/jwt.ts';
import { VSCodeIntegrationService } from '../../../src/utils/supabase/vscode-integration.ts';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug || '';

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (slug === 'refresh') {
    // Original refresh endpoint logic
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
  } else if (slug === 'submit-token') {
    // Original submit-token endpoint logic
    try {
      const { access_token } = req.body;
      if (!access_token) {
        return res.status(400).json({ error: 'Access token required' });
      }

      // Verify custom JWT
      const payload = verifyJWT(access_token);
      if (!payload || !payload.sub) {
        throw new Error('Invalid token payload');
      }

      const clerkId = payload.sub;
      const sessionId = payload.session_id;

      // Fetch user from Supabase
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('clerk_id, email, plan_type, credits, organization_id')
        .eq('clerk_id', clerkId)
        .single();

      if (userError || !userData) {
        throw new Error('User not found');
      }

      // Check if session exists and is active
      let session = await VSCodeIntegrationService.getActiveVSCodeSession(sessionId);
      if (!session) {
        // Create new session
        const expiresAt = new Date(Date.now() + 3600 * 1000); // 1h
        session = await VSCodeIntegrationService.createVSCodeSession({
          userId: clerkId,
          sessionId,
          accessToken: access_token,
          expiresAt,
          clientInfo: { source: 'vscode-extension', version: req.headers['user-agent'] as string },
          userEmail: userData.email,
          planType: userData.plan_type,
          orgId: userData.organization_id || null
        });
      } else {
        // Update last used
        await VSCodeIntegrationService.updateSessionLastUsed(sessionId);
      }

      res.status(200).json({
        success: true,
        session_id: session.id,
        user: { id: clerkId, email: userData.email, credits: userData.credits, plan: userData.plan_type }
      });
    } catch (error) {
      console.error('Submit token error:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
}