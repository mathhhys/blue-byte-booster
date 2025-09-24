import { verifyToken } from '@clerk/backend';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== CLERK CONFIG DIAGNOSTIC ===');
    
    // Check all environment variables
    const envCheck = {
      CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
      CLERK_SECRET_KEY_length: process.env.CLERK_SECRET_KEY?.length,
      CLERK_SECRET_KEY_prefix: process.env.CLERK_SECRET_KEY?.substring(0, 8),
      CLERK_DOMAIN: process.env.CLERK_DOMAIN,
      VITE_CLERK_PUBLISHABLE_KEY: !!process.env.VITE_CLERK_PUBLISHABLE_KEY,
      VITE_CLERK_PUBLISHABLE_KEY_prefix: process.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 8),
      NEXT_PUBLIC_CLERK_FRONTEND_API: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API,
    };
    
    console.log('Environment check:', envCheck);

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('Token received, length:', token.length);

    // Decode token parts for inspection
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      console.log('Token header:', {
        alg: header.alg,
        kid: header.kid,
        typ: header.typ
      });
      
      console.log('Token payload (safe fields):', {
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
        iat: payload.iat,
        nbf: payload.nbf,
        sub_preview: payload.sub?.substring(0, 10) + '...',
        azp: payload.azp
      });

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp && payload.exp < now;
      console.log('Token expiry check:', {
        exp: payload.exp,
        now: now,
        expired: isExpired,
        timeUntilExpiry: payload.exp ? payload.exp - now : 'no exp'
      });

      if (isExpired) {
        return res.status(400).json({
          error: 'Token is expired',
          details: `Token expired ${now - payload.exp} seconds ago`
        });
      }

    } catch (decodeError) {
      console.error('Failed to decode token:', decodeError);
      return res.status(400).json({
        error: 'Invalid token format',
        details: (decodeError as Error).message
      });
    }

    // Try different verification approaches
    const results: any = {};

    // Method 1: Standard jwtKey
    try {
      console.log('Trying verification with jwtKey...');
      const claims1 = await verifyToken(token, {
        jwtKey: process.env.CLERK_SECRET_KEY!
      });
      results.method1 = {
        success: true,
        sub: claims1.sub,
        email: claims1.email,
        iss: claims1.iss
      };
      console.log('✅ Method 1 success');
    } catch (error1) {
      results.method1 = {
        success: false,
        error: (error1 as Error).message,
        name: (error1 as Error).name
      };
      console.log('❌ Method 1 failed:', (error1 as Error).message);
    }

    // Method 2: secretKey
    try {
      console.log('Trying verification with secretKey...');
      const claims2 = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!
      });
      results.method2 = {
        success: true,
        sub: claims2.sub,
        email: claims2.email,
        iss: claims2.iss
      };
      console.log('✅ Method 2 success');
    } catch (error2) {
      results.method2 = {
        success: false,
        error: (error2 as Error).message,
        name: (error2 as Error).name
      };
      console.log('❌ Method 2 failed:', (error2 as Error).message);
    }

    // Method 3: With additional options
    try {
      console.log('Trying verification with additional options...');
      const claims3 = await verifyToken(token, {
        jwtKey: process.env.CLERK_SECRET_KEY!,
        // Add any other valid options here
      });
      results.method3 = {
        success: true,
        sub: claims3.sub,
        email: claims3.email,
        iss: claims3.iss
      };
      console.log('✅ Method 3 success');
    } catch (error3) {
      results.method3 = {
        success: false,
        error: (error3 as Error).message,
        name: (error3 as Error).name
      };
      console.log('❌ Method 3 failed:', (error3 as Error).message);
    }

    res.status(200).json({
      success: true,
      environment: envCheck,
      verificationResults: results,
      recommendation: generateRecommendation(results)
    });

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    res.status(500).json({ 
      error: 'Diagnostic failed', 
      details: (error as Error).message 
    });
  }
}

function generateRecommendation(results: any): string {
  const successful = Object.keys(results).filter(key => results[key].success);
  
  if (successful.length === 0) {
    return 'All verification methods failed. Check if the CLERK_SECRET_KEY is correct and the token is valid.';
  }
  
  if (successful.length === 1) {
    return `Use ${successful[0]} for token verification.`;
  }
  
  return `Multiple methods work: ${successful.join(', ')}. Use the first successful one.`;
}