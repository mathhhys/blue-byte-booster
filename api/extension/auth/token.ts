import { verifyToken } from '@clerk/backend';
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { userOperations } from '../../../src/utils/supabase/database.js';

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
      const now = Math.floor(Date.now() / 1000);
      console.log('🔍 [BACKEND] Current server time:', new Date(now * 1000).toISOString(), 'Unix:', now);
      console.log('Token header:', { alg: header.alg, kid: header.kid, iss: header.iss });
      console.log('🔍 [BACKEND] Decoded Clerk token payload:');
      console.log('  - iss:', payload.iss);
      console.log('  - iat:', payload.iat, '(Date:', new Date(payload.iat * 1000).toISOString(), ')');
      console.log('  - exp:', payload.exp, '(Date:', new Date(payload.exp * 1000).toISOString(), ')');
      console.log('  - nbf:', payload.nbf, '(Date:', new Date(payload.nbf * 1000).toISOString(), ')');
      console.log('  - sub (first 10 chars):', payload.sub?.substring(0, 10) + '...');
      console.log('  - iat vs now:', payload.iat - now, 'seconds (positive = future)');
      console.log('  - Duration (exp - iat):', (payload.exp || 0) - payload.iat, 'seconds');
      
      // Check if token is expired (pre-verification check)
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

    const clerkId = claims.sub;
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    // Fetch user data using shared operations (ensures consistent server-side client and RLS handling)
    console.log('🔧 Using userOperations.getUserByClerkId for clerkId:', clerkId);
    console.log('Env check before query: SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await userOperations.getUserByClerkId(clerkId);
    
    console.log('userOperations result:', { data: !!userData, error: userError?.message || userError });
    if (userError || !userData) {
      console.error('User fetch error via userOperations:', userError || 'No user data returned');
      return res.status(404).json({ error: 'User not found in database' });
    }
    console.log('✅ User data fetched via userOperations:', {
      clerk_id: userData.clerk_id,
      email: userData.email,
      plan_type: userData.plan_type,
      credits: userData.credits,
      organization_id: userData.organization_id
    });

    // Generate long-lived custom JWT for VSCode extension (inline to avoid import issues)
    const sessionId = crypto.randomUUID();
    const FOUR_MONTHS_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months approx
    const iat = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userData.clerk_id,
      email: userData.email,
      session_id: sessionId,
      org_id: userData.organization_id || null,
      plan: userData.plan_type,
      iat,
      exp: iat + FOUR_MONTHS_SECONDS,
      iss: 'softcodes.ai',
      aud: 'vscode-extension'
    };
    const customToken = jwt.sign(payload, process.env.JWT_SECRET!);
    const customExpiresIn = FOUR_MONTHS_SECONDS;
    const customExpiresAt = new Date((iat + FOUR_MONTHS_SECONDS) * 1000).toISOString();

    console.log('🔧 Generated custom long-lived JWT for extension:');
    console.log('  - Expires in:', customExpiresIn, 'seconds (~4 months)');
    console.log('  - Expires at:', customExpiresAt);
    console.log('  - Token preview:', customToken.substring(0, 50) + '...');

    console.log('Returning success response with custom extension token');
    res.status(200).json({
      success: true,
      access_token: customToken,
      expires_in: customExpiresIn,
      expires_at: customExpiresAt,
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