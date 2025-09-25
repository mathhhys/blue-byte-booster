import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { generateExtensionJWT } from '../../../src/utils/jwt.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  
  
  // Original token generation endpoint
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== TOKEN API DEBUG START ===');
    console.log('Env vars check: CLERK_SECRET_KEY:', !!process.env.CLERK_SECRET_KEY);
    console.log('Env vars check: SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Env vars check: SUPABASE_URL:', !!process.env.SUPABASE_URL);
    console.log('Env vars check: VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL);
    console.log('Env vars check: JWT_SECRET:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'unset');

    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid auth header');
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const clerkToken = authHeader.substring(7);
    console.log('Clerk token length:', clerkToken.length);
    console.log('Verifying Clerk token...');
    console.log('CLERK_SECRET_KEY length:', process.env.CLERK_SECRET_KEY ? process.env.CLERK_SECRET_KEY.length : 'unset');
    
    const now = Math.floor(Date.now() / 1000);
    let claims: any;
    try {
      // Decode header without verification to inspect
      const header = JSON.parse(Buffer.from(clerkToken.split('.')[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(clerkToken.split('.')[1], 'base64').toString());
      console.log('Token header:', { alg: header.alg, kid: header.kid, iss: header.iss });
      console.log('Token payload preview:', {
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
        iat: payload.iat,
        sub: payload.sub?.substring(0, 10) + '...'
      });
      
      // Check if token is expired (pre-verification check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.error('❌ Token is expired');
        return res.status(401).json({
          error: 'Token expired',
          details: 'The provided token has expired'
        });
      }

      // Try verification with different approaches
      console.log('Attempting Clerk token verification...');
      console.log('Using CLERK_SECRET_KEY length:', process.env.CLERK_SECRET_KEY?.length);
      
      // Method 1: Standard verification
      try {
        claims = await verifyToken(clerkToken, {
          jwtKey: process.env.CLERK_SECRET_KEY!,
          // Add issuer check if needed
          ...(payload.iss && { issuer: payload.iss })
        });
        console.log('✅ Clerk claims (method 1):', { sub: claims.sub, email: claims.email });
      } catch (method1Error) {
        console.log('Method 1 failed, trying alternative...');
        
        // Method 2: Try with different options
        try {
          claims = await verifyToken(clerkToken, {
            secretKey: process.env.CLERK_SECRET_KEY!
          });
          console.log('✅ Clerk claims (method 2):', { sub: claims.sub, email: claims.email });
        } catch (method2Error) {
          console.error('Both verification methods failed');
          throw method1Error; // Throw the original error
        }
      }

      
    } catch (verifyError) {
      const err = verifyError as Error;
      console.error('🔍 VerifyToken detailed error:', err.message);
      console.error('🔍 VerifyToken error name:', err.name);
      console.error('🔍 Token preview (first 50 chars):', clerkToken.substring(0, 50));
      console.error('🔍 CLERK_SECRET_KEY preview (first 20 chars):', process.env.CLERK_SECRET_KEY?.substring(0, 20));
      console.error('🔍 Environment check:');
      console.error('  - CLERK_DOMAIN:', process.env.CLERK_DOMAIN);
      console.error('  - VITE_CLERK_PUBLISHABLE_KEY present:', !!process.env.VITE_CLERK_PUBLISHABLE_KEY);
      
      return res.status(500).json({
        error: 'Internal server error',
        details: `JWT signature is invalid. ${err.message}`
      });
    }

    // Calculate expiration from verified claims
    const expiresIn = claims.exp - now;
    const expiresAt = new Date(claims.exp * 1000).toISOString();
    console.log('Clerk token expires in:', expiresIn, 'seconds');

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    // Fetch user data from Supabase (using service role for server-side)
    console.log('Creating Supabase client...');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase configuration');
      console.error('SUPABASE_URL:', !!supabaseUrl);
      console.error('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
      return res.status(500).json({ error: 'Server configuration error', details: 'Missing Supabase configuration' });
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
    console.log('✅ Supabase client created');

    console.log('Querying users table for clerkId:', clerkId);
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, clerk_id, email, plan_type, credits')
      .eq('clerk_id', clerkId)
      .single();

    console.log('Supabase query result:', { data: !!userData, error: error?.message });
    if (error || !userData) {
      console.error('User fetch error:', error);
      return res.status(404).json({ error: 'User not found in database' });
    }
    console.log('✅ User data fetched:', { clerk_id: userData.clerk_id, plan_type: userData.plan_type });

    // Generate custom extension JWT
    const mergedPayload = {
      ...claims,
      ...userData,
      scope: 'vscode:auth'
    };
    const customToken = generateExtensionJWT(mergedPayload);

    // Hash token for storage (security)
    const tokenHash = crypto.createHash('sha256').update(customToken).digest('hex');

    // Store in Supabase vscode_tokens
    const extensionExpiresAt = new Date((now + 12096000) * 1000); // 4 months
    const { error: insertError } = await supabase
      .from('vscode_tokens')
      .insert({
        user_id: userData.id,
        token_hash: tokenHash,
        expires_at: extensionExpiresAt,
        created_at: new Date()
      });

    if (insertError) {
      console.error('Failed to store extension token:', insertError);
      return res.status(500).json({ error: 'Failed to generate token' });
    }

    console.log('✅ Custom extension JWT generated and stored');

    console.log('Returning success response with custom extension token');
    res.status(200).json({
      success: true,
      access_token: customToken,
      expires_in: 12096000, // 4 months in seconds
      expires_at: extensionExpiresAt.toISOString(),
      token_type: 'Bearer'
    });
    console.log('=== TOKEN API DEBUG END ===');

  } catch (error) {
    const err = error as Error;
    console.error('❌ TOKEN API EXCEPTION:', err);
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'unset');
    res.status(500).json({ error: 'Internal server error', details: err.message });
    console.log('=== TOKEN API DEBUG END (ERROR) ===');
  }
}