const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

console.log('middleware/auth.js: SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('middleware/auth.js: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('middleware/auth.js: JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded');
const JWT_SECRET = process.env.JWT_SECRET;

// Cache for Clerk's public keys
let clerkPublicKeys = null;
let keysLastFetched = 0;
const KEYS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch Clerk's public keys from JWKS endpoint
async function fetchClerkPublicKeys() {
  try {
    const now = Date.now();
    if (clerkPublicKeys && (now - keysLastFetched) < KEYS_CACHE_DURATION) {
      return clerkPublicKeys;
    }

    const response = await axios.get('https://softcodes.ai/.well-known/jwks.json');
    const jwks = response.data;
    clerkPublicKeys = jwks.keys;
    keysLastFetched = now;

    return clerkPublicKeys;
  } catch (error) {
    console.error('Error fetching Clerk public keys:', error);
    // Fallback to decode-only mode if JWKS fetch fails
    return null;
  }
}

// Helper function to verify Clerk session token
async function verifyClerkToken(token) {
  try {
    // Try to get Clerk's public keys for proper verification
    const publicKeys = await fetchClerkPublicKeys();

    if (publicKeys && publicKeys.length > 0) {
      // Use proper JWT verification with Clerk's public key
      const decoded = jwt.verify(token, publicKeys[0], {
        algorithms: ['RS256'],
        issuer: 'https://softcodes.ai'
      });

      if (!decoded || !decoded.sub) {
        throw new Error('Invalid Clerk token structure');
      }

      return {
        clerkUserId: decoded.sub,
        sessionId: decoded.sid,
        exp: decoded.exp
      };
    } else {
      // Fallback: decode and manually check expiration
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || !decoded.payload || !decoded.payload.sub) {
        throw new Error('Invalid Clerk token structure');
      }

      // Check if token has expired (with 5 second tolerance)
      const currentTime = Math.floor(Date.now() / 1000);
      const clockTolerance = 5;
      if (decoded.payload.exp && decoded.payload.exp < (currentTime - clockTolerance)) {
        throw new Error('Clerk token has expired. Please generate a new token from the dashboard.');
      }

      return {
        clerkUserId: decoded.payload.sub,
        sessionId: decoded.payload.sid,
        exp: decoded.payload.exp
      };
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.message.includes('expired')) {
      throw new Error('Clerk token has expired. Please generate a new token from the dashboard.');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid Clerk token signature');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Clerk token not yet valid');
    }
    throw new Error('Invalid Clerk token: ' + error.message);
  }
}

// Helper function to verify extension token
async function verifyExtensionToken(token) {
  try {
    // First verify JWT signature and structure
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'extension') {
      throw new Error('Not an extension token');
    }

    // Check if token exists and is not revoked
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    
    const { data: tokenData, error } = await supabase
      .from('extension_tokens')
      .select('user_id, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !tokenData) {
      throw new Error('Token not found in database');
    }

    if (tokenData.revoked_at) {
      throw new Error('Token has been revoked');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Token has expired');
    }

    // Update last_used_at
    await supabase
      .from('extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    return {
      clerkUserId: decoded.sub,
      userId: tokenData.user_id,
      planType: decoded.plan
    };

  } catch (error) {
    throw new Error('Invalid extension token: ' + error.message);
  }
}

// Middleware to authenticate Clerk token
const authenticateClerkToken = async (req, res, next) => {
  try {
    console.log('middleware/auth.js: authenticateClerkToken middleware hit');
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('middleware/auth.js: Missing or invalid authorization header');
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    console.log('middleware/auth.js: Authorization header found.');

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // For development/testing, allow mock tokens
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
      req.auth = {
        clerkUserId: clerkUserId,
        isAdmin: false
      };
      return next();
    }

    let authResult;

    try {
      // Try extension token first
      console.log('middleware/auth.js: Attempting extension token verification...');
      authResult = await verifyExtensionToken(token);
      console.log('middleware/auth.js: Extension token verified successfully');
    } catch (extensionError) {
      console.log('middleware/auth.js: Extension token verification failed, trying other methods...');
      
      // Fall back to existing Clerk/JWT verification
      try {
        // First try custom JWT with clock tolerance
        const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 5 });
        authResult = { clerkUserId: decoded.clerkUserId };
        console.log('middleware/auth.js: Custom JWT token verified');
      } catch (jwtError) {
        console.log('middleware/auth.js: Custom JWT verification failed, trying Clerk token...');
        
        // Try Clerk token
        const clerkDecoded = await verifyClerkToken(token);
        authResult = { clerkUserId: clerkDecoded.clerkUserId };
        console.log('middleware/auth.js: Clerk token verified');
      }
    }

    if (!authResult || !authResult.clerkUserId) {
      console.error('middleware/auth.js: No valid authentication result');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify user exists in database (only if not already provided by extension token)
    if (!authResult.userId) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, clerk_id, plan_type')
        .eq('clerk_id', authResult.clerkUserId)
        .single();

      if (userError || !userData) {
        console.error('middleware/auth.js: User not found in database');
        return res.status(401).json({ error: 'User not found' });
      }
      
      authResult.userId = userData.id;
      authResult.planType = userData.plan_type;
    }

    console.log('middleware/auth.js: Authentication successful for user:', authResult.clerkUserId);

    // Add user info to request
    req.auth = {
      clerkUserId: authResult.clerkUserId,
      userId: authResult.userId,
      planType: authResult.planType,
      isAdmin: authResult.planType === 'admin'
    };

    next();
  } catch (error) {
    console.error('middleware/auth.js: Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to require admin access
const requireAdmin = (req, res, next) => {
  if (!req.auth || !req.auth.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = {
  authenticateClerkToken,
  requireAdmin
};