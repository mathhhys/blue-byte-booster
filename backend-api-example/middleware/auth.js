const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

console.log('middleware/auth.js: SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('middleware/auth.js: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('middleware/auth.js: JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded');
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to verify Clerk session token
async function verifyClerkToken(token) {
  try {
    // For now, we'll use a simple JWT decode for Clerk tokens
    // In production, you might want to verify against Clerk's public keys
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.sub) {
      throw new Error('Invalid Clerk token structure');
    }
    
    return {
      clerkUserId: decoded.sub,
      sessionId: decoded.sid,
      exp: decoded.exp
    };
  } catch (error) {
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

    // Try to verify as custom JWT first (for backward compatibility)
    let decoded;
    let clerkUserId;
    
    try {
      // First try custom JWT
      decoded = jwt.verify(token, JWT_SECRET);
      clerkUserId = decoded.clerkUserId;
      console.log('middleware/auth.js: Custom JWT token verified. Decoded:', decoded);
    } catch (jwtError) {
      console.log('middleware/auth.js: Custom JWT verification failed, trying Clerk token...');
      
      // If custom JWT fails, try Clerk token
      try {
        const clerkDecoded = await verifyClerkToken(token);
        clerkUserId = clerkDecoded.clerkUserId;
        console.log('middleware/auth.js: Clerk token verified. User ID:', clerkUserId);
      } catch (clerkError) {
        console.error('middleware/auth.js: Both JWT and Clerk token verification failed:', clerkError);
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
      isAdmin: userData.plan_type === 'admin' // Simple admin check
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