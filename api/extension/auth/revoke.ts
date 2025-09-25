import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TOKEN REVOKE API DEBUG START ===');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid auth header for revoke');
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    console.log('Token length for revoke:', token.length);

    // Verify the custom extension JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
      console.log('✅ Custom token verified:', { sub: decoded.sub, scope: decoded.scope });
    } catch (verifyError) {
      console.error('❌ Custom token verification failed:', verifyError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const clerkId = decoded.sub;
    if (!clerkId || decoded.scope !== 'vscode:auth') {
      return res.status(401).json({ error: 'Invalid token claims' });
    }

    // Hash the token for database lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Create Supabase client with service role
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration for revoke');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Fetch user_id from clerk_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !userData) {
      console.error('User not found for revoke:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userData.id;

    // Update token as revoked
    const { error: revokeError } = await supabase
      .from('vscode_tokens')
      .update({ revoked_at: new Date() })
      .eq('token_hash', tokenHash)
      .eq('user_id', userId)
      .eq('revoked_at', null); // Only revoke if not already revoked

    if (revokeError) {
      console.error('Failed to revoke token:', revokeError);
      if (revokeError.code === 'PGRST116') { // No rows updated
        return res.status(404).json({ error: 'Token not found or already revoked' });
      }
      return res.status(500).json({ error: 'Failed to revoke token' });
    }

    console.log('✅ Extension token revoked successfully');
    res.status(200).json({ success: true, message: 'Token revoked successfully' });
    console.log('=== TOKEN REVOKE API DEBUG END ===');

  } catch (error) {
    console.error('❌ TOKEN REVOKE API EXCEPTION:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}