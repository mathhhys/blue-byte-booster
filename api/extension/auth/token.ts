import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

// Local implementation of generateExtensionJWT to avoid import issues
function generateExtensionJWT(userData: any): { token: string; expiresAt: Date; hash: string } {
  const now = Math.floor(Date.now() / 1000);
  const fourMonthsInSeconds = 4 * 30 * 24 * 60 * 60; // 4 months
  const expiresAt = new Date((now + fourMonthsInSeconds) * 1000);
  
  const payload = {
    sub: userData.clerk_id,
    email: userData.email,
    org_id: userData.organization_id,
    plan: userData.plan_type,
    type: 'extension',
    iat: now,
    exp: now + fourMonthsInSeconds,
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET!);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, expiresAt, hash };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== EXTENSION TOKEN GENERATION START ===');
    
    // Verify Clerk token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    console.log('Verifying Clerk token for extension token generation...');
    
    const claims = await verifyToken(clerkToken, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }
    console.log('✅ Clerk token verified for user:', clerkId);

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
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

    // Fetch user data
    console.log('Fetching user data for extension token...');
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, organization_id')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !userData) {
      console.error('User fetch error:', error);
      return res.status(404).json({ error: 'User not found in database' });
    }
    console.log('✅ User data fetched for extension token generation');

    // Revoke existing tokens (single token policy)
    console.log('Revoking existing extension tokens...');
    const { error: revokeError } = await supabase.rpc('revoke_user_extension_tokens', {
      p_user_id: userData.id
    });
    
    if (revokeError) {
      console.warn('Warning: Could not revoke existing tokens:', revokeError.message);
      // Continue anyway - this is not critical
    }

    // Generate new 4-month extension token
    console.log('Generating 4-month extension JWT...');
    const { token, expiresAt, hash } = generateExtensionJWT(userData);

    // Store token metadata in database
    console.log('Storing extension token metadata...');
    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: userData.id,
        token_hash: hash,
        name: 'VSCode Extension Token',
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Error storing token:', insertError);
      return res.status(500).json({ error: 'Failed to store token' });
    }

    // Calculate response data
    const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    console.log('✅ Extension token generated successfully');
    console.log('- Expires in:', Math.floor(expiresIn / (30 * 24 * 60 * 60)), 'months');
    console.log('- Expires at:', expiresAt.toISOString());

    res.status(200).json({
      success: true,
      access_token: token,
      expires_in: expiresIn,
      expires_at: expiresAt.toISOString(),
      token_type: 'Bearer'
    });
    
    console.log('=== EXTENSION TOKEN GENERATION END ===');

  } catch (error) {
    const err = error as Error;
    console.error('❌ Extension token generation error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
    console.log('=== EXTENSION TOKEN GENERATION END (ERROR) ===');
  }
}