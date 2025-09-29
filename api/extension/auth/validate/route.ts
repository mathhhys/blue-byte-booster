import type { NextApiRequest, NextApiResponse } from 'next';
import * as jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ valid: false, error: 'Server configuration error' });
    }

    // Verify JWT (HS256 for custom tokens)
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
      return res.status(401).json({ valid: false, error: 'Invalid token signature' });
    }

    if (decoded.type !== 'access' || !decoded.sub) {
      return res.status(401).json({ valid: false, error: 'Invalid token payload' });
    }

    const clerkUserId = decoded.sub;

    // Optional: Verify user in Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let userId = decoded.user_id || clerkUserId;
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: userData, error } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', clerkUserId)
        .single();

      if (error || !userData) {
        console.error('User verification failed:', error);
        return res.status(404).json({ valid: false, error: 'User not found' });
      }

      userId = userData.id;
    }

    res.status(200).json({
      valid: true,
      userId,
      clerkUserId: clerkUserId,
      email: decoded.email,
      plan_type: decoded.plan_type,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
}