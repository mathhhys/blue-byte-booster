import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJWT } from '../../../src/utils/jwt.js';
import { createClient } from '@supabase/supabase-js';
import { VSCodeIntegrationService } from '../../../src/utils/supabase/vscode-integration.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}