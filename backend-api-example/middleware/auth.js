const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('@clerk/backend');

console.log('middleware/auth.js: SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('middleware/auth.js: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('middleware/auth.js: CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Loaded' : 'Not Loaded');

// Helper function to verify Clerk session token using @clerk/backend
async function verifyClerkToken(token) {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('Missing CLERK_SECRET_KEY environment variable');
    }

    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    if (!claims.sub) {
      throw new Error('Invalid Clerk token: missing user ID');
    }

    return {
      clerkUserId: claims.sub,
      sessionId: claims.sid,
      exp: claims.exp,
      email: claims.email
    };
  } catch (error) {
    if (error.message.includes('expired')) {
      throw new Error('Clerk token has expired. Please generate a new token from the dashboard.');
    } else if (error.message.includes('invalid signature')) {
      throw new Error('Invalid Clerk token signature');
    } else if (error.message.includes('not before')) {
      throw new Error('Clerk token not yet valid');
    }
    throw new Error('Invalid Clerk token: ' + error.message);
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

    // Verify as Clerk token (primary method for new flow)
    let clerkUserId;
    let decoded;
    
    try {
      const clerkDecoded = await verifyClerkToken(token);
      clerkUserId = clerkDecoded.clerkUserId;
      decoded = clerkDecoded;
      console.log('middleware/auth.js: Clerk token verified. User ID:', clerkUserId);
    } catch (clerkError) {
      console.error('middleware/auth.js: Clerk token verification failed:', clerkError);
      
      // Backward compatibility: try custom JWT as fallback
      try {
        const jwt = require('jsonwebtoken');
        decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 5 });
        clerkUserId = decoded.clerkUserId || decoded.sub;
        console.log('middleware/auth.js: Custom JWT token verified (legacy). User ID:', clerkUserId);
      } catch (jwtError) {
        console.error('middleware/auth.js: Both Clerk and custom JWT verification failed:', jwtError);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!clerkUserId) {
      console.error('middleware/auth.js: Invalid token payload: missing clerkUserId');
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    console.log('middleware/auth.js: Clerk User ID from token:', clerkUserId);

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, plan_type')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      console.error('middleware/auth.js: User not found in database. Error:', userError, 'UserData:', userData);
      return res.status(401).json({ error: 'User not found' });
    }
    console.log('middleware/auth.js: User found in database. UserData:', userData);

    // Add user info to request
    req.auth = {
      clerkUserId: clerkUserId,
      userId: userData.id,
      planType: userData.plan_type,
      isAdmin: userData.plan_type === 'admin', // Simple admin check
      tokenDecoded: decoded
    };

    next();
  } catch (error) {
    console.error('middleware/auth.js: Auth middleware catch block error:', error);
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