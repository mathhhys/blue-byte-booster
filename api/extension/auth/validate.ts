import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Local implementation of verifyExtensionJWT
function verifyExtensionJWT(token: string): any {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decoded === 'object' && decoded !== null && 'type' in decoded && decoded.type !== 'extension') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid extension token');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    
    // Try to verify as extension token first
    try {
      // Verify JWT structure and signature
      const decoded = verifyExtensionJWT(token);
      
      // Check database for token status
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ valid: false, error: 'Server configuration error' });
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

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const { data: tokenData, error } = await supabase
        .from('extension_tokens')
        .select('expires_at, revoked_at, last_used_at')
        .eq('token_hash', tokenHash)
        .single();

      if (error || !tokenData) {
        return res.status(401).json({ valid: false, error: 'Token not found' });
      }

      if (tokenData.revoked_at) {
        return res.status(401).json({ valid: false, error: 'Token revoked' });
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return res.status(401).json({ valid: false, error: 'Token expired' });
      }

      // Update last_used_at timestamp
      await supabase
        .from('extension_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('token_hash', tokenHash);

      return res.status(200).json({
        valid: true,
        userId: decoded.sub,
        expiresAt: tokenData.expires_at,
        tokenType: 'extension'
      });
    } catch (extensionError) {
      // Fall back to Clerk token validation
      try {
        const claims = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY!,
        });
        
        if (!claims || !claims.sub) {
          return res.status(401).json({ valid: false, error: 'Invalid token' });
        }

        return res.status(200).json({
          valid: true,
          userId: claims.sub,
          tokenType: 'clerk'
        });
      } catch (clerkError) {
        return res.status(401).json({ valid: false, error: 'Invalid token' });
      }
    }
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
}