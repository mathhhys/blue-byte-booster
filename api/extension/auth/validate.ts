import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Missing authorization header' 
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify JWT signature and expiry
    let decoded: any;
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
      }
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        clockTolerance: 5
      });
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid or expired token' 
      });
    }

    // 3. Validate token type
    if (decoded.type !== 'access') {
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid token type' 
      });
    }

    // 4. Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
        valid: false,
        error: 'Server configuration error' 
      });
    }

    const supabase = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 5. Verify token hash exists and not revoked
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('extension_tokens')
      .select('id, user_id, expires_at, revoked_at, last_used_at')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenRecord) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Token not found in database' 
      });
    }

    // 6. Check if revoked
    if (tokenRecord.revoked_at) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Token has been revoked' 
      });
    }

    // 7. Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Token has expired' 
      });
    }

    // 8. Update last used timestamp
    await supabase
      .from('extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // 9. Fetch user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('clerk_id, email, plan_type, credits')
      .eq('id', tokenRecord.user_id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ 
        valid: false, 
        error: 'User not found' 
      });
    }

    // 10. Return validation result
    res.status(200).json({
      valid: true,
      userId: userData.clerk_id,
      email: userData.email,
      plan: userData.plan_type,
      credits: userData.credits
    });

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ 
      valid: false,
      error: 'Internal server error'
    });
  }
}