import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyToken } from '@clerk/backend';
import { generateExtensionJWT } from '../../../src/utils/jwt.js';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (action) {
      case 'token':
        return await handleTokenGeneration(req, res);
      case 'revoke':
        return await handleTokenRevocation(req, res);
      case 'validate':
        return await handleTokenValidation(req, res);
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error) {
    console.error('Extension auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleTokenGeneration(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    const now = Math.floor(Date.now() / 1000);
    
    let claims: any;
    try {
      claims = await verifyToken(clerkToken, {
        secretKey: process.env.CLERK_SECRET_KEY!
      });
    } catch (verifyError) {
      return res.status(401).json({
        error: 'Internal server error',
        details: `JWT signature is invalid. ${verifyError.message}`
      });
    }

    const expiresIn = claims.exp - now;
    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error', details: 'Missing Supabase configuration' });
    }
    
    const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, credits')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !userData) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const customToken = generateExtensionJWT({
      ...claims,
      ...userData,
      scope: 'vscode:auth'
    });

    const tokenHash = crypto.createHash('sha256').update(customToken).digest('hex');
    const extensionExpiresAt = new Date((now + 12096000) * 1000);

    const { error: insertError } = await supabase
      .from('vscode_tokens')
      .insert({
        user_id: userData.id,
        token_hash: tokenHash,
        expires_at: extensionExpiresAt,
        created_at: new Date()
      });

    if (insertError) {
      return res.status(500).json({ error: 'Failed to generate token' });
    }

    return res.status(200).json({
      success: true,
      access_token: customToken,
      expires_in: 12096000,
      expires_at: extensionExpiresAt.toISOString(),
      token_type: 'Bearer'
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleTokenRevocation(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (verifyError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const clerkId = decoded.sub;
    if (!clerkId || decoded.scope !== 'vscode:auth') {
      return res.status(401).json({ error: 'Invalid token claims' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { error: revokeError } = await supabase
      .from('vscode_tokens')
      .update({ revoked_at: new Date() })
      .eq('token_hash', tokenHash)
      .eq('user_id', userData.id)
      .eq('revoked_at', null);

    if (revokeError) {
      if (revokeError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Token not found or already revoked' });
      }
      return res.status(500).json({ error: 'Failed to revoke token' });
    }

    return res.status(200).json({ success: true, message: 'Token revoked successfully' });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleTokenValidation(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    
    if (!claims || !claims.sub) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }

    return res.status(200).json({ valid: true, userId: claims.sub });
  } catch (error) {
    return res.status(500).json({ valid: false, error: 'Validation failed' });
  }
}